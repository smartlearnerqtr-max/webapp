from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


def _serialize_datetime(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        return isoformat()
    return str(value)


class ParentTeacherMessage(TimestampMixin, db.Model):
    __tablename__ = "parent_teacher_messages"
    __table_args__ = (
        Index("ix_parent_teacher_messages_thread", "teacher_id", "parent_id", "student_id"),
        Index("ix_parent_teacher_messages_sender", "sender_user_id", "sender_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("parent_profiles.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False, index=True)
    sender_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    sender_role: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read_by_teacher_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_by_parent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    teacher = relationship("TeacherProfile")
    parent = relationship("ParentProfile")
    student = relationship("StudentProfile")
    sender_user = relationship("User")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "parent_id": self.parent_id,
            "student_id": self.student_id,
            "sender_user_id": self.sender_user_id,
            "sender_role": self.sender_role,
            "message": self.message,
            "read_by_teacher_at": _serialize_datetime(self.read_by_teacher_at),
            "read_by_parent_at": _serialize_datetime(self.read_by_parent_at),
            "created_at": _serialize_datetime(self.created_at),
            "updated_at": _serialize_datetime(self.updated_at),
        }
