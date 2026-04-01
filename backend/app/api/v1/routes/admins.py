from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....models import TeacherParentStudentLink, TeacherStudentLink, User
from ....services.auth_service import create_teacher_user
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1


def _require_admin_user():
    if get_jwt().get('role') != 'admin':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'admin':
        return None, error_response('Khong tim thay admin', 'ADMIN_NOT_FOUND', 404)
    return user, None


def _build_teacher_payload(teacher_user: User) -> dict[str, object]:
    return {
        'user': teacher_user.to_dict(),
        'profile': teacher_user.teacher_profile.to_dict() if teacher_user.teacher_profile else None,
    }


@api_v1.get('/admin/teachers')
@jwt_required()
def list_teachers():
    user, error = _require_admin_user()
    if error:
        return error
    query = User.query.filter_by(role='teacher')
    if request.args.get('status'):
        query = query.filter_by(status=request.args['status'])
    teachers = query.order_by(User.created_at.desc()).all()
    payload = [_build_teacher_payload(teacher) for teacher in teachers]
    return success_response(payload)


@api_v1.get('/admin/relationships/overview')
@jwt_required()
def get_relationship_overview():
    user, error = _require_admin_user()
    if error:
        return error

    teachers = User.query.filter_by(role='teacher').order_by(User.created_at.desc()).all()
    active_teacher_student_links = TeacherStudentLink.query.filter_by(status='active').all()
    active_parent_group_links = TeacherParentStudentLink.query.filter_by(status='active').all()

    teacher_payload = []
    for teacher in teachers:
        teacher_profile = teacher.teacher_profile
        if not teacher_profile:
            continue
        student_links = [link for link in active_teacher_student_links if link.teacher_id == teacher_profile.id]
        parent_links = [link for link in active_parent_group_links if link.teacher_id == teacher_profile.id]
        shared_student_count = len([
            link for link in student_links
            if len([peer for peer in active_teacher_student_links if peer.student_id == link.student_id]) > 1
        ])
        teacher_payload.append({
            'teacher': _build_teacher_payload(teacher),
            'student_count': len(student_links),
            'parent_group_count': len(parent_links),
            'shared_student_count': shared_student_count,
        })

    shared_students_map: dict[int, dict[str, object]] = {}
    for link in active_teacher_student_links:
        if not link.student or not link.teacher:
            continue
        entry = shared_students_map.setdefault(link.student_id, {
            'student': link.student.to_dict(),
            'teachers': [],
        })
        entry['teachers'].append({
            'id': link.teacher.id,
            'full_name': link.teacher.full_name,
            'school_name': link.teacher.school_name,
        })

    shared_students = [item for item in shared_students_map.values() if len(item['teachers']) > 1]
    shared_students.sort(key=lambda item: str(item['student']['full_name']).lower())

    return success_response({
        'summary': {
            'teacher_count': len(teacher_payload),
            'teacher_student_link_count': len(active_teacher_student_links),
            'teacher_parent_group_count': len(active_parent_group_links),
            'shared_student_count': len(shared_students),
        },
        'teachers': teacher_payload,
        'shared_students': shared_students,
    })


@api_v1.post('/admin/teachers')
@jwt_required()
def create_teacher():
    user, error = _require_admin_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    created_payload, error_message, error_code = create_teacher_user(payload)
    if error_message or not created_payload:
        return error_response(error_message or 'Khong tao duoc tai khoan giao vien', error_code or 'VALIDATION_ERROR', 422 if error_code == 'VALIDATION_ERROR' else 409)

    log_server_event(level='info', module='admin', message='Admin tao tai khoan giao vien', action_name='admin_create_teacher', user_id=user.id, metadata={'teacher_user_id': created_payload['user']['id']})
    return success_response(created_payload, 'Tao tai khoan giao vien thanh cong', 201)
