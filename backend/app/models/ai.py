from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class UserAISetting(TimestampMixin, db.Model):
    __tablename__ = "user_ai_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="gemini")
    model_name: Mapped[str] = mapped_column(String(120), nullable=False, default="gemini-2.5-flash")
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    last_validated_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user = relationship("User", back_populates="ai_settings")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "user_id": self.user_id, "provider": self.provider, "model_name": self.model_name, "api_key_masked": self.api_key_masked, "status": self.status, "last_validated_at": self.last_validated_at, "last_error_message": self.last_error_message}
