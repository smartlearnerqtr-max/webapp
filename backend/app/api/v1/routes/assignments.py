from __future__ import annotations

from datetime import datetime, UTC

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload, selectinload

from ....extensions import db
from ....models import Classroom, ClassStudent, Lesson, LessonAssignment, LessonAssignmentStudent, ParentStudentLink, StudentLessonProgress, StudentProfile, Subject, TeacherProfile, User
from ....services.github_snapshot_service import JsonSnapshotPersistError, persist_json_snapshot
from ....services.logger import log_server_event
from ....services.realtime_service import publish_realtime_event
from ....utils.responses import error_response, success_response
from .. import api_v1

VALID_TARGET_TYPES = {'class', 'group', 'student'}


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        # Handling ISO format from frontend (e.g., 2024-04-08T10:00:00Z)
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None


def _current_user():
    return User.query.get(get_jwt_identity())


def _require_teacher_user():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Không có quyền truy cập", "AUTH_FORBIDDEN", 403)
    user = _current_user()
    if not user or not user.teacher_profile:
        return None, error_response("Không tìm thấy giáo viên", "TEACHER_NOT_FOUND", 404)
    return user, None


def _persist_json_snapshot_or_error(action_name: str):
    try:
        persist_json_snapshot(action_name)
    except JsonSnapshotPersistError as error:
        db.session.rollback()
        return error_response(str(error), 'JSON_SNAPSHOT_PERSIST_FAILED', 502, error.details)
    return None


def _require_student_user():
    if get_jwt().get("role") != "student":
        return None, error_response("Không có quyền truy cập", "AUTH_FORBIDDEN", 403)
    user = _current_user()
    if not user or not user.student_profile:
        return None, error_response("Không tìm thấy học sinh", "STUDENT_NOT_FOUND", 404)
    return user, None


def _get_teacher_assignment(assignment_id: int, teacher_id: int) -> LessonAssignment | None:
    assignment = LessonAssignment.query.get(assignment_id)
    if not assignment or assignment.assigned_by_teacher_id != teacher_id:
        return None
    return assignment


def _get_active_class_student_ids(classroom: Classroom) -> list[int]:
    return [link.student_id for link in classroom.students if link.status == 'active']


def _get_active_class_students(classroom: Classroom) -> list[StudentProfile]:
    students: list[StudentProfile] = []
    for link in classroom.students:
        if link.status != 'active' or not link.student:
            continue
        students.append(link.student)
    return students


def _get_student_user_ids(student_ids: list[int]) -> list[int]:
    if not student_ids:
        return []
    students = StudentProfile.query.filter(StudentProfile.id.in_(student_ids)).all()
    return sorted({student.user_id for student in students if student.user_id})


def _get_parent_user_ids(student_ids: list[int]) -> list[int]:
    if not student_ids:
        return []
    links = ParentStudentLink.query.filter(ParentStudentLink.student_id.in_(student_ids), ParentStudentLink.status == 'active').all()
    return sorted({link.parent.user_id for link in links if link.parent and link.parent.user_id})


def _get_teacher_user_id(teacher_id: int | None) -> int | None:
    if not teacher_id:
        return None
    teacher = TeacherProfile.query.get(teacher_id)
    if not teacher or not teacher.user_id:
        return None
    return int(teacher.user_id)


def _get_assignment_recipient_user_ids(assignment: LessonAssignment) -> list[int]:
    student_ids = [item.student_id for item in assignment.students]
    recipient_ids = set(_get_student_user_ids(student_ids))
    recipient_ids.update(_get_parent_user_ids(student_ids))
    teacher_user_id = _get_teacher_user_id(assignment.assigned_by_teacher_id)
    if teacher_user_id:
        recipient_ids.add(teacher_user_id)
    return sorted(recipient_ids)


def _publish_assignment_progress_event(progress: StudentLessonProgress, event_type: str, message: str) -> None:
    assignment = progress.assignment
    recipient_ids = set()
    teacher_user_id = _get_teacher_user_id(assignment.assigned_by_teacher_id) if assignment else None
    if teacher_user_id:
        recipient_ids.add(teacher_user_id)
    recipient_ids.update(_get_student_user_ids([progress.student_id]))
    recipient_ids.update(_get_parent_user_ids([progress.student_id]))
    publish_realtime_event(
        event_type,
        message,
        title='Cập nhật tiến độ',
        recipient_user_ids=sorted(recipient_ids),
        payload={
            'assignment_id': progress.assignment_id,
            'student_id': progress.student_id,
            'progress_percent': progress.progress_percent,
            'status': progress.status,
            'source': 'progress_update',
        },
    )


def _calculate_readiness(progress: StudentLessonProgress) -> dict[str, object]:
    reasons: list[str] = []
    status = 'dang_phu_hop'

    if progress.status != 'completed' and progress.help_count >= 3:
        status = 'can_ho_tro_them'
        reasons.append('Học sinh cần trợ giúp nhiều trong khi bài học chưa hoàn thành.')
    elif progress.completion_score >= 80 and progress.retry_count <= 1 and progress.help_count <= 1 and progress.progress_percent >= 100:
        status = 'san_sang_nang_do_kho'
        reasons.append('Học sinh hoàn thành tốt, ít cần trợ giúp và có thể thử mức khó cao hơn.')
    else:
        reasons.append('Học sinh đang học ổn định ở mức hiện tại, nên tiếp tục theo dõi thêm.')

    if progress.retry_count >= 3:
        status = 'can_ho_tro_them'
        reasons.append('Số lần học lại cao, cần thêm hướng dẫn trước khi nâng độ khó.')
    if progress.completion_score < 50 and progress.progress_percent >= 50:
        status = 'can_ho_tro_them'
        reasons.append('Điểm hoàn thành thấp so với tiến độ hiện tại.')

    return {'readiness_status': status, 'readiness_reasons': reasons}


@api_v1.get('/assignments')
@jwt_required()
def list_assignments():
    user, error = _require_teacher_user()
    if error:
        return error
    query = LessonAssignment.query.options(
        joinedload(LessonAssignment.lesson),
        joinedload(LessonAssignment.classroom),
        joinedload(LessonAssignment.subject)
    ).filter_by(assigned_by_teacher_id=user.teacher_profile.id)
    if request.args.get('class_id'):
        query = query.filter_by(class_id=int(request.args['class_id']))
    assignments = query.order_by(LessonAssignment.created_at.desc()).all()
    return success_response([assignment.to_dict() for assignment in assignments])


@api_v1.post('/assignments')
@jwt_required()
def create_assignment():
    user, error = _require_teacher_user()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    lesson = Lesson.query.get(payload.get('lesson_id'))
    classroom = Classroom.query.get(payload.get('class_id'))
    target_type = payload.get('target_type') or 'class'

    if not lesson or lesson.created_by_teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)
    if not classroom or classroom.teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
    if target_type not in VALID_TARGET_TYPES:
        return error_response('Loại giao bài không hợp lệ', 'VALIDATION_ERROR', 422)

    subject_id = int(payload.get('subject_id') or lesson.subject_id)
    subject = Subject.query.get(subject_id)
    if not subject:
        return error_response('Không tìm thấy môn học', 'SUBJECT_NOT_FOUND', 404)
    if subject_id != lesson.subject_id:
        return error_response('Môn học giao bài phải trùng với môn của bài học', 'ASSIGNMENT_SUBJECT_MISMATCH', 422)

    class_student_ids = _get_active_class_student_ids(classroom)
    active_students = _get_active_class_students(classroom)
    lesson_level = (lesson.primary_level or '').strip()
    requested_student_ids = [int(item) for item in (payload.get('student_ids') or []) if item]
    if target_type == 'class' and not requested_student_ids:
        if lesson_level:
            final_student_ids = [student.id for student in active_students if student.disability_level == lesson_level]
        else:
            final_student_ids = class_student_ids
    else:
        invalid_student_ids = [student_id for student_id in requested_student_ids if student_id not in class_student_ids]
        if invalid_student_ids:
            return error_response('Chỉ được giao cho học sinh đang thuộc lớp mục tiêu', 'ASSIGNMENT_STUDENT_NOT_IN_CLASS', 422, {'student_ids': invalid_student_ids})
        if lesson_level:
            student_level_map = {student.id: student.disability_level for student in active_students}
            mismatched_student_ids = [student_id for student_id in requested_student_ids if student_level_map.get(student_id) != lesson_level]
            if mismatched_student_ids:
                return error_response(
                    'Bài học chỉ được giao cho học sinh cùng mức độ với bài học',
                    'ASSIGNMENT_LEVEL_MISMATCH',
                    422,
                    {'student_ids': mismatched_student_ids, 'lesson_level': lesson_level},
                )
        final_student_ids = list(dict.fromkeys(requested_student_ids))

    if not final_student_ids:
        if lesson_level:
            return error_response(
                'Lớp này chưa có học sinh phù hợp với mức độ của bài học',
                'ASSIGNMENT_NO_MATCHING_LEVEL_STUDENTS',
                422,
                {'lesson_level': lesson_level},
            )
        return error_response('Cần có ít nhất một học sinh để giao bài', 'VALIDATION_ERROR', 422)

    assignment = LessonAssignment(
        lesson_id=lesson.id,
        class_id=classroom.id,
        subject_id=subject.id,
        assigned_by_teacher_id=user.teacher_profile.id,
        target_type=target_type,
        due_at=_parse_date(payload.get('due_at')),
        required_completion_percent=payload.get('required_completion_percent') or 100,
        status=payload.get('status') or 'active',
    )
    db.session.add(assignment)
    db.session.flush()

    for student_id in final_student_ids:
        db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=student_id))
        db.session.add(
            StudentLessonProgress(
                assignment_id=assignment.id,
                student_id=student_id,
                status='not_started',
                progress_percent=0,
            )
        )

    student_user_ids = _get_student_user_ids(final_student_ids)
    parent_user_ids = _get_parent_user_ids(final_student_ids)
    publish_realtime_event(
        'assignment_created',
        f'Đã giao bài {lesson.title} cho lớp {classroom.name}.',
        title='Bài tập mới',
        recipient_user_ids=[user.id],
        payload={'assignment_id': assignment.id, 'class_id': classroom.id, 'class_name': classroom.name, 'lesson_id': lesson.id, 'lesson_title': lesson.title, 'student_count': len(final_student_ids), 'source': 'manual'},
    )
    if student_user_ids:
        publish_realtime_event(
            'assignment_created',
            f'Bạn vừa nhận bài mới: {lesson.title}.',
            title='Bài tập mới',
            recipient_user_ids=student_user_ids,
            payload={'assignment_id': assignment.id, 'class_id': classroom.id, 'class_name': classroom.name, 'lesson_id': lesson.id, 'lesson_title': lesson.title, 'student_count': len(final_student_ids), 'source': 'manual'},
        )
    if parent_user_ids:
        publish_realtime_event(
            'assignment_created',
            f'Có bài tập mới được giao cho học sinh trong lớp {classroom.name}.',
            title='Cập nhật học tập',
            recipient_user_ids=parent_user_ids,
            payload={'assignment_id': assignment.id, 'class_id': classroom.id, 'class_name': classroom.name, 'lesson_id': lesson.id, 'lesson_title': lesson.title, 'student_count': len(final_student_ids), 'source': 'manual'},
        )

    db.session.flush()
    persist_error = _persist_json_snapshot_or_error('create_assignment')
    if persist_error:
        return persist_error
    db.session.commit()
    log_server_event(
        level='info',
        module='assignments',
        message='Giao bài học',
        action_name='create_assignment',
        user_id=user.id,
        metadata={'assignment_id': assignment.id, 'class_id': classroom.id, 'student_count': len(final_student_ids)},
    )
    return success_response(assignment.to_dict(), 'Giao bài học thành công', 201)


@api_v1.get('/assignments/<int:assignment_id>')
@jwt_required()
def get_assignment(assignment_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    assignment = _get_teacher_assignment(assignment_id, user.teacher_profile.id)
    if not assignment:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)
    return success_response(assignment.to_dict())


@api_v1.put('/assignments/<int:assignment_id>')
@jwt_required()
def update_assignment(assignment_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    assignment = _get_teacher_assignment(assignment_id, user.teacher_profile.id)
    if not assignment:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    for field in ['due_at', 'required_completion_percent', 'status']:
        if field in payload:
            val = payload.get(field)
            if field == 'due_at':
                val = _parse_date(val)
            setattr(assignment, field, val)
    publish_realtime_event(
        'assignment_updated',
        f'Assignment {assignment.id} vừa được cập nhật.',
        title='Cập nhật assignment',
        recipient_user_ids=_get_assignment_recipient_user_ids(assignment),
        payload={'assignment_id': assignment.id, 'status': assignment.status},
    )
    db.session.flush()
    persist_error = _persist_json_snapshot_or_error('update_assignment')
    if persist_error:
        return persist_error
    db.session.commit()
    return success_response(assignment.to_dict(), 'Cập nhật assignment thành công')


@api_v1.post('/assignments/<int:assignment_id>/close')
@jwt_required()
def close_assignment(assignment_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    assignment = _get_teacher_assignment(assignment_id, user.teacher_profile.id)
    if not assignment:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)
    assignment.status = 'closed'
    publish_realtime_event(
        'assignment_closed',
        f'Assignment {assignment.id} đã đóng.',
        title='Đóng assignment',
        recipient_user_ids=_get_assignment_recipient_user_ids(assignment),
        payload={'assignment_id': assignment.id, 'status': assignment.status},
    )
    db.session.flush()
    persist_error = _persist_json_snapshot_or_error('close_assignment')
    if persist_error:
        return persist_error
    db.session.commit()
    return success_response(assignment.to_dict(), 'Đã đóng assignment')


@api_v1.get('/assignments/<int:assignment_id>/progress')
@jwt_required()
def get_assignment_progress(assignment_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    # Load progresses và student_profile cùng lúc bằng selectinload/joinedload
    assignment = LessonAssignment.query.options(
        selectinload(LessonAssignment.progresses).joinedload(StudentLessonProgress.student)
    ).get(assignment_id)

    if not assignment or assignment.assigned_by_teacher_id != user.teacher_profile.id:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)

    progresses = []
    for progress in sorted(assignment.progresses, key=lambda item: item.created_at or datetime.now(UTC), reverse=True):
        payload = progress.to_dict()
        payload.update(_calculate_readiness(progress))
        progresses.append(payload)

    return success_response(
        {
            'assignment': assignment.to_dict(),
            'progresses': progresses,
            'summary': {
                'student_count': len(progresses),
                'completed_count': len([item for item in progresses if item['status'] == 'completed']),
                'in_progress_count': len([item for item in progresses if item['status'] == 'in_progress']),
                'need_support_count': len([item for item in progresses if item['readiness_status'] == 'can_ho_tro_them']),
                'ready_to_increase_count': len([item for item in progresses if item['readiness_status'] == 'san_sang_nang_do_kho']),
            },
        }
    )


@api_v1.get('/my/assignments')
@jwt_required()
def list_my_assignments():
    user, error = _require_student_user()
    if error:
        return error
    # Load assignment, lesson và classroom ngay từ đầu
    progresses = StudentLessonProgress.query.options(
        joinedload(StudentLessonProgress.assignment).joinedload(LessonAssignment.lesson),
        joinedload(StudentLessonProgress.assignment).joinedload(LessonAssignment.classroom)
    ).filter_by(student_id=user.student_profile.id).order_by(StudentLessonProgress.created_at.desc()).all()
    data = [{**progress.to_dict(), 'assignment': progress.assignment.to_dict() if progress.assignment else None} for progress in progresses]
    return success_response(data)


@api_v1.get('/my/assignments/<int:assignment_id>')
@jwt_required()
def get_my_assignment(assignment_id: int):
    user, error = _require_student_user()
    if error:
        return error
    progress = StudentLessonProgress.query.filter_by(assignment_id=assignment_id, student_id=user.student_profile.id).first()
    if not progress:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)
    assignment = progress.assignment
    payload = progress.to_dict()
    payload['assignment'] = assignment.to_dict() if assignment else None
    payload['lesson'] = assignment.lesson.to_dict(include_activities=True) if assignment and assignment.lesson else None
    payload.update(_calculate_readiness(progress))
    return success_response(payload)


@api_v1.post('/my/assignments/<int:assignment_id>/start')
@jwt_required()
def start_my_assignment(assignment_id: int):
    user, error = _require_student_user()
    if error:
        return error
    progress = StudentLessonProgress.query.filter_by(assignment_id=assignment_id, student_id=user.student_profile.id).first()
    if not progress:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)
    if progress.status == 'completed':
        progress.retry_count += 1
        progress.progress_percent = 0
        progress.completion_score = 0
        progress.reward_star_count = 0
        progress.completed_at = None
    progress.status = 'in_progress'
    _publish_assignment_progress_event(
        progress,
        'assignment_progress_updated',
        f'Tiến độ bài học {assignment_id} vừa {"được làm lại từ đầu" if progress.retry_count > 0 else "bắt đầu"}.',
    )
    db.session.commit()
    return success_response(progress.to_dict(), 'Bắt đầu bài học thành công')


@api_v1.post('/my/assignments/<int:assignment_id>/progress')
@jwt_required()
def update_my_assignment_progress(assignment_id: int):
    user, error = _require_student_user()
    if error:
        return error
    progress = StudentLessonProgress.query.filter_by(assignment_id=assignment_id, student_id=user.student_profile.id).first()
    if not progress:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    for field in ['progress_percent', 'total_learning_seconds', 'retry_count', 'help_count', 'reward_star_count', 'completion_score']:
        if field in payload and payload.get(field) is not None:
            setattr(progress, field, int(payload.get(field)))
    if payload.get('status') in {'not_started', 'in_progress', 'completed'}:
        progress.status = payload['status']
    _publish_assignment_progress_event(progress, 'assignment_progress_updated', f'Tiến độ bài học {assignment_id} vừa được cập nhật.')
    db.session.commit()
    return success_response(progress.to_dict(), 'Cập nhật tiến độ thành công')


@api_v1.post('/my/assignments/<int:assignment_id>/complete')
@jwt_required()
def complete_my_assignment(assignment_id: int):
    user, error = _require_student_user()
    if error:
        return error
    progress = StudentLessonProgress.query.filter_by(assignment_id=assignment_id, student_id=user.student_profile.id).first()
    if not progress:
        return error_response('Không tìm thấy assignment', 'ASSIGNMENT_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    requested_completion_score = payload.get('completion_score')
    requested_reward_star_count = payload.get('reward_star_count')
    requested_total_learning_seconds = payload.get('total_learning_seconds')
    progress.status = 'completed'
    progress.progress_percent = 100
    if requested_total_learning_seconds is not None:
        progress.total_learning_seconds = max(progress.total_learning_seconds, int(requested_total_learning_seconds))
    if requested_completion_score is not None:
        progress.completion_score = max(0, min(100, int(requested_completion_score)))
    else:
        progress.completion_score = max(progress.completion_score, 100)
    if requested_reward_star_count is not None:
        progress.reward_star_count = max(0, min(3, int(requested_reward_star_count)))
    else:
        progress.reward_star_count = max(progress.reward_star_count, 3)
    progress.completed_at = datetime.now(UTC)
    _publish_assignment_progress_event(progress, 'assignment_completed', f'Bài học {assignment_id} đã hoàn thành.')
    db.session.commit()
    return success_response(progress.to_dict(), 'Đã hoàn thành bài học')
