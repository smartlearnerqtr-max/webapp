from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class TeacherProfile(TimestampMixin, db.Model):
    __tablename__ = "teacher_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    school_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    user = relationship("User", back_populates="teacher_profile")
    classes = relationship("Classroom", back_populates="teacher")
    student_links = relationship("TeacherStudentLink", back_populates="teacher", cascade="all, delete-orphan")
    parent_links = relationship("ParentStudentLink", back_populates="teacher", foreign_keys="ParentStudentLink.linked_by_teacher_id")
    parent_group_links = relationship("TeacherParentStudentLink", back_populates="teacher", cascade="all, delete-orphan")
    parent_reports = relationship("ParentDailyReport", back_populates="teacher", foreign_keys="ParentDailyReport.teacher_id")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "user_id": self.user_id, "full_name": self.full_name, "school_name": self.school_name, "avatar_url": self.avatar_url, "note": self.note}


class ParentProfile(TimestampMixin, db.Model):
    __tablename__ = "parent_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    user = relationship("User", back_populates="parent_profile")
    student_links = relationship("ParentStudentLink", back_populates="parent", cascade="all, delete-orphan")
    teacher_group_links = relationship("TeacherParentStudentLink", back_populates="parent", cascade="all, delete-orphan")
    reports = relationship("ParentDailyReport", back_populates="parent", cascade="all, delete-orphan")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "user_id": self.user_id, "full_name": self.full_name, "relationship_label": self.relationship_label, "avatar_url": self.avatar_url, "note": self.note}


class StudentProfile(TimestampMixin, db.Model):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    disability_level: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    support_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    preferred_input: Mapped[str] = mapped_column(String(30), nullable=False, default="touch")
    preferred_read_speed: Mapped[str | None] = mapped_column(String(30), nullable=True)
    preferred_font_size: Mapped[str | None] = mapped_column(String(30), nullable=True)
    preferred_bg_color: Mapped[str | None] = mapped_column(String(30), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=True)

    user = relationship("User", back_populates="student_profile")
    classrooms = relationship("ClassStudent", back_populates="student", cascade="all, delete-orphan")
    teacher_links = relationship("TeacherStudentLink", back_populates="student", cascade="all, delete-orphan")
    parent_links = relationship("ParentStudentLink", back_populates="student", cascade="all, delete-orphan")
    teacher_parent_links = relationship("TeacherParentStudentLink", back_populates="student", cascade="all, delete-orphan")
    daily_reports = relationship("ParentDailyReport", back_populates="student", cascade="all, delete-orphan")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "user_id": self.user_id, "full_name": self.full_name, "disability_level": self.disability_level, "support_note": self.support_note, "preferred_input": self.preferred_input, "preferred_read_speed": self.preferred_read_speed, "preferred_font_size": self.preferred_font_size, "preferred_bg_color": self.preferred_bg_color, "avatar_url": self.avatar_url, "created_by_teacher_id": self.created_by_teacher_id}
