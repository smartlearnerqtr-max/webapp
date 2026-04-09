from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import app.api.v1.routes.ai_settings as ai_routes
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
    RealtimeEvent,
    ServerLog,
    StudentLessonProgress,
    StudentProfile,
    TeacherParentStudentLink,
    TeacherProfile,
    TeacherStudentLink,
    User,
    UserAISetting,
)
from app.services.gemini_service import GeminiResult
from app.services.seed_service import seed_subjects
from flask_jwt_extended import create_access_token

PASSWORD = "123456"
ADMIN_EMAIL = (os.getenv("ADMIN_EMAIL") or "admin@example.com").strip().lower()

TEACHER_SPECS = [
    {
        "email": "user001@gmail.com",
        "full_name": "C\u00f4 Minh Anh",
        "school_name": "Tr\u01b0\u1eddng Ho\u00e0 B\u00ecnh",
        "class_name": "L\u1edbp M\u1eb7t Tr\u1eddi",
        "grade_label": "3",
    }
]

STUDENT_SPECS = [
    {
        "slug": "hoang-an",
        "full_name": "Nguy\u1ec5n Ho\u00e0ng An",
        "disability_level": "nhe",
        "preferred_input": "touch",
    }
]

PARENT_SPECS = [
    {
        "slug": "hoa",
        "full_name": "L\u00ea Th\u1ecb Ho\u00e0",
        "relationship_label": "M\u1eb9",
    }
]

LESSON_BLUEPRINTS = [
    {
        "subject_code": "TOAN",
        "title": "S\u1ed1 h\u1ecdc: \u0110\u1ebfm v\u00e0 c\u1ed9ng trong ph\u1ea1m vi 10",
        "description": "B\u00e0i h\u1ecdc gi\u00fap h\u1ecdc sinh l\u00e0m quen v\u1edbi ph\u00e9p \u0111\u1ebfm, ph\u00e9p c\u1ed9ng \u0111\u01a1n gi\u1ea3n v\u00e0 thao t\u00e1c b\u1eb1ng h\u00ecnh \u1ea3nh minh ho\u1ea1.",
        "primary_level": "nhe",
        "estimated_minutes": 18,
        "activities": [
            {
                "title": "Ch\u1ecdn \u0111\u00e1p \u00e1n \u0111\u00fang",
                "activity_type": "multiple_choice",
                "instruction_text": "Quan s\u00e1t tranh v\u00e0 ch\u1ecdn \u0111\u00e1p \u00e1n \u0111\u00fang.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "multiple_choice",
                    "prompt": "C\u00f3 4 qu\u1ea3 t\u00e1o, th\u00eam 2 qu\u1ea3 n\u1eefa. T\u1ea5t c\u1ea3 l\u00e0 bao nhi\u00eau qu\u1ea3?",
                    "choices": ["5", "6", "7"],
                    "correct": "6",
                    "image_url": "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=1200&q=80",
                },
            },
            {
                "title": "K\u00e9o th\u1ea3 ph\u00e9p t\u00ednh",
                "activity_type": "drag_drop",
                "instruction_text": "K\u00e9o ph\u00e9p t\u00ednh v\u00e0o k\u1ebft qu\u1ea3 ph\u00f9 h\u1ee3p.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "drag_drop",
                    "prompt": "Gh\u00e9p ph\u00e9p t\u00ednh v\u1edbi k\u1ebft qu\u1ea3 \u0111\u00fang.",
                    "items": ["1 + 2", "3 + 4", "5 + 2"],
                    "targets": ["3", "7", "7"],
                    "illustration_url": "https://images.unsplash.com/photo-1516117172878-fd2c41f4a759?auto=format&fit=crop&w=1200&q=80",
                },
            },
            {
                "title": "L\u00e0m theo t\u1eebng b\u01b0\u1edbc",
                "activity_type": "step_by_step",
                "instruction_text": "L\u00e0m l\u1ea7n l\u01b0\u1ee3t t\u1eebng b\u01b0\u1edbc \u0111\u1ec3 t\u00ednh ph\u00e9p c\u1ed9ng.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "step_by_step",
                    "prompt": "T\u00ednh 2 + 3 b\u1eb1ng que t\u00ednh.",
                    "steps": [
                        "B\u01b0\u1edbc 1: L\u1ea5y 2 que t\u00ednh.",
                        "B\u01b0\u1edbc 2: L\u1ea5y th\u00eam 3 que t\u00ednh.",
                        "B\u01b0\u1edbc 3: \u0110\u1ebfm t\u1ea5t c\u1ea3 que t\u00ednh \u0111\u1ec3 t\u00ecm k\u1ebft qu\u1ea3.",
                    ],
                },
            },
        ],
    },
    {
        "subject_code": "KHTN",
        "title": "\u0110\u1ed9ng v\u1eadt: Nh\u1eadn bi\u1ebft con v\u1eadt quen thu\u1ed9c",
        "description": "B\u00e0i h\u1ecdc k\u1ebft h\u1ee3p \u1ea3nh, video v\u00e0 h\u1ed9i tho\u1ea1i AI \u0111\u1ec3 h\u1ecdc sinh nh\u1eadn bi\u1ebft c\u00e1c con v\u1eadt quen thu\u1ed9c quanh em.",
        "primary_level": "trung_binh",
        "estimated_minutes": 20,
        "activities": [
            {
                "title": "N\u1ed1i con v\u1eadt v\u1edbi \u0111\u1eb7c \u0111i\u1ec3m",
                "activity_type": "matching",
                "instruction_text": "N\u1ed1i m\u1ed7i con v\u1eadt v\u1edbi \u0111\u1eb7c \u0111i\u1ec3m n\u1ed5i b\u1eadt c\u1ee7a n\u00f3.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "matching",
                    "prompt": "Gh\u00e9p \u0111\u00fang con v\u1eadt v\u1edbi n\u01a1i s\u1ed1ng ho\u1eb7c ti\u1ebfng k\u00eau.",
                    "pairs": [
                        {"left": "M\u00e8o", "right": "K\u00eau meo meo"},
                        {"left": "C\u00e1", "right": "S\u1ed1ng d\u01b0\u1edbi n\u01b0\u1edbc"},
                        {"left": "G\u00e0", "right": "C\u00f3 l\u00f4ng v\u0169"},
                    ],
                    "image_url": "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80",
                },
            },
            {
                "title": "Xem video v\u00e0 tr\u1ea3 l\u1eddi",
                "activity_type": "watch_answer",
                "instruction_text": "Xem video ng\u1eafn r\u1ed3i tr\u1ea3 l\u1eddi b\u1eb1ng m\u1ed9t c\u00e2u \u0111\u01a1n gi\u1ea3n.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "watch_answer",
                    "media_url": "https://www.youtube.com/watch?v=J---aiyznGQ",
                    "prompt": "Sau khi xem video, em h\u00e3y k\u1ec3 t\u00ean 2 con v\u1eadt em nh\u00ecn th\u1ea5y.",
                },
            },
            {
                "title": "Tr\u00f2 chuy\u1ec7n v\u1edbi AI v\u1ec1 con v\u1eadt em th\u00edch",
                "activity_type": "ai_chat",
                "instruction_text": "Tr\u1ea3 l\u1eddi ng\u1eafn g\u1ecdn \u0111\u1ec3 AI khuy\u1ebfn kh\u00edch em di\u1ec5n \u0111\u1ea1t t\u1ef1 nhi\u00ean h\u01a1n.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "ai_chat",
                    "starter_prompt": "H\u00e3y \u0111\u00f3ng vai gi\u00e1o vi\u00ean v\u00e0 h\u1ecfi h\u1ecdc sinh 3 c\u00e2u ng\u1eafn v\u1ec1 con v\u1eadt em y\u00eau th\u00edch.",
                    "goals": ["Bi\u1ebft g\u1ecdi t\u00ean con v\u1eadt", "Bi\u1ebft n\u00f3i n\u01a1i s\u1ed1ng", "Bi\u1ebft n\u00f3i l\u00fd do y\u00eau th\u00edch"],
                },
            },
        ],
    },
    {
        "subject_code": "TOAN",
        "title": "H\u00ecnh h\u1ecdc: Nh\u1eadn bi\u1ebft h\u00ecnh tr\u00f2n, h\u00ecnh vu\u00f4ng, h\u00ecnh tam gi\u00e1c",
        "description": "B\u00e0i h\u1ecdc d\u00f9ng \u00e2m thanh, th\u1ebb giao ti\u1ebfp v\u00e0 m\u00f4 ph\u1ecfng \u0111\u1ec3 h\u1ecdc sinh nh\u1eadn bi\u1ebft c\u00e1c h\u00ecnh d\u1ea1ng c\u01a1 b\u1ea3n.",
        "primary_level": "trung_binh",
        "estimated_minutes": 22,
        "activities": [
            {
                "title": "Nghe v\u00e0 ch\u1ecdn h\u00ecnh \u0111\u00fang",
                "activity_type": "listen_choose",
                "instruction_text": "Nghe th\u1eadt k\u1ef9 r\u1ed3i ch\u1ecdn h\u00ecnh ph\u00f9 h\u1ee3p.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "listen_choose",
                    "audio_text": "H\u00ecnh n\u00e0o c\u00f3 ba c\u1ea1nh?",
                    "choices": ["H\u00ecnh tr\u00f2n", "H\u00ecnh vu\u00f4ng", "H\u00ecnh tam gi\u00e1c"],
                    "correct": "H\u00ecnh tam gi\u00e1c",
                },
            },
            {
                "title": "Ch\u1ecdn th\u1ebb giao ti\u1ebfp",
                "activity_type": "aac",
                "instruction_text": "Ch\u1ecdn th\u1ebb \u0111\u1ec3 n\u00f3i \u0111\u00fang t\u00ean h\u00ecnh.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "aac",
                    "prompt": "Khi c\u00f4 \u0111\u01b0a m\u1ed9t chi\u1ebfc \u0111\u0129a l\u00ean, em s\u1ebd ch\u1ecdn th\u1ebb n\u00e0o?",
                    "cards": ["\u0110\u00e2y l\u00e0 h\u00ecnh tr\u00f2n", "\u0110\u00e2y l\u00e0 h\u00ecnh vu\u00f4ng", "Con c\u1ea7n c\u00f4 gi\u00fap"],
                    "image_url": "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80",
                },
            },
            {
                "title": "M\u00f4 ph\u1ecfng t\u00ecm \u0111\u1ed3 v\u1eadt theo h\u00ecnh",
                "activity_type": "career_simulation",
                "instruction_text": "L\u00e0m theo t\u00ecnh hu\u1ed1ng m\u00f4 ph\u1ecfng nh\u01b0 \u0111ang gi\u00fap c\u00f4 s\u1eafp x\u1ebfp l\u1edbp h\u1ecdc.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "career_simulation",
                    "scenario": "Em \u0111\u00f3ng vai tr\u1ee3 l\u00fd l\u1edbp h\u1ecdc, t\u00ecm \u0111\u1ed3 v\u1eadt h\u00ecnh tr\u00f2n, h\u00ecnh vu\u00f4ng v\u00e0 h\u00ecnh tam gi\u00e1c \u0111\u1ec3 c\u1ea5t v\u00e0o \u0111\u00fang khay.",
                    "success_criteria": "G\u1ecdi \u0111\u00fang t\u00ean h\u00ecnh, ch\u1ecdn \u0111\u00fang \u0111\u1ed3 v\u1eadt v\u00e0 ho\u00e0n th\u00e0nh \u0111\u1ee7 3 khay.",
                },
            },
        ],
    },
]

PROGRESS_PROFILES = [
    {"status": "completed", "progress_percent": 100, "total_learning_seconds": 540, "retry_count": 0, "help_count": 0, "reward_star_count": 5, "completion_score": 97, "complete": True},
    {"status": "completed", "progress_percent": 100, "total_learning_seconds": 620, "retry_count": 1, "help_count": 1, "reward_star_count": 5, "completion_score": 92, "complete": True},
    {"status": "in_progress", "progress_percent": 78, "total_learning_seconds": 455, "retry_count": 2, "help_count": 2, "reward_star_count": 4, "completion_score": 81, "complete": False},
]

def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def api_json(response):
    payload = response.get_json()
    expect(payload is not None, "Response is not valid JSON")
    return payload


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def request_json(client, method: str, path: str, expected_status: int | tuple[int, ...], **kwargs):
    response = client.open(path, method=method, **kwargs)
    expected_codes = (expected_status,) if isinstance(expected_status, int) else expected_status
    expect(response.status_code in expected_codes, f"{method} {path} failed: {response.status_code} {response.get_data(as_text=True)}")
    return api_json(response)


def login(client, email: str, password: str) -> dict[str, object]:
    return request_json(client, "POST", "/api/v1/auth/login", 200, json={"identity": email, "password": password})["data"]


def create_token_for_user(user: User) -> str:
    return create_access_token(identity=str(user.id), additional_claims={"role": user.role})


def configure_fake_ai() -> None:
    def fake_generate_text(**kwargs):
        return GeminiResult(
            text=f"Ph\u1ea3n h\u1ed3i Gemini m\u00f4 ph\u1ecfng cho m\u00f4 h\u00ecnh {kwargs['model_name']}",
            model_name=kwargs["model_name"],
            prompt_feedback=None,
            usage_metadata={"promptTokenCount": 24},
            raw_response={"mocked": True},
        )

    ai_routes.generate_text = fake_generate_text


def purge_non_admin_data() -> None:
    for model in [
        RealtimeEvent,
        ServerLog,
        UserAISetting,
        ParentDailyReport,
        LessonAssignmentStudent,
        StudentLessonProgress,
        LessonAssignment,
        LessonActivity,
        Lesson,
        ClassStudent,
        ClassJoinCredential,
        ClassSubject,
        Classroom,
        TeacherParentStudentLink,
        ParentStudentLink,
        TeacherStudentLink,
        ParentProfile,
        StudentProfile,
        TeacherProfile,
    ]:
        model.query.delete()
    User.query.filter(User.role != "admin").delete()
    User.query.filter(User.role == "admin", User.email != ADMIN_EMAIL).delete()
    db.session.commit()


def assert_admin_only_state() -> None:
    expect(User.query.filter(User.role != "admin").count() == 0, "Database is not admin-only. Run with --reset-non-admin if you want to rebuild the scenario.")


def exercise_auth_roundtrip(client, login_payload: dict[str, object]) -> None:
    access_token = str(login_payload["access_token"])
    refresh_token = str(login_payload["refresh_token"])
    request_json(client, "GET", "/api/v1/auth/me", 200, headers=auth_headers(access_token))
    request_json(client, "POST", "/api/v1/auth/refresh", 200, headers=auth_headers(refresh_token))
    request_json(client, "POST", "/api/v1/auth/logout", 200, headers=auth_headers(access_token))

def create_teacher_by_admin(client, admin_token: str, spec: dict[str, str]) -> dict[str, object]:
    payload = request_json(
        client,
        "POST",
        "/api/v1/admin/teachers",
        201,
        headers=auth_headers(admin_token),
        json={
            "full_name": spec["full_name"],
            "email": spec["email"],
            "password": PASSWORD,
            "school_name": spec["school_name"],
        },
    )["data"]
    return {
        "email": spec["email"],
        "password": PASSWORD,
        "full_name": spec["full_name"],
        "school_name": spec["school_name"],
        "user_id": int(payload["user"]["id"]),
        "profile_id": int(payload["profile"]["id"]),
    }


def register_student(client, teacher_index: int, spec: dict[str, str]) -> dict[str, object]:
    email = f"student.t{teacher_index + 1}.{spec['slug']}@example.com"
    payload = request_json(
        client,
        "POST",
        "/api/v1/auth/register",
        201,
        json={
            "role": "student",
            "full_name": spec["full_name"],
            "email": email,
            "password": PASSWORD,
            "disability_level": spec["disability_level"],
            "preferred_input": spec["preferred_input"],
        },
    )["data"]
    return {
        "email": email,
        "password": PASSWORD,
        "profile_id": int(payload["profile"]["id"]),
        "full_name": spec["full_name"],
        "access_token": str(payload["access_token"]),
    }


def register_parent(client, teacher_index: int, spec: dict[str, str], student_full_name: str) -> dict[str, object]:
    email = f"parent.t{teacher_index + 1}.{spec['slug']}@example.com"
    payload = request_json(
        client,
        "POST",
        "/api/v1/auth/register",
        201,
        json={
            "role": "parent",
            "full_name": spec["full_name"],
            "email": email,
            "password": PASSWORD,
            "relationship_label": spec["relationship_label"],
            "note": f"Ph\u1ee5 huynh c\u1ee7a {student_full_name}",
        },
    )["data"]
    return {
        "email": email,
        "password": PASSWORD,
        "profile_id": int(payload["profile"]["id"]),
        "full_name": spec["full_name"],
        "access_token": str(payload["access_token"]),
        "relationship_label": spec["relationship_label"],
    }


def create_teacher_workspace(client, teacher: dict[str, object], spec: dict[str, str], subject_map: dict[str, int]) -> dict[str, object]:
    teacher_login = login(client, str(teacher["email"]), str(teacher["password"]))
    exercise_auth_roundtrip(client, teacher_login)
    token = str(teacher_login["access_token"])
    headers = auth_headers(token)

    class_payload = request_json(
        client,
        "POST",
        "/api/v1/classes",
        201,
        headers=headers,
        json={"name": spec["class_name"], "grade_label": spec["grade_label"], "description": f"Kh\u00f4ng gian h\u1ecdc t\u1eadp c\u1ee7a {spec['full_name']}"},
    )["data"]
    class_id = int(class_payload["id"])
    class_password = str(class_payload["join_credential"]["class_password"])

    request_json(client, "PUT", f"/api/v1/classes/{class_id}", 200, headers=headers, json={"description": f"L\u1edbp h\u1ecdc demo do {spec['full_name']} qu\u1ea3n l\u00fd", "grade_label": spec["grade_label"]})
    request_json(client, "GET", f"/api/v1/classes/{class_id}", 200, headers=headers)
    request_json(client, "GET", "/api/v1/classes", 200, headers=headers)

    for code in ["TOAN", "KHTN"]:
        request_json(client, "POST", f"/api/v1/classes/{class_id}/subjects", 201, headers=headers, json={"subject_id": subject_map[code]})
    request_json(client, "GET", f"/api/v1/classes/{class_id}/subjects", 200, headers=headers)

    lessons: list[dict[str, object]] = []
    for blueprint in LESSON_BLUEPRINTS:
        lesson_payload = request_json(
            client,
            "POST",
            "/api/v1/lessons",
            201,
            headers=headers,
            json={
                "title": blueprint["title"],
                "subject_id": subject_map[blueprint["subject_code"]],
                "primary_level": blueprint["primary_level"],
                "description": blueprint["description"],
                "estimated_minutes": blueprint["estimated_minutes"],
                "difficulty_stage": 1,
                "is_published": True,
            },
        )["data"]
        lesson_id = int(lesson_payload["id"])
        activity_ids: list[int] = []
        for index, activity in enumerate(blueprint["activities"], start=1):
            activity_payload = request_json(
                client,
                "POST",
                f"/api/v1/lessons/{lesson_id}/activities",
                201,
                headers=headers,
                json={
                    "title": activity["title"],
                    "activity_type": activity["activity_type"],
                    "instruction_text": activity["instruction_text"],
                    "voice_answer_enabled": activity["voice_answer_enabled"],
                    "is_required": True,
                    "sort_order": index,
                    "difficulty_stage": 1,
                    "config_json": json.dumps(activity["config"], ensure_ascii=False),
                },
            )["data"]
            activity_ids.append(int(activity_payload["id"]))

        request_json(client, "GET", f"/api/v1/lessons/{lesson_id}/activities", 200, headers=headers)
        request_json(client, "GET", f"/api/v1/activities/{activity_ids[0]}", 200, headers=headers)
        request_json(client, "PUT", f"/api/v1/activities/{activity_ids[0]}", 200, headers=headers, json={"instruction_text": "Làm bài chậm rãi và xin trợ giúp nếu cần."})
        request_json(
            client,
            "POST",
            f"/api/v1/lessons/{lesson_id}/activities/reorder",
            200,
            headers=headers,
            json={"activity_orders": [{"activity_id": activity_id, "sort_order": index} for index, activity_id in enumerate(activity_ids, start=1)]},
        )
        request_json(client, "PUT", f"/api/v1/lessons/{lesson_id}", 200, headers=headers, json={"description": f"{blueprint['description']} Da kiem tra va san sang giao bai."})
        request_json(client, "GET", f"/api/v1/lessons/{lesson_id}", 200, headers=headers)
        lessons.append({"id": lesson_id, "subject_id": subject_map[blueprint["subject_code"]], "lesson_title": blueprint["title"]})

    request_json(client, "GET", "/api/v1/lessons", 200, headers=headers)

    return {"token": token, "class_id": class_id, "class_password": class_password, "lessons": lessons}


def create_assignments_for_class(client, bundle: dict[str, object]) -> list[dict[str, object]]:
    headers = auth_headers(str(bundle["token"]))
    assignments: list[dict[str, object]] = []
    for offset, lesson in enumerate(bundle["lessons"], start=1):
        due_at = (datetime.now(UTC) + timedelta(days=7 + offset)).date().isoformat()
        assignment_payload = request_json(
            client,
            "POST",
            "/api/v1/assignments",
            201,
            headers=headers,
            json={
                "lesson_id": lesson["id"],
                "class_id": bundle["class_id"],
                "subject_id": lesson["subject_id"],
                "target_type": "class",
                "required_completion_percent": 80,
                "due_at": due_at,
            },
        )["data"]
        assignment_id = int(assignment_payload["id"])
        request_json(client, "PUT", f"/api/v1/assignments/{assignment_id}", 200, headers=headers, json={"required_completion_percent": 85, "due_at": due_at})
        request_json(client, "GET", f"/api/v1/assignments/{assignment_id}", 200, headers=headers)
        assignments.append({"id": assignment_id, "lesson_title": str(lesson["lesson_title"])})

    request_json(client, "GET", "/api/v1/assignments", 200, headers=headers)
    return assignments


def join_students_to_class(client, bundle: dict[str, object], students: list[dict[str, object]]) -> None:
    for student in students:
        request_json(
            client,
            "POST",
            "/api/v1/my/classes/join",
            201,
            headers=auth_headers(str(student["access_token"])),
            json={"class_id": int(bundle["class_id"]), "class_password": str(bundle["class_password"])},
        )
        request_json(client, "GET", "/api/v1/my/classes", 200, headers=auth_headers(str(student["access_token"])))


def link_parents_and_verify(client, teacher_token: str, teacher_profile_id: int, students: list[dict[str, object]], parents: list[dict[str, object]]) -> None:
    headers = auth_headers(teacher_token)
    for student, parent in zip(students, parents):
        request_json(client, "POST", f"/api/v1/students/{student['profile_id']}/parents/link", 201, headers=headers, json={"parent_id": parent["profile_id"]})
        request_json(client, "GET", f"/api/v1/students/{student['profile_id']}/parents", 200, headers=headers)

    request_json(client, "GET", "/api/v1/parents", 200, headers=headers)
    request_json(client, "GET", "/api/v1/teacher/parent-groups", 200, headers=headers)

    first_parent_login = login(client, str(parents[0]["email"]), str(parents[0]["password"]))
    exercise_auth_roundtrip(client, first_parent_login)
    parent_headers = auth_headers(str(first_parent_login["access_token"]))
    request_json(client, "GET", "/api/v1/parent/my-children", 200, headers=parent_headers)
    request_json(client, "GET", "/api/v1/parent/reports", 200, headers=parent_headers)
    request_json(client, "GET", f"/api/v1/parent/teachers/{teacher_profile_id}", 200, headers=parent_headers)


def exercise_student_and_teacher_views(client, bundle: dict[str, object], teacher_token: str, students: list[dict[str, object]]) -> None:
    headers = auth_headers(teacher_token)
    request_json(client, "GET", f"/api/v1/classes/{bundle['class_id']}/students", 200, headers=headers)
    student_list = request_json(client, "GET", "/api/v1/students", 200, headers=headers)["data"]
    expect(len(student_list) == len(students), "Teacher does not see all expected students")
    request_json(client, "GET", f"/api/v1/students/{students[0]['profile_id']}", 200, headers=headers)
    request_json(client, "PUT", f"/api/v1/students/{students[0]['profile_id']}", 200, headers=headers, json={"support_note": "C\u1ea7n nh\u1eafc nh\u1edf b\u1eaft đ\u1ea7u b\u00e0i h\u1ecdc b\u1eb1ng nh\u1eafc nh\u1edf ng\u1eafn.", "preferred_font_size": "large", "preferred_bg_color": "cream"})
    request_json(client, "GET", "/api/v1/teacher/shared-students", 200, headers=headers)

    first_student_login = login(client, str(students[0]["email"]), str(students[0]["password"]))
    exercise_auth_roundtrip(client, first_student_login)
    student_headers = auth_headers(str(first_student_login["access_token"]))
    request_json(client, "GET", "/api/v1/my/teachers", 200, headers=student_headers)
    request_json(client, "GET", f"/api/v1/students/{students[0]['profile_id']}/teachers", 200, headers=student_headers)


def simulate_progress(client, assignments: list[dict[str, object]], students: list[dict[str, object]]) -> None:
    for student_index, student in enumerate(students):
        login_payload = login(client, str(student["email"]), str(student["password"]))
        headers = auth_headers(str(login_payload["access_token"]))
        all_assignments = request_json(client, "GET", "/api/v1/my/assignments", 200, headers=headers)["data"]
        expect(len(all_assignments) == len(assignments), f"{student['email']} did not receive every assignment")
        request_json(client, "GET", "/api/v1/my/teachers", 200, headers=headers)

        for assignment_index, assignment in enumerate(assignments):
            assignment_id = int(assignment["id"])
            request_json(client, "GET", f"/api/v1/my/assignments/{assignment_id}", 200, headers=headers)
            profile = PROGRESS_PROFILES[(student_index + assignment_index) % len(PROGRESS_PROFILES)]
            request_json(client, "POST", f"/api/v1/my/assignments/{assignment_id}/start", 200, headers=headers)
            request_json(
                client,
                "POST",
                f"/api/v1/my/assignments/{assignment_id}/progress",
                200,
                headers=headers,
                json={
                    "progress_percent": profile["progress_percent"],
                    "total_learning_seconds": profile["total_learning_seconds"] + assignment_index * 30,
                    "retry_count": profile["retry_count"],
                    "help_count": profile["help_count"],
                    "reward_star_count": profile["reward_star_count"],
                    "completion_score": profile["completion_score"],
                    "status": profile["status"],
                },
            )
            if profile["complete"]:
                request_json(client, "POST", f"/api/v1/my/assignments/{assignment_id}/complete", 200, headers=headers)


def verify_reports_and_logs(client, teacher_token: str, assignments: list[dict[str, object]], parents: list[dict[str, object]]) -> None:
    headers = auth_headers(teacher_token)
    for assignment in assignments:
        request_json(client, "GET", f"/api/v1/assignments/{assignment['id']}/progress", 200, headers=headers)
    request_json(client, "POST", "/api/v1/teacher/reports/send", 201, headers=headers, json={"note": "B\u00e1o c\u00e1o t\u1ed5ng h\u1ee3p cu\u1ed1i ng\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c g\u1eedi t\u1ef1 \u0111\u1ed9ng."})
    request_json(client, "GET", "/api/v1/teacher/reports", 200, headers=headers)
    request_json(client, "GET", "/api/v1/logs", 200, headers=headers)

    for parent in parents:
        parent_login = login(client, str(parent["email"]), str(parent["password"]))
        parent_headers = auth_headers(str(parent_login["access_token"]))
        children = request_json(client, "GET", "/api/v1/parent/my-children", 200, headers=parent_headers)["data"]
        expect(len(children) >= 1, f"{parent['email']} has no linked child")
        reports = request_json(client, "GET", "/api/v1/parent/reports", 200, headers=parent_headers)["data"]
        expect(len(reports) >= 1, f"{parent['email']} has no report")


def exercise_ai_and_realtime(client, teacher_token: str) -> None:
    headers = auth_headers(teacher_token)
    request_json(client, "GET", "/api/v1/ai/settings", 200, headers=headers)
    request_json(client, "POST", "/api/v1/ai/settings/test", 200, headers=headers)
    request_json(
        client,
        "POST",
        "/api/v1/ai/chat",
        200,
        headers=headers,
        json={"message": "Gợi ý cách động viên học sinh trong 3 câu ngắn.", "context": {"subject_name": "Kỹ năng sống", "lesson_title": "Tự phục vụ và giao tiếp lịch sự"}},
    )

    stream_response = client.get(f"/api/v1/realtime/stream?access_token={teacher_token}&last_event_id=0", buffered=False)
    stream_iter = iter(stream_response.response)
    first_chunk = next(stream_iter)
    stream_response.close()
    text_chunk = first_chunk.decode("utf-8") if isinstance(first_chunk, bytes) else str(first_chunk)
    expect("event:" in text_chunk or "data:" in text_chunk, "Realtime stream did not return SSE payload")


def write_summary_file(instance_path: str, admin_email: str, bundles: list[dict[str, object]]) -> Path:
    output_path = Path(instance_path) / "local_persona_seed_summary.txt"
    lines = [
        "LOCAL PERSONA SEED SUMMARY",
        f"Generated at: {datetime.now().isoformat(timespec='seconds')}",
        f"Admin used: {admin_email}",
        f"Shared password for all new accounts: {PASSWORD}",
        "",
    ]
    for bundle in bundles:
        teacher = bundle["teacher"]
        lines.extend(
            [
                f"Teacher: {teacher['full_name']} | {teacher['email']} | class={bundle['class_name']} | join_password={bundle['class_password']}",
                "Students and parents:",
            ]
        )
        for student, parent in zip(bundle["students"], bundle["parents"]):
            lines.append(f"- Student: {student['full_name']} | {student['email']} | Parent: {parent['full_name']} ({parent['relationship_label']}) | {parent['email']}")
        lines.append("Assignments:")
        for assignment in bundle["assignments"]:
            lines.append(f"- {assignment['lesson_title']} (assignment_id={assignment['id']})")
        lines.append("")
    output_path.write_text("\n".join(lines), encoding="utf-8")
    return output_path

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a realistic local multi-role scenario into the development database.")
    parser.add_argument("--reset-non-admin", action="store_true", help="Delete all non-admin data before creating the scenario.")
    args = parser.parse_args()

    app = create_app("development")
    app.config['GEMINI_API_KEYS'] = app.config.get('GEMINI_API_KEYS') or ['fake-key-1', 'fake-key-2']
    app.config['GEMINI_MODEL_NAME'] = app.config.get('GEMINI_MODEL_NAME') or 'gemini-2.5-flash'

    with app.app_context():
        db.create_all()
        seed_subjects()
        configure_fake_ai()

        if args.reset_non_admin:
            purge_non_admin_data()
        assert_admin_only_state()

        client = app.test_client()
        with app.test_request_context():
            admin_user = User.query.filter_by(role="admin", status="active").order_by(User.id.asc()).first()
            expect(admin_user is not None, "No active admin account found")
            admin_token = create_token_for_user(admin_user)

        request_json(client, "GET", "/api/v1/health", 200)
        request_json(client, "GET", "/api/v1/admin/teachers", 200, headers=auth_headers(admin_token))
        request_json(client, "GET", "/api/v1/admin/relationships/overview", 200, headers=auth_headers(admin_token))

        subject_list = request_json(client, "GET", "/api/v1/subjects", 200)["data"]
        subject_map = {item["code"]: int(item["id"]) for item in subject_list}
        expect({"TOAN", "KHTN"}.issubset(subject_map), "Required subjects are missing")

        seeded_bundles: list[dict[str, object]] = []
        for teacher_index, spec in enumerate(TEACHER_SPECS):
            teacher = create_teacher_by_admin(client, admin_token, spec)
            students = [register_student(client, teacher_index, student_spec) for student_spec in STUDENT_SPECS]
            parents = [register_parent(client, teacher_index, parent_spec, students[index]["full_name"]) for index, parent_spec in enumerate(PARENT_SPECS)]

            bundle = create_teacher_workspace(client, teacher, spec, subject_map)
            join_students_to_class(client, bundle, students)
            assignments = create_assignments_for_class(client, bundle)
            exercise_student_and_teacher_views(client, bundle, str(bundle["token"]), students)
            link_parents_and_verify(client, str(bundle["token"]), int(teacher["profile_id"]), students, parents)
            simulate_progress(client, assignments, students)
            verify_reports_and_logs(client, str(bundle["token"]), assignments, parents)

            seeded_bundles.append(
                {
                    "teacher": teacher,
                    "students": students,
                    "parents": parents,
                    "assignments": assignments,
                    "class_name": spec["class_name"],
                    "class_password": str(bundle["class_password"]),
                    "teacher_token": str(bundle["token"]),
                }
            )

        exercise_ai_and_realtime(client, str(seeded_bundles[0]["teacher_token"]))
        request_json(client, "GET", "/api/v1/admin/teachers", 200, headers=auth_headers(admin_token))
        overview = request_json(client, "GET", "/api/v1/admin/relationships/overview", 200, headers=auth_headers(admin_token))["data"]["summary"]

        summary_path = write_summary_file(app.instance_path, str(admin_user.email), seeded_bundles)
        final_counts = {
            "teachers": TeacherProfile.query.count(),
            "students": StudentProfile.query.count(),
            "parents": ParentProfile.query.count(),
            "classes": Classroom.query.count(),
            "lessons": Lesson.query.count(),
            "activities": LessonActivity.query.count(),
            "assignments": LessonAssignment.query.count(),
            "progress_records": StudentLessonProgress.query.count(),
            "reports": ParentDailyReport.query.count(),
            "realtime_events": RealtimeEvent.query.count(),
        }

        print("Local persona seed completed successfully.")
        print(f"Admin account used: {admin_user.email}")
        print(f"Summary file: {summary_path}")
        print(f"Counts: {final_counts}")
        print(f"Relationship overview: {overview}")


if __name__ == "__main__":
    main()
