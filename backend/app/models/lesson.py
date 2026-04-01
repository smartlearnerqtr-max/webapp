from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class Lesson(TimestampMixin, db.Model):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_by_teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_level: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    difficulty_stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    subject = relationship("Subject")
    activities = relationship("LessonActivity", back_populates="lesson", cascade="all, delete-orphan")
    assignments = relationship("LessonAssignment", back_populates="lesson", cascade="all, delete-orphan")

    def to_dict(self, include_activities: bool = False) -> dict[str, object]:
        payload = {
            "id": self.id,
            "created_by_teacher_id": self.created_by_teacher_id,
            "subject_id": self.subject_id,
            "title": self.title,
            "description": self.description,
            "primary_level": self.primary_level,
            "estimated_minutes": self.estimated_minutes,
            "difficulty_stage": self.difficulty_stage,
            "is_published": self.is_published,
            "is_archived": self.is_archived,
            "activity_count": len(self.activities),
            "subject": self.subject.to_dict() if self.subject else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_activities:
            payload["activities"] = [activity.to_dict() for activity in sorted(self.activities, key=lambda item: item.sort_order)]
        return payload


class LessonActivity(TimestampMixin, db.Model):
    __tablename__ = "lesson_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    instruction_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_answer_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    difficulty_stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    config_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    lesson = relationship("Lesson", back_populates="activities")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "lesson_id": self.lesson_id,
            "title": self.title,
            "activity_type": self.activity_type,
            "instruction_text": self.instruction_text,
            "voice_answer_enabled": self.voice_answer_enabled,
            "is_required": self.is_required,
            "sort_order": self.sort_order,
            "difficulty_stage": self.difficulty_stage,
            "config_json": self.config_json,
        }


class LessonAssignment(TimestampMixin, db.Model):
    __tablename__ = "lesson_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), nullable=False, index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False, index=True)
    assigned_by_teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(30), nullable=False, default="class")
    due_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    required_completion_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    lesson = relationship("Lesson", back_populates="assignments")
    classroom = relationship("Classroom")
    subject = relationship("Subject")
    students = relationship("LessonAssignmentStudent", back_populates="assignment", cascade="all, delete-orphan")
    progresses = relationship("StudentLessonProgress", back_populates="assignment", cascade="all, delete-orphan")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "lesson_id": self.lesson_id,
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "assigned_by_teacher_id": self.assigned_by_teacher_id,
            "target_type": self.target_type,
            "due_at": self.due_at,
            "required_completion_percent": self.required_completion_percent,
            "status": self.status,
            "lesson": self.lesson.to_dict() if self.lesson else None,
            "classroom": self.classroom.to_dict() if self.classroom else None,
            "subject": self.subject.to_dict() if self.subject else None,
            "student_ids": [item.student_id for item in self.students],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LessonAssignmentStudent(TimestampMixin, db.Model):
    __tablename__ = "lesson_assignment_students"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="uq_assignment_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("lesson_assignments.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False)

    assignment = relationship("LessonAssignment", back_populates="students")
    student = relationship("StudentProfile")


class StudentLessonProgress(TimestampMixin, db.Model):
    __tablename__ = "student_lesson_progress"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="uq_assignment_progress"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("lesson_assignments.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="not_started")
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_learning_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    help_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reward_star_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    assignment = relationship("LessonAssignment", back_populates="progresses")
    student = relationship("StudentProfile")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "assignment_id": self.assignment_id,
            "student_id": self.student_id,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "total_learning_seconds": self.total_learning_seconds,
            "retry_count": self.retry_count,
            "help_count": self.help_count,
            "reward_star_count": self.reward_star_count,
            "completion_score": self.completion_score,
            "completed_at": self.completed_at,
            "student": self.student.to_dict() if self.student else None,
        }
