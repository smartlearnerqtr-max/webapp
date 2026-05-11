from __future__ import annotations

import json
import sys
import unicodedata

from app import create_app
from app.extensions import db
from app.models import Classroom, Lesson, LessonActivity, LessonAssignment, LessonAssignmentStudent, StudentLessonProgress, Subject, TeacherProfile, User

TEACHER_EMAIL = "teacher.levels.demo@example.com"
DEMO_CLASS_NAME = "Lớp demo 3 mức"

SUBJECT_LOOKUP_CANONICAL_MAP = {
    "nghe thuat am nhac": "am nhac",
    "am nhac": "am nhac",
    "nghe thuat mi thuat": "my thuat",
    "my thuat": "my thuat",
    "giao duc dia phuong": "giao duc dia phuong",
    "hd trai nghiem huong nghiep": "hoat dong trai nghiem",
    "hoat dong trai nghiem": "hoat dong trai nghiem",
    "lich su dia li": "lich su dia ly",
    "lich su dia ly": "lich su dia ly",
}


def safe_log(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
        sys.stdout.buffer.write(message.encode(encoding, errors="replace") + b"\n")


def normalize_lookup(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = normalized.replace("đ", "d").replace("Đ", "D").lower()
    normalized = "".join(char if char.isalnum() else " " for char in normalized)
    return " ".join(normalized.split())


def canonical_subject_lookup(value: str) -> str:
    lookup = normalize_lookup(value)
    return SUBJECT_LOOKUP_CANONICAL_MAP.get(lookup, lookup)


def get_teacher() -> TeacherProfile:
    user = User.query.filter_by(email=TEACHER_EMAIL).first()
    if not user or not user.teacher_profile:
        raise RuntimeError(f"Không tìm thấy giáo viên demo: {TEACHER_EMAIL}")
    return user.teacher_profile


def get_demo_classroom(teacher_id: int) -> Classroom:
    classroom = Classroom.query.filter_by(teacher_id=teacher_id, name=DEMO_CLASS_NAME).first()
    if not classroom:
        raise RuntimeError(f"Không tìm thấy lớp demo: {DEMO_CLASS_NAME}")
    return classroom


def get_subject_map_for_classroom(classroom: Classroom) -> dict[str, Subject]:
    subject_map: dict[str, Subject] = {}
    for class_subject in classroom.subjects:
        if not class_subject.is_active or not class_subject.subject:
            continue
        subject_map[canonical_subject_lookup(class_subject.subject.name)] = class_subject.subject
    return subject_map


def get_heavy_students(classroom: Classroom) -> list[int]:
    student_ids: list[int] = []
    for class_student in classroom.students:
        if class_student.status != "active" or not class_student.student:
            continue
        if class_student.student.disability_level == "nang":
            student_ids.append(class_student.student_id)
    return student_ids


def choice_card(card_id: str, label: str, media_url: str) -> dict[str, object]:
    return {
        "id": card_id,
        "label": label,
        "media_url": media_url,
        "media_kind": "image",
    }


def build_heavy_specs() -> list[dict[str, object]]:
    return [
        {
            "subject_name": "Ngữ văn",
            "title": "Nhận biết nhân vật trong truyện cổ tích",
            "description": "Chạm đúng nhân vật và xem truyện tranh động theo nhịp chậm, rõ.",
            "activities": [
                {
                    "title": "Chạm đúng nhân vật",
                    "activity_type": "image_choice",
                    "instruction_text": "Nghe câu hỏi rồi chạm đúng nhân vật.",
                    "config": {
                        "prompt": "Ai là cô Tấm?",
                        "audio_text": "Ai là cô Tấm?",
                        "correct": "co-tam",
                        "image_selection_mode": "carousel_find",
                        "image_cards": [
                            choice_card("co-tam", "Cô Tấm", "/lesson-media/nang/co-tam-card.svg"),
                            choice_card("con-cho", "Con chó", "/lesson-media/nang/con-cho-card.svg"),
                        ],
                    },
                },
                {
                    "title": "Nghe truyện bằng Tranh động",
                    "activity_type": "watch_answer",
                    "instruction_text": "Lật từng trang tranh động và nghe chuyện.",
                    "config": {
                        "prompt": "Xem truyện tranh động rồi bấm xác nhận khi em nghe xong.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=nguvan-story",
                        "answer_mode": "none",
                    },
                },
            ],
        },
        {
            "subject_name": "Toán học",
            "title": "Nhận biết số lượng 1-3 và Hình khối cơ bản",
            "description": "Kéo thả đếm số và phân loại hình khối cơ bản trên app.",
            "activities": [
                {
                    "title": "Kéo thả đếm số",
                    "activity_type": "drag_drop",
                    "instruction_text": "Kéo đúng số lượng theo yêu cầu.",
                    "config": {
                        "prompt": "Kéo đúng 2 quả táo vào rổ của cô, quả còn lại để trên bàn.",
                        "items": ["Táo đỏ", "Táo xanh", "Táo vàng"],
                        "targets": ["Rổ của cô", "Để trên bàn"],
                    },
                },
                {
                    "title": "Phân loại hình khối",
                    "activity_type": "drag_drop",
                    "instruction_text": "Bỏ đúng khối vào đúng hộp.",
                    "config": {
                        "prompt": "Chia các khối vào đúng hộp hình Tròn hoặc hình Vuông.",
                        "items": ["Đĩa tròn", "Khung vuông", "Bóng tròn", "Khối vuông"],
                        "targets": ["Hộp hình Tròn", "Hộp hình Vuông"],
                    },
                },
            ],
        },
        {
            "subject_name": "Tiếng Anh",
            "title": "Nhận biết Màu sắc và Khẩu lệnh",
            "description": "Nghe từ màu sắc và làm theo khẩu lệnh đơn giản bằng AI Camera.",
            "activities": [
                {
                    "title": "Flashcard Âm thanh",
                    "activity_type": "listen_choose",
                    "instruction_text": "Nghe màu rồi chọn đúng thẻ.",
                    "config": {
                        "prompt": "Nghe màu rồi chọn đúng thẻ.",
                        "audio_text": "Red",
                        "audio_lang": "en-US",
                        "correct": "red",
                        "image_selection_mode": "carousel_find",
                        "image_cards": [
                            choice_card("red", "Red", "/lesson-media/nang/red-card.svg"),
                            choice_card("blue", "Blue", "/lesson-media/nang/blue-card.svg"),
                        ],
                    },
                },
                {
                    "title": "Học qua bắt chước hành động",
                    "activity_type": "watch_answer",
                    "instruction_text": "Đứng lên theo mẫu rồi bấm xác nhận.",
                    "config": {
                        "prompt": "Nhìn chữ Stand up, đứng lên theo mẫu rồi bấm xác nhận.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=tienganh-standup",
                        "answer_mode": "none",
                    },
                },
            ],
        },
        {
            "subject_name": "Khoa học tự nhiên",
            "title": "Cơ thể người và Vật sống / Không sống",
            "description": "Nhận biết bộ phận cơ thể và phân loại vật sống, vật không sống.",
            "activities": [
                {
                    "title": "Ghép bộ phận",
                    "activity_type": "watch_answer",
                    "instruction_text": "Đặt mắt, mũi, miệng vào đúng vị trí.",
                    "config": {
                        "prompt": "Chạm để đặt mắt, mũi, miệng vào đúng vị trí trên khuôn mặt.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=khtn-face",
                        "answer_mode": "none",
                    },
                },
                {
                    "title": "Phân loại Sinh học",
                    "activity_type": "drag_drop",
                    "instruction_text": "Kéo vật vào đúng nhóm.",
                    "config": {
                        "prompt": "Kéo con chó vào nhóm vật sống và cái ghế vào nhóm vật không sống.",
                        "items": ["Con chó", "Cái ghế", "Cây xanh", "Bàn học"],
                        "targets": ["Vật sống", "Vật không sống"],
                    },
                },
            ],
        },
        {
            "subject_name": "Lịch sử - Địa lý",
            "title": "Thời tiết và Phương tiện giao thông",
            "description": "Chọn đồ vật theo thời tiết và ghép đúng phương tiện với môi trường di chuyển.",
            "activities": [
                {
                    "title": "Chọn đồ vật theo thời tiết",
                    "activity_type": "image_choice",
                    "instruction_text": "Nghe câu hỏi rồi chọn đúng đồ vật.",
                    "config": {
                        "prompt": "Mưa rồi, lấy gì đây?",
                        "audio_text": "Mưa rồi, lấy gì đây?",
                        "correct": "umbrella",
                        "image_selection_mode": "carousel_find",
                        "image_cards": [
                            choice_card("umbrella", "Cái ô", "/lesson-media/nang/umbrella-card.svg"),
                            choice_card("sunglasses", "Kính râm", "/lesson-media/nang/sunglasses-card.svg"),
                        ],
                    },
                },
                {
                    "title": "Ghép đúng đường đi",
                    "activity_type": "drag_drop",
                    "instruction_text": "Kéo phương tiện vào đúng môi trường.",
                    "config": {
                        "prompt": "Kéo thuyền xuống nước và kéo ô tô lên đường bộ.",
                        "items": ["Thuyền", "Ô tô", "Xe máy", "Ca nô"],
                        "targets": ["Đường thủy", "Đường bộ"],
                    },
                },
            ],
        },
        {
            "subject_name": "Công nghệ",
            "title": "Nhận diện vật cấm/nguy hiểm trong nhà",
            "description": "Tập nhận biết vật nguy hiểm và sắp xếp đồ dùng gia đình an toàn.",
            "activities": [
                {
                    "title": "Thẻ cảnh báo AAC",
                    "activity_type": "drag_drop",
                    "instruction_text": "Kéo thẻ cảnh báo lên các vật nguy hiểm.",
                    "config": {
                        "prompt": "Kéo thẻ cảnh báo lên các vật nguy hiểm trong nhà.",
                        "items": ["Dấu X cho ổ điện", "Dấu X cho dao", "Nhãn an toàn cho bát cơm"],
                        "targets": ["Nguy hiểm", "An toàn"],
                    },
                },
                {
                    "title": "Sắp xếp đồ dùng nhà bếp",
                    "activity_type": "drag_drop",
                    "instruction_text": "Xếp bát to, bát nhỏ vào đúng kệ.",
                    "config": {
                        "prompt": "Xếp bát to ở kệ dưới và bát nhỏ ở kệ trên.",
                        "items": ["Bát to", "Bát nhỏ", "Bát vừa"],
                        "targets": ["Kệ dưới", "Kệ trên"],
                    },
                },
            ],
        },
        {
            "subject_name": "Giáo dục công dân",
            "title": "Hành vi đạo đức và Ứng xử",
            "description": "Nhận biết hành vi đúng sai và luyện lời chào cơ bản bằng micro.",
            "activities": [
                {
                    "title": "Chọn mặt Cười/Mếu",
                    "activity_type": "multiple_choice",
                    "instruction_text": "Nhìn tình huống và chọn mặt phù hợp.",
                    "config": {
                        "prompt": "Bạn vứt rác ra sân. Em chọn mặt cười hay mặt mếu?",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=gdcd-litter",
                        "media_kind": "video",
                        "choices": ["😊 Mặt cười", "☹️ Mặt mếu"],
                        "correct": "☹️ Mặt mếu",
                    },
                },
                {
                    "title": "Thực hành chào hỏi",
                    "activity_type": "watch_answer",
                    "instruction_text": "Bấm micro và nói “ạ”.",
                    "config": {
                        "prompt": "Nhìn cô giáo, bấm micro và nói “ạ” để hoàn thành lời chào.",
                        "media_url": "/lesson-media/nang/teacher-greeting-card.svg",
                        "media_kind": "image",
                        "answer_mode": "voice_ai_grade",
                        "expected_answer": "ạ",
                        "accepted_answers": ["a", "ạ ạ", "con chào cô ạ"],
                    },
                },
            ],
        },
        {
            "subject_name": "Tin học",
            "title": "Nhận biết thiết bị máy tính",
            "description": "Nhận biết chuột máy tính và luyện thao tác tap, swipe trên thiết bị số.",
            "activities": [
                {
                    "title": "Ghép cặp / Chọn đúng thiết bị",
                    "activity_type": "image_choice",
                    "instruction_text": "Nghe câu hỏi rồi chọn đúng hình chuột máy tính.",
                    "config": {
                        "prompt": "Chuột máy tính đâu?",
                        "audio_text": "Chuột máy tính đâu?",
                        "correct": "computer-mouse",
                        "image_selection_mode": "carousel_find",
                        "image_cards": [
                            choice_card("computer-mouse", "Chuột máy tính", "/lesson-media/nang/computer-mouse-card.svg"),
                            choice_card("animal-mouse", "Con chuột", "/lesson-media/nang/animal-mouse-card.svg"),
                        ],
                    },
                },
                {
                    "title": "Thực hành Tap/Swipe",
                    "activity_type": "watch_answer",
                    "instruction_text": "Tap để bật sáng, swipe để lật trang.",
                    "config": {
                        "prompt": "Vuốt trái phải để lật trang và chạm để bật sáng màn hình máy tính bảng.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=tinhoc-swipe",
                        "answer_mode": "none",
                    },
                },
            ],
        },
        {
            "subject_name": "Giáo dục thể chất",
            "title": "Vận động định hướng",
            "description": "Bắt chước tư thế vận động đúng và tham gia hoạt động AR đơn giản.",
            "activities": [
                {
                    "title": "Video làm mẫu chậm",
                    "activity_type": "watch_answer",
                    "instruction_text": "Xem thầy làm mẫu chậm rồi bắt chước theo.",
                    "config": {
                        "prompt": "Xem thầy làm mẫu chậm rồi bắt chước động tác vươn vai, nhún gối theo nhịp.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=gdtc-warmup",
                        "answer_mode": "none",
                    },
                },
                {
                    "title": "AR Camera",
                    "activity_type": "watch_answer",
                    "instruction_text": "Đập các vòng tròn ảo khi chúng bay tới.",
                    "config": {
                        "prompt": "Đứng trước màn hình và vung tay đập các vòng tròn ảo.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=gdtc-ar",
                        "answer_mode": "none",
                    },
                },
            ],
        },
        {
            "subject_name": "Âm nhạc",
            "title": "Nhận biết nhịp điệu",
            "description": "Gõ phách theo nhịp và nghe phân biệt nhạc cụ dân tộc.",
            "activities": [
                {
                    "title": "Gõ phách ảo",
                    "activity_type": "watch_answer",
                    "instruction_text": "Canh đúng nhịp rồi chạm vào mặt trống.",
                    "config": {
                        "prompt": "Canh đúng nhịp rồi gõ vào mặt trống khi nốt nhạc chạm đích.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=amnhac-rhythm",
                        "answer_mode": "none",
                    },
                },
                {
                    "title": "Nhận diện nhạc cụ",
                    "activity_type": "listen_choose",
                    "instruction_text": "Nghe âm thanh rồi chọn đúng nhạc cụ.",
                    "config": {
                        "prompt": "Nghe âm thanh rồi chọn đúng nhạc cụ.",
                        "audio_url": "/lesson-media/nang/audio/flute.ogg",
                        "audio_lang": "vi-VN",
                        "correct": "flute",
                        "image_selection_mode": "carousel_find",
                        "image_cards": [
                            choice_card("flute", "Sáo trúc", "/lesson-media/nang/photos/bamboo-flute.jpg"),
                            choice_card("dan-bau", "Đàn bầu", "/lesson-media/nang/photos/dan-bau.jpg"),
                        ],
                    },
                },
            ],
        },
        {
            "subject_name": "Mỹ thuật",
            "title": "Tô màu và tạo hình đơn giản",
            "description": "Tô màu đúng mảng và kéo thả sticker để tạo bố cục đơn giản.",
            "activities": [
                {
                    "title": "Tô mảng màu",
                    "activity_type": "watch_answer",
                    "instruction_text": "Chọn màu rồi tô kín hình quả cam.",
                    "config": {
                        "prompt": "Chọn màu cam rồi tô kín hình quả cam.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=mythuat-fill",
                        "answer_mode": "none",
                    },
                },
                {
                    "title": "Bóc dán Sticker ảo",
                    "activity_type": "watch_answer",
                    "instruction_text": "Thêm sticker vào bức tranh vườn hoa.",
                    "config": {
                        "prompt": "Thêm sticker con ong và bươm bướm vào bức tranh vườn hoa.",
                        "media_url": "/lesson-media/nang/heavy-lab.html?activity=mythuat-card",
                        "answer_mode": "none",
                    },
                },
            ],
        },
        {
            "subject_name": "Giáo dục địa phương",
            "title": "Nhận diện đặc sản Đồng Nai",
            "description": "Xem flashcard đặc sản và ghép 2 mảnh ảnh quả bưởi.",
            "activities": [
                {
                    "title": "Flashcard Hình ảnh lớn",
                    "activity_type": "watch_answer",
                    "instruction_text": "Chạm để lật thẻ và xem phần ruột quả bưởi.",
                    "config": {
                        "prompt": "Chạm để lật thẻ và xem ruột quả bưởi Tân Triều.",
                        "media_url": "/lesson-media/nang/photos/buoi.jpg",
                        "media_kind": "image",
                        "answer_mode": "none",
                    },
                },
                {
                    "title": "Ghép 2 mảnh",
                    "activity_type": "image_puzzle",
                    "instruction_text": "Kéo 2 mảnh lại gần nhau để ghép thành quả hoàn chỉnh.",
                    "config": {
                        "prompt": "Kéo 2 mảnh lại gần nhau để ghép thành quả bưởi hoàn chỉnh.",
                        "image_url": "/lesson-media/nang/photos/buoi.jpg",
                        "rows": 1,
                        "cols": 2,
                        "piece_count": 2,
                    },
                },
            ],
        },
        {
            "subject_name": "Hoạt động trải nghiệm",
            "title": "Kỹ năng tự phục vụ cơ bản",
            "description": "Sắp xếp quy trình rửa tay và dùng bảng AAC để giao tiếp nhu cầu cơ bản.",
            "activities": [
                {
                    "title": "Task Analysis",
                    "activity_type": "step_by_step",
                    "instruction_text": "Sắp xếp đúng thứ tự rửa tay.",
                    "config": {
                        "prompt": "Sắp xếp đúng thứ tự rửa tay.",
                        "steps": ["Mở vòi nước", "Lấy xà phòng", "Rửa tay"],
                    },
                },
                {
                    "title": "Bảng AAC Giao tiếp",
                    "activity_type": "aac",
                    "instruction_text": "Bấm thẻ để app nói thay em.",
                    "config": {
                        "prompt": "Bấm vào thẻ để app nói thay em câu em muốn.",
                        "cards": ["Con muốn uống nước", "Con muốn ăn cơm", "Con mệt"],
                        "image_cards": [
                            choice_card("aac-food", "Cơm", "/lesson-media/nang/aac-com.svg"),
                            choice_card("aac-play", "Chơi", "/lesson-media/nang/aac-choi.svg"),
                        ],
                    },
                },
            ],
        },
    ]


def clear_heavy_lessons(teacher_id: int) -> None:
    lessons = Lesson.query.filter_by(created_by_teacher_id=teacher_id, primary_level="nang").all()
    for lesson in lessons:
        db.session.delete(lesson)
    db.session.flush()


def create_assignment_bundle(lesson: Lesson, classroom: Classroom, student_ids: list[int]) -> None:
    assignment = LessonAssignment(
        lesson_id=lesson.id,
        class_id=classroom.id,
        subject_id=lesson.subject_id,
        assigned_by_teacher_id=classroom.teacher_id,
        target_type="class",
        required_completion_percent=100,
        status="active",
    )
    db.session.add(assignment)
    db.session.flush()

    for student_id in student_ids:
        db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=student_id))
        db.session.add(
            StudentLessonProgress(
                assignment_id=assignment.id,
                student_id=student_id,
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


def seed_heavy_lessons() -> None:
    teacher = get_teacher()
    classroom = get_demo_classroom(teacher.id)
    subject_map = get_subject_map_for_classroom(classroom)
    heavy_student_ids = get_heavy_students(classroom)
    if not heavy_student_ids:
        raise RuntimeError("Lớp demo chưa có học sinh mức nặng để giao bài.")

    clear_heavy_lessons(teacher.id)

    created_count = 0
    for spec in build_heavy_specs():
        subject_name = str(spec["subject_name"])
        subject_key = canonical_subject_lookup(subject_name)
        subject = subject_map.get(subject_key)
        if not subject:
            raise RuntimeError(f"Không tìm thấy môn trong lớp demo cho dữ liệu nặng: {subject_name}")

        lesson = Lesson(
            created_by_teacher_id=teacher.id,
            subject_id=subject.id,
            title=str(spec["title"]),
            description=str(spec.get("description") or ""),
            primary_level="nang",
            estimated_minutes=15,
            difficulty_stage=1,
            is_published=True,
            is_archived=False,
        )
        db.session.add(lesson)
        db.session.flush()

        for sort_order, activity in enumerate(spec["activities"], start=1):
            db.session.add(
                LessonActivity(
                    lesson_id=lesson.id,
                    title=str(activity["title"]),
                    activity_type=str(activity["activity_type"]),
                    instruction_text=str(activity.get("instruction_text") or ""),
                    voice_answer_enabled=False,
                    is_required=(sort_order == 1),
                    sort_order=sort_order,
                    difficulty_stage=1,
                    config_json=json.dumps(activity.get("config") or {}, ensure_ascii=False),
                )
            )

        create_assignment_bundle(lesson, classroom, heavy_student_ids)
        created_count += 1
        safe_log(f"Đã nạp lại môn nặng: {subject.name}")

    db.session.commit()
    safe_log(f"Hoàn tất nạp {created_count} bài mức nặng cho lớp demo.")


def main() -> None:
    app = create_app()
    with app.app_context():
        seed_heavy_lessons()


if __name__ == "__main__":
    main()
