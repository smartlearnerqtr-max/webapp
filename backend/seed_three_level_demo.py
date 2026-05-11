from __future__ import annotations

import json
import subprocess
import sys
import unicodedata
from datetime import UTC, datetime, timedelta
from pathlib import Path

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
    StudentLessonProgress,
    StudentProfile,
    Subject,
    TeacherProfile,
    TeacherStudentLink,
    User,
)
from app.utils.security import hash_password

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_SOURCE = REPO_ROOT / "frontend" / "src" / "data" / "lessonTemplates.ts"

TEACHER_EMAIL = "teacher.levels.demo@example.com"
TEACHER_PASSWORD = "Teacher123!"
CLASS_NAME = "Lớp demo 3 mức"
CLASS_PASSWORD = "MUC3TEST"

STUDENT_DEMOS = [
    {
        "full_name": "Nguyễn Văn A",
        "email": "nguyenvana.demo@example.com",
        "password": "Student123!",
        "level": "nhe",
    },
    {
        "full_name": "Nguyễn Văn B",
        "email": "nguyenvanb.demo@example.com",
        "password": "Student123!",
        "level": "trung_binh",
    },
    {
        "full_name": "Nguyễn Văn C",
        "email": "nguyenvanc.demo@example.com",
        "password": "Student123!",
        "level": "nang",
    },
]

LEVEL_LABELS = {
    "nhe": "nhẹ",
    "trung_binh": "trung bình",
    "nang": "nặng",
}


def normalize_lookup(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return normalized.replace("đ", "d").replace("Đ", "D").lower().strip()


def build_subject_code(name: str) -> str:
    code = normalize_lookup(name)
    code = "".join(char if char.isalnum() else "_" for char in code)
    code = "_".join(part for part in code.split("_") if part)
    return f"DEMO_{code.upper()}"[:50]


def extract_object_block(source: str, marker: str) -> str:
    marker_index = source.find(marker)
    if marker_index < 0:
        raise RuntimeError(f"Không tìm thấy marker: {marker}")

    equals_index = source.find("=", marker_index)
    if equals_index < 0:
        raise RuntimeError(f"Không tìm thấy dấu gán mảng cho marker: {marker}")

    start_index = source.find("{", equals_index)
    if start_index < 0:
        raise RuntimeError(f"Không tìm thấy dấu mở mảng cho marker: {marker}")

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

    raise RuntimeError(f"Không đóng được mảng cho marker: {marker}")


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
        raise RuntimeError(result.stderr.strip() or "Node không parse được mảng template.")
    return json.loads(result.stdout)


def load_teacher_templates() -> dict[str, list[dict[str, object]]]:
    source = TEMPLATE_SOURCE.read_text(encoding="utf-8")
    object_block = extract_object_block(source, "export const SUBJECT_TEMPLATES")
    templates_by_level = evaluate_javascript_object(object_block)
    if not isinstance(templates_by_level, dict):
        raise RuntimeError("Dữ liệu SUBJECT_TEMPLATES không hợp lệ.")
    return templates_by_level


def upsert_user(email: str, password: str, role: str) -> User:
    normalized_email = email.strip().lower()
    user = User.query.filter_by(email=normalized_email).first()
    if not user:
        user = User(
            email=normalized_email,
            phone=None,
            password_hash=hash_password(password),
            role=role,
            status="active",
        )
        db.session.add(user)
        db.session.flush()
        return user

    user.password_hash = hash_password(password)
    user.role = role
    user.status = "active"
    return user


def upsert_teacher() -> TeacherProfile:
    user = upsert_user(TEACHER_EMAIL, TEACHER_PASSWORD, "teacher")
    profile = user.teacher_profile
    if not profile:
        profile = TeacherProfile(
            user_id=user.id,
            full_name="Cô Demo 3 Mức",
            school_name="Lớp học demo 3 mức",
            note="Tài khoản demo để test luồng giao bài theo 3 mức hỗ trợ.",
        )
        db.session.add(profile)
        db.session.flush()
        return profile

    profile.full_name = "Cô Demo 3 Mức"
    profile.school_name = "Lớp học demo 3 mức"
    profile.note = "Tài khoản demo để test luồng giao bài theo 3 mức hỗ trợ."
    return profile


def upsert_classroom(teacher: TeacherProfile) -> Classroom:
    classroom = Classroom.query.filter_by(teacher_id=teacher.id, name=CLASS_NAME).first()
    if not classroom:
        classroom = Classroom(
            teacher_id=teacher.id,
            name=CLASS_NAME,
            grade_label="Lớp tổng hợp",
            description="Lớp demo gồm học sinh mức nhẹ, trung bình và nặng.",
            default_disability_level=None,
            ui_variant=Classroom.UI_VARIANT_STANDARD,
            visual_theme=Classroom.VISUAL_THEME_GARDEN,
            background_image_url=None,
            status="active",
        )
        db.session.add(classroom)
        db.session.flush()
    else:
        classroom.grade_label = "Lớp tổng hợp"
        classroom.description = "Lớp demo gồm học sinh mức nhẹ, trung bình và nặng."
        classroom.default_disability_level = None
        classroom.ui_variant = Classroom.UI_VARIANT_STANDARD
        classroom.visual_theme = Classroom.VISUAL_THEME_GARDEN
        classroom.background_image_url = None
        classroom.status = "active"

    join_credential = classroom.join_credential
    if not join_credential:
        join_credential = ClassJoinCredential(class_id=classroom.id, join_password=CLASS_PASSWORD)
        db.session.add(join_credential)
    else:
        join_credential.join_password = CLASS_PASSWORD
    return classroom


def upsert_students(teacher: TeacherProfile, classroom: Classroom) -> dict[str, StudentProfile]:
    students_by_level: dict[str, StudentProfile] = {}

    for student_payload in STUDENT_DEMOS:
        level_code = str(student_payload["level"])
        level_label = LEVEL_LABELS.get(level_code, level_code)
        user = upsert_user(student_payload["email"], student_payload["password"], "student")
        profile = user.student_profile
        if not profile:
            profile = StudentProfile(
                user_id=user.id,
                full_name=student_payload["full_name"],
                disability_level=level_code,
                support_note=f"Học sinh demo mức {level_label}.",
                preferred_input="touch",
                preferred_read_speed="normal",
                preferred_font_size="medium",
                preferred_bg_color="warm",
                created_by_teacher_id=teacher.id,
            )
            db.session.add(profile)
            db.session.flush()
        else:
            profile.user_id = user.id
            profile.full_name = student_payload["full_name"]
            profile.disability_level = level_code
            profile.support_note = f"Học sinh demo mức {level_label}."
            profile.preferred_input = "touch"
            profile.preferred_read_speed = "normal"
            profile.preferred_font_size = "medium"
            profile.preferred_bg_color = "warm"
            profile.created_by_teacher_id = teacher.id

        teacher_link = TeacherStudentLink.query.filter_by(teacher_id=teacher.id, student_id=profile.id).first()
        if not teacher_link:
            teacher_link = TeacherStudentLink(
                teacher_id=teacher.id,
                student_id=profile.id,
                status="active",
                source="three_level_demo_seed",
            )
            db.session.add(teacher_link)
        else:
            teacher_link.status = "active"
            teacher_link.source = "three_level_demo_seed"

        class_link = ClassStudent.query.filter_by(class_id=classroom.id, student_id=profile.id).first()
        if not class_link:
            class_link = ClassStudent(class_id=classroom.id, student_id=profile.id, status="active")
            db.session.add(class_link)
        else:
            class_link.status = "active"

        students_by_level[student_payload["level"]] = profile

    return students_by_level


def ensure_subject(name: str, sort_order: int) -> Subject:
    code = build_subject_code(name)
    subject = Subject.query.filter_by(code=code).first()
    if not subject:
        subject = Subject(code=code, name=name)
        db.session.add(subject)
        db.session.flush()

    subject.name = name
    subject.description = f"Môn học demo seed cho giáo viên - {name}"
    subject.sort_order = sort_order
    subject.is_active = True
    return subject


def ensure_class_subject(classroom: Classroom, subject: Subject, sort_order: int) -> None:
    link = ClassSubject.query.filter_by(class_id=classroom.id, subject_id=subject.id).first()
    if not link:
        link = ClassSubject(class_id=classroom.id, subject_id=subject.id)
        db.session.add(link)

    link.sort_order = sort_order
    link.is_active = True


def upsert_lesson_from_template(
    teacher: TeacherProfile,
    subject: Subject,
    level: str,
    template: dict[str, object],
) -> Lesson:
    candidate_lessons = (
        Lesson.query.filter_by(
            created_by_teacher_id=teacher.id,
            subject_id=subject.id,
            primary_level=level,
        )
        .order_by(Lesson.id.asc())
        .all()
    )
    lesson = next((item for item in candidate_lessons if item.assignments), None)
    if not lesson:
        lesson = next((item for item in candidate_lessons if item.title == str(template["lessonTitle"])), None)
    if not lesson and candidate_lessons:
        lesson = candidate_lessons[0]
    if not lesson:
        lesson = Lesson(
            created_by_teacher_id=teacher.id,
            subject_id=subject.id,
            title=str(template["lessonTitle"]),
        )
        db.session.add(lesson)

    description_parts = [
        f"Chu de: {template['topicSummary']}",
        str(template.get("description") or "").strip(),
    ]
    notes = str(template.get("notes") or "").strip()
    if notes:
        description_parts.append(f"Ghi chu: {notes}")

    lesson.title = str(template["lessonTitle"])
    lesson.description = "\n".join(part for part in description_parts if part)
    lesson.primary_level = level
    lesson.estimated_minutes = int(template.get("estimatedMinutes") or 15)
    level_map = {"nhe": 1, "trung_binh": 2, "nang": 3}
    lesson.difficulty_stage = level_map.get(level, 1)
    lesson.is_published = True
    lesson.is_archived = False
    db.session.flush()

    duplicate_lessons = [item for item in candidate_lessons if item.id != lesson.id]
    for duplicate in duplicate_lessons:
        for assignment in duplicate.assignments:
            assignment.lesson_id = lesson.id
            assignment.subject_id = lesson.subject_id
        db.session.flush()
        db.session.delete(duplicate)

    existing_activities = {
        activity.sort_order: activity
        for activity in LessonActivity.query.filter_by(lesson_id=lesson.id).all()
    }
    activities = template.get("activities") or []
    incoming_orders = set(range(1, len(activities) + 1))

    for activity in list(existing_activities.values()):
        if activity.sort_order not in incoming_orders:
            db.session.delete(activity)

    for index, activity_payload in enumerate(activities, start=1):
        activity = existing_activities.get(index)
        if not activity:
            activity = LessonActivity(lesson_id=lesson.id, sort_order=index)
            db.session.add(activity)

        activity.title = str(activity_payload["title"])
        activity.activity_type = str(activity_payload["activityType"])
        activity.instruction_text = activity_payload.get("instructionText")
        activity.voice_answer_enabled = bool(activity_payload.get("voiceAnswerEnabled", False))
        activity.is_required = True
        activity.sort_order = index
        activity.difficulty_stage = level_map.get(level, 1)
        activity.config_json = json.dumps(activity_payload.get("config") or {}, ensure_ascii=False)

    return lesson


def sync_assignment_for_level(
    classroom: Classroom,
    teacher: TeacherProfile,
    lesson: Lesson,
    student: StudentProfile,
) -> LessonAssignment:
    assignment = LessonAssignment.query.filter_by(
        lesson_id=lesson.id,
        class_id=classroom.id,
        assigned_by_teacher_id=teacher.id,
    ).first()
    if not assignment:
        assignment = LessonAssignment(
            lesson_id=lesson.id,
            class_id=classroom.id,
            subject_id=lesson.subject_id,
            assigned_by_teacher_id=teacher.id,
        )
        db.session.add(assignment)
        db.session.flush()

    assignment.subject_id = lesson.subject_id
    assignment.target_type = "class"
    assignment.due_at = datetime.now(UTC) + timedelta(days=30)
    assignment.required_completion_percent = 100
    assignment.status = "active"

    expected_student_ids = {student.id}

    existing_assignment_students = LessonAssignmentStudent.query.filter_by(assignment_id=assignment.id).all()
    for assignment_student in existing_assignment_students:
        if assignment_student.student_id not in expected_student_ids:
            db.session.delete(assignment_student)

    existing_progresses = StudentLessonProgress.query.filter_by(assignment_id=assignment.id).all()
    for progress in existing_progresses:
        if progress.student_id not in expected_student_ids:
            db.session.delete(progress)

    assignment_student = LessonAssignmentStudent.query.filter_by(
        assignment_id=assignment.id,
        student_id=student.id,
    ).first()
    if not assignment_student:
        db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=student.id))

    progress = StudentLessonProgress.query.filter_by(
        assignment_id=assignment.id,
        student_id=student.id,
    ).first()
    if not progress:
        progress = StudentLessonProgress(
            assignment_id=assignment.id,
            student_id=student.id,
        )
        db.session.add(progress)

    progress.status = "not_started"
    progress.progress_percent = 0
    progress.total_learning_seconds = 0
    progress.retry_count = 0
    progress.help_count = 0
    progress.reward_star_count = 0
    progress.completion_score = 0
    progress.completed_at = None

    return assignment


def seed_three_level_demo() -> dict[str, object]:
    templates_by_level = load_teacher_templates()
    teacher = upsert_teacher()
    classroom = upsert_classroom(teacher)
    students_by_level = upsert_students(teacher, classroom)

    ordered_subject_names: list[str] = []
    for level in ("nhe", "trung_binh", "nang"):
        for template in templates_by_level[level]:
            subject_name = str(template["subjectName"])
            if subject_name not in ordered_subject_names:
                ordered_subject_names.append(subject_name)

    subjects_by_name: dict[str, Subject] = {}
    for index, subject_name in enumerate(ordered_subject_names, start=1):
        subject = ensure_subject(subject_name, 100 + index)
        ensure_class_subject(classroom, subject, index)
        subjects_by_name[subject_name] = subject

    lesson_count = 0
    activity_count = 0
    assignment_count = 0
    kept_lesson_ids: set[int] = set()

    for level in ("nhe", "trung_binh", "nang"):
        student = students_by_level[level]
        for template in templates_by_level[level]:
            subject = subjects_by_name[str(template["subjectName"])]
            lesson = upsert_lesson_from_template(teacher, subject, level, template)
            sync_assignment_for_level(classroom, teacher, lesson, student)
            kept_lesson_ids.add(lesson.id)
            lesson_count += 1
            activity_count += len(template.get("activities") or [])
            assignment_count += 1

    obsolete_lessons = Lesson.query.filter_by(created_by_teacher_id=teacher.id).all()
    for lesson in obsolete_lessons:
        if lesson.id not in kept_lesson_ids:
            db.session.delete(lesson)

    db.session.commit()

    return {
        "teacher": {
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "full_name": teacher.full_name,
        },
        "classroom": {
            "id": classroom.id,
            "name": classroom.name,
            "password": CLASS_PASSWORD,
        },
        "students": STUDENT_DEMOS,
        "subjects": len(ordered_subject_names),
        "lessons": lesson_count,
        "activities": activity_count,
        "assignments": assignment_count,
    }


def main() -> int:
    app = create_app()
    with app.app_context():
        db.create_all()
        payload = seed_three_level_demo()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Three-level demo data seeded successfully.")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
