from __future__ import annotations

import json
import sys

from app import create_app
from app.extensions import db
from app.models import (
    ClassJoinCredential,
    ClassStudent,
    ClassSubject,
    Classroom,
    Lesson,
    LessonActivity,
    LessonAssignment,
    LessonAssignmentStudent,
    ParentDailyReport,
    ParentProfile,
    ParentStudentLink,
    ParentTeacherMessage,
    RealtimeEvent,
    ServerLog,
    StudentLessonProgress,
    StudentProfile,
    Subject,
    TeacherParentStudentLink,
    TeacherProfile,
    TeacherStudentLink,
    User,
    UserAISetting,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


KEEP_EMAILS = {
    "student.feed.20260410111136@example.com",
    "user001@gmail.com",
}

CLASS_NAME = "Lớp trực quan chính"
CLASS_GRADE = "6"
CLASS_PASSWORD = "LOPCHINH"
VIDEO_URL = "https://www.tiktok.com/@ha.mei277/video/7532173796287974663?is_from_webapp=1&sender_device=pc&web_id=7520835859257869832"
LESSON_TITLE = "Bài tổng hợp động vật - 10 hoạt động"


def build_activities() -> list[dict[str, object]]:
    activities = [
        {
            "sort_order": 1,
            "title": "Chọn đáp án đúng",
            "activity_type": "multiple_choice",
            "instruction_text": "Nhìn ảnh và chọn đáp án đúng.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "multiple_choice",
                "prompt": "Đây là con gì?",
                "choices": ["Con chó", "Con mèo", "Con cá", "Con cua"],
                "correct": "Con chó",
                "media_url": "/demo-media/concho.jpg",
                "media_kind": "image",
                "audio_url": "/demo-audio/animal-demo-01-vi-v3.mp3",
            },
        },
        {
            "sort_order": 2,
            "title": "Nhìn ảnh chọn đáp án",
            "activity_type": "image_choice",
            "instruction_text": "Quan sát rồi chọn đúng tên con vật.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "image_choice",
                "prompt": "Con vật trong ảnh là gì?",
                "choices": ["Con mèo", "Con chó", "Con hổ", "Con gấu"],
                "correct": "Con mèo",
                "media_url": "/demo-media/conmeo.jpg",
                "media_kind": "image",
                "audio_url": "/demo-audio/animal-demo-02-vi-v3.mp3",
            },
        },
        {
            "sort_order": 3,
            "title": "Ghép mảnh ảnh",
            "activity_type": "image_puzzle",
            "instruction_text": "Kéo các mảnh vào đúng chỗ để ghép ảnh.",
            "voice_answer_enabled": False,
            "config": {
                "kind": "image_puzzle",
                "prompt": "Ghép lại thành hình con gấu.",
                "image_url": "/demo-media/gau.webp",
                "image_kind": "image",
                "rows": 2,
                "cols": 3,
                "piece_count": 6,
                "audio_url": "/demo-audio/animal-demo-03-vi-v3.mp3",
            },
        },
        {
            "sort_order": 4,
            "title": "Nối cặp",
            "activity_type": "matching",
            "instruction_text": "Nối con vật với mô tả phù hợp.",
            "voice_answer_enabled": False,
            "config": {
                "kind": "matching",
                "prompt": "Hãy nối đúng từng con vật.",
                "pairs": [
                    {"left": "Con chó", "right": "Gâu gâu"},
                    {"left": "Con mèo", "right": "Meo meo"},
                    {"left": "Con cá", "right": "Bơi dưới nước"},
                ],
            },
        },
        {
            "sort_order": 5,
            "title": "Kéo thả",
            "activity_type": "drag_drop",
            "instruction_text": "Đưa con vật vào đúng nhóm.",
            "voice_answer_enabled": False,
            "config": {
                "kind": "drag_drop",
                "prompt": "Hãy đưa mỗi con vật vào nhóm phù hợp.",
                "items": ["Con chó", "Con mèo", "Con cá"],
                "targets": ["Sống trên cạn", "Sống dưới nước"],
            },
        },
        {
            "sort_order": 6,
            "title": "Nghe và chọn",
            "activity_type": "listen_choose",
            "instruction_text": "Nghe câu hỏi rồi chọn đáp án đúng.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "listen_choose",
                "audio_text": "Con vật nào thường kêu meo meo?",
                "prompt": "Con vật nào thường kêu meo meo?",
                "choices": ["Con mèo", "Con chó", "Con cá", "Con cua"],
                "correct": "Con mèo",
                "audio_url": "/demo-audio/animal-demo-04-vi-v3.mp3",
            },
        },
        {
            "sort_order": 7,
            "title": "Xem video và trả lời",
            "activity_type": "watch_answer",
            "instruction_text": "Xem video rồi nói video nói về gì.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "watch_answer",
                "media_url": VIDEO_URL,
                "media_kind": "embed",
                "prompt": "Video nói về gì?",
                "answer_mode": "voice_ai_grade",
                "expected_answer": "con cá",
                "accepted_answers": ["cá", "con cá", "đàn cá", "ca", "con ca", "dan ca", "dan cá"],
                "audio_url": "/demo-audio/animal-demo-05-vi-v3.mp3",
            },
        },
        {
            "sort_order": 8,
            "title": "Mở ô đoán hình",
            "activity_type": "hidden_image_guess",
            "instruction_text": "Mở dần các ô rồi đoán con vật trong ảnh.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "hidden_image_guess",
                "prompt": "Con vật trong ảnh là gì?",
                "image_url": "/demo-media/conca.jpg",
                "image_kind": "image",
                "overlay_rows": 3,
                "overlay_cols": 4,
                "expected_answer": "con cá",
                "accepted_answers": ["cá", "con cá", "ca", "con ca"],
                "audio_url": "/demo-audio/animal-demo-06-vi-v3.mp3",
            },
        },
        {
            "sort_order": 9,
            "title": "Làm theo từng bước",
            "activity_type": "step_by_step",
            "instruction_text": "Làm lần lượt từng bước.",
            "voice_answer_enabled": False,
            "config": {
                "kind": "step_by_step",
                "prompt": "Hãy chăm sóc chú chó theo đúng trình tự.",
                "steps": ["Chào chú chó", "Đặt thức ăn", "Cho chó uống nước", "Dọn chỗ sạch sẽ"],
            },
        },
        {
            "sort_order": 10,
            "title": "Thẻ giao tiếp",
            "activity_type": "aac",
            "instruction_text": "Chọn thẻ phù hợp với điều em muốn nói.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "aac",
                "prompt": "Em muốn nói gì khi thấy con mèo dễ thương?",
                "cards": ["Con thich meo", "Con muon cho an", "Con muon vuot nhe", "Con thay vui"],
                "image_cards": [
                    {"id": "aac-card-1", "label": "Con thich meo", "media_url": "/demo-media/conmeo.jpg", "media_kind": "image"},
                    {"id": "aac-card-2", "label": "Con muon cho an", "media_url": "/demo-media/concho.jpg", "media_kind": "image"},
                    {"id": "aac-card-3", "label": "Con muon vuot nhe", "media_url": "/demo-media/gau.webp", "media_kind": "image"},
                    {"id": "aac-card-4", "label": "Con thay vui", "media_url": "/demo-media/conca.jpg", "media_kind": "image"},
                ],
                "audio_url": "/demo-audio/animal-demo-07-vi-v3.mp3",
            },
        },
        {
            "sort_order": 11,
            "title": "Mô phỏng tình huống",
            "activity_type": "career_simulation",
            "instruction_text": "Thử làm người chăm sóc thú cưng.",
            "voice_answer_enabled": False,
            "config": {
                "kind": "career_simulation",
                "scenario": "Em vào vai người chăm sóc thú cưng và giúp bạn nhỏ chuẩn bị đồ cho chú chó.",
                "success_criteria": "Chọn đúng việc cần làm, trả lời lịch sự và đủ bước.",
            },
        },
        {
            "sort_order": 12,
            "title": "Trao đổi với AI",
            "activity_type": "ai_chat",
            "instruction_text": "Trò chuyện ngắn với AI về con vật em thích.",
            "voice_answer_enabled": True,
            "config": {
                "kind": "ai_chat",
                "starter_prompt": "Hãy hỏi em 3 câu ngắn về con vật em thích nhất.",
                "goals": ["Trả lời ngắn gọn", "Nói đúng tên con vật", "Biết nhờ AI gợi ý thêm"],
            },
        },
    ]
    retired_types = {"matching", "step_by_step", "career_simulation", "ai_chat", "drag_drop", "listen_choose"}
    kept_activities = [activity for activity in activities if activity["activity_type"] not in retired_types]
    kept_activities.extend(
        [
            {
                "sort_order": 7,
                "title": "Lật thẻ ghi nhớ",
                "activity_type": "memory_match",
                "instruction_text": "Lật 2 thẻ giống nhau để ghi điểm.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "memory_match",
                    "prompt": "Lật 2 thẻ giống nhau để ghi điểm.",
                    "pair_count": 5,
                    "image_cards": [
                        {"id": "dog", "label": "Con chó", "media_url": "/demo-media/concho.jpg", "media_kind": "image"},
                        {"id": "cat", "label": "Con mèo", "media_url": "/demo-media/conmeo.jpg", "media_kind": "image"},
                        {"id": "fish", "label": "Con cá", "media_url": "/demo-media/conca.jpg", "media_kind": "image"},
                        {"id": "tiger", "label": "Con hổ", "media_url": "/demo-media/conho.webp", "media_kind": "image"},
                        {"id": "rabbit", "label": "Con thỏ", "media_url": "/demo-media/contho.png", "media_kind": "image"},
                    ],
                },
            },
            {
                "sort_order": 8,
                "title": "Chạm đúng - phản xạ nhanh",
                "activity_type": "quick_tap",
                "instruction_text": "Chạm nhanh vào các thẻ con vật trước khi hết giờ.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "quick_tap",
                    "prompt": "Chạm nhanh vào các thẻ con vật trước khi hết giờ.",
                    "duration_seconds": 10,
                    "target_hits": 6,
                    "simultaneous_cards": 5,
                    "spawn_interval_ms": 1600,
                    "fall_speed_percent": 4,
                    "fall_duration_seconds": 5.2,
                    "distractor_cards": [
                        {"id": "home", "label": "Trong nh\u00e0", "media_url": "/demo-media/nha.webp", "media_kind": "image"},
                        {"id": "forest", "label": "R\u1eebng", "media_url": "/demo-media/r\u1eebng.jpg", "media_kind": "image"},
                        {"id": "water", "label": "Bi\u1ec3n", "media_url": "/demo-media/bien.jpg", "media_kind": "image"},
                        {"id": "grassland", "label": "\u0110\u1ed3ng c\u1ecf", "media_url": "/demo-media/dongco.jpg", "media_kind": "image"},
                    ],
                    "image_cards": [
                        {"id": "dog", "label": "Con chó", "media_url": "/demo-media/concho.jpg", "media_kind": "image"},
                        {"id": "cat", "label": "Con mèo", "media_url": "/demo-media/conmeo.jpg", "media_kind": "image"},
                        {"id": "fish", "label": "Con cá", "media_url": "/demo-media/conca.jpg", "media_kind": "image"},
                        {"id": "tiger", "label": "Con hổ", "media_url": "/demo-media/conho.webp", "media_kind": "image"},
                        {"id": "rabbit", "label": "Con thỏ", "media_url": "/demo-media/contho.png", "media_kind": "image"},
                    ],
                },
            },
            {
                "sort_order": 9,
                "title": "Sắp xếp lớn - nhỏ",
                "activity_type": "size_order",
                "instruction_text": "Sắp xếp các con vật từ bé đến lớn.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "size_order",
                    "prompt": "Sắp xếp các con vật từ bé đến lớn.",
                    "items": [
                        {"id": "cat", "label": "Mèo", "media_url": "/demo-media/conmeo.jpg", "media_kind": "image", "rank": 1},
                        {"id": "dog", "label": "Chó", "media_url": "/demo-media/concho.jpg", "media_kind": "image", "rank": 2},
                        {"id": "tiger", "label": "Hổ", "media_url": "/demo-media/conho.webp", "media_kind": "image", "rank": 3},
                        {"id": "buffalo", "label": "Trâu", "media_url": "/demo-media/trau.webp", "media_kind": "image", "rank": 4},
                        {"id": "elephant", "label": "Voi", "media_url": "/demo-media/voi.jpg", "media_kind": "image", "rank": 5},
                    ],
                },
            },
            {
                "sort_order": 10,
                "title": "Ghép nơi sống",
                "activity_type": "habitat_match",
                "instruction_text": "Chọn nơi sống đúng cho từng con vật.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "habitat_match",
                    "prompt": "Nối con vật với nơi sống phù hợp.",
                    "habitat_cards": [
                        {"id": "home", "label": "Trong nh\u00e0", "media_url": "/demo-media/nha.webp", "media_kind": "image"},
                        {"id": "forest", "label": "R\u1eebng", "media_url": "/demo-media/r\u1eebng.jpg", "media_kind": "image"},
                        {"id": "water", "label": "D\u01b0\u1edbi n\u01b0\u1edbc", "media_url": "/demo-media/bien.jpg", "media_kind": "image"},
                        {"id": "grassland", "label": "\u0110\u1ed3ng c\u1ecf", "media_url": "/demo-media/dongco.jpg", "media_kind": "image"},
                    ],
                    "items": [
                        {"id": "cat", "label": "M\u00e8o", "media_url": "/demo-media/conmeo.jpg", "media_kind": "image", "habitat_id": "home", "habitat": "Trong nh\u00e0"},
                        {"id": "tiger", "label": "H\u1ed5", "media_url": "/demo-media/conho.webp", "media_kind": "image", "habitat_id": "forest", "habitat": "R\u1eebng"},
                        {"id": "fish", "label": "C\u00e1", "media_url": "/demo-media/conca.jpg", "media_kind": "image", "habitat_id": "water", "habitat": "D\u01b0\u1edbi n\u01b0\u1edbc"},
                        {"id": "buffalo", "label": "Tr\u00e2u", "media_url": "/demo-media/trau.webp", "media_kind": "image", "habitat_id": "grassland", "habitat": "\u0110\u1ed3ng c\u1ecf"},
                    ],
                },
            },
        ]
    )
    for index, activity in enumerate(kept_activities, start=1):
        activity["sort_order"] = index
    return kept_activities


def get_kept_entities() -> tuple[User, User, TeacherProfile, StudentProfile]:
    kept_users = {
        user.email: user
        for user in User.query.filter(User.email.in_(KEEP_EMAILS)).all()
        if user.email
    }
    missing_emails = [email for email in KEEP_EMAILS if email not in kept_users]
    if missing_emails:
        raise RuntimeError(f"Không tìm thấy tài khoản cần giữ: {', '.join(missing_emails)}")

    teacher_user = kept_users["user001@gmail.com"]
    student_user = kept_users["student.feed.20260410111136@example.com"]
    if not teacher_user.teacher_profile:
        raise RuntimeError("Tài khoản giáo viên không có teacher_profile.")
    if not student_user.student_profile:
        raise RuntimeError("Tài khoản học sinh không có student_profile.")
    return teacher_user, student_user, teacher_user.teacher_profile, student_user.student_profile


def clean_database(teacher_user: User, student_user: User, teacher_profile: TeacherProfile, student_profile: StudentProfile) -> None:
    keep_user_ids = {teacher_user.id, student_user.id}
    keep_teacher_ids = {teacher_profile.id}
    keep_student_ids = {student_profile.id}

    ParentTeacherMessage.query.delete()
    ParentDailyReport.query.delete()
    TeacherParentStudentLink.query.delete()
    ParentStudentLink.query.delete()
    LessonAssignmentStudent.query.delete()
    StudentLessonProgress.query.delete()
    LessonAssignment.query.delete()
    LessonActivity.query.delete()
    Lesson.query.delete()
    ClassSubject.query.delete()
    ClassStudent.query.delete()
    ClassJoinCredential.query.delete()
    Classroom.query.delete()
    TeacherStudentLink.query.delete()
    RealtimeEvent.query.delete()
    ServerLog.query.delete()

    UserAISetting.query.filter(~UserAISetting.user_id.in_(keep_user_ids)).delete(synchronize_session=False)
    ParentProfile.query.delete()
    StudentProfile.query.filter(~StudentProfile.id.in_(keep_student_ids)).delete(synchronize_session=False)
    TeacherProfile.query.filter(~TeacherProfile.id.in_(keep_teacher_ids)).delete(synchronize_session=False)
    User.query.filter(~User.id.in_(keep_user_ids)).delete(synchronize_session=False)

    db.session.flush()


def ensure_subject() -> Subject:
    subject = Subject.query.filter_by(code="KHTN").first()
    if subject:
        return subject

    fallback = Subject.query.order_by(Subject.id.asc()).first()
    if fallback:
        return fallback

    subject = Subject(code="KHTN", name="Khoa học tự nhiên", description="Môn mặc định cho bài demo tổng hợp.")
    db.session.add(subject)
    db.session.flush()
    return subject


def create_clean_bundle(teacher_user: User, teacher_profile: TeacherProfile, student_profile: StudentProfile) -> None:
    subject = ensure_subject()

    classroom = Classroom(
        teacher_id=teacher_profile.id,
        name=CLASS_NAME,
        grade_label=CLASS_GRADE,
        description="Lớp chính sau khi làm sạch dữ liệu.",
        default_disability_level=student_profile.disability_level,
        ui_variant=Classroom.UI_VARIANT_VISUAL_SUPPORT,
        visual_theme=Classroom.VISUAL_THEME_GARDEN,
        background_image_url="/student-ui/cayxanh.jpg",
        status="active",
    )
    db.session.add(classroom)
    db.session.flush()

    db.session.add(ClassJoinCredential(class_id=classroom.id, join_password=CLASS_PASSWORD))
    db.session.add(ClassStudent(class_id=classroom.id, student_id=student_profile.id, status="active"))
    db.session.add(TeacherStudentLink(teacher_id=teacher_profile.id, student_id=student_profile.id, status="active", source="class_join"))
    db.session.add(ClassSubject(class_id=classroom.id, subject_id=subject.id, sort_order=1, is_active=True))
    db.session.flush()

    lesson = Lesson(
        created_by_teacher_id=teacher_profile.id,
        subject_id=subject.id,
        title=LESSON_TITLE,
        description="Bài học duy nhất sau khi làm sạch dữ liệu, gom đủ 10 hoạt động.",
        primary_level=student_profile.disability_level,
        estimated_minutes=20,
        difficulty_stage=1,
        is_published=True,
        is_archived=False,
    )
    db.session.add(lesson)
    db.session.flush()

    for payload in build_activities():
        db.session.add(
            LessonActivity(
                lesson_id=lesson.id,
                title=str(payload["title"]),
                activity_type=str(payload["activity_type"]),
                instruction_text=str(payload["instruction_text"]),
                voice_answer_enabled=bool(payload["voice_answer_enabled"]),
                is_required=True,
                sort_order=int(payload["sort_order"]),
                difficulty_stage=1,
                config_json=json.dumps(payload["config"], ensure_ascii=False),
            )
        )

    assignment = LessonAssignment(
        lesson_id=lesson.id,
        class_id=classroom.id,
        subject_id=subject.id,
        assigned_by_teacher_id=teacher_profile.id,
        target_type="class",
        required_completion_percent=100,
        status="active",
    )
    db.session.add(assignment)
    db.session.flush()

    db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=student_profile.id))
    db.session.add(
        StudentLessonProgress(
            assignment_id=assignment.id,
            student_id=student_profile.id,
            status="not_started",
            progress_percent=0,
            total_learning_seconds=0,
            retry_count=0,
            help_count=0,
            reward_star_count=0,
            completion_score=0,
            completed_at=None,
        )
    )

    db.session.commit()

    print("DONE")
    print(f"teacher={teacher_user.email} user_id={teacher_user.id} teacher_profile_id={teacher_profile.id}")
    print(f"student={student_profile.user.email if student_profile.user else None} user_id={student_profile.user_id} student_profile_id={student_profile.id}")
    print(f"class_id={classroom.id} class_name={classroom.name} class_password={CLASS_PASSWORD}")
    print(f"lesson_id={lesson.id} lesson_title={lesson.title}")
    print(f"activity_count={len(build_activities())}")


def main() -> None:
    app = create_app()
    with app.app_context():
        teacher_user, student_user, teacher_profile, student_profile = get_kept_entities()
        clean_database(teacher_user, student_user, teacher_profile, student_profile)
        create_clean_bundle(teacher_user, teacher_profile, student_profile)


if __name__ == "__main__":
    main()
