from __future__ import annotations

import json
import sys

from app import create_app
from app.extensions import db
from app.models import (
    ClassStudent,
    ClassSubject,
    Classroom,
    Lesson,
    LessonActivity,
    LessonAssignment,
    LessonAssignmentStudent,
    StudentLessonProgress,
    Subject,
)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


OLD_LESSON_TITLE = 'Động vật quanh em - 12 hoạt động demo'
LESSON_TITLE = 'Động vật quanh em - demo trực quan'
VIDEO_URL = 'https://www.tiktok.com/@ha.mei277/video/7532173796287974663?is_from_webapp=1&sender_device=pc&web_id=7520835859257869832'


def build_activities() -> list[dict[str, object]]:
    return [
        {
            'sort_order': 1,
            'title': 'Con nào đang ở trong ảnh?',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Nhìn ảnh và chọn đáp án đúng.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'multiple_choice',
                'prompt': 'Đây là con gì?',
                'choices': ['Con chó', 'Con mèo', 'Con cá', 'Con cua'],
                'correct': 'Con chó',
                'media_url': '/demo-media/concho.jpg',
                'media_kind': 'image',
                'audio_url': '/demo-audio/animal-demo-01-vi-v3.mp3',
            },
        },
        {
            'sort_order': 2,
            'title': 'Nhìn ảnh chọn đáp án',
            'activity_type': 'image_choice',
            'instruction_text': 'Quan sát rồi chọn đúng tên con vật.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'image_choice',
                'prompt': 'Con vật trong ảnh là gì?',
                'choices': ['Con mèo', 'Con chó', 'Con hổ', 'Con gấu'],
                'correct': 'Con mèo',
                'media_url': '/demo-media/conmeo.jpg',
                'media_kind': 'image',
                'audio_url': '/demo-audio/animal-demo-02-vi-v3.mp3',
            },
        },
        {
            'sort_order': 3,
            'title': 'Ghép mảnh ảnh con gấu',
            'activity_type': 'image_puzzle',
            'instruction_text': 'Kéo các mảnh vào đúng chỗ để ghép ảnh.',
            'voice_answer_enabled': False,
            'config': {
                'kind': 'image_puzzle',
                'prompt': 'Ghép lại thành hình con gấu.',
                'image_url': '/demo-media/gau.webp',
                'image_kind': 'image',
                'rows': 2,
                'cols': 3,
                'piece_count': 6,
                'audio_url': '/demo-audio/animal-demo-03-vi-v3.mp3',
            },
        },
        {
            'sort_order': 4,
            'title': 'Nghe và chọn',
            'activity_type': 'listen_choose',
            'instruction_text': 'Nghe câu hỏi rồi chọn đáp án đúng.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'listen_choose',
                'audio_text': 'Con vật nào thường kêu meo meo?',
                'choices': ['Con mèo', 'Con chó', 'Con cá', 'Con cua'],
                'correct': 'Con mèo',
                'audio_url': '/demo-audio/animal-demo-04-vi-v3.mp3',
            },
        },
        {
            'sort_order': 5,
            'title': 'Xem video và trả lời',
            'activity_type': 'watch_answer',
            'instruction_text': 'Xem video rồi nói video nói về gì.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'watch_answer',
                'media_url': VIDEO_URL,
                'media_kind': 'embed',
                'prompt': 'Video nói về gì?',
                'answer_mode': 'voice_ai_grade',
                'expected_answer': 'con cá',
                'accepted_answers': ['cá', 'con cá', 'đàn cá', 'ca', 'con ca', 'dan ca', 'dan cá'],
                'audio_url': '/demo-audio/animal-demo-05-vi-v3.mp3',
            },
        },
        {
            'sort_order': 6,
            'title': 'Mở ô đoán hình',
            'activity_type': 'hidden_image_guess',
            'instruction_text': 'Mở dần các ô rồi đoán con vật trong ảnh.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'hidden_image_guess',
                'prompt': 'Con vật trong ảnh là gì?',
                'image_url': '/demo-media/conca.jpg',
                'image_kind': 'image',
                'overlay_rows': 3,
                'overlay_cols': 4,
                'expected_answer': 'con cá',
                'accepted_answers': ['cá', 'con cá', 'ca', 'con ca'],
                'audio_url': '/demo-audio/animal-demo-06-vi-v3.mp3',
            },
        },
        {
            'sort_order': 7,
            'title': 'Thẻ giao tiếp',
            'activity_type': 'aac',
            'instruction_text': 'Chọn thẻ phù hợp với điều em muốn nói.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'aac',
                'prompt': 'Em muốn nói gì khi thấy con mèo dễ thương?',
                'cards': ['Con thich meo', 'Con muon cho an', 'Con muon vuot nhe', 'Con thay vui'],
                'image_cards': [
                    {'id': 'aac-card-1', 'label': 'Con thich meo', 'media_url': '/demo-media/conmeo.jpg', 'media_kind': 'image'},
                    {'id': 'aac-card-2', 'label': 'Con muon cho an', 'media_url': '/demo-media/concho.jpg', 'media_kind': 'image'},
                    {'id': 'aac-card-3', 'label': 'Con muon vuot nhe', 'media_url': '/demo-media/gau.webp', 'media_kind': 'image'},
                    {'id': 'aac-card-4', 'label': 'Con thay vui', 'media_url': '/demo-media/conca.jpg', 'media_kind': 'image'},
                ],
                'audio_url': '/demo-audio/animal-demo-07-vi-v3.mp3',
            },
        },
    ]


def choose_target_class() -> Classroom:
    visual_class = (
        Classroom.query.filter_by(ui_variant=Classroom.UI_VARIANT_VISUAL_SUPPORT, status='active')
        .order_by(Classroom.id.desc())
        .first()
    )
    if visual_class:
        return visual_class

    fallback = Classroom.query.filter_by(status='active').order_by(Classroom.id.asc()).first()
    if not fallback:
        raise RuntimeError('Không tìm thấy lớp học nào để gán bài.')
    return fallback


def upsert_lesson_bundle() -> None:
    target_class = choose_target_class()
    subject = Subject.query.filter_by(code='KHTN').first() or Subject.query.order_by(Subject.id.asc()).first()
    if not subject:
        raise RuntimeError('Không tìm thấy môn học nào trong DB.')

    class_subject = ClassSubject.query.filter_by(class_id=target_class.id, subject_id=subject.id).first()
    if not class_subject:
        db.session.add(ClassSubject(class_id=target_class.id, subject_id=subject.id, sort_order=1, is_active=True))

    lesson = (
        Lesson.query.filter(
            Lesson.created_by_teacher_id == target_class.teacher_id,
            Lesson.subject_id == subject.id,
            Lesson.title.in_([LESSON_TITLE, OLD_LESSON_TITLE]),
        )
        .order_by(Lesson.id.desc())
        .first()
    )
    if not lesson:
        lesson = Lesson(
            created_by_teacher_id=target_class.teacher_id,
            subject_id=subject.id,
            title=LESSON_TITLE,
            description='Bài demo trực quan với ảnh động vật, video về cá và ít chữ hơn.',
            primary_level='nhe',
            estimated_minutes=12,
            difficulty_stage=1,
            is_published=True,
            is_archived=False,
        )
        db.session.add(lesson)
        db.session.flush()

    lesson.title = LESSON_TITLE
    lesson.description = 'Bài demo trực quan với ảnh động vật, video về cá và ít chữ hơn.'
    lesson.primary_level = 'nhe'
    lesson.estimated_minutes = 12
    lesson.difficulty_stage = 1
    lesson.is_published = True
    lesson.is_archived = False

    incoming_activities = build_activities()
    existing_by_sort = {activity.sort_order: activity for activity in LessonActivity.query.filter_by(lesson_id=lesson.id).all()}
    incoming_sort_orders = {item['sort_order'] for item in incoming_activities}

    for activity in list(existing_by_sort.values()):
      if activity.sort_order not in incoming_sort_orders:
          db.session.delete(activity)

    for payload in incoming_activities:
        activity = existing_by_sort.get(payload['sort_order'])
        if not activity:
            activity = LessonActivity(lesson_id=lesson.id, sort_order=int(payload['sort_order']))
            db.session.add(activity)

        activity.title = str(payload['title'])
        activity.activity_type = str(payload['activity_type'])
        activity.instruction_text = str(payload['instruction_text'])
        activity.voice_answer_enabled = bool(payload['voice_answer_enabled'])
        activity.is_required = True
        activity.difficulty_stage = 1
        activity.sort_order = int(payload['sort_order'])
        activity.config_json = json.dumps(payload['config'], ensure_ascii=False)

    assignment = LessonAssignment.query.filter_by(
        lesson_id=lesson.id,
        class_id=target_class.id,
        assigned_by_teacher_id=target_class.teacher_id,
    ).first()
    if not assignment:
        assignment = LessonAssignment(
            lesson_id=lesson.id,
            class_id=target_class.id,
            subject_id=subject.id,
            assigned_by_teacher_id=target_class.teacher_id,
            target_type='class',
            required_completion_percent=100,
            status='active',
        )
        db.session.add(assignment)
        db.session.flush()
    else:
        assignment.subject_id = subject.id
        assignment.target_type = 'class'
        assignment.required_completion_percent = 100
        assignment.status = 'active'

    active_student_ids = [link.student_id for link in ClassStudent.query.filter_by(class_id=target_class.id, status='active').all()]
    existing_assignment_students = {item.student_id: item for item in LessonAssignmentStudent.query.filter_by(assignment_id=assignment.id).all()}
    existing_progress = {item.student_id: item for item in StudentLessonProgress.query.filter_by(assignment_id=assignment.id).all()}

    for student_id, link in list(existing_assignment_students.items()):
        if student_id not in active_student_ids:
            db.session.delete(link)

    for student_id, progress in list(existing_progress.items()):
        if student_id not in active_student_ids:
            db.session.delete(progress)

    for student_id in active_student_ids:
        if student_id not in existing_assignment_students:
            db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=student_id))
        progress = existing_progress.get(student_id)
        if not progress:
            progress = StudentLessonProgress(assignment_id=assignment.id, student_id=student_id)
            db.session.add(progress)
        progress.status = 'not_started'
        progress.progress_percent = 0
        progress.total_learning_seconds = 0
        progress.help_count = 0
        progress.reward_star_count = 0
        progress.completion_score = 0
        progress.completed_at = None

    db.session.commit()
    print(f'Created/updated lesson: {lesson.title} (id={lesson.id})')
    print(f'Class assigned: {target_class.name} (id={target_class.id})')
    print(f'Assignment id: {assignment.id}')
    print(f'Activities: {len(incoming_activities)}')
    print(f'Students assigned: {len(active_student_ids)}')


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        upsert_lesson_bundle()
