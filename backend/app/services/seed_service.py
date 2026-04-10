from __future__ import annotations

import json
import os
import random
from datetime import datetime, timedelta

from ..extensions import db
from ..models import (
    User, TeacherProfile, StudentProfile, ParentProfile,
    Classroom, ClassJoinCredential, ClassStudent, Subject, ClassSubject,
    Lesson, LessonActivity, LessonAssignment, LessonAssignmentStudent,
    StudentLessonProgress, ParentDailyReport, ParentStudentLink, TeacherStudentLink,
)
from ..utils.security import hash_password

BASE_SUBJECTS = [('TOAN', 'To\u00e1n'), ('VAN', 'V\u0103n'), ('KHTN', 'Khoa h\u1ecdc t\u1ef1 nhi\u00ean'), ('KY_NANG_SONG', 'K\u1ef9 n\u0103ng s\u1ed1ng')]
DEFAULT_ADMIN_EMAIL = 'admin@example.com'
DEFAULT_ADMIN_PASSWORD = 'admin123456'
DEFAULT_VISUAL_DEMO_TEACHER_EMAIL = 'visual.teacher.demo@example.com'
DEFAULT_VISUAL_DEMO_TEACHER_PASSWORD = 'Teacher123!'
DEFAULT_VISUAL_DEMO_STUDENT_EMAIL = 'visual.student.demo@example.com'
DEFAULT_VISUAL_DEMO_STUDENT_PASSWORD = 'Student123!'
DEFAULT_VISUAL_DEMO_CLASS_PASSWORD = 'VISUAL08'


def seed_subjects() -> int:
    created = 0
    for index, (code, name) in enumerate(BASE_SUBJECTS, start=1):
        existing = Subject.query.filter_by(code=code).first()
        if existing:
            existing.name = name
            existing.sort_order = index
            existing.is_active = True
            continue
        db.session.add(Subject(code=code, name=name, sort_order=index, is_active=True))
        created += 1
    db.session.commit()
    return created


def seed_admin_user(email: str | None = None, password: str | None = None) -> User:
    admin_email = (email or os.getenv('ADMIN_EMAIL') or DEFAULT_ADMIN_EMAIL).strip().lower()
    admin_password = (password or os.getenv('ADMIN_PASSWORD') or DEFAULT_ADMIN_PASSWORD).strip()

    existing = User.query.filter_by(email=admin_email).first()
    if existing:
        existing.password_hash = hash_password(admin_password)
        existing.role = 'admin'
        existing.status = 'active'
        db.session.commit()
        return existing

    user = User(
        email=admin_email,
        phone=None,
        password_hash=hash_password(admin_password),
        role='admin',
        status='active',
    )
    db.session.add(user)
    db.session.commit()
    return user


def seed_visual_support_demo_bundle() -> dict[str, object]:
    teacher_email = (os.getenv('VISUAL_DEMO_TEACHER_EMAIL') or DEFAULT_VISUAL_DEMO_TEACHER_EMAIL).strip().lower()
    teacher_password = (os.getenv('VISUAL_DEMO_TEACHER_PASSWORD') or DEFAULT_VISUAL_DEMO_TEACHER_PASSWORD).strip()
    student_email = (os.getenv('VISUAL_DEMO_STUDENT_EMAIL') or DEFAULT_VISUAL_DEMO_STUDENT_EMAIL).strip().lower()
    student_password = (os.getenv('VISUAL_DEMO_STUDENT_PASSWORD') or DEFAULT_VISUAL_DEMO_STUDENT_PASSWORD).strip()
    class_password = (os.getenv('VISUAL_DEMO_CLASS_PASSWORD') or DEFAULT_VISUAL_DEMO_CLASS_PASSWORD).strip().upper()
    background_image_url = (
        os.getenv('VISUAL_DEMO_BACKGROUND_IMAGE_URL')
        or 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80'
    ).strip()

    subject = Subject.query.filter_by(code='KHTN').first()
    if not subject:
        seed_subjects()
        subject = Subject.query.filter_by(code='KHTN').first()
    if not subject:
        raise RuntimeError('Missing subject KHTN after seeding base subjects.')

    teacher_user = User.query.filter_by(email=teacher_email).first()
    if not teacher_user:
        teacher_user = User(
            email=teacher_email,
            phone=None,
            password_hash=hash_password(teacher_password),
            role='teacher',
            status='active',
        )
        db.session.add(teacher_user)
        db.session.flush()
    else:
        teacher_user.password_hash = hash_password(teacher_password)
        teacher_user.role = 'teacher'
        teacher_user.status = 'active'

    teacher_profile = teacher_user.teacher_profile
    if not teacher_profile:
        teacher_profile = TeacherProfile(
            user_id=teacher_user.id,
            full_name='Cô Minh Họa',
            school_name='Lớp học trực quan',
            note='Tài khoản giáo viên demo cho lớp visual support.',
        )
        db.session.add(teacher_profile)
        db.session.flush()
    else:
        teacher_profile.full_name = 'Cô Minh Họa'
        teacher_profile.school_name = 'Lớp học trực quan'
        teacher_profile.note = 'Tài khoản giáo viên demo cho lớp visual support.'

    student_user = User.query.filter_by(email=student_email).first()
    if not student_user:
        student_user = User(
            email=student_email,
            phone=None,
            password_hash=hash_password(student_password),
            role='student',
            status='active',
        )
        db.session.add(student_user)
        db.session.flush()
    else:
        student_user.password_hash = hash_password(student_password)
        student_user.role = 'student'
        student_user.status = 'active'

    student_profile = student_user.student_profile
    if not student_profile:
        student_profile = StudentProfile(
            user_id=student_user.id,
            full_name='Bé Trực Quan',
            disability_level='nhe',
            support_note='Tài khoản học sinh demo để thử giao diện trực quan.',
            preferred_input='touch',
            preferred_read_speed='slow',
            preferred_font_size='large',
            preferred_bg_color='warm',
            created_by_teacher_id=teacher_profile.id,
        )
        db.session.add(student_profile)
        db.session.flush()
    else:
        student_profile.user_id = student_user.id
        student_profile.full_name = 'Bé Trực Quan'
        student_profile.disability_level = 'nhe'
        student_profile.support_note = 'Tài khoản học sinh demo để thử giao diện trực quan.'
        student_profile.preferred_input = 'touch'
        student_profile.preferred_read_speed = 'slow'
        student_profile.preferred_font_size = 'large'
        student_profile.preferred_bg_color = 'warm'
        student_profile.created_by_teacher_id = teacher_profile.id

    teacher_student_link = TeacherStudentLink.query.filter_by(
        teacher_id=teacher_profile.id,
        student_id=student_profile.id,
    ).first()
    if not teacher_student_link:
        teacher_student_link = TeacherStudentLink(
            teacher_id=teacher_profile.id,
            student_id=student_profile.id,
            status='active',
            source='visual_demo_seed',
        )
        db.session.add(teacher_student_link)
    else:
        teacher_student_link.status = 'active'
        teacher_student_link.source = 'visual_demo_seed'

    classroom = Classroom.query.filter_by(
        teacher_id=teacher_profile.id,
        name='Lớp Trực Quan Demo',
    ).first()
    if not classroom:
        classroom = Classroom(
            teacher_id=teacher_profile.id,
            name='Lớp Trực Quan Demo',
            grade_label='Lớp minh họa',
            description='Lớp demo giao diện trực quan cuộn dọc cho học sinh cần hỗ trợ hình ảnh.',
            default_disability_level='nhe',
            ui_variant=Classroom.UI_VARIANT_VISUAL_SUPPORT,
            visual_theme=Classroom.VISUAL_THEME_GARDEN,
            background_image_url=background_image_url,
            status='active',
        )
        db.session.add(classroom)
        db.session.flush()
    else:
        classroom.grade_label = 'Lớp minh họa'
        classroom.description = 'Lớp demo giao diện trực quan cuộn dọc cho học sinh cần hỗ trợ hình ảnh.'
        classroom.default_disability_level = 'nhe'
        classroom.ui_variant = Classroom.UI_VARIANT_VISUAL_SUPPORT
        classroom.visual_theme = Classroom.VISUAL_THEME_GARDEN
        classroom.background_image_url = background_image_url
        classroom.status = 'active'

    join_credential = classroom.join_credential
    if not join_credential:
        join_credential = ClassJoinCredential(class_id=classroom.id, join_password=class_password)
        db.session.add(join_credential)
    else:
        join_credential.join_password = class_password

    class_subject = ClassSubject.query.filter_by(class_id=classroom.id, subject_id=subject.id).first()
    if not class_subject:
        class_subject = ClassSubject(class_id=classroom.id, subject_id=subject.id, sort_order=1, is_active=True)
        db.session.add(class_subject)
    else:
        class_subject.sort_order = 1
        class_subject.is_active = True

    class_student = ClassStudent.query.filter_by(class_id=classroom.id, student_id=student_profile.id).first()
    if not class_student:
        class_student = ClassStudent(class_id=classroom.id, student_id=student_profile.id, status='active')
        db.session.add(class_student)
    else:
        class_student.status = 'active'

    lesson = Lesson.query.filter_by(
        created_by_teacher_id=teacher_profile.id,
        subject_id=subject.id,
        title='Nhận biết con vật qua hình ảnh và video',
    ).first()
    if not lesson:
        lesson = Lesson(
            created_by_teacher_id=teacher_profile.id,
            subject_id=subject.id,
            title='Nhận biết con vật qua hình ảnh và video',
            description='Bài học demo gồm clip ngắn, chọn ảnh, ghép hình và trả lời bằng giọng nói.',
            primary_level='nhe',
            estimated_minutes=15,
            difficulty_stage=1,
            is_published=True,
            is_archived=False,
        )
        db.session.add(lesson)
        db.session.flush()
    else:
        lesson.description = 'Bài học demo gồm clip ngắn, chọn ảnh, ghép hình và trả lời bằng giọng nói.'
        lesson.primary_level = 'nhe'
        lesson.estimated_minutes = 15
        lesson.difficulty_stage = 1
        lesson.is_published = True
        lesson.is_archived = False

    activities = [
        {
            'sort_order': 1,
            'title': 'Clip 1: Chọn kết quả đúng',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Xem clip ngắn rồi chọn đáp án đúng.',
            'voice_answer_enabled': False,
            'config': {
                'prompt': '2 cộng 3 bằng mấy?',
                'choices': ['5', '4'],
                'correct': '5',
                'media_url': '/demo-media/clip-1-count-five.html',
            },
        },
        {
            'sort_order': 2,
            'title': 'Clip 2: Màu của quả chuối',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Nhìn clip ngắn và chọn màu đúng.',
            'voice_answer_enabled': False,
            'config': {
                'prompt': 'Quả chuối thường có màu gì?',
                'choices': ['Vàng', 'Tím'],
                'correct': 'Vàng',
                'media_url': '/demo-media/clip-2-banana.html',
            },
        },
        {
            'sort_order': 3,
            'title': 'Clip 3: Ban ngày',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Vuốt tiếp và chọn đúng.',
            'voice_answer_enabled': False,
            'config': {
                'prompt': 'Ban ngày em thường thấy gì?',
                'choices': ['Mặt trời', 'Mặt trăng'],
                'correct': 'Mặt trời',
                'media_url': '/demo-media/clip-3-sun.html',
            },
        },
        {
            'sort_order': 4,
            'title': 'Clip 4: Con cá',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Xem clip và chọn đáp án đúng.',
            'voice_answer_enabled': False,
            'config': {
                'prompt': 'Con cá bơi ở đâu?',
                'choices': ['Dưới nước', 'Trên trời'],
                'correct': 'Dưới nước',
                'media_url': '/demo-media/clip-4-fish.html',
            },
        },
        {
            'sort_order': 5,
            'title': 'Clip 5: Màu của quả táo',
            'activity_type': 'multiple_choice',
            'instruction_text': 'Clip ngắn có 2 đáp án.',
            'voice_answer_enabled': False,
            'config': {
                'prompt': 'Quả táo trong clip có màu gì?',
                'choices': ['Đỏ', 'Tím'],
                'correct': 'Đỏ',
                'media_url': '/demo-media/clip-5-red-apple.html',
            },
        },
        {
            'sort_order': 6,
            'title': 'Ảnh mèo',
            'activity_type': 'image_choice',
            'instruction_text': 'Nhìn ảnh con vật và chọn đúng.',
            'voice_answer_enabled': False,
            'config': {
                'prompt': 'Đây là con gì?',
                'choices': ['Con mèo', 'Con gà'],
                'correct': 'Con mèo',
                'media_url': '/demo-media/cat-card.svg',
                'media_kind': 'image',
            },
        },
        {
            'sort_order': 7,
            'title': 'Video TikTok: Con vật gì?',
            'activity_type': 'watch_answer',
            'instruction_text': 'Xem video, bấm mic và nói tên con vật em thấy.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'watch_answer',
                'media_url': 'https://www.tiktok.com/@gimph_124/video/7489356649216511238?is_from_webapp=1&sender_device=pc&web_id=7520835859257869832',
                'media_kind': 'embed',
                'prompt': 'Trong video xuất hiện con vật gì?',
                'answer_mode': 'voice_ai_grade',
                'expected_answer': 'con mèo',
                'accepted_answers': ['con mèo', 'mèo', 'con meo', 'meo'],
            },
        },
        {
            'sort_order': 8,
            'title': 'Vuốt tìm ảnh: Con mèo',
            'activity_type': 'image_choice',
            'instruction_text': 'Vuốt trái phải để tìm đúng ảnh rồi bấm chọn.',
            'voice_answer_enabled': False,
            'config': {
                'kind': 'image_choice',
                'prompt': 'Đâu là con mèo?',
                'image_selection_mode': 'carousel_find',
                'image_cards': [
                    {'id': 'cat', 'label': 'Con mèo', 'media_url': '/demo-media/conmeo.jpg', 'media_kind': 'image'},
                    {'id': 'dog', 'label': 'Con chó', 'media_url': '/demo-media/concho.jpg', 'media_kind': 'image'},
                    {'id': 'fish', 'label': 'Con cá', 'media_url': '/demo-media/conca.jpg', 'media_kind': 'image'},
                    {'id': 'crab', 'label': 'Con cua', 'media_url': '/demo-media/concua.jpg', 'media_kind': 'image'},
                    {'id': 'tiger', 'label': 'Con hổ', 'media_url': '/demo-media/conho.webp', 'media_kind': 'image'},
                    {'id': 'bear', 'label': 'Con gấu', 'media_url': '/demo-media/gau.webp', 'media_kind': 'image'},
                ],
                'correct': 'cat',
            },
        },
        {
            'sort_order': 9,
            'title': 'Vuốt tìm ảnh: Con gấu',
            'activity_type': 'image_choice',
            'instruction_text': 'Vuốt trái phải để tìm đúng ảnh rồi bấm chọn.',
            'voice_answer_enabled': False,
            'config': {
                'kind': 'image_choice',
                'prompt': 'Đâu là con gấu?',
                'image_selection_mode': 'carousel_find',
                'image_cards': [
                    {'id': 'cat', 'label': 'Con mèo', 'media_url': '/demo-media/conmeo.jpg', 'media_kind': 'image'},
                    {'id': 'dog', 'label': 'Con chó', 'media_url': '/demo-media/concho.jpg', 'media_kind': 'image'},
                    {'id': 'fish', 'label': 'Con cá', 'media_url': '/demo-media/conca.jpg', 'media_kind': 'image'},
                    {'id': 'crab', 'label': 'Con cua', 'media_url': '/demo-media/concua.jpg', 'media_kind': 'image'},
                    {'id': 'tiger', 'label': 'Con hổ', 'media_url': '/demo-media/conho.webp', 'media_kind': 'image'},
                    {'id': 'bear', 'label': 'Con gấu', 'media_url': '/demo-media/gau.webp', 'media_kind': 'image'},
                ],
                'correct': 'bear',
            },
        },
        {
            'sort_order': 10,
            'title': 'Ghép mảnh ảnh: Con mèo',
            'activity_type': 'image_puzzle',
            'instruction_text': 'Kéo thả các mảnh để ghép lại thành hình con mèo.',
            'voice_answer_enabled': False,
            'config': {
                'kind': 'image_puzzle',
                'prompt': 'Ghép lại thành hình con mèo.',
                'image_url': '/demo-media/conmeo.jpg',
                'image_kind': 'image',
                'rows': 2,
                'cols': 3,
                'piece_count': 6,
            },
        },
        {
            'sort_order': 11,
            'title': 'Mở ô đoán hình: Con gấu',
            'activity_type': 'hidden_image_guess',
            'instruction_text': 'Chạm mở từng ô đen, đoán hình và nói tên con vật.',
            'voice_answer_enabled': True,
            'config': {
                'kind': 'hidden_image_guess',
                'prompt': 'Trong bức ảnh này là con vật gì?',
                'image_url': '/demo-media/gau.webp',
                'image_kind': 'image',
                'overlay_rows': 3,
                'overlay_cols': 4,
                'expected_answer': 'con gấu',
                'accepted_answers': ['gấu', 'con gấu', 'gau', 'con gau'],
            },
        },
    ]

    existing_activities = {
        activity.sort_order: activity
        for activity in LessonActivity.query.filter_by(lesson_id=lesson.id).all()
    }
    incoming_sort_orders = {item['sort_order'] for item in activities}

    for activity in list(existing_activities.values()):
        if activity.sort_order not in incoming_sort_orders:
            db.session.delete(activity)

    for activity_payload in activities:
        activity = existing_activities.get(activity_payload['sort_order'])
        if not activity:
            activity = LessonActivity(lesson_id=lesson.id, sort_order=activity_payload['sort_order'])
            db.session.add(activity)

        activity.title = activity_payload['title']
        activity.activity_type = activity_payload['activity_type']
        activity.instruction_text = activity_payload['instruction_text']
        activity.voice_answer_enabled = activity_payload['voice_answer_enabled']
        activity.is_required = True
        activity.difficulty_stage = 1
        activity.config_json = json.dumps(activity_payload['config'], ensure_ascii=False)

    assignment = LessonAssignment.query.filter_by(
        lesson_id=lesson.id,
        class_id=classroom.id,
        assigned_by_teacher_id=teacher_profile.id,
    ).first()
    if not assignment:
        assignment = LessonAssignment(
            lesson_id=lesson.id,
            class_id=classroom.id,
            subject_id=subject.id,
            assigned_by_teacher_id=teacher_profile.id,
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

    assignment_student = LessonAssignmentStudent.query.filter_by(
        assignment_id=assignment.id,
        student_id=student_profile.id,
    ).first()
    if not assignment_student:
        assignment_student = LessonAssignmentStudent(assignment_id=assignment.id, student_id=student_profile.id)
        db.session.add(assignment_student)

    progress = StudentLessonProgress.query.filter_by(
        assignment_id=assignment.id,
        student_id=student_profile.id,
    ).first()
    if not progress:
        progress = StudentLessonProgress(
            assignment_id=assignment.id,
            student_id=student_profile.id,
            status='not_started',
            progress_percent=0,
            total_learning_seconds=0,
            retry_count=0,
            help_count=0,
            reward_star_count=0,
            completion_score=0,
            completed_at=None,
        )
        db.session.add(progress)
    else:
        progress.status = 'not_started'
        progress.progress_percent = 0
        progress.total_learning_seconds = 0
        progress.retry_count = 0
        progress.help_count = 0
        progress.reward_star_count = 0
        progress.completion_score = 0
        progress.completed_at = None

    db.session.commit()
    return {
        'teacher_email': teacher_email,
        'teacher_password': teacher_password,
        'student_email': student_email,
        'student_password': student_password,
        'class_name': classroom.name,
        'class_password': class_password,
        'lesson_title': lesson.title,
        'activity_count': len(activities),
    }


def seed_test_scenario():
    print("Starting test scenario seeding...")
    
    # 1. Ensure subjects exist
    subjects = Subject.query.all()
    if not subjects:
        print("Error: No subjects found. Please run seed-base first.")
        return

    # 2. Create Teachers
    teachers_data = [
        {"email": "co_lan@example.com", "name": "Cô Lan", "school": "Trường Tiểu Học A"},
        {"email": "co_mai@example.com", "name": "Cô Mai", "school": "Trường Tiểu Học B"}
    ]
    
    teachers = []
    for data in teachers_data:
        user = User.query.filter_by(email=data["email"]).first()
        if not user:
            user = User(
                email=data["email"],
                password_hash=hash_password("password123"),
                role="teacher",
                status="active"
            )
            db.session.add(user)
            db.session.flush()
            
            profile = TeacherProfile(
                user_id=user.id,
                full_name=data["name"],
                school_name=data["school"],
                note=f"Giáo viên kinh nghiệm từ {data['school']}"
            )
            db.session.add(profile)
            teachers.append(profile)
        else:
            teachers.append(user.teacher_profile)

    db.session.commit()
    print(f"Created {len(teachers)} Teachers.")

    # 3. For each teacher, create 10 Students and 10 Parents
    all_students = []
    for teacher in teachers:
        classroom = Classroom.query.filter_by(teacher_id=teacher.id, name=f"Lop cua {teacher.full_name}").first()
        if not classroom:
            classroom = Classroom(
                teacher_id=teacher.id,
                name=f"Lớp của {teacher.full_name}",
                grade_label="Lớp 1",
                description=f"Không gian học tập của {teacher.full_name}",
                status="active"
            )
            db.session.add(classroom)
            db.session.flush()
            
            # Add all subjects to classroom
            for sub in subjects:
                db.session.add(ClassSubject(class_id=classroom.id, subject_id=sub.id, is_active=True))

        for i in range(1, 11):
            student_name = f"Học sinh {i} ({teacher.full_name})"
            p_idx = f"{teacher.id}_{i}"
            parent_email = f"phu_huynh_{p_idx}@example.com"
            parent_name = f"Phụ huynh {student_name}"
            
            # Create Student
            student = StudentProfile(
                full_name=student_name,
                disability_level=random.choice(["nhe", "trung_binh"]),
                created_by_teacher_id=teacher.id,
                preferred_input="touch"
            )
            db.session.add(student)
            db.session.flush()
            
            # Enrollment
            db.session.add(ClassStudent(class_id=classroom.id, student_id=student.id, status="active"))
            
            # Create Parent User & Profile
            p_user = User.query.filter_by(email=parent_email).first()
            if not p_user:
                p_user = User(
                    email=parent_email,
                    password_hash=hash_password("password123"),
                    role="parent",
                    status="active"
                )
                db.session.add(p_user)
                db.session.flush()
                
                p_profile = ParentProfile(
                    user_id=p_user.id,
                    full_name=parent_name,
                    relationship_label="Phụ huynh"
                )
                db.session.add(p_profile)
                db.session.flush()
            else:
                p_profile = p_user.parent_profile
            
            # Link Parent to Student
            link = ParentStudentLink.query.filter_by(parent_id=p_profile.id, student_id=student.id).first()
            if not link:
                db.session.add(ParentStudentLink(
                    parent_id=p_profile.id,
                    student_id=student.id,
                    linked_by_teacher_id=teacher.id,
                    status="active"
                ))

            all_students.append((student, p_profile, teacher, classroom))

    db.session.commit()
    print("Created 20 Students and 20 Parents, and linked them.")

    # 4. Create Lessons and Assignments
    lessons = []
    for teacher in teachers:
        for sub in subjects:
            lesson = Lesson(
                created_by_teacher_id=teacher.id,
                subject_id=sub.id,
                title=f"Bài học {sub.name} cơ bản",
                description=f"Hướng dẫn học {sub.name} cho trẻ",
                primary_level="nhe",
                estimated_minutes=15,
                is_published=True
            )
            db.session.add(lesson)
            db.session.flush()
            
            # Add Activity
            db.session.add(LessonActivity(
                lesson_id=lesson.id,
                title="Làm quen con số/chữ cái",
                activity_type="interactive_card",
                instruction_text="Hãy chạm vào hình ảnh phù hợp",
                sort_order=1
            ))
            
            lessons.append((lesson, teacher))

    db.session.commit()
    print("Created Lessons and Activities.")

    # 5. Assign and Progress
    for teacher in teachers:
        teacher_lessons = [l for l, t in lessons if t.id == teacher.id]
        classroom = Classroom.query.filter_by(teacher_id=teacher.id).first()
        
        for lesson in teacher_lessons:
            assignment = LessonAssignment(
                lesson_id=lesson.id,
                class_id=classroom.id,
                subject_id=lesson.subject_id,
                assigned_by_teacher_id=teacher.id,
                target_type="class",
                status="active",
                due_at=(datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
            )
            db.session.add(assignment)
            db.session.flush()
            
            # Random progress for students
            students_in_class = [s for s, p, t, c in all_students if c.id == classroom.id]
            for stu in students_in_class:
                # Add student to assignment
                db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=stu.id))
                
                # Progress
                progress = StudentLessonProgress(
                    assignment_id=assignment.id,
                    student_id=stu.id,
                    status=random.choice(["completed", "in_progress", "not_started"]),
                    progress_percent=random.randint(0, 100),
                    total_learning_seconds=random.randint(0, 600),
                    reward_star_count=random.randint(0, 5),
                    completion_score=random.randint(0, 100)
                )
                if progress.status == "completed":
                    progress.progress_percent = 100
                    progress.completed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                db.session.add(progress)

    db.session.commit()
    print("Created Assignments and Progress.")

    # 6. Daily Reports
    for student, parent, teacher, classroom in all_students:
        report = ParentDailyReport(
            teacher_id=teacher.id,
            parent_id=parent.id,
            student_id=student.id,
            report_date=datetime.now().strftime("%Y-%m-%d"),
            title=f"Báo cáo ngày {datetime.now().strftime('%d/%m/%Y')} - {student.full_name}",
            summary_text=f"Hôm nay {student.full_name} đã học tập rất chăm chỉ.",
            teacher_note="Phụ huynh cần nhắc nhở con tập trung hơn vào bài học toán.",
            recommendation="Khuyến khích con sử dụng hình ảnh để ghi nhớ.",
            total_assignments=3,
            completed_count=random.randint(0, 3),
            in_progress_count=1,
            last_progress_percent=random.randint(50, 100),
            readiness_status="tiep_thu_tot"
        )
        db.session.add(report)

    db.session.commit()
    print("Generated Daily Reports for all parents.")
