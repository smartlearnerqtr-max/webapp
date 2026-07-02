from __future__ import annotations

import secrets

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from ....extensions import db
from ....models import ClassJoinCredential, ClassStudent, Classroom, StudentAccountBatch, StudentProfile, User
from ....services.assignment_delivery_service import ensure_student_has_active_assignments
from ....services.logger import log_server_event
from ....services.realtime_service import publish_realtime_event
from ....services.relationship_service import ensure_teacher_student_link, sync_legacy_teacher_student_links, teacher_has_student_access
from ....utils.responses import error_response, success_response
from .. import api_v1


CLASS_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
ALLOWED_CLASS_UI_VARIANTS = {
    Classroom.UI_VARIANT_STANDARD,
    Classroom.UI_VARIANT_VISUAL_SUPPORT,
}
ALLOWED_VISUAL_THEMES = {
    Classroom.VISUAL_THEME_GARDEN,
    Classroom.VISUAL_THEME_OCEAN,
    Classroom.VISUAL_THEME_COSMOS,
}


def _require_teacher_user():
    if get_jwt().get('role') != 'teacher':
        return None, error_response('Không có quyền truy cập', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response('Không tìm thấy giáo viên', 'TEACHER_NOT_FOUND', 404)
    return user, None


def _require_student_user():
    if get_jwt().get('role') != 'student':
        return None, error_response('Không có quyền truy cập', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.student_profile:
        return None, error_response('Không tìm thấy học sinh', 'STUDENT_NOT_FOUND', 404)
    return user, None


def _generate_join_password(length: int = 8) -> str:
    return ''.join(secrets.choice(CLASS_PASSWORD_ALPHABET) for _ in range(length))


def _ensure_join_credential(classroom: Classroom) -> None:
    if classroom.join_credential:
        return
    db.session.add(ClassJoinCredential(class_id=classroom.id, join_password=_generate_join_password()))
    db.session.flush()


def _serialize_teacher_classroom(classroom: Classroom) -> dict[str, object]:
    return classroom.to_dict(include_join_credentials=True)


def _serialize_student_classroom(classroom: Classroom) -> dict[str, object]:
    payload = classroom.to_dict()
    payload['teacher'] = classroom.teacher.to_dict() if classroom.teacher else None
    return payload


def _resolve_class_ui_variant(raw_value: object) -> str:
    if not isinstance(raw_value, str):
        return Classroom.UI_VARIANT_STANDARD
    normalized_value = raw_value.strip().lower()
    if normalized_value in ALLOWED_CLASS_UI_VARIANTS:
        return normalized_value
    return Classroom.UI_VARIANT_STANDARD


def _resolve_visual_theme(raw_value: object) -> str:
    if not isinstance(raw_value, str):
        return Classroom.VISUAL_THEME_GARDEN
    normalized_value = raw_value.strip().lower()
    if normalized_value in ALLOWED_VISUAL_THEMES:
        return normalized_value
    return Classroom.VISUAL_THEME_GARDEN


def _resolve_background_image_url(raw_value: object) -> str | None:
    if not isinstance(raw_value, str):
        return None
    normalized_value = raw_value.strip()
    return normalized_value or None


def _get_student_user_ids(student_ids: list[int]) -> list[int]:
    if not student_ids:
        return []
    students = StudentProfile.query.filter(StudentProfile.id.in_(student_ids)).all()
    return sorted({student.user_id for student in students if student.user_id})


def _get_parent_user_ids(student_ids: list[int]) -> list[int]:
    if not student_ids:
        return []
    students = StudentProfile.query.filter(StudentProfile.id.in_(student_ids)).all()
    parent_user_ids: set[int] = set()
    for student in students:
        for link in student.parent_links:
            if link.status == 'active' and link.parent and link.parent.user_id:
                parent_user_ids.add(int(link.parent.user_id))
    return sorted(parent_user_ids)


def _publish_auto_assignment_events(
    *,
    teacher_user_id: int,
    classroom: Classroom,
    student: StudentProfile,
    assignment_count: int,
    recipient_user_ids: list[int],
) -> None:
    if assignment_count <= 0:
        return

    payload = {
        'source': 'class_sync',
        'class_id': classroom.id,
        'class_name': classroom.name,
        'student_id': student.id,
        'student_name': student.full_name,
        'assignment_count': assignment_count,
    }

    publish_realtime_event(
        'assignment_created',
        f'Học sinh {student.full_name} đã được nhận tự động {assignment_count} bài đang mở của lớp {classroom.name}.',
        title='Tự động bổ sung bài tập',
        recipient_user_ids=[teacher_user_id],
        payload=payload,
    )

    if recipient_user_ids:
        publish_realtime_event(
            'assignment_created',
            f'Bạn vừa nhận {assignment_count} bài đang hoạt động của lớp {classroom.name}.',
            title='Bài tập mới đã sẵn sàng',
            recipient_user_ids=recipient_user_ids,
            payload=payload,
        )


@api_v1.get('/classes')
@jwt_required()
def list_classes():
    user, error = _require_teacher_user()
    if error:
        return error
    status = request.args.get('status')
    query = Classroom.query.options(joinedload(Classroom.join_credential)).filter_by(teacher_id=user.teacher_profile.id)
    if status:
        query = query.filter_by(status=status)
    classrooms = query.order_by(Classroom.created_at.desc()).all()
    for classroom in classrooms:
        _ensure_join_credential(classroom)
    db.session.commit()
    return success_response([_serialize_teacher_classroom(item) for item in classrooms])


@api_v1.post('/classes')
@jwt_required()
def create_class():
    user, error = _require_teacher_user()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    name = (payload.get('name') or '').strip()
    if not name:
        return error_response('Tên lớp không được để trống', 'VALIDATION_ERROR', 422)
    classroom = Classroom(
        teacher_id=user.teacher_profile.id,
        name=name,
        grade_label=payload.get('grade_label'),
        description=payload.get('description'),
        default_disability_level=payload.get('default_disability_level'),
        ui_variant=_resolve_class_ui_variant(payload.get('ui_variant')),
        visual_theme=_resolve_visual_theme(payload.get('visual_theme')),
        background_image_url=_resolve_background_image_url(payload.get('background_image_url')),
        status=payload.get('status') or 'active',
    )
    db.session.add(classroom)
    db.session.flush()
    _ensure_join_credential(classroom)
    db.session.commit()
    log_server_event(level='info', module='classes', message='Tạo lớp học mới', action_name='create_class', user_id=user.id, metadata={'class_id': classroom.id})
    return success_response(_serialize_teacher_classroom(classroom), 'Tạo lớp thành công', 201)


@api_v1.get('/classes/<int:class_id>')
@jwt_required()
def get_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
    _ensure_join_credential(classroom)
    db.session.commit()
    return success_response(_serialize_teacher_classroom(classroom))


@api_v1.put('/classes/<int:class_id>')
@jwt_required()
def update_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    for field in ['name', 'grade_label', 'description', 'default_disability_level', 'status']:
        if field in payload:
            setattr(classroom, field, payload.get(field))
    if 'ui_variant' in payload:
        classroom.ui_variant = _resolve_class_ui_variant(payload.get('ui_variant'))
    if 'visual_theme' in payload:
        classroom.visual_theme = _resolve_visual_theme(payload.get('visual_theme'))
    if 'background_image_url' in payload:
        classroom.background_image_url = _resolve_background_image_url(payload.get('background_image_url'))
    _ensure_join_credential(classroom)
    db.session.commit()
    return success_response(_serialize_teacher_classroom(classroom), 'Cập nhật lớp thành công')


@api_v1.delete('/classes/<int:class_id>')
@jwt_required()
def archive_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
    classroom.status = 'archived'
    _ensure_join_credential(classroom)
    db.session.commit()
    return success_response(_serialize_teacher_classroom(classroom), 'Đã lưu trữ lớp')


@api_v1.get('/classes/<int:class_id>/students')
@jwt_required()
def list_class_students(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
    return success_response([link.to_dict() for link in classroom.students if link.status == 'active'])


@api_v1.post('/classes/<int:class_id>/students')
@jwt_required()
def add_students_to_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)

    if sync_legacy_teacher_student_links(user.teacher_profile.id):
        db.session.flush()

    payload = request.get_json(silent=True) or {}
    student_ids = payload.get('student_ids') or []
    if payload.get('student_id'):
        student_ids.append(payload['student_id'])
    unique_student_ids = [int(item) for item in dict.fromkeys(student_ids) if item]
    if not unique_student_ids:
        return error_response('Vui lòng chọn ít nhất một học sinh', 'VALIDATION_ERROR', 422)

    links = []
    invalid_student_ids = []
    students_by_id: dict[int, StudentProfile] = {}
    for sid in unique_student_ids:
        student = StudentProfile.query.get(sid)
        if not teacher_has_student_access(user.teacher_profile.id, student):
            invalid_student_ids.append(sid)
            continue
        students_by_id[sid] = student
        class_link = ClassStudent.query.filter_by(class_id=class_id, student_id=sid).first()
        if not class_link:
            class_link = ClassStudent(class_id=class_id, student_id=sid, status='active')
            db.session.add(class_link)
        else:
            class_link.status = 'active'
        ensure_teacher_student_link(user.teacher_profile.id, sid, source='class_manual_add')
        links.append(class_link)

    if invalid_student_ids:
        return error_response(
            'Chỉ được thêm học sinh đã có liên kết với giáo viên này',
            'CLASS_STUDENT_FORBIDDEN',
            422,
            {'student_ids': invalid_student_ids},
        )

    student_levels = {student.disability_level for student in students_by_id.values() if student.disability_level}
    if len(student_levels) > 1:
        return error_response('Chỉ được thêm học sinh cùng một mức độ vào một lớp.', 'MIXED_LEVEL_CLASS_STUDENTS', 422)
    if classroom.default_disability_level and student_levels and classroom.default_disability_level not in student_levels:
        return error_response('Mức độ của học sinh không khớp với mức độ của lớp.', 'CLASS_LEVEL_MISMATCH', 422)
    if not classroom.default_disability_level and len(student_levels) == 1:
        classroom.default_disability_level = next(iter(student_levels))

    auto_assignment_count = 0
    for sid in unique_student_ids:
        student = students_by_id[sid]
        created_assignments = ensure_student_has_active_assignments(classroom, sid)
        auto_assignment_count += len(created_assignments)
        recipient_user_ids = [uid for uid in [student.user_id, *_get_parent_user_ids([sid])] if uid]
        _publish_auto_assignment_events(
            teacher_user_id=user.id,
            classroom=classroom,
            student=student,
            assignment_count=len(created_assignments),
            recipient_user_ids=recipient_user_ids,
        )

    student_user_ids = _get_student_user_ids(unique_student_ids)
    publish_realtime_event(
        'class_membership_updated',
        f'Lớp {classroom.name} vừa được cập nhật học sinh.',
        title='Cập nhật lớp học',
        recipient_user_ids=[user.id, *student_user_ids],
        payload={'class_id': class_id, 'class_name': classroom.name, 'student_ids': unique_student_ids, 'auto_assignment_count': auto_assignment_count},
    )

    db.session.commit()
    log_server_event(level='info', module='classes', message='Thêm học sinh vào lớp', action_name='add_students_to_class', user_id=user.id, metadata={'class_id': class_id, 'student_ids': unique_student_ids})
    return success_response([link.to_dict() for link in links], 'Thêm học sinh vào lớp thành công', 201)


@api_v1.post('/classes/<int:class_id>/student-batches/join')
@jwt_required()
def add_student_batch_to_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    batch_code = (payload.get('batch_code') or '').strip().upper()
    if not batch_code:
        return error_response('Vui lòng nhập mã danh sách học sinh', 'VALIDATION_ERROR', 422)

    batch = StudentAccountBatch.query.filter_by(code=batch_code, status='active').first()
    if not batch:
        return error_response('Mã danh sách học sinh không tồn tại hoặc đã bị khóa', 'STUDENT_BATCH_NOT_FOUND', 404)

    active_members = [member for member in batch.members if member.status == 'active' and member.student]
    batch_levels = {member.student.disability_level for member in active_members if member.student.disability_level}
    if len(batch_levels) > 1:
        return error_response('Danh sách học sinh này có nhiều mức độ. Vui lòng tách thành từng danh sách nhẹ, trung bình hoặc nặng.', 'MIXED_LEVEL_BATCH', 422)
    if classroom.default_disability_level and batch_levels and classroom.default_disability_level not in batch_levels:
        return error_response('Mức độ của danh sách học sinh không khớp với mức độ của lớp.', 'CLASS_LEVEL_MISMATCH', 422)
    if not classroom.default_disability_level and len(batch_levels) == 1:
        classroom.default_disability_level = next(iter(batch_levels))

    links = []
    added_student_ids = []
    existing_count = 0
    for member in active_members:
        student = member.student
        class_link = ClassStudent.query.filter_by(class_id=classroom.id, student_id=student.id).first()
        if not class_link:
            class_link = ClassStudent(class_id=classroom.id, student_id=student.id, status='active')
            db.session.add(class_link)
            added_student_ids.append(student.id)
        else:
            if class_link.status == 'active':
                existing_count += 1
            class_link.status = 'active'
        ensure_teacher_student_link(user.teacher_profile.id, student.id, source='admin_student_batch')
        links.append(class_link)

    db.session.commit()

    publish_realtime_event(
        'class_membership_updated',
        f'Lớp {classroom.name} vừa được thêm danh sách học sinh từ mã {batch.code}.',
        title='Cập nhật lớp học',
        recipient_user_ids=[user.id, *_get_student_user_ids(added_student_ids)],
        payload={'class_id': class_id, 'class_name': classroom.name, 'student_ids': added_student_ids, 'batch_code': batch.code},
    )
    log_server_event(
        level='info',
        module='classes',
        message='Giáo viên thêm danh sách học sinh bằng mã admin',
        action_name='add_student_batch_to_class',
        user_id=user.id,
        metadata={'class_id': class_id, 'batch_code': batch.code, 'added_count': len(added_student_ids), 'existing_count': existing_count},
    )

    return success_response({
        'classroom': _serialize_teacher_classroom(classroom),
        'batch': batch.to_dict(),
        'links': [link.to_dict() for link in links],
        'added_count': len(added_student_ids),
        'existing_count': existing_count,
    }, 'Đã thêm danh sách học sinh vào lớp')


@api_v1.delete('/classes/<int:class_id>/students/<int:student_id>')
@jwt_required()
def remove_student_from_class(class_id: int, student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
    link = ClassStudent.query.filter_by(class_id=class_id, student_id=student_id).first()
    if not link:
        return error_response('Học sinh không nằm trong lớp', 'CLASS_STUDENT_NOT_FOUND', 404)
    link.status = 'inactive'
    db.session.commit()
    return success_response(None, 'Đã xóa học sinh khỏi lớp')


@api_v1.get('/my/classes')
@jwt_required()
def list_my_classes():
    user, error = _require_student_user()
    if error:
        return error
    # Sử dụng joinedload để lấy lớp và giáo viên trong 1 lần query duy nhất
    class_links = ClassStudent.query.options(
        joinedload(ClassStudent.classroom).joinedload(Classroom.teacher)
    ).filter_by(student_id=user.student_profile.id, status='active').all()

    classes = [
        _serialize_student_classroom(link.classroom)
        for link in class_links
        if link.classroom and link.classroom.status == 'active'
    ]
    return success_response(classes)


@api_v1.post('/my/classes/join')
@jwt_required()
def join_class_by_credentials():
    user, error = _require_student_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    class_id = payload.get('class_id')
    class_password = (payload.get('class_password') or '').strip().upper()
    if not class_id or not class_password:
        return error_response('Cần nhập class_id và class_password', 'VALIDATION_ERROR', 422)

    try:
        class_id = int(class_id)
    except (TypeError, ValueError):
        return error_response('class_id không hợp lệ', 'VALIDATION_ERROR', 422)

    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.status != 'active':
        return error_response('Không tìm thấy lớp học', 'CLASS_NOT_FOUND', 404)
    _ensure_join_credential(classroom)
    if not classroom.join_credential or classroom.join_credential.join_password != class_password:
        return error_response('Mật khẩu vào lớp không đúng', 'CLASS_JOIN_FAILED', 422)

    student = user.student_profile
    link = ClassStudent.query.filter_by(class_id=classroom.id, student_id=student.id).first()
    created = False
    if not link:
        link = ClassStudent(class_id=classroom.id, student_id=student.id, status='active')
        db.session.add(link)
        created = True
    else:
        link.status = 'active'

    ensure_teacher_student_link(classroom.teacher_id, student.id, source='class_join')

    created_assignments = ensure_student_has_active_assignments(classroom, student.id)
    teacher_user_id = classroom.teacher.user_id if classroom.teacher and classroom.teacher.user_id else None
    parent_user_ids = _get_parent_user_ids([student.id])

    publish_realtime_event(
        'class_membership_updated',
        f'Học sinh {student.full_name} vừa vào lớp {classroom.name}.',
        title='Học sinh vào lớp',
        recipient_user_ids=[uid for uid in [user.id, teacher_user_id] if uid],
        payload={
            'class_id': classroom.id,
            'class_name': classroom.name,
            'student_id': student.id,
            'student_name': student.full_name,
            'auto_assignment_count': len(created_assignments),
        },
    )
    _publish_auto_assignment_events(
        teacher_user_id=teacher_user_id or 0,
        classroom=classroom,
        student=student,
        assignment_count=len(created_assignments),
        recipient_user_ids=[uid for uid in [user.id, *parent_user_ids] if uid],
    )

    db.session.commit()
    log_server_event(
        level='info',
        module='classes',
        message='Học sinh tự tham gia lớp học',
        action_name='student_join_class',
        user_id=user.id,
        metadata={'class_id': classroom.id, 'student_id': student.id},
    )
    return success_response(
        {
            'classroom': _serialize_student_classroom(classroom),
            'student': student.to_dict(),
            'class_join_status': 'created' if created else 'reactivated',
        },
        'Tham gia lớp học thành công',
        201 if created else 200,
    )
