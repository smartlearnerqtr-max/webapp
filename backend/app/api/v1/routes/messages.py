from __future__ import annotations

from datetime import UTC, datetime

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from ....extensions import db
from ....models import ParentProfile, ParentTeacherMessage, TeacherParentStudentLink, TeacherProfile, User
from ....services.logger import log_server_event
from ....services.realtime_service import publish_realtime_event
from ....utils.responses import error_response, success_response
from .. import api_v1


def _current_user() -> User | None:
    return User.query.get(get_jwt_identity())


def _require_teacher_user():
    if get_jwt().get("role") != "teacher":
        return None, error_response("Khong co quyen truy cap", "AUTH_FORBIDDEN", 403)
    user = _current_user()
    if not user or not user.teacher_profile:
        return None, error_response("Khong tim thay giao vien", "TEACHER_NOT_FOUND", 404)
    return user, None


def _require_parent_user():
    if get_jwt().get("role") != "parent":
        return None, error_response("Khong co quyen truy cap", "AUTH_FORBIDDEN", 403)
    user = _current_user()
    if not user or not user.parent_profile:
        return None, error_response("Khong tim thay phu huynh", "PARENT_NOT_FOUND", 404)
    return user, None


def _build_teacher_payload(teacher: TeacherProfile) -> dict[str, object]:
    return {
        **teacher.to_dict(),
        "email": teacher.user.email if teacher.user else None,
        "phone": teacher.user.phone if teacher.user else None,
    }


def _build_parent_payload(parent: ParentProfile) -> dict[str, object]:
    return {
        **parent.to_dict(),
        "email": parent.user.email if parent.user else None,
        "phone": parent.user.phone if parent.user else None,
    }


def _conversation_key(teacher_id: int, parent_id: int, student_id: int) -> str:
    return f"{teacher_id}:{parent_id}:{student_id}"


def _build_preview(text: str, limit: int = 120) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit].rstrip()}..."


def _normalize_message_text(value: object) -> str:
    return str(value or "").strip()


def _find_active_link(*, teacher_id: int, parent_id: int, student_id: int) -> TeacherParentStudentLink | None:
    return TeacherParentStudentLink.query.options(
        joinedload(TeacherParentStudentLink.teacher).joinedload(TeacherProfile.user),
        joinedload(TeacherParentStudentLink.parent).joinedload(ParentProfile.user),
        joinedload(TeacherParentStudentLink.student),
    ).filter_by(
        teacher_id=teacher_id,
        parent_id=parent_id,
        student_id=student_id,
        status="active",
    ).first()


def _load_messages_for_links(links: list[TeacherParentStudentLink]) -> dict[str, list[ParentTeacherMessage]]:
    if not links:
        return {}

    teacher_ids = sorted({link.teacher_id for link in links})
    parent_ids = sorted({link.parent_id for link in links})
    student_ids = sorted({link.student_id for link in links})
    allowed_keys = {_conversation_key(link.teacher_id, link.parent_id, link.student_id) for link in links}

    messages = ParentTeacherMessage.query.filter(
        ParentTeacherMessage.teacher_id.in_(teacher_ids),
        ParentTeacherMessage.parent_id.in_(parent_ids),
        ParentTeacherMessage.student_id.in_(student_ids),
    ).order_by(ParentTeacherMessage.created_at.asc(), ParentTeacherMessage.id.asc()).all()

    grouped: dict[str, list[ParentTeacherMessage]] = {}
    for message in messages:
        key = _conversation_key(message.teacher_id, message.parent_id, message.student_id)
        if key not in allowed_keys:
            continue
        grouped.setdefault(key, []).append(message)
    return grouped


def _count_unread(messages: list[ParentTeacherMessage], viewer_role: str) -> int:
    if viewer_role == "teacher":
        return sum(1 for item in messages if item.sender_role == "parent" and item.read_by_teacher_at is None)
    return sum(1 for item in messages if item.sender_role == "teacher" and item.read_by_parent_at is None)


def _serialize_conversation(link: TeacherParentStudentLink, messages: list[ParentTeacherMessage], viewer_role: str) -> dict[str, object]:
    latest_message = messages[-1] if messages else None
    return {
        "conversation_key": _conversation_key(link.teacher_id, link.parent_id, link.student_id),
        "status": link.status,
        "teacher": _build_teacher_payload(link.teacher) if link.teacher else None,
        "parent": _build_parent_payload(link.parent) if link.parent else None,
        "student": link.student.to_dict() if link.student else None,
        "message_count": len(messages),
        "unread_count": _count_unread(messages, viewer_role),
        "latest_message": latest_message.to_dict() if latest_message else None,
        "messages": [item.to_dict() for item in messages],
    }


def _sort_conversations(conversations: list[dict[str, object]]) -> list[dict[str, object]]:
    def sort_key(item: dict[str, object]) -> tuple[str, str]:
        latest_message = item.get("latest_message")
        if isinstance(latest_message, dict):
            return (
                str(latest_message.get("created_at") or ""),
                str(latest_message.get("id") or ""),
            )
        return ("", "")

    return sorted(conversations, key=sort_key, reverse=True)


def _mark_thread_read(*, teacher_id: int, parent_id: int, student_id: int, viewer_role: str) -> int:
    now = datetime.now(UTC)
    messages = ParentTeacherMessage.query.filter_by(
        teacher_id=teacher_id,
        parent_id=parent_id,
        student_id=student_id,
    ).order_by(ParentTeacherMessage.created_at.asc(), ParentTeacherMessage.id.asc()).all()

    updated_count = 0
    for message in messages:
        if viewer_role == "teacher" and message.sender_role == "parent" and message.read_by_teacher_at is None:
            message.read_by_teacher_at = now
            updated_count += 1
        if viewer_role == "parent" and message.sender_role == "teacher" and message.read_by_parent_at is None:
            message.read_by_parent_at = now
            updated_count += 1
    return updated_count


def _create_message(*, teacher_id: int, parent_id: int, student_id: int, sender_user_id: int, sender_role: str, message_text: str) -> ParentTeacherMessage:
    now = datetime.now(UTC)
    message = ParentTeacherMessage(
        teacher_id=teacher_id,
        parent_id=parent_id,
        student_id=student_id,
        sender_user_id=sender_user_id,
        sender_role=sender_role,
        message=message_text,
        read_by_teacher_at=now if sender_role == "teacher" else None,
        read_by_parent_at=now if sender_role == "parent" else None,
    )
    db.session.add(message)
    db.session.flush()
    return message


@api_v1.get("/teacher/messages")
@jwt_required()
def list_teacher_messages():
    user, error = _require_teacher_user()
    if error:
        return error

    query = TeacherParentStudentLink.query.options(
        joinedload(TeacherParentStudentLink.teacher).joinedload(TeacherProfile.user),
        joinedload(TeacherParentStudentLink.parent).joinedload(ParentProfile.user),
        joinedload(TeacherParentStudentLink.student),
    ).filter_by(teacher_id=user.teacher_profile.id, status="active")

    student_id = request.args.get("student_id", type=int)
    parent_id = request.args.get("parent_id", type=int)
    if student_id:
        query = query.filter_by(student_id=student_id)
    if parent_id:
        query = query.filter_by(parent_id=parent_id)

    links = query.order_by(TeacherParentStudentLink.created_at.desc()).all()
    grouped_messages = _load_messages_for_links(links)
    conversations = [
        _serialize_conversation(
            link,
            grouped_messages.get(_conversation_key(link.teacher_id, link.parent_id, link.student_id), []),
            "teacher",
        )
        for link in links
    ]
    return success_response(_sort_conversations(conversations))


@api_v1.post("/teacher/messages")
@jwt_required()
def send_teacher_message():
    user, error = _require_teacher_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    parent_id = int(payload.get("parent_id") or 0)
    student_id = int(payload.get("student_id") or 0)
    message_text = _normalize_message_text(payload.get("message"))

    if not parent_id or not student_id:
        return error_response("Can parent_id va student_id de gui tin nhan", "VALIDATION_ERROR", 422)
    if not message_text:
        return error_response("Noi dung tin nhan khong duoc de trong", "VALIDATION_ERROR", 422)

    link = _find_active_link(teacher_id=user.teacher_profile.id, parent_id=parent_id, student_id=student_id)
    if not link:
        return error_response("Khong tim thay nhom trao doi hop le", "CHAT_THREAD_NOT_FOUND", 404)

    message = _create_message(
        teacher_id=link.teacher_id,
        parent_id=link.parent_id,
        student_id=link.student_id,
        sender_user_id=user.id,
        sender_role="teacher",
        message_text=message_text,
    )

    if link.parent and link.parent.user_id:
        publish_realtime_event(
            "parent_teacher_message_created",
            f"Giao vien {link.teacher.full_name if link.teacher else 'giao vien'} vua gui tin nhan moi.",
            title="Tin nhan moi",
            recipient_user_ids=[link.parent.user_id],
            payload={
                "message_id": message.id,
                "teacher_id": link.teacher_id,
                "parent_id": link.parent_id,
                "student_id": link.student_id,
                "student_name": link.student.full_name if link.student else None,
                "teacher_name": link.teacher.full_name if link.teacher else None,
                "parent_name": link.parent.full_name if link.parent else None,
                "sender_role": "teacher",
                "sender_name": link.teacher.full_name if link.teacher else None,
                "message_preview": _build_preview(message_text),
            },
        )

    db.session.commit()
    log_server_event(
        level="info",
        module="messages",
        message="Giao vien gui tin nhan cho phu huynh",
        action_name="teacher_send_message",
        user_id=user.id,
        metadata={"teacher_id": link.teacher_id, "parent_id": link.parent_id, "student_id": link.student_id, "message_id": message.id},
    )
    return success_response(message.to_dict(), "Gui tin nhan thanh cong", 201)


@api_v1.post("/teacher/messages/read")
@jwt_required()
def mark_teacher_messages_read():
    user, error = _require_teacher_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    parent_id = int(payload.get("parent_id") or 0)
    student_id = int(payload.get("student_id") or 0)
    if not parent_id or not student_id:
        return error_response("Can parent_id va student_id de danh dau da doc", "VALIDATION_ERROR", 422)

    link = _find_active_link(teacher_id=user.teacher_profile.id, parent_id=parent_id, student_id=student_id)
    if not link:
        return error_response("Khong tim thay nhom trao doi hop le", "CHAT_THREAD_NOT_FOUND", 404)

    updated_count = _mark_thread_read(
        teacher_id=link.teacher_id,
        parent_id=link.parent_id,
        student_id=link.student_id,
        viewer_role="teacher",
    )
    db.session.commit()
    return success_response({"updated_count": updated_count}, "Da cap nhat trang thai da doc")


@api_v1.get("/parent/messages")
@jwt_required()
def list_parent_messages():
    user, error = _require_parent_user()
    if error:
        return error

    query = TeacherParentStudentLink.query.options(
        joinedload(TeacherParentStudentLink.teacher).joinedload(TeacherProfile.user),
        joinedload(TeacherParentStudentLink.parent).joinedload(ParentProfile.user),
        joinedload(TeacherParentStudentLink.student),
    ).filter_by(parent_id=user.parent_profile.id, status="active")

    teacher_id = request.args.get("teacher_id", type=int)
    student_id = request.args.get("student_id", type=int)
    if teacher_id:
        query = query.filter_by(teacher_id=teacher_id)
    if student_id:
        query = query.filter_by(student_id=student_id)

    links = query.order_by(TeacherParentStudentLink.created_at.desc()).all()
    grouped_messages = _load_messages_for_links(links)
    conversations = [
        _serialize_conversation(
            link,
            grouped_messages.get(_conversation_key(link.teacher_id, link.parent_id, link.student_id), []),
            "parent",
        )
        for link in links
    ]
    return success_response(_sort_conversations(conversations))


@api_v1.post("/parent/messages")
@jwt_required()
def send_parent_message():
    user, error = _require_parent_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    teacher_id = int(payload.get("teacher_id") or 0)
    student_id = int(payload.get("student_id") or 0)
    message_text = _normalize_message_text(payload.get("message"))

    if not teacher_id or not student_id:
        return error_response("Can teacher_id va student_id de gui tin nhan", "VALIDATION_ERROR", 422)
    if not message_text:
        return error_response("Noi dung tin nhan khong duoc de trong", "VALIDATION_ERROR", 422)

    link = _find_active_link(teacher_id=teacher_id, parent_id=user.parent_profile.id, student_id=student_id)
    if not link:
        return error_response("Khong tim thay nhom trao doi hop le", "CHAT_THREAD_NOT_FOUND", 404)

    message = _create_message(
        teacher_id=link.teacher_id,
        parent_id=link.parent_id,
        student_id=link.student_id,
        sender_user_id=user.id,
        sender_role="parent",
        message_text=message_text,
    )

    if link.teacher and link.teacher.user_id:
        publish_realtime_event(
            "parent_teacher_message_created",
            f"Phu huynh {link.parent.full_name if link.parent else 'phu huynh'} vua gui tin nhan moi.",
            title="Tin nhan moi",
            recipient_user_ids=[link.teacher.user_id],
            payload={
                "message_id": message.id,
                "teacher_id": link.teacher_id,
                "parent_id": link.parent_id,
                "student_id": link.student_id,
                "student_name": link.student.full_name if link.student else None,
                "teacher_name": link.teacher.full_name if link.teacher else None,
                "parent_name": link.parent.full_name if link.parent else None,
                "sender_role": "parent",
                "sender_name": link.parent.full_name if link.parent else None,
                "message_preview": _build_preview(message_text),
            },
        )

    db.session.commit()
    log_server_event(
        level="info",
        module="messages",
        message="Phu huynh gui tin nhan cho giao vien",
        action_name="parent_send_message",
        user_id=user.id,
        metadata={"teacher_id": link.teacher_id, "parent_id": link.parent_id, "student_id": link.student_id, "message_id": message.id},
    )
    return success_response(message.to_dict(), "Gui tin nhan thanh cong", 201)


@api_v1.post("/parent/messages/read")
@jwt_required()
def mark_parent_messages_read():
    user, error = _require_parent_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    teacher_id = int(payload.get("teacher_id") or 0)
    student_id = int(payload.get("student_id") or 0)
    if not teacher_id or not student_id:
        return error_response("Can teacher_id va student_id de danh dau da doc", "VALIDATION_ERROR", 422)

    link = _find_active_link(teacher_id=teacher_id, parent_id=user.parent_profile.id, student_id=student_id)
    if not link:
        return error_response("Khong tim thay nhom trao doi hop le", "CHAT_THREAD_NOT_FOUND", 404)

    updated_count = _mark_thread_read(
        teacher_id=link.teacher_id,
        parent_id=link.parent_id,
        student_id=link.student_id,
        viewer_role="parent",
    )
    db.session.commit()
    return success_response({"updated_count": updated_count}, "Da cap nhat trang thai da doc")
