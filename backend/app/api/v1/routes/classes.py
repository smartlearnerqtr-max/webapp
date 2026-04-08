from __future__ import annotations

import secrets

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from ....extensions import db
from ....models import ClassJoinCredential, ClassStudent, Classroom, StudentProfile, User
from ....services.assignment_delivery_service import ensure_student_has_active_assignments
from ....services.logger import log_server_event
from ....services.realtime_service import publish_realtime_event
from ....services.relationship_service import ensure_teacher_student_link, sync_legacy_teacher_student_links, teacher_has_student_access
from ....utils.responses import error_response, success_response
from .. import api_v1


CLASS_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _require_teacher_user():
    if get_jwt().get('role') != 'teacher':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response('Khong tim thay giao vien', 'TEACHER_NOT_FOUND', 404)
    return user, None


def _require_student_user():
    if get_jwt().get('role') != 'student':
        return None, error_response('Khong co quyen truy cap', 'AUTH_FORBIDDEN', 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.student_profile:
        return None, error_response('Khong tim thay hoc sinh', 'STUDENT_NOT_FOUND', 404)
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
        f'Hoc sinh {student.full_name} da duoc nhan tu dong {assignment_count} bai dang mo cua lop {classroom.name}.',
        title='Tu dong bo sung bai tap',
        recipient_user_ids=[teacher_user_id],
        payload=payload,
    )

    if recipient_user_ids:
        publish_realtime_event(
            'assignment_created',
            f'Ban vua nhan {assignment_count} bai dang hoat dong cua lop {classroom.name}.',
            title='Bai tap moi da san sang',
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
        return error_response('Ten lop khong duoc de trong', 'VALIDATION_ERROR', 422)
    classroom = Classroom(
        teacher_id=user.teacher_profile.id,
        name=name,
        grade_label=payload.get('grade_label'),
        description=payload.get('description'),
        default_disability_level=payload.get('default_disability_level'),
        status=payload.get('status') or 'active',
    )
    db.session.add(classroom)
    db.session.flush()
    _ensure_join_credential(classroom)
    db.session.commit()
    log_server_event(level='info', module='classes', message='Tao lop hoc moi', action_name='create_class', user_id=user.id, metadata={'class_id': classroom.id})
    return success_response(_serialize_teacher_classroom(classroom), 'Tao lop thanh cong', 201)


@api_v1.get('/classes/<int:class_id>')
@jwt_required()
def get_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay lop', 'CLASS_NOT_FOUND', 404)
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
        return error_response('Khong tim thay lop', 'CLASS_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    for field in ['name', 'grade_label', 'description', 'default_disability_level', 'status']:
        if field in payload:
            setattr(classroom, field, payload.get(field))
    _ensure_join_credential(classroom)
    db.session.commit()
    return success_response(_serialize_teacher_classroom(classroom), 'Cap nhat lop thanh cong')


@api_v1.delete('/classes/<int:class_id>')
@jwt_required()
def archive_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay lop', 'CLASS_NOT_FOUND', 404)
    classroom.status = 'archived'
    _ensure_join_credential(classroom)
    db.session.commit()
    return success_response(_serialize_teacher_classroom(classroom), 'Da luu tru lop')


@api_v1.get('/classes/<int:class_id>/students')
@jwt_required()
def list_class_students(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay lop', 'CLASS_NOT_FOUND', 404)
    return success_response([link.to_dict() for link in classroom.students if link.status == 'active'])


@api_v1.post('/classes/<int:class_id>/students')
@jwt_required()
def add_students_to_class(class_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay lop', 'CLASS_NOT_FOUND', 404)

    if sync_legacy_teacher_student_links(user.teacher_profile.id):
        db.session.flush()

    payload = request.get_json(silent=True) or {}
    student_ids = payload.get('student_ids') or []
    if payload.get('student_id'):
        student_ids.append(payload['student_id'])
    unique_student_ids = [int(item) for item in dict.fromkeys(student_ids) if item]
    if not unique_student_ids:
        return error_response('Vui long chon it nhat mot hoc sinh', 'VALIDATION_ERROR', 422)

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
            'Chi duoc them hoc sinh da co lien ket voi giao vien nay',
            'CLASS_STUDENT_FORBIDDEN',
            422,
            {'student_ids': invalid_student_ids},
        )

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
        f'Lop {classroom.name} vua duoc cap nhat hoc sinh.',
        title='Cap nhat lop hoc',
        recipient_user_ids=[user.id, *student_user_ids],
        payload={'class_id': class_id, 'class_name': classroom.name, 'student_ids': unique_student_ids, 'auto_assignment_count': auto_assignment_count},
    )

    db.session.commit()
    log_server_event(level='info', module='classes', message='Them hoc sinh vao lop', action_name='add_students_to_class', user_id=user.id, metadata={'class_id': class_id, 'student_ids': unique_student_ids})
    return success_response([link.to_dict() for link in links], 'Them hoc sinh vao lop thanh cong', 201)


@api_v1.delete('/classes/<int:class_id>/students/<int:student_id>')
@jwt_required()
def remove_student_from_class(class_id: int, student_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Khong tim thay lop', 'CLASS_NOT_FOUND', 404)
    link = ClassStudent.query.filter_by(class_id=class_id, student_id=student_id).first()
    if not link:
        return error_response('Hoc sinh khong nam trong lop', 'CLASS_STUDENT_NOT_FOUND', 404)
    link.status = 'inactive'
    db.session.commit()
    return success_response(None, 'Da xoa hoc sinh khoi lop')


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
        return error_response('Can nhap class_id va class_password', 'VALIDATION_ERROR', 422)

    try:
        class_id = int(class_id)
    except (TypeError, ValueError):
        return error_response('class_id khong hop le', 'VALIDATION_ERROR', 422)

    classroom = Classroom.query.get(class_id)
    if not classroom or classroom.status != 'active':
        return error_response('Khong tim thay lop hoc', 'CLASS_NOT_FOUND', 404)
    _ensure_join_credential(classroom)
    if not classroom.join_credential or classroom.join_credential.join_password != class_password:
        return error_response('Mat khau vao lop khong dung', 'CLASS_JOIN_FAILED', 422)

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
        f'Hoc sinh {student.full_name} vua vao lop {classroom.name}.',
        title='Hoc sinh vao lop',
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
        message='Hoc sinh tu tham gia lop hoc',
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
        'Tham gia lop hoc thanh cong',
        201 if created else 200,
    )
