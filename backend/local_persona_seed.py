from __future__ import annotations

import argparse
import json
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

TEACHER_SPECS = [
    {
        "email": "user001@gmail.com",
        "full_name": "Co Minh Anh",
        "school_name": "Truong Hoa Binh",
        "class_name": "Lớp Mặt Trời",
        "grade_label": "3",
    },
    {
        "email": "user004@gmail.com",
        "full_name": "Thay Quoc Viet",
        "school_name": "Truong Binh Minh",
        "class_name": "Lớp Cầu Vồng",
        "grade_label": "4",
    },
]

STUDENT_SPECS = [
    {"slug": "hoang-an", "full_name": "Nguyen Hoang An", "disability_level": "nhe", "preferred_input": "touch"},
    {"slug": "gia-han", "full_name": "Tran Gia Han", "disability_level": "trung_binh", "preferred_input": "voice"},
    {"slug": "minh-khang", "full_name": "Pham Minh Khang", "disability_level": "trung_binh", "preferred_input": "touch"},
    {"slug": "khanh-linh", "full_name": "Le Khanh Linh", "disability_level": "nang", "preferred_input": "touch"},
    {"slug": "tuan-kiet", "full_name": "Vo Tuan Kiet", "disability_level": "nhe", "preferred_input": "voice"},
]

PARENT_SPECS = [
    {"slug": "hoa", "full_name": "Le Thi Hoa", "relationship_label": "Me"},
    {"slug": "phong", "full_name": "Tran Van Phong", "relationship_label": "Bo"},
    {"slug": "mai", "full_name": "Nguyen Thi Mai", "relationship_label": "Me"},
    {"slug": "long", "full_name": "Pham Van Long", "relationship_label": "Bo"},
    {"slug": "lan", "full_name": "Do Thi Lan", "relationship_label": "Me"},
]

LESSON_BLUEPRINTS = [
    {
        "subject_code": "TOAN",
        "title": "Nhận biết hình khối quanh em",
        "description": "Bài học giúp học sinh nhận ra hình tròn, hình vuông và phân loại vật dụng quen thuộc.",
        "primary_level": "nhe",
        "estimated_minutes": 18,
        "activities": [
            {
                "title": "Chọn hình tròn đúng",
                "activity_type": "multiple_choice",
                "instruction_text": "Doc cau hoi va chon dap an dung.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "multiple_choice",
                    "prompt": "Vat nao co dang tron nhat?",
                    "choices": ["Qua bong", "Quyen sach", "Hop but"],
                    "correct": "Qua bong",
                },
            },
            {
                "title": "Nối tên với hình dạng",
                "activity_type": "matching",
                "instruction_text": "Nối mỗi vật với dạng hình phù hợp.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "matching",
                    "prompt": "Ghep ten vat voi dang hinh dung.",
                    "pairs": [
                        {"left": "Dong ho", "right": "Tron"},
                        {"left": "Cua so", "right": "Vuong"},
                        {"left": "Hop sua", "right": "Chu nhat"},
                    ],
                },
            },
            {
                "title": "Kéo thả vào nhóm đúng",
                "activity_type": "drag_drop",
                "instruction_text": "Kéo từng vật vào nhóm đúng.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "drag_drop",
                    "prompt": "Sap xep do vat theo nhom.",
                    "items": ["Qua cam", "Bang den", "Hop qua"],
                    "targets": ["Dang tron", "Dang vuong", "Dang chu nhat"],
                },
            },
        ],
    },
    {
        "subject_code": "VAN",
        "title": "Nghe và nói về đồ vật trong lớp",
        "description": "Bài học luyện nghe, quan sát và trả lời câu hỏi sau khi xem nội dung minh họa.",
        "primary_level": "trung_binh",
        "estimated_minutes": 20,
        "activities": [
            {
                "title": "Nghe và chọn đồ vật",
                "activity_type": "listen_choose",
                "instruction_text": "Nghe ky va chon dap an dung.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "listen_choose",
                    "audio_text": "Em hay chon vat dung de viet bai tren lop.",
                    "choices": ["But chi", "Ca uong nuoc", "Qua bong"],
                    "correct": "But chi",
                },
            },
            {
                "title": "Xem video và trả lời",
                "activity_type": "watch_answer",
                "instruction_text": "Xem nội dung minh họa rồi trả lời.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "watch_answer",
                    "media_url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
                    "prompt": "Sau khi xem xong, em ke ten 2 vat em nhin thay.",
                },
            },
            {
                "title": "Làm theo từng bước",
                "activity_type": "step_by_step",
                "instruction_text": "Làm lần lượt theo từng bước.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "step_by_step",
                    "prompt": "Sap xep ban hoc gon gang.",
                    "steps": [
                        "Buoc 1: Cat sach vo gon vao mot cho.",
                        "Buoc 2: Dat but vao hop but.",
                        "Buoc 3: Kiem tra lai ban hoc da sach se chua.",
                    ],
                },
            },
        ],
    },
    {
        "subject_code": "KY_NANG_SONG",
        "title": "Tự phục vụ và giao tiếp lịch sự",
        "description": "Bài học kết hợp thẻ giao tiếp, tình huống đóng vai và trao đổi với AI.",
        "primary_level": "trung_binh",
        "estimated_minutes": 22,
        "activities": [
            {
                "title": "Chọn thẻ giao tiếp phù hợp",
                "activity_type": "aac",
                "instruction_text": "Chon cau em muon noi trong tinh huong nay.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "aac",
                    "prompt": "Em muon xin them nuoc uong, em se chon the nao?",
                    "cards": ["Con mu?n u?ng n??c", "Con ?? xong", "Con c?n gi?p ??"],
                },
            },
            {
                "title": "Đóng vai ở thư viện",
                "activity_type": "career_simulation",
                "instruction_text": "Làm theo tình huống đóng vai.",
                "voice_answer_enabled": False,
                "config": {
                    "kind": "career_simulation",
                    "scenario": "Em dong vai ban truc thu vien va huong dan mot ban moi tim sach.",
                    "success_criteria": "Ch?o h?i l?ch s?, hoi nhu cau, chi dung khu sach can tim.",
                },
            },
            {
                "title": "Trao đổi ngắn với AI",
                "activity_type": "ai_chat",
                "instruction_text": "Trao đổi ngắn gọn với trợ lý AI.",
                "voice_answer_enabled": True,
                "config": {
                    "kind": "ai_chat",
                    "starter_prompt": "Hay dong vai ban hoc va hoi em 3 cau ngan ve cach xin phep lich su.",
                    "goals": ["Biet chao hoi", "Biet xin phep", "Biet noi loi cam on"],
                },
            },
        ],
    },
]

PROGRESS_PROFILES = [
    {"status": "completed", "progress_percent": 100, "total_learning_seconds": 540, "retry_count": 0, "help_count": 0, "reward_star_count": 5, "completion_score": 96, "complete": True},
    {"status": "in_progress", "progress_percent": 78, "total_learning_seconds": 460, "retry_count": 1, "help_count": 1, "reward_star_count": 4, "completion_score": 82, "complete": False},
    {"status": "in_progress", "progress_percent": 64, "total_learning_seconds": 420, "retry_count": 2, "help_count": 2, "reward_star_count": 3, "completion_score": 68, "complete": False},
    {"status": "in_progress", "progress_percent": 52, "total_learning_seconds": 520, "retry_count": 3, "help_count": 4, "reward_star_count": 2, "completion_score": 44, "complete": False},
    {"status": "completed", "progress_percent": 100, "total_learning_seconds": 500, "retry_count": 1, "help_count": 0, "reward_star_count": 5, "completion_score": 90, "complete": True},
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
            text=f"Gemini demo response for {kwargs['model_name']}",
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
            "note": f"Phu huynh cua {student_full_name}",
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
        json={"name": spec["class_name"], "grade_label": spec["grade_label"], "description": f"Khong gian hoc tap cua {spec['full_name']}"},
    )["data"]
    class_id = int(class_payload["id"])
    class_password = str(class_payload["join_credential"]["class_password"])

    request_json(client, "PUT", f"/api/v1/classes/{class_id}", 200, headers=headers, json={"description": f"Lop hoc demo do {spec['full_name']} quan ly", "grade_label": spec["grade_label"]})
    request_json(client, "GET", f"/api/v1/classes/{class_id}", 200, headers=headers)
    request_json(client, "GET", "/api/v1/classes", 200, headers=headers)

    for code in ["TOAN", "VAN", "KY_NANG_SONG"]:
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
    request_json(client, "PUT", f"/api/v1/students/{students[0]['profile_id']}", 200, headers=headers, json={"support_note": "Can nhac nho bat dau bai hoc bang nhac nho ngan.", "preferred_font_size": "large", "preferred_bg_color": "cream"})
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
    request_json(client, "POST", "/api/v1/teacher/reports/send", 201, headers=headers, json={"note": "Bao cao tong hop cuoi ngay da duoc gui tu dong."})
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
    request_json(client, "PUT", "/api/v1/ai/settings", 200, headers=headers, json={"api_key": "fake-demo-key", "model_name": "gemini-2.5-flash"})
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
        expect({"TOAN", "VAN", "KY_NANG_SONG"}.issubset(subject_map), "Required subjects are missing")

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
