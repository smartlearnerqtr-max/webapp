from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class StudentAccountBatch(TimestampMixin, db.Model):
    __tablename__ = "student_account_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    members = relationship("StudentAccountBatchMember", back_populates="batch", cascade="all, delete-orphan")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "code": self.code,
            "title": self.title,
            "created_by_admin_id": self.created_by_admin_id,
            "status": self.status,
            "student_count": len([member for member in self.members if member.status == "active"]),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class StudentAccountBatchMember(TimestampMixin, db.Model):
    __tablename__ = "student_account_batch_members"
    __table_args__ = (
        UniqueConstraint("batch_id", "student_id", name="uq_student_account_batch_member"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("student_account_batches.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    student_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temporary_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    batch = relationship("StudentAccountBatch", back_populates="members")
    student = relationship("StudentProfile")
    user = relationship("User")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "student_id": self.student_id,
            "user_id": self.user_id,
            "student_code": self.student_code,
            "username": self.username,
            "temporary_password": self.temporary_password,
            "status": self.status,
            "student": self.student.to_dict() if self.student else None,
            "user": self.user.to_dict() if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
