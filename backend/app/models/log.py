from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class ServerLog(TimestampMixin, db.Model):
    __tablename__ = "server_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    module: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    action_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", back_populates="logs")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "level": self.level, "module": self.module, "action_name": self.action_name, "endpoint": self.endpoint, "method": self.method, "request_id": self.request_id, "user_id": self.user_id, "error_code": self.error_code, "message": self.message, "stack_trace": self.stack_trace, "metadata_json": self.metadata_json, "created_at": self.created_at.isoformat() if self.created_at else None}
