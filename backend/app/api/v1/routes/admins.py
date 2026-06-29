from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import TeacherParentStudentLink, TeacherStudentLink, User
from ....services.auth_service import create_teacher_user
from ....services.logger import log_server_event
from ....utils.security import hash_password
from ....utils.responses import error_response, success_response
from .. import api_v1


def _require_admin_user():
    if get_jwt().get('role') != 'admin':
        return None, error_response('Không có quyền truy cập', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or user.role != 'admin':
        return None, error_response('Không tìm thấy admin', 'ADMIN_NOT_FOUND', 404)
    return user, None


def _build_teacher_payload(teacher_user: User) -> dict[str, object]:
    return {
        'user': teacher_user.to_dict(),
        'profile': teacher_user.teacher_profile.to_dict() if teacher_user.teacher_profile else None,
    }


def _account_username(user: User) -> str | None:
    return user.email or user.phone


def _build_recovery_account_payload(user: User) -> dict[str, object]:
    profile = user.teacher_profile if user.role == 'teacher' else user.student_profile
    profile_payload = profile.to_dict() if profile else None
    return {
        'user': user.to_dict(),
        'profile': profile_payload,
        'full_name': profile_payload.get('full_name') if profile_payload else None,
        'username': _account_username(user),
        'can_login': bool(_account_username(user)),
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


@api_v1.get('/admin/account-recovery')
@jwt_required()
def list_recoverable_accounts():
    _user, error = _require_admin_user()
    if error:
        return error

    query = User.query.filter(User.role.in_(('teacher', 'student')))
    role = (request.args.get('role') or '').strip()
    status = (request.args.get('status') or '').strip()
    if role in {'teacher', 'student'}:
        query = query.filter_by(role=role)
    if status:
        query = query.filter_by(status=status)

    accounts = query.order_by(User.role.asc(), User.created_at.desc()).all()
    return success_response([_build_recovery_account_payload(account) for account in accounts])


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
        return error_response(error_message or 'Không tạo được tài khoản giáo viên', error_code or 'VALIDATION_ERROR', 422 if error_code == 'VALIDATION_ERROR' else 409)

    log_server_event(level='info', module='admin', message='Admin tạo tài khoản giáo viên', action_name='admin_create_teacher', user_id=user.id, metadata={'teacher_user_id': created_payload['user']['id']})
    return success_response(created_payload, 'Tạo tài khoản giáo viên thành công', 201)


@api_v1.post('/admin/users/<int:user_id>/recover')
@jwt_required()
def recover_account(user_id: int):
    admin_user, error = _require_admin_user()
    if error:
        return error

    target_user = User.query.get(user_id)
    if not target_user or target_user.role not in {'teacher', 'student'}:
        return error_response('Không tìm thấy tài khoản giáo viên hoặc học sinh', 'USER_NOT_FOUND', 404)

    username = _account_username(target_user)
    if not username:
        return error_response('Tài khoản này chưa có email hoặc số điện thoại để đăng nhập', 'USERNAME_MISSING', 422)

    payload = request.get_json(silent=True) or {}
    temporary_password = (payload.get('temporary_password') or 'Demo123456').strip()
    if len(temporary_password) < 6:
        return error_response('Mật khẩu tạm thời cần tối thiểu 6 ký tự', 'VALIDATION_ERROR', 422)

    target_user.password_hash = hash_password(temporary_password)
    target_user.status = 'active'
    db.session.commit()

    log_server_event(
        level='warning',
        module='admin',
        message='Admin khôi phục mật khẩu tài khoản',
        action_name='admin_recover_account',
        user_id=admin_user.id,
        metadata={'target_user_id': target_user.id, 'target_role': target_user.role},
    )
    return success_response({
        'account': _build_recovery_account_payload(target_user),
        'username': username,
        'temporary_password': temporary_password,
    }, 'Khôi phục tài khoản thành công')
