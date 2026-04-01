from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import StudentProfile, TeacherParentStudentLink, TeacherProfile, TeacherStudentLink, User
from ....services.logger import log_server_event
from ....services.relationship_service import ensure_teacher_student_link, sync_legacy_teacher_student_links, teacher_has_student_access
from ....utils.responses import error_response, success_response
from .. import api_v1


def _build_teacher_payload(teacher: TeacherProfile) -> dict[str, object]:
    return {
        **teacher.to_dict(),
        'email': teacher.user.email if teacher.user else None,
        'phone': teacher.user.phone if teacher.user else None,
    }


def _serialize_student_teacher_links(student: StudentProfile) -> list[dict[str, object]]:
    links = TeacherStudentLink.query.filter_by(student_id=student.id, status='active').all()
    payload = []
    for link in links:
        if not link.teacher:
            continue
        active_class_count = len([
            class_link for class_link in student.classrooms
            if class_link.status == 'active' and class_link.classroom and class_link.classroom.status == 'active' and class_link.classroom.teacher_id == link.teacher_id
        ])
        payload.append({
            'link_id': link.id,
            'teacher': _build_teacher_payload(link.teacher),
            'source': link.source,
            'active_class_count': active_class_count,
        })
    payload.sort(key=lambda item: str(item['teacher']['full_name']).lower())
    return payload


def _serialize_shared_students_for_teacher(teacher_id: int) -> list[dict[str, object]]:
    own_links = TeacherStudentLink.query.filter_by(teacher_id=teacher_id, status='active').all()
    payload = []
    for own_link in own_links:
        student = own_link.student
        if not student:
            continue
        active_links = TeacherStudentLink.query.filter_by(student_id=student.id, status='active').all()
        if len(active_links) <= 1:
            continue

        teacher_items = []
        for active_link in active_links:
            if not active_link.teacher:
                continue
            teacher_items.append({
                'id': active_link.teacher.id,
                'full_name': active_link.teacher.full_name,
                'school_name': active_link.teacher.school_name,
                'email': active_link.teacher.user.email if active_link.teacher.user else None,
                'phone': active_link.teacher.user.phone if active_link.teacher.user else None,
                'is_current_teacher': active_link.teacher_id == teacher_id,
            })
        teacher_items.sort(key=lambda item: str(item['full_name']).lower())
        peer_teachers = [item for item in teacher_items if not item['is_current_teacher']]
        my_active_class_count = len([
            class_link for class_link in student.classrooms
            if class_link.status == 'active'
            and class_link.classroom
            and class_link.classroom.status == 'active'
            and class_link.classroom.teacher_id == teacher_id
        ])
        parent_group_count = TeacherParentStudentLink.query.filter_by(
            teacher_id=teacher_id,
            student_id=student.id,
            status='active',
        ).count()
        payload.append({
            'student': student.to_dict(),
            'teachers': teacher_items,
            'peer_teachers': peer_teachers,
            'my_active_class_count': my_active_class_count,
            'parent_group_count': parent_group_count,
        })

    payload.sort(key=lambda item: str(item['student']['full_name']).lower())
    return payload


def _require_teacher():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Khong co quyen truy cap", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response("Khong tim thay giao vien", "TEACHER_NOT_FOUND", 404)
    return user, None


def _require_student():
    if get_jwt().get('role') != 'student':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.student_profile:
        return None, error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)
    return user, None


@api_v1.get("/students")
@jwt_required()
def list_students():
    user, error = _require_teacher()
    if error:
        return error

    if sync_legacy_teacher_student_links(user.teacher_profile.id):
        db.session.commit()

    level = request.args.get("level")
    query = TeacherStudentLink.query.filter_by(teacher_id=user.teacher_profile.id, status='active').join(StudentProfile)
    if level:
        query = query.filter(StudentProfile.disability_level == level)
    links = query.order_by(StudentProfile.full_name.asc()).all()
    students = [link.student.to_dict() for link in links if link.student]
    return success_response(students)


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
    student = StudentProfile(
        full_name=full_name,
        disability_level=disability_level,
        support_note=payload.get("support_note"),
        preferred_input=payload.get("preferred_input") or "touch",
        preferred_read_speed=payload.get("preferred_read_speed"),
        preferred_font_size=payload.get("preferred_font_size"),
        preferred_bg_color=payload.get("preferred_bg_color"),
        created_by_teacher_id=user.teacher_profile.id,
    )
    db.session.add(student)
    db.session.flush()
    ensure_teacher_student_link(user.teacher_profile.id, student.id, source='teacher_created')
    db.session.commit()
    log_server_event(level="info", module="students", message="Tao hoc sinh moi", action_name="create_student", user_id=user.id, metadata={"student_id": student.id})
    return success_response(student.to_dict(), "Tao hoc sinh thanh cong", 201)


@api_v1.get('/students/<int:student_id>/teachers')
@jwt_required()
def get_student_teachers(student_id: int):
    role = get_jwt().get('role')
    student = StudentProfile.query.get(student_id)
    if not student:
        return error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)

    if role == 'teacher':
        user, error = _require_teacher()
        if error:
            return error
        if not teacher_has_student_access(user.teacher_profile.id, student):
            return error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)
        db.session.commit()
    elif role == 'student':
        user, error = _require_student()
        if error:
            return error
        if user.student_profile.id != student.id:
            return error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    elif role == 'admin':
        user = User.query.get(get_jwt_identity())
        if not user or user.role != 'admin':
            return error_response('Khong tim thay admin', 'ADMIN_NOT_FOUND', 404)
    else:
        return error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)

    return success_response(_serialize_student_teacher_links(student))


@api_v1.get('/my/teachers')
@jwt_required()
def list_my_teachers():
    user, error = _require_student()
    if error:
        return error
    return success_response(_serialize_student_teacher_links(user.student_profile))


@api_v1.get('/teacher/shared-students')
@jwt_required()
def list_teacher_shared_students():
    user, error = _require_teacher()
    if error:
        return error

    if sync_legacy_teacher_student_links(user.teacher_profile.id):
        db.session.commit()

    return success_response(_serialize_shared_students_for_teacher(user.teacher_profile.id))


@api_v1.get("/students/<int:student_id>")
@jwt_required()
def get_student(student_id: int):
    user, error = _require_teacher()
    if error:
        return error
    student = StudentProfile.query.get(student_id)
    if not teacher_has_student_access(user.teacher_profile.id, student):
        return error_response("Khong tim thay hoc sinh", "STUDENT_NOT_FOUND", 404)
    db.session.commit()
    return success_response(student.to_dict())


@api_v1.put("/students/<int:student_id>")
@jwt_required()
def update_student(student_id: int):
    user, error = _require_teacher()
    if error:
        return error
    student = StudentProfile.query.get(student_id)
    if not teacher_has_student_access(user.teacher_profile.id, student):
        return error_response("Khong tim thay hoc sinh", "STUDENT_NOT_FOUND", 404)
    payload = request.get_json(silent=True) or {}
    for field in ["full_name", "support_note", "preferred_input", "preferred_read_speed", "preferred_font_size", "preferred_bg_color", "avatar_url"]:
        if field in payload:
            setattr(student, field, payload.get(field))
    if payload.get("disability_level") in {"nang", "trung_binh", "nhe"}:
        student.disability_level = payload["disability_level"]
    db.session.commit()
    return success_response(student.to_dict(), "Cap nhat hoc sinh thanh cong")
