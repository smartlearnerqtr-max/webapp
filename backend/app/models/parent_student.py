from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class ParentStudentLink(TimestampMixin, db.Model):
    __tablename__ = "parent_student_links"
    __table_args__ = (UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("parent_profiles.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False)
    linked_by_teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    parent = relationship("ParentProfile", back_populates="student_links")
    student = relationship("StudentProfile", back_populates="parent_links")
