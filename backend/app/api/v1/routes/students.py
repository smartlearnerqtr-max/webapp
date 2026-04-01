from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import StudentProfile, User
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1


def _require_teacher():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Khong co quyen truy cap", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response("Khong tim thay giao vien", "TEACHER_NOT_FOUND", 404)
    return user, None


@api_v1.get("/students")
@jwt_required()
def list_students():
    user, error = _require_teacher()
    if error:
        return error
    level = request.args.get("level")
    query = StudentProfile.query.filter_by(created_by_teacher_id=user.teacher_profile.id)
    if level:
        query = query.filter_by(disability_level=level)
    students = query.order_by(StudentProfile.full_name.asc()).all()
    return success_response([student.to_dict() for student in students])


@api_v1.post("/students")
@jwt_required()
def create_student():
    user, error = _require_teacher()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("full_name") or "").strip()
    disability_level = (payload.get("disability_level") or "").strip()
    if not full_name or disability_level not in {"nang", "trung_binh", "nhe"}:
        return error_response("Du lieu hoc sinh khong hop le", "VALIDATION_ERROR", 422)
    student = StudentProfile(full_name=full_name, disability_level=disability_level, support_note=payload.get("support_note"), preferred_input=payload.get("preferred_input") or "touch", preferred_read_speed=payload.get("preferred_read_speed"), preferred_font_size=payload.get("preferred_font_size"), preferred_bg_color=payload.get("preferred_bg_color"), created_by_teacher_id=user.teacher_profile.id)
    db.session.add(student)
    db.session.commit()
    log_server_event(level="info", module="students", message="Tao hoc sinh moi", action_name="create_student", user_id=user.id, metadata={"student_id": student.id})
    return success_response(student.to_dict(), "Tao hoc sinh thanh cong", 201)


@api_v1.get("/students/<int:student_id>")
@jwt_required()
def get_student(student_id: int):
    student = StudentProfile.query.get(student_id)
    if not student:
        return error_response("Khong tim thay hoc sinh", "STUDENT_NOT_FOUND", 404)
    return success_response(student.to_dict())


@api_v1.put("/students/<int:student_id>")
@jwt_required()
def update_student(student_id: int):
    user, error = _require_teacher()
    if error:
        return error
    student = StudentProfile.query.get(student_id)
    if not student or student.created_by_teacher_id != user.teacher_profile.id:
        return error_response("Khong tim thay hoc sinh", "STUDENT_NOT_FOUND", 404)
    payload = request.get_json(silent=True) or {}
    for field in ["full_name", "support_note", "preferred_input", "preferred_read_speed", "preferred_font_size", "preferred_bg_color", "avatar_url"]:
        if field in payload:
            setattr(student, field, payload.get(field))
    if payload.get("disability_level") in {"nang", "trung_binh", "nhe"}:
        student.disability_level = payload["disability_level"]
    db.session.commit()
    return success_response(student.to_dict(), "Cap nhat hoc sinh thanh cong")
