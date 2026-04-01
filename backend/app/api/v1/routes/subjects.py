from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import ClassSubject, Classroom, Subject, User
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1


def _require_teacher_user():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Khong co quyen truy cap", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response("Khong tim thay giao vien", "TEACHER_NOT_FOUND", 404)
    return user, None


@api_v1.get("/subjects")
def list_subjects():
    subjects = Subject.query.order_by(Subject.sort_order.asc(), Subject.name.asc()).all()
    return success_response([subject.to_dict() for subject in subjects])


@api_v1.post("/subjects")
@jwt_required()
def create_subject():
    _, error = _require_teacher_user()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    code = (payload.get("code") or "").strip().upper()
    name = (payload.get("name") or "").strip()
    if not code or not name:
        return error_response("Du lieu mon hoc khong hop le", "VALIDATION_ERROR", 422)
    if Subject.query.filter_by(code=code).first():
        return error_response("Ma mon hoc da ton tai", "SUBJECT_CODE_EXISTS", 409)
    subject = Subject(code=code, name=name, description=payload.get("description"), sort_order=payload.get("sort_order") or 0, is_active=payload.get("is_active", True))
    db.session.add(subject)
    db.session.commit()
    log_server_event(level="info", module="subjects", message="Tao mon hoc moi", action_name="create_subject", user_id=get_jwt_identity(), metadata={"subject_id": subject.id})
    return success_response(subject.to_dict(), "Tao mon hoc thanh cong", 201)


@api_v1.put("/subjects/<int:subject_id>")
@jwt_required()
def update_subject(subject_id: int):
    _, error = _require_teacher_user()
    if error:
        return error
    subject = Subject.query.get(subject_id)
    if not subject:
        return error_response("Khong tim thay mon hoc", "SUBJECT_NOT_FOUND", 404)
    payload = request.get_json(silent=True) or {}
    for field in ["name", "description", "sort_order", "is_active"]:
        if field in payload:
            setattr(subject, field, payload.get(field))
    db.session.commit()
    return success_response(subject.to_dict(), "Cap nhat mon hoc thanh cong")


@api_v1.get("/classes/<int:class_id>/subjects")
@jwt_required()
def list_class_subjects(class_id: int):
    classroom = Classroom.query.get(class_id)
    if not classroom:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    return success_response([link.to_dict() for link in classroom.subjects])


@api_v1.post("/classes/<int:class_id>/subjects")
@jwt_required()
def add_subject_to_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    payload = request.get_json(silent=True) or {}
    subject = Subject.query.get(payload.get("subject_id"))
    if not subject:
        return error_response("Khong tim thay mon hoc", "SUBJECT_NOT_FOUND", 404)
    if ClassSubject.query.filter_by(class_id=class_id, subject_id=subject.id).first():
        return error_response("Mon hoc da co trong lop", "CLASS_SUBJECT_EXISTS", 409)
    link = ClassSubject(class_id=class_id, subject_id=subject.id, sort_order=payload.get("sort_order") or 0, is_active=payload.get("is_active", True))
    db.session.add(link)
    db.session.commit()
    log_server_event(level="info", module="subjects", message="Gan mon hoc vao lop", action_name="add_subject_to_class", user_id=user.id, metadata={"class_id": class_id, "subject_id": subject.id})
    return success_response(link.to_dict(), "Gan mon hoc vao lop thanh cong", 201)


@api_v1.delete("/classes/<int:class_id>/subjects/<int:subject_id>")
@jwt_required()
def remove_subject_from_class(class_id: int, subject_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    link = ClassSubject.query.filter_by(class_id=class_id, subject_id=subject_id).first()
    if not link:
        return error_response("Khong tim thay mon hoc trong lop", "CLASS_SUBJECT_NOT_FOUND", 404)
    db.session.delete(link)
    db.session.commit()
    return success_response(None, "Da go mon hoc khoi lop")
