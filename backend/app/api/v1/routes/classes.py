from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import ClassStudent, Classroom, StudentProfile, User
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


@api_v1.get("/classes")
@jwt_required()
def list_classes():
    user, error = _require_teacher_user()
    if error:
        return error
    status = request.args.get("status")
    query = Classroom.query.filter_by(teacher_id=user.teacher_profile.id)
    if status:
        query = query.filter_by(status=status)
    classrooms = query.order_by(Classroom.created_at.desc()).all()
    return success_response([item.to_dict() for item in classrooms])


@api_v1.post("/classes")
@jwt_required()
def create_class():
    user, error = _require_teacher_user()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return error_response("Ten lop khong duoc de trong", "VALIDATION_ERROR", 422)
    classroom = Classroom(teacher_id=user.teacher_profile.id, name=name, grade_label=payload.get("grade_label"), description=payload.get("description"), default_disability_level=payload.get("default_disability_level"), status=payload.get("status") or "active")
    db.session.add(classroom)
    db.session.commit()
    log_server_event(level="info", module="classes", message="Tao lop hoc moi", action_name="create_class", user_id=user.id, metadata={"class_id": classroom.id})
    return success_response(classroom.to_dict(), "Tao lop thanh cong", 201)


@api_v1.get("/classes/<int:class_id>")
@jwt_required()
def get_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    return success_response(classroom.to_dict())


@api_v1.put("/classes/<int:class_id>")
@jwt_required()
def update_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    payload = request.get_json(silent=True) or {}
    for field in ["name", "grade_label", "description", "default_disability_level", "status"]:
        if field in payload:
            setattr(classroom, field, payload.get(field))
    db.session.commit()
    return success_response(classroom.to_dict(), "Cap nhat lop thanh cong")


@api_v1.delete("/classes/<int:class_id>")
@jwt_required()
def archive_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    classroom.status = "archived"
    db.session.commit()
    return success_response(classroom.to_dict(), "Da luu tru lop")


@api_v1.get("/classes/<int:class_id>/students")
@jwt_required()
def list_class_students(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    return success_response([link.to_dict() for link in classroom.students if link.status == "active"])


@api_v1.post("/classes/<int:class_id>/students")
@jwt_required()
def add_students_to_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    payload = request.get_json(silent=True) or {}
    student_ids = payload.get("student_ids") or []
    if payload.get("student_id"):
        student_ids.append(payload["student_id"])
    student_ids = [int(item) for item in student_ids if item]
    if not student_ids:
        return error_response("Vui long chon it nhat mot hoc sinh", "VALIDATION_ERROR", 422)
    links = []
    for sid in dict.fromkeys(student_ids):
        student = StudentProfile.query.get(sid)
        if not student:
            continue
        link = ClassStudent.query.filter_by(class_id=class_id, student_id=sid).first()
        if not link:
            link = ClassStudent(class_id=class_id, student_id=sid, status="active")
            db.session.add(link)
        else:
            link.status = "active"
        links.append(link)
    db.session.commit()
    log_server_event(level="info", module="classes", message="Them hoc sinh vao lop", action_name="add_students_to_class", user_id=user.id, metadata={"class_id": class_id, "student_ids": student_ids})
    return success_response([link.to_dict() for link in links], "Them hoc sinh vao lop thanh cong", 201)


@api_v1.delete("/classes/<int:class_id>/students/<int:student_id>")
@jwt_required()
def remove_student_from_class(class_id: int, student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay lop", "CLASS_NOT_FOUND", 404)
    link = ClassStudent.query.filter_by(class_id=class_id, student_id=student_id).first()
    if not link:
        return error_response("Hoc sinh khong nam trong lop", "CLASS_STUDENT_NOT_FOUND", 404)
    link.status = "inactive"
    db.session.commit()
    return success_response(None, "Da xoa hoc sinh khoi lop")
