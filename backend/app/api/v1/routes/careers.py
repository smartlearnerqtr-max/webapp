from __future__ import annotations

import json

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ....extensions import db
from ....models import StudentProfile, TeacherCareerCard, User
from ....services.logger import log_server_event
from ....utils.responses import error_response, success_response
from .. import api_v1

VALID_LEVELS = {"nang", "trung_binh", "nhe"}


def _require_teacher_user():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Không có quyền truy cập", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.teacher_profile:
        return None, error_response("Không tìm thấy giáo viên", "TEACHER_NOT_FOUND", 404)
    return user, None


def _require_student_user():
    if get_jwt().get("role") != "student":
        return None, error_response("Không có quyền truy cập", "AUTH_FORBIDDEN", 403)
    user = User.query.get(get_jwt_identity())
    if not user or not user.student_profile:
        return None, error_response("Không tìm thấy học sinh", "STUDENT_NOT_FOUND", 404)
    return user, None


def _normalize_text(value: object, fallback: str = "") -> str:
    return str(value or fallback).strip()


def _normalize_levels(raw_levels: object) -> list[str]:
    if not isinstance(raw_levels, list):
        return ["nhe"]
    levels: list[str] = []
    for item in raw_levels:
        normalized = _normalize_text(item).lower()
        if normalized in VALID_LEVELS and normalized not in levels:
            levels.append(normalized)
    return levels or ["nhe"]


def _normalize_skills(raw_skills: object) -> list[str]:
    if not isinstance(raw_skills, list):
        return []
    skills: list[str] = []
    for item in raw_skills:
        normalized = _normalize_text(item)
        if normalized and normalized not in skills:
            skills.append(normalized)
    return skills


def _normalize_steps(raw_steps: object) -> list[dict[str, str]]:
    if not isinstance(raw_steps, list):
        return []

    steps: list[dict[str, str]] = []
    for item in raw_steps:
        if not isinstance(item, dict):
            continue
        title = _normalize_text(item.get("title"))
        description = _normalize_text(item.get("description"))
        if not title and not description:
            continue
        steps.append(
            {
                "title": title or f"Bước {len(steps) + 1}",
                "description": description,
            }
        )
    return steps


def _deserialize_list(raw_value: str | None) -> list[object]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _serialize_list(value: list[object]) -> str:
    return json.dumps(value, ensure_ascii=False)


def _parse_sort_order(raw_value: object) -> int:
    try:
        return int(raw_value or 0)
    except (TypeError, ValueError):
        return 0


def _validate_career_payload(
    *,
    title: str,
    meaning_text: str,
    steps: list[dict[str, str]],
    skills: list[str],
):
    if not title or not meaning_text:
        return error_response("Cần nhập tiêu đề và ý nghĩa công việc", "VALIDATION_ERROR", 422)
    if not steps:
        return error_response("Cần nhập ít nhất 1 bước thực hiện", "VALIDATION_ERROR", 422)
    if not skills:
        return error_response("Cần nhập ít nhất 1 kỹ năng học được", "VALIDATION_ERROR", 422)
    return None


def _career_payload_is_complete(payload: dict[str, object]) -> bool:
    return _validate_career_payload(
        title=_normalize_text(payload.get("title")),
        meaning_text=_normalize_text(payload.get("meaning_text")),
        steps=_normalize_steps(payload.get("steps")),
        skills=_normalize_skills(payload.get("skills")),
    ) is None


def _get_teacher_career_or_404(card_id: int, teacher_id: int) -> TeacherCareerCard | None:
    card = TeacherCareerCard.query.get(card_id)
    if not card or card.teacher_id != teacher_id:
        return None
    return card


@api_v1.get("/teacher/career-cards")
@jwt_required()
def list_teacher_career_cards():
    user, error = _require_teacher_user()
    if error:
        return error

    cards = (
        TeacherCareerCard.query
        .filter_by(teacher_id=user.teacher_profile.id, status="active")
        .order_by(TeacherCareerCard.sort_order.asc(), TeacherCareerCard.id.asc())
        .all()
    )
    return success_response([card.to_dict() for card in cards])


@api_v1.post("/teacher/career-cards")
@jwt_required()
def create_teacher_career_card():
    user, error = _require_teacher_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    title = _normalize_text(payload.get("title"))
    meaning_title = _normalize_text(payload.get("meaning_title"), "Ý nghĩa công việc")
    meaning_text = _normalize_text(payload.get("meaning_text"))
    cover_image_url = _normalize_text(payload.get("cover_image_url")) or None
    video_url = _normalize_text(payload.get("video_url")) or None
    steps = _normalize_steps(payload.get("steps"))
    skills = _normalize_skills(payload.get("skills"))
    levels = _normalize_levels(payload.get("levels"))

    validation_error = _validate_career_payload(
        title=title,
        meaning_text=meaning_text,
        steps=steps,
        skills=skills,
    )
    if validation_error:
        return validation_error

    card = TeacherCareerCard(
        teacher_id=user.teacher_profile.id,
        title=title,
        description=_normalize_text(payload.get("description")) or None,
        cover_image_url=cover_image_url,
        meaning_title=meaning_title,
        meaning_text=meaning_text,
        video_url=video_url,
        video_note=_normalize_text(payload.get("video_note")) or None,
        steps_json=_serialize_list(steps),
        skills_json=_serialize_list(skills),
        levels_json=_serialize_list(levels),
        status="active",
        sort_order=_parse_sort_order(payload.get("sort_order")),
    )
    db.session.add(card)
    db.session.commit()

    log_server_event(
        level="info",
        module="career_cards",
        message="Tạo thẻ nghề nghiệp",
        action_name="create_teacher_career_card",
        user_id=user.id,
        metadata={"career_card_id": card.id},
    )
    return success_response(card.to_dict(), "Tạo thẻ nghề nghiệp thành công", 201)


@api_v1.put("/teacher/career-cards/<int:card_id>")
@jwt_required()
def update_teacher_career_card(card_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    card = _get_teacher_career_or_404(card_id, user.teacher_profile.id)
    if not card:
        return error_response("Không tìm thấy thẻ nghề nghiệp", "CAREER_CARD_NOT_FOUND", 404)

    payload = request.get_json(silent=True) or {}
    next_title = card.title
    next_cover_image_url = card.cover_image_url
    next_meaning_text = card.meaning_text
    next_video_url = card.video_url
    next_steps = _normalize_steps(payload.get("steps")) if "steps" in payload else _normalize_steps(_deserialize_list(card.steps_json))
    next_skills = _normalize_skills(payload.get("skills")) if "skills" in payload else _normalize_skills(_deserialize_list(card.skills_json))

    if "title" in payload:
        title = _normalize_text(payload.get("title"))
        if not title:
            return error_response("Tiêu đề không được để trống", "VALIDATION_ERROR", 422)
        card.title = title
        next_title = title
    if "description" in payload:
        card.description = _normalize_text(payload.get("description")) or None
    if "cover_image_url" in payload:
        next_cover_image_url = _normalize_text(payload.get("cover_image_url")) or None
        card.cover_image_url = next_cover_image_url
    if "meaning_title" in payload:
        card.meaning_title = _normalize_text(payload.get("meaning_title"), "Ý nghĩa công việc")
    if "meaning_text" in payload:
        meaning_text = _normalize_text(payload.get("meaning_text"))
        if not meaning_text:
            return error_response("Ý nghĩa công việc không được để trống", "VALIDATION_ERROR", 422)
        card.meaning_text = meaning_text
        next_meaning_text = meaning_text
    if "video_url" in payload:
        next_video_url = _normalize_text(payload.get("video_url")) or None
        card.video_url = next_video_url
    if "video_note" in payload:
        card.video_note = _normalize_text(payload.get("video_note")) or None
    if "steps" in payload:
        card.steps_json = _serialize_list(next_steps)
    if "skills" in payload:
        card.skills_json = _serialize_list(next_skills)
    if "levels" in payload:
        card.levels_json = _serialize_list(_normalize_levels(payload.get("levels")))
    if "sort_order" in payload:
        card.sort_order = _parse_sort_order(payload.get("sort_order"))

    validation_error = _validate_career_payload(
        title=next_title,
        meaning_text=next_meaning_text,
        steps=next_steps,
        skills=next_skills,
    )
    if validation_error:
        db.session.rollback()
        return validation_error

    db.session.commit()
    return success_response(card.to_dict(), "Cập nhật thẻ nghề nghiệp thành công")


@api_v1.delete("/teacher/career-cards/<int:card_id>")
@jwt_required()
def delete_teacher_career_card(card_id: int):
    user, error = _require_teacher_user()
    if error:
        return error

    card = _get_teacher_career_or_404(card_id, user.teacher_profile.id)
    if not card:
        return error_response("Không tìm thấy thẻ nghề nghiệp", "CAREER_CARD_NOT_FOUND", 404)

    card.status = "archived"
    db.session.commit()
    return success_response(None, "Đã ẩn thẻ nghề nghiệp")


@api_v1.get("/my/career-cards")
@jwt_required()
def list_my_career_cards():
    user, error = _require_student_user()
    if error:
        return error

    student: StudentProfile = user.student_profile
    teacher_ids = sorted({link.teacher_id for link in student.teacher_links if link.status == "active"})
    if not teacher_ids:
        return success_response([])

    cards = (
        TeacherCareerCard.query
        .filter(TeacherCareerCard.teacher_id.in_(teacher_ids), TeacherCareerCard.status == "active")
        .order_by(TeacherCareerCard.sort_order.asc(), TeacherCareerCard.id.asc())
        .all()
    )

    filtered_cards = []
    for card in cards:
        payload = card.to_dict()
        if not _career_payload_is_complete(payload):
            continue
        levels = payload.get("levels") or []
        if levels and student.disability_level not in levels:
            continue
        filtered_cards.append(payload)
    return success_response(filtered_cards)
