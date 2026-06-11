from __future__ import annotations

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import StudentProfile, TeacherSimulationQuizQuestion, User
from ....utils.responses import error_response, success_response
from .. import api_v1

VALID_SIMULATION_KEYS = {
    "plant-cell",
    "animal-cell",
    "white-blood-cell",
    "neuron",
    "dna",
    "human-heart",
    "human-lungs",
    "human-liver",
    "human-kidney",
    "human-stomach",
}
VALID_OPTIONS = {"A", "B", "C", "D"}


def _require_teacher_user():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Không có quyền truy cập", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response("Không tìm thấy giáo viên", "TEACHER_NOT_FOUND", 404)
    return user, None


def _require_student_user():
    if get_jwt().get("role") != "student":
        return None, error_response("KhÃ´ng cÃ³ quyá»n truy cáº­p", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.student_profile:
        return None, error_response("KhÃ´ng tÃ¬m tháº¥y há»c sinh", "STUDENT_NOT_FOUND", 404)
    return user, None


def _normalize_text(value: object) -> str:
    return str(value or "").strip()


def _normalize_correct_option(value: object) -> str:
    option = _normalize_text(value).upper()
    return option if option in VALID_OPTIONS else ""


def _get_teacher_question_or_404(question_id: int, teacher_id: int) -> TeacherSimulationQuizQuestion | None:
    question = TeacherSimulationQuizQuestion.query.get(question_id)
    if not question or question.teacher_id != teacher_id:
        return None
    return question


def _validate_payload(payload: dict[str, object]):
    simulation_key = _normalize_text(payload.get("simulation_key"))
    simulation_title = _normalize_text(payload.get("simulation_title"))
    question_text = _normalize_text(payload.get("question_text"))
    option_a = _normalize_text(payload.get("option_a"))
    option_b = _normalize_text(payload.get("option_b"))
    option_c = _normalize_text(payload.get("option_c"))
    option_d = _normalize_text(payload.get("option_d"))
    correct_option = _normalize_correct_option(payload.get("correct_option"))

    if simulation_key not in VALID_SIMULATION_KEYS:
        return None, error_response("Mô phỏng không hợp lệ", "VALIDATION_ERROR", 422)
    if not simulation_title:
        return None, error_response("Thiếu tên mô phỏng", "VALIDATION_ERROR", 422)
    if not question_text:
        return None, error_response("Cần nhập câu hỏi", "VALIDATION_ERROR", 422)
    if not all([option_a, option_b, option_c, option_d]):
        return None, error_response("Cần nhập đủ đáp án A/B/C/D", "VALIDATION_ERROR", 422)
    if not correct_option:
        return None, error_response("Cần chọn đáp án đúng A/B/C/D", "VALIDATION_ERROR", 422)

    try:
        sort_order = int(payload.get("sort_order") or 0)
    except (TypeError, ValueError):
        sort_order = 0

    return {
        "subject_code": "KHTN",
        "simulation_key": simulation_key,
        "simulation_title": simulation_title,
        "question_text": question_text,
        "option_a": option_a,
        "option_b": option_b,
        "option_c": option_c,
        "option_d": option_d,
        "correct_option": correct_option,
        "explanation": _normalize_text(payload.get("explanation")) or None,
        "sort_order": sort_order,
    }, None


@api_v1.get("/teacher/simulation-quiz-questions")
@jwt_required()
def list_teacher_simulation_quiz_questions():
    user, error = _require_teacher_user()
    if error:
        return error

    simulation_key = _normalize_text(request.args.get("simulation_key"))
    query = TeacherSimulationQuizQuestion.query.filter_by(
        teacher_id=user.teacher_profile.id,
        subject_code="KHTN",
        status="active",
    )
    if simulation_key:
        query = query.filter_by(simulation_key=simulation_key)

    questions = query.order_by(
        TeacherSimulationQuizQuestion.simulation_key.asc(),
        TeacherSimulationQuizQuestion.sort_order.asc(),
        TeacherSimulationQuizQuestion.id.asc(),
    ).all()
    return success_response([question.to_dict() for question in questions])


@api_v1.get("/my/simulation-quiz-questions")
@jwt_required()
def list_my_simulation_quiz_questions():
    user, error = _require_student_user()
    if error:
        return error

    student: StudentProfile = user.student_profile
    teacher_ids = sorted({link.teacher_id for link in student.teacher_links if link.status == "active"})
    if not teacher_ids:
        return success_response([])

    simulation_key = _normalize_text(request.args.get("simulation_key"))
    query = TeacherSimulationQuizQuestion.query.filter(
        TeacherSimulationQuizQuestion.teacher_id.in_(teacher_ids),
        TeacherSimulationQuizQuestion.subject_code == "KHTN",
        TeacherSimulationQuizQuestion.status == "active",
    )
    if simulation_key:
        if simulation_key not in VALID_SIMULATION_KEYS:
            return success_response([])
        query = query.filter(TeacherSimulationQuizQuestion.simulation_key == simulation_key)

    questions = query.order_by(
        TeacherSimulationQuizQuestion.simulation_key.asc(),
        TeacherSimulationQuizQuestion.sort_order.asc(),
        TeacherSimulationQuizQuestion.id.asc(),
    ).all()
    return success_response([question.to_dict() for question in questions])


@api_v1.post("/teacher/simulation-quiz-questions")
@jwt_required()
def create_teacher_simulation_quiz_question():
    user, error = _require_teacher_user()
    if error:
        return error

    payload, validation_error = _validate_payload(request.get_json(silent=True) or {})
    if validation_error:
        return validation_error

    question = TeacherSimulationQuizQuestion(
        teacher_id=user.teacher_profile.id,
        status="active",
        **payload,
    )
    db.session.add(question)
    db.session.commit()
    return success_response(question.to_dict(), "Tạo câu hỏi mô phỏng thành công", 201)


@api_v1.put("/teacher/simulation-quiz-questions/<int:question_id>")
@jwt_required()
def update_teacher_simulation_quiz_question(question_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    question = _get_teacher_question_or_404(question_id, user.teacher_profile.id)
    if not question:
        return error_response("Không tìm thấy câu hỏi mô phỏng", "SIMULATION_QUESTION_NOT_FOUND", 404)

    payload, validation_error = _validate_payload(request.get_json(silent=True) or {})
    if validation_error:
        return validation_error

    for key, value in payload.items():
        setattr(question, key, value)
    db.session.commit()
    return success_response(question.to_dict(), "Cập nhật câu hỏi mô phỏng thành công")


@api_v1.delete("/teacher/simulation-quiz-questions/<int:question_id>")
@jwt_required()
def delete_teacher_simulation_quiz_question(question_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    question = _get_teacher_question_or_404(question_id, user.teacher_profile.id)
    if not question:
        return error_response("Không tìm thấy câu hỏi mô phỏng", "SIMULATION_QUESTION_NOT_FOUND", 404)

    question.status = "archived"
    db.session.commit()
    return success_response(None, "Đã ẩn câu hỏi mô phỏng")
