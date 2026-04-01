from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class Subject(TimestampMixin, db.Model):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    class_links = relationship("ClassSubject", back_populates="subject", cascade="all, delete-orphan")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "code": self.code, "name": self.name, "description": self.description, "sort_order": self.sort_order, "is_active": self.is_active}


class ClassSubject(TimestampMixin, db.Model):
    __tablename__ = "class_subjects"
    __table_args__ = (UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    classroom = relationship("Classroom", back_populates="subjects")
    subject = relationship("Subject", back_populates="class_links")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "class_id": self.class_id, "subject_id": self.subject_id, "sort_order": self.sort_order, "is_active": self.is_active, "subject": self.subject.to_dict() if self.subject else None}
