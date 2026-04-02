from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class RealtimeEvent(TimestampMixin, db.Model):
    __tablename__ = "realtime_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    recipient_role: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "recipient_user_id": self.recipient_user_id,
            "recipient_role": self.recipient_role,
            "event_type": self.event_type,
            "title": self.title,
            "message": self.message,
            "payload_json": self.payload_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
