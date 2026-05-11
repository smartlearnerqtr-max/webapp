from __future__ import annotations

import json
import subprocess
import sys
import unicodedata
from pathlib import Path

from app import create_app
from app.extensions import db
from app.models import Classroom, Lesson, LessonActivity, LessonAssignment, LessonAssignmentStudent, StudentLessonProgress, Subject, TeacherProfile, User

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_SOURCE = REPO_ROOT / "frontend" / "src" / "data" / "lessonTemplates.ts"

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


def extract_object_block(source: str, marker: str) -> str:
    marker_index = source.find(marker)
    if marker_index < 0:
        raise RuntimeError(f"Không tìm thấy marker: {marker}")

    equals_index = source.find("=", marker_index)
    if equals_index < 0:
        raise RuntimeError(f"Không tìm thấy dấu gán cho marker: {marker}")

    start_index = source.find("{", equals_index)
    if start_index < 0:
        raise RuntimeError(f"Không tìm thấy object mở cho marker: {marker}")

    depth = 0
    in_string: str | None = None
    escaping = False

    for index in range(start_index, len(source)):
        char = source[index]
        if in_string:
            if escaping:
                escaping = False
            elif char == "\\":
                escaping = True
            elif char == in_string:
                in_string = None
            continue

        if char in {"'", '"', "`"}:
            in_string = char
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[start_index:index + 1]

    raise RuntimeError(f"Không đọc được block cho marker: {marker}")


def evaluate_javascript_object(object_block: str) -> dict[str, list[dict[str, object]]]:
    script = """
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(0, 'utf8');
const value = vm.runInNewContext(`(${source})`);
process.stdout.write(JSON.stringify(value));
"""
    result = subprocess.run(
        ["node", "-e", script],
        input=object_block,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Node không parse được SUBJECT_TEMPLATES.")
    parsed = json.loads(result.stdout)
    if not isinstance(parsed, dict):
        raise RuntimeError("SUBJECT_TEMPLATES không hợp lệ.")
    return parsed


def load_medium_templates() -> list[dict[str, object]]:
    source = TEMPLATE_SOURCE.read_text(encoding="utf-8")
    object_block = extract_object_block(source, "export const SUBJECT_TEMPLATES")
    templates_by_level = evaluate_javascript_object(object_block)
    medium_templates = templates_by_level.get("trung_binh")
    if not isinstance(medium_templates, list):
        raise RuntimeError("Không tìm thấy template mức trung bình.")
    return medium_templates


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


def get_medium_students(classroom: Classroom) -> list[int]:
    student_ids: list[int] = []
    for class_student in classroom.students:
        if class_student.status != "active" or not class_student.student:
            continue
        if class_student.student.disability_level == "trung_binh":
            student_ids.append(class_student.student_id)
    return student_ids


def choice_card(card_id: str, label: str, media_url: str) -> dict[str, object]:
    return {
        "id": card_id,
        "label": label,
        "media_url": media_url,
        "media_kind": "image",
    }


def build_medium_activity_specs(subject_key: str, template: dict[str, object]) -> list[dict[str, object]]:
    h1 = dict(template["h1"])
    h2 = dict(template["h2"])

    if subject_key == "ngu van":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "image_choice",
                "instruction_text": "Quan sát hình rồi chọn đúng nhân vật trong câu chuyện.",
                "config": {
                    "prompt": "Ai đang ngồi ở đáy giếng?",
                    "correct": "frog",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("frog", "Con ếch", "/lesson-media/trung-binh/frog-card.svg"),
                        choice_card("turtle", "Con rùa", "/lesson-media/trung-binh/turtle-card.svg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Kéo các ý chính vào sơ đồ để hoàn thành câu chuyện.",
                "config": {
                    "prompt": "Kéo các ý chính vào sơ đồ để hoàn thành cốt truyện.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=ngu-van-mindmap",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "toan hoc":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "drag_drop",
                "instruction_text": "Ghép đồ vật vào đúng nhóm hình khối.",
                "config": {
                    "prompt": "Kéo từng đồ vật vào đúng nhóm hình học của nó.",
                    "items": ["Kim tự tháp", "Cái lều", "Tủ lạnh", "Hộp sữa"],
                    "targets": ["Hình chóp", "Hình lăng trụ"],
                    "visual_style": "shape_3d",
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Đưa đủ 4 xu vào máy tính tiền để mua 2 cái kẹo.",
                "config": {
                    "prompt": "Đưa đủ 4 xu vào máy tính tiền để mua 2 cái kẹo.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=toan-coins",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "tieng anh":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "listen_choose",
                "instruction_text": "Nghe thật kỹ rồi chọn đúng phương tiện.",
                "config": {
                    "prompt": "Nghe thật kỹ rồi chọn đúng phương tiện.",
                    "audio_text": "Bus",
                    "audio_lang": "en-US",
                    "correct": "bus",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("bus", "Bus", "/lesson-media/trung-binh/bus-card.svg"),
                        choice_card("bicycle", "Bicycle", "/lesson-media/trung-binh/bicycle-card.svg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Xem thẻ Festival rồi đọc lại từ mới.",
                "config": {
                    "prompt": "Xem thẻ Festival rồi đọc lại từ mới.",
                    "media_url": "/lesson-media/nhe/photos/festival-viet-nam.jpg",
                    "media_kind": "image",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "khoa hoc tu nhien":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "multiple_choice",
                "instruction_text": "Chọn đáp án đúng về nam châm.",
                "config": {
                    "prompt": "Nam châm có hút sắt không?",
                    "choices": ["Đúng", "Sai"],
                    "correct": "Đúng",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=khtn-magnet",
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Đưa nam châm lại gần từng vật để quan sát vật nào bị hút.",
                "config": {
                    "prompt": "Đưa nam châm lại gần từng vật để quan sát vật nào bị hút.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=khtn-magnet",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "lich su dia ly":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Chạm vào Châu Mỹ trên quả địa cầu mô phỏng.",
                "config": {
                    "prompt": "Chạm vào Châu Mỹ trên quả địa cầu mô phỏng.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=lsdl-globe",
                    "answer_mode": "none",
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Nối đường đi từ Châu Âu sang Châu Á cho con thuyền chạy qua.",
                "config": {
                    "prompt": "Nối đường đi từ Châu Âu sang Châu Á cho con thuyền chạy qua.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=lsdl-route",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "cong nghe":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "image_choice",
                "instruction_text": "Chọn đúng nông cụ dùng để đào đất.",
                "config": {
                    "prompt": "Vật nào dùng để đào đất?",
                    "correct": "shovel",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("hoe", "Cái cuốc", "/lesson-media/trung-binh/hoe-card.svg"),
                        choice_card("shovel", "Cái xẻng", "/lesson-media/trung-binh/shovel-card.svg"),
                        choice_card("knife", "Con dao", "/lesson-media/trung-binh/knife-card.svg"),
                        choice_card("bowl", "Cái chén", "/lesson-media/trung-binh/bowl-card.svg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Kéo các bước vào đúng thứ tự để cây lớn lên.",
                "config": {
                    "prompt": "Kéo các bước vào đúng thứ tự để cây lớn lên.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=congnghe-grow",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "giao duc cong dan":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Làm theo nhịp thở để bình tĩnh lại trước khi học tiếp.",
                "config": {
                    "prompt": "Làm theo nhịp thở để bình tĩnh lại trước khi học tiếp.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=gdcd-calm",
                    "answer_mode": "none",
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "multiple_choice",
                "instruction_text": "Chọn cách ứng xử đúng khi thấy bạn bị bắt nạt.",
                "config": {
                    "prompt": "Nếu thấy bạn bị bắt nạt, em nên làm gì?",
                    "choices": ["Báo cô giáo", "Đánh lại", "Đứng xem"],
                    "correct": "Báo cô giáo",
                    "media_url": "https://www.youtube.com/embed/plU2JksBYV0?rel=0&playsinline=1",
                },
            },
        ]

    if subject_key == "tin hoc":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "image_choice",
                "instruction_text": "Chọn đúng thiết bị dùng để gõ chữ.",
                "config": {
                    "prompt": "Thiết bị nào dùng để gõ chữ?",
                    "correct": "keyboard",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("keyboard", "Bàn phím", "/lesson-media/trung-binh/keyboard-card.svg"),
                        choice_card("monitor", "Màn hình", "/lesson-media/trung-binh/monitor-card.svg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "multiple_choice",
                "instruction_text": "Chọn cách xử lý an toàn khi có người xin mật khẩu.",
                "config": {
                    "prompt": "Nếu có người xin mật khẩu, em nên làm gì?",
                    "choices": ["Không cho", "Báo người lớn", "Gửi ngay mật khẩu"],
                    "correct": "Không cho",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=tinhoc-safe",
                },
            },
        ]

    if subject_key == "giao duc the chat":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "image_choice",
                "instruction_text": "Chọn đúng tư thế chạy.",
                "config": {
                    "prompt": "Hình nào là tư thế chạy đúng?",
                    "correct": "running-correct",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("running-correct", "Chạy đúng tư thế", "/lesson-media/nhe/running-correct.svg"),
                        choice_card("running-wrong", "Chạy sai tư thế", "/lesson-media/nhe/running-wrong.svg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Chạm vào các vòng sáng theo nhịp.",
                "config": {
                    "prompt": "Chạm lần lượt vào các vòng sáng theo nhịp 1 2 3 4.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=gdtc-ar",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "am nhac":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "listen_choose",
                "instruction_text": "Nghe âm thanh thật rồi chọn đúng nhạc cụ.",
                "config": {
                    "prompt": "Nghe âm thanh thật rồi chọn đúng nhạc cụ.",
                    "audio_url": "/lesson-media/nhe/audio/flute.ogg",
                    "audio_lang": "vi-VN",
                    "correct": "flute",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("drum", "Trống", "/lesson-media/trung-binh/drum-card.svg"),
                        choice_card("flute", "Sáo", "/lesson-media/nhe/photos/bamboo-flute.jpg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Canh đúng nhịp rồi chạm vào mặt trống.",
                "config": {
                    "prompt": "Canh đúng nhịp rồi chạm vào mặt trống khi nốt nhạc chạm đích.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=amnhac-drum",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "my thuat":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Chọn màu rồi tô kín quả cam.",
                "config": {
                    "prompt": "Chọn màu rồi tô kín quả cam cho nổi bật.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=mythuat-fill",
                    "answer_mode": "none",
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Nắn khối đất sét ảo để tạo thành chiếc bình.",
                "config": {
                    "prompt": "Nắn khối đất sét ảo để tạo thành chiếc bình đơn giản.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=mythuat-pottery",
                    "answer_mode": "none",
                },
            },
        ]

    if subject_key == "giao duc dia phuong":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "image_choice",
                "instruction_text": "Chọn đúng đặc sản Đồng Nai.",
                "config": {
                    "prompt": "Đâu là hình Bưởi Tân Triều?",
                    "correct": "buoi",
                    "image_selection_mode": "carousel_find",
                    "image_cards": [
                        choice_card("buoi", "Bưởi Tân Triều", "/lesson-media/nhe/photos/buoi.jpg"),
                        choice_card("vai", "Vải thiều", "/lesson-media/trung-binh/vai-card.svg"),
                        choice_card("nhan", "Nhãn", "/lesson-media/trung-binh/nhan-card.svg"),
                    ],
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "multiple_choice",
                "instruction_text": "Xem clip rồi chọn đúng đặc sản đang được giới thiệu.",
                "config": {
                    "prompt": "Sau khi xem clip, em chọn đúng đặc sản đang được giới thiệu.",
                    "choices": ["Bưởi Tân Triều", "Vải thiều", "Nhãn"],
                    "correct": "Bưởi Tân Triều",
                    "media_url": "https://www.youtube.com/embed/DQhT-cBk7Vo?rel=0&playsinline=1",
                },
            },
        ]

    if subject_key == "hoat dong trai nghiem":
        return [
            {
                "title": str(h1["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Soạn đúng sách đi học và để đồ chơi ở ngoài balo.",
                "config": {
                    "prompt": "Soạn đúng sách đi học và để đồ chơi ở ngoài balo.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=hdtn-bag",
                    "answer_mode": "none",
                },
            },
            {
                "title": str(h2["title"]),
                "activity_type": "watch_answer",
                "instruction_text": "Tập ưu tiên bỏ tiền tiết kiệm trước rồi mới chọn món muốn mua.",
                "config": {
                    "prompt": "Tập ưu tiên bỏ tiền tiết kiệm trước rồi mới chọn món muốn mua.",
                    "media_url": "/lesson-media/trung-binh/medium-lab.html?activity=hdtn-budget",
                    "answer_mode": "none",
                },
            },
        ]

    raise RuntimeError(f"Chưa có cấu hình mức trung bình cho môn: {template['subject_name']}")


def clear_medium_lessons(teacher_id: int) -> None:
    lessons = Lesson.query.filter_by(created_by_teacher_id=teacher_id, primary_level="trung_binh").all()
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


def seed_medium_lessons() -> None:
    teacher = get_teacher()
    classroom = get_demo_classroom(teacher.id)
    subject_map = get_subject_map_for_classroom(classroom)
    medium_student_ids = get_medium_students(classroom)
    if not medium_student_ids:
        raise RuntimeError("Lớp demo chưa có học sinh mức trung bình để giao bài.")

    templates = load_medium_templates()

    clear_medium_lessons(teacher.id)

    created_count = 0
    for template in templates:
        subject_name = str(template["subject_name"])
        subject_key = canonical_subject_lookup(subject_name)
        subject = subject_map.get(subject_key)
        if not subject:
            raise RuntimeError(f"Không tìm thấy môn trong lớp demo cho template: {subject_name}")

        lesson = Lesson(
            created_by_teacher_id=teacher.id,
            subject_id=subject.id,
            title=str(template["title"]),
            description=str(template.get("description") or ""),
            primary_level="trung_binh",
            estimated_minutes=15,
            difficulty_stage=1,
            is_published=True,
            is_archived=False,
        )
        db.session.add(lesson)
        db.session.flush()

        activities = build_medium_activity_specs(subject_key, template)
        for sort_order, spec in enumerate(activities, start=1):
            db.session.add(
                LessonActivity(
                    lesson_id=lesson.id,
                    title=str(spec["title"]),
                    activity_type=str(spec["activity_type"]),
                    instruction_text=str(spec.get("instruction_text") or ""),
                    voice_answer_enabled=False,
                    is_required=(sort_order == 1),
                    sort_order=sort_order,
                    difficulty_stage=1,
                    config_json=json.dumps(spec.get("config") or {}, ensure_ascii=False),
                )
            )

        create_assignment_bundle(lesson, classroom, medium_student_ids)
        created_count += 1
        safe_log(f"Đã nạp lại môn trung bình: {subject.name}")

    db.session.commit()
    safe_log(f"Hoàn tất nạp {created_count} bài mức trung bình cho lớp demo.")


def main() -> None:
    app = create_app()
    with app.app_context():
        seed_medium_lessons()


if __name__ == "__main__":
    main()
