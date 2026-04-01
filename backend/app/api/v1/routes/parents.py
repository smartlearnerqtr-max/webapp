from __future__ import annotations

from sqlalchemy import or_
from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import ParentProfile, ParentStudentLink, StudentLessonProgress, StudentProfile, User
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from ....utils.security import hash_password
from .. import api_v1


def _current_user() -> User | None:
    return User.query.get(get_jwt_identity())


def _require_teacher_user():
    if get_jwt().get('role') != 'teacher':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = _current_user()
    if not user or not user.teacher_profile:
        return None, error_response('Khong tim thay giao vien', 'TEACHER_NOT_FOUND', 404)
    return user, None


def _require_parent_user():
    if get_jwt().get('role') != 'parent':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = _current_user()
    if not user or not user.parent_profile:
        return None, error_response('Khong tim thay phu huynh', 'PARENT_NOT_FOUND', 404)
    return user, None


def _build_parent_payload(parent: ParentProfile) -> dict[str, object]:
    return {
        **parent.to_dict(),
        'email': parent.user.email if parent.user else None,
        'phone': parent.user.phone if parent.user else None,
    }


def _build_progress_summary(student_id: int) -> dict[str, object]:
    progresses = StudentLessonProgress.query.filter_by(student_id=student_id).all()
    latest_progress = sorted(progresses, key=lambda item: item.updated_at or item.created_at, reverse=True)
    last_item = latest_progress[0] if latest_progress else None
    return {
        'total_assignments': len(progresses),
        'completed_count': len([item for item in progresses if item.status == 'completed']),
        'in_progress_count': len([item for item in progresses if item.status == 'in_progress']),
        'last_assignment_title': last_item.assignment.lesson.title if last_item and last_item.assignment and last_item.assignment.lesson else None,
        'last_progress_percent': last_item.progress_percent if last_item else 0,
    }


def _create_parent_account(payload: dict[str, object]) -> tuple[User | None, object | None]:
    full_name = (payload.get('full_name') or '').strip()
    email = (payload.get('email') or '').strip().lower() or None
    phone = (payload.get('phone') or '').strip() or None
    relationship_label = (payload.get('relationship_label') or '').strip() or None
    password = (payload.get('password') or '123456').strip()

    if not full_name or (not email and not phone):
        return None, error_response('Can full_name va it nhat mot trong email hoac phone', 'VALIDATION_ERROR', 422)

    existing_user = User.query.filter(or_(User.email == email, User.phone == phone)).first()
    if existing_user:
        return None, error_response('Email hoac so dien thoai da ton tai', 'USER_EXISTS', 409)

    user = User(
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role='parent',
        status='active',
    )
    db.session.add(user)
    db.session.flush()

    parent = ParentProfile(
        user_id=user.id,
        full_name=full_name,
        relationship_label=relationship_label,
    )
    db.session.add(parent)
    db.session.flush()
    return user, None


@api_v1.get('/parents')
@jwt_required()
def list_parents():
    user, error = _require_teacher_user()
    if error:
        return error

    links = ParentStudentLink.query.filter_by(linked_by_teacher_id=user.teacher_profile.id, status='active').all()
    parent_map: dict[int, dict[str, object]] = {}
    for link in links:
        if not link.parent:
            continue
        parent_id = link.parent.id
        if parent_id not in parent_map:
            parent_map[parent_id] = {
                **_build_parent_payload(link.parent),
                'students': [],
            }
        if link.student:
            parent_map[parent_id]['students'].append(link.student.to_dict())

    return success_response(list(parent_map.values()))


@api_v1.post('/parents')
@jwt_required()
def create_parent():
    user, error = _require_teacher_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    parent_user, create_error = _create_parent_account(payload)
    if create_error:
        return create_error

    db.session.commit()
    log_server_event(level='info', module='parents', message='Tao phu huynh moi', action_name='create_parent', user_id=user.id, metadata={'parent_user_id': parent_user.id if parent_user else None})
    return success_response(_build_parent_payload(parent_user.parent_profile), 'Tao phu huynh thanh cong', 201)


@api_v1.get('/students/<int:student_id>/parents')
@jwt_required()
def list_student_parents(student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    student = StudentProfile.query.get(student_id)
    if not student or student.created_by_teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)

    payload = []
    for link in student.parent_links:
        if link.status != 'active' or not link.parent:
            continue
        payload.append({
            'link_id': link.id,
            'status': link.status,
            'parent': _build_parent_payload(link.parent),
        })
    return success_response(payload)


@api_v1.post('/students/<int:student_id>/parents/link')
@jwt_required()
def link_parent_to_student(student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    student = StudentProfile.query.get(student_id)
    if not student or student.created_by_teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    parent_profile = None
    parent_id = payload.get('parent_id')
    if parent_id:
        parent_profile = ParentProfile.query.get(int(parent_id))
        if not parent_profile:
            return error_response('Khong tim thay phu huynh', 'PARENT_NOT_FOUND', 404)
    else:
        parent_user, create_error = _create_parent_account(payload)
        if create_error:
            return create_error
        parent_profile = parent_user.parent_profile if parent_user else None

    existing_link = ParentStudentLink.query.filter_by(parent_id=parent_profile.id, student_id=student.id).first() if parent_profile else None
    if existing_link:
        existing_link.status = 'active'
        existing_link.linked_by_teacher_id = user.teacher_profile.id
        link = existing_link
    else:
        link = ParentStudentLink(
            parent_id=parent_profile.id,
            student_id=student.id,
            linked_by_teacher_id=user.teacher_profile.id,
            status='active',
        )
        db.session.add(link)

    db.session.commit()
    log_server_event(level='info', module='parents', message='Lien ket phu huynh voi hoc sinh', action_name='link_parent_student', user_id=user.id, metadata={'student_id': student.id, 'parent_id': parent_profile.id if parent_profile else None})
    return success_response({
        'link_id': link.id,
        'student': student.to_dict(),
        'parent': _build_parent_payload(parent_profile),
    }, 'Lien ket phu huynh thanh cong', 201)


@api_v1.get('/parent/my-children')
@jwt_required()
def get_my_children():
    user, error = _require_parent_user()
    if error:
        return error

    children = []
    for link in user.parent_profile.student_links:
        if link.status != 'active' or not link.student:
            continue
        active_classes = [class_link.classroom.to_dict() for class_link in link.student.classrooms if class_link.status == 'active' and class_link.classroom]
        children.append({
            'student': link.student.to_dict(),
            'classes': active_classes,
            'progress_summary': _build_progress_summary(link.student.id),
        })

    return success_response(children)
