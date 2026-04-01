from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class Classroom(TimestampMixin, db.Model):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    grade_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    default_disability_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    teacher = relationship("TeacherProfile", back_populates="classes")
    join_credential = relationship("ClassJoinCredential", back_populates="classroom", cascade="all, delete-orphan", uselist=False)
    students = relationship("ClassStudent", back_populates="classroom", cascade="all, delete-orphan")
    subjects = relationship("ClassSubject", back_populates="classroom", cascade="all, delete-orphan")

    def to_dict(self, include_join_credentials: bool = False) -> dict[str, object]:
        payload = {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "name": self.name,
            "grade_label": self.grade_label,
            "description": self.description,
            "default_disability_level": self.default_disability_level,
            "status": self.status,
            "student_count": len([item for item in self.students if item.status == "active"]),
            "subject_count": len([item for item in self.subjects if item.is_active]),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_join_credentials:
            payload["join_credential"] = self.join_credential.to_dict() if self.join_credential else None
        return payload


class ClassJoinCredential(TimestampMixin, db.Model):
    __tablename__ = "class_join_credentials"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False, unique=True, index=True)
    join_password: Mapped[str] = mapped_column(String(32), nullable=False)

    classroom = relationship("Classroom", back_populates="join_credential")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "class_id": self.class_id,
            "class_password": self.join_password,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ClassStudent(TimestampMixin, db.Model):
    __tablename__ = "class_students"
    __table_args__ = (UniqueConstraint("class_id", "student_id", name="uq_class_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    classroom = relationship("Classroom", back_populates="students")
    student = relationship("StudentProfile", back_populates="classrooms")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "class_id": self.class_id, "student_id": self.student_id, "status": self.status, "student": self.student.to_dict() if self.student else None}
