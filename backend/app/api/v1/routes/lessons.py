from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import Classroom, Lesson, LessonActivity, Subject, User
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1

VALID_LEVELS = {"nang", "trung_binh", "nhe"}
VALID_ACTIVITY_TYPES = {
    "multiple_choice",
    "image_choice",
    "matching",
    "drag_drop",
    "listen_choose",
    "watch_answer",
    "step_by_step",
    "aac",
    "image_puzzle",
    "hidden_image_guess",
    "memory_match",
    "quick_tap",
    "size_order",
    "habitat_match",
    "basket_toss",
    "trash_cleanup",
    "career_simulation",
    "ai_chat",
}


def _require_teacher_user():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Không có quyền truy cập", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response("Không tìm thấy giáo viên", "TEACHER_NOT_FOUND", 404)
    return user, None


def _get_teacher_lesson(lesson_id: int, teacher_id: int) -> Lesson | None:
    lesson = Lesson.query.get(lesson_id)
    if not lesson or lesson.created_by_teacher_id != teacher_id:
        return None
    return lesson


def _get_teacher_activity(activity_id: int, teacher_id: int) -> LessonActivity | None:
    activity = LessonActivity.query.get(activity_id)
    if not activity or not activity.lesson or activity.lesson.created_by_teacher_id != teacher_id:
        return None
    return activity


def _ordered_lesson_activities(lesson: Lesson) -> list[LessonActivity]:
    return sorted(lesson.activities, key=lambda item: (item.sort_order, item.id))


def _place_activity_at_sort_order(lesson: Lesson, activity: LessonActivity, requested_sort_order: int | None) -> None:
    ordered_activities = [item for item in _ordered_lesson_activities(lesson) if item.id != activity.id]
    target_sort_order = len(ordered_activities) + 1 if requested_sort_order is None else int(requested_sort_order)
    target_sort_order = max(1, min(target_sort_order, len(ordered_activities) + 1))
    ordered_activities.insert(target_sort_order - 1, activity)
    for index, item in enumerate(ordered_activities, start=1):
        item.sort_order = index


def _normalize_lesson_activity_sort_orders(lesson: Lesson) -> None:
    for index, item in enumerate(_ordered_lesson_activities(lesson), start=1):
        item.sort_order = index


@api_v1.get('/lessons')
@jwt_required()
def list_lessons():
    user, error = _require_teacher_user()
    if error:
        return error
    query = Lesson.query.filter_by(created_by_teacher_id=user.teacher_profile.id, is_archived=False)
    if request.args.get('subject_id'):
        query = query.filter_by(subject_id=int(request.args['subject_id']))
    if request.args.get('primary_level'):
        query = query.filter_by(primary_level=request.args['primary_level'])
    lessons = query.order_by(Lesson.created_at.desc()).all()
    return success_response([lesson.to_dict() for lesson in lessons])


@api_v1.post('/lessons')
@jwt_required()
def create_lesson():
    user, error = _require_teacher_user()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    title = (payload.get('title') or '').strip()
    primary_level = (payload.get('primary_level') or '').strip()
    subject_id = payload.get('subject_id')
    if not title or primary_level not in VALID_LEVELS or not subject_id:
        return error_response('Dữ liệu bài học không hợp lệ', 'VALIDATION_ERROR', 422)

    subject = Subject.query.get(int(subject_id))
    if not subject:
        return error_response('Không tìm thấy môn học', 'SUBJECT_NOT_FOUND', 404)

    class_id = payload.get('class_id')
    classroom = None
    if class_id:
        classroom = Classroom.query.get(int(class_id))
        if not classroom or classroom.teacher_id != user.teacher_profile.id:
            return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)

    lesson = Lesson(
        created_by_teacher_id=user.teacher_profile.id,
        subject_id=subject.id,
        class_id=classroom.id if classroom else None,
        title=title,
        description=payload.get('description'),
        primary_level=primary_level,
        estimated_minutes=payload.get('estimated_minutes'),
        difficulty_stage=payload.get('difficulty_stage') or 1,
        is_published=payload.get('is_published', False),
        is_archived=False,
    )
    db.session.add(lesson)
    db.session.commit()
    log_server_event(level='info', module='lessons', message='Tạo bài học mới', action_name='create_lesson', user_id=user.id, metadata={'lesson_id': lesson.id})
    return success_response(lesson.to_dict(), 'Tạo bài học thành công', 201)


@api_v1.get('/lessons/<int:lesson_id>')
@jwt_required()
def get_lesson(lesson_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    lesson = _get_teacher_lesson(lesson_id, user.teacher_profile.id)
    if not lesson:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)
    return success_response(lesson.to_dict(include_activities=True))


@api_v1.put('/lessons/<int:lesson_id>')
@jwt_required()
def update_lesson(lesson_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    lesson = _get_teacher_lesson(lesson_id, user.teacher_profile.id)
    if not lesson:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)

    payload = request.get_json(silent=True) or {}
    for field in ['title', 'description', 'estimated_minutes', 'difficulty_stage', 'is_published', 'is_archived']:
        if field in payload:
            setattr(lesson, field, payload.get(field))
    if payload.get('primary_level') in VALID_LEVELS:
        lesson.primary_level = payload['primary_level']
    if 'subject_id' in payload:
        subject = Subject.query.get(payload.get('subject_id'))
        if not subject:
            return error_response('Không tìm thấy môn học', 'SUBJECT_NOT_FOUND', 404)
        lesson.subject_id = subject.id
    if 'class_id' in payload:
        class_id = payload.get('class_id')
        if class_id:
            classroom = Classroom.query.get(int(class_id))
            if not classroom or classroom.teacher_id != user.teacher_profile.id:
                return error_response('Không tìm thấy lớp', 'CLASS_NOT_FOUND', 404)
            lesson.class_id = classroom.id
        else:
            lesson.class_id = None
    db.session.commit()
    return success_response(lesson.to_dict(), 'Cập nhật bài học thành công')


@api_v1.delete('/lessons/<int:lesson_id>')
@jwt_required()
def archive_lesson(lesson_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    lesson = _get_teacher_lesson(lesson_id, user.teacher_profile.id)
    if not lesson:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)
    lesson.is_archived = True
    db.session.commit()
    return success_response(lesson.to_dict(), 'Đã lưu trữ bài học')


@api_v1.get('/lessons/<int:lesson_id>/activities')
@jwt_required()
def list_activities(lesson_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    lesson = _get_teacher_lesson(lesson_id, user.teacher_profile.id)
    if not lesson:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)
    return success_response([activity.to_dict() for activity in sorted(lesson.activities, key=lambda item: item.sort_order)])


@api_v1.post('/lessons/<int:lesson_id>/activities')
@jwt_required()
def create_activity(lesson_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    lesson = _get_teacher_lesson(lesson_id, user.teacher_profile.id)
    if not lesson:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    title = (payload.get('title') or '').strip()
    activity_type = (payload.get('activity_type') or '').strip()
    if not title or activity_type not in VALID_ACTIVITY_TYPES:
        return error_response('Dữ liệu hoạt động không hợp lệ', 'VALIDATION_ERROR', 422)
    activity = LessonActivity(
        lesson_id=lesson.id,
        title=title,
        activity_type=activity_type,
        instruction_text=payload.get('instruction_text'),
        voice_answer_enabled=payload.get('voice_answer_enabled', False),
        is_required=payload.get('is_required', True),
        sort_order=len(lesson.activities) + 1,
        difficulty_stage=payload.get('difficulty_stage') or 1,
        config_json=payload.get('config_json'),
    )
    db.session.add(activity)
    db.session.flush()
    _place_activity_at_sort_order(lesson, activity, payload.get('sort_order'))
    db.session.commit()
    log_server_event(level='info', module='lessons', message='Tao hoat dong bai hoc', action_name='create_activity', user_id=user.id, metadata={'lesson_id': lesson.id, 'activity_id': activity.id})
    return success_response(activity.to_dict(), 'Tạo hoạt động thành công', 201)


@api_v1.get('/activities/<int:activity_id>')
@jwt_required()
def get_activity(activity_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    activity = _get_teacher_activity(activity_id, user.teacher_profile.id)
    if not activity:
        return error_response('Không tìm thấy hoạt động', 'ACTIVITY_NOT_FOUND', 404)
    return success_response(activity.to_dict())


@api_v1.put('/activities/<int:activity_id>')
@jwt_required()
def update_activity(activity_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    activity = _get_teacher_activity(activity_id, user.teacher_profile.id)
    if not activity:
        return error_response('Không tìm thấy hoạt động', 'ACTIVITY_NOT_FOUND', 404)
    payload = request.get_json(silent=True) or {}
    requested_sort_order = payload.get('sort_order') if 'sort_order' in payload else None
    for field in ['title', 'instruction_text', 'voice_answer_enabled', 'is_required', 'difficulty_stage', 'config_json']:
        if field in payload:
            setattr(activity, field, payload.get(field))
    if payload.get('activity_type') in VALID_ACTIVITY_TYPES:
        activity.activity_type = payload['activity_type']
    if requested_sort_order is not None:
        _place_activity_at_sort_order(activity.lesson, activity, requested_sort_order)
    db.session.commit()
    return success_response(activity.to_dict(), 'Cập nhật hoạt động thành công')


@api_v1.delete('/activities/<int:activity_id>')
@jwt_required()
def delete_activity(activity_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    activity = _get_teacher_activity(activity_id, user.teacher_profile.id)
    if not activity:
        return error_response('Không tìm thấy hoạt động', 'ACTIVITY_NOT_FOUND', 404)
    lesson = activity.lesson
    db.session.delete(activity)
    db.session.flush()
    if lesson:
        _normalize_lesson_activity_sort_orders(lesson)
    db.session.commit()
    return success_response(None, 'Đã xóa hoạt động')


@api_v1.post('/lessons/<int:lesson_id>/activities/reorder')
@jwt_required()
def reorder_activities(lesson_id: int):
    user, error = _require_teacher_user()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    activity_orders = payload.get('activity_orders') or []
    lesson = _get_teacher_lesson(lesson_id, user.teacher_profile.id)
    if not lesson:
        return error_response('Không tìm thấy bài học', 'LESSON_NOT_FOUND', 404)
    activity_map = {activity.id: activity for activity in lesson.activities}
    for item in activity_orders:
        activity = activity_map.get(int(item['activity_id']))
        if activity:
            activity.sort_order = int(item['sort_order'])
    _normalize_lesson_activity_sort_orders(lesson)
    db.session.commit()
    return success_response([activity.to_dict() for activity in sorted(lesson.activities, key=lambda row: row.sort_order)], 'Da sap xep lai hoat dong')
