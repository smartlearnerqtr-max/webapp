from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    teacher_profile = relationship("TeacherProfile", back_populates="user", uselist=False)
    parent_profile = relationship("ParentProfile", back_populates="user", uselist=False)
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    ai_settings = relationship("UserAISetting", back_populates="user", cascade="all, delete-orphan")
    logs = relationship("ServerLog", back_populates="user")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "email": self.email, "phone": self.phone, "role": self.role, "status": self.status, "created_at": self.created_at.isoformat() if self.created_at else None, "updated_at": self.updated_at.isoformat() if self.updated_at else None}
