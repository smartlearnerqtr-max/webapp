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
    teacher = relationship("TeacherProfile", back_populates="parent_links")


class ParentDailyReport(TimestampMixin, db.Model):
    __tablename__ = "parent_daily_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("parent_profiles.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id"), nullable=False, index=True)
    report_date: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_note: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    summary_text: Mapped[str] = mapped_column(String(2000), nullable=False)
    recommendation: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    total_assignments: Mapped[int] = mapped_column(nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(nullable=False, default=0)
    in_progress_count: Mapped[int] = mapped_column(nullable=False, default=0)
    last_assignment_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_progress_percent: Mapped[int] = mapped_column(nullable=False, default=0)
    readiness_status: Mapped[str] = mapped_column(String(30), nullable=False, default="dang_phu_hop")
    help_count: Mapped[int] = mapped_column(nullable=False, default=0)
    retry_count: Mapped[int] = mapped_column(nullable=False, default=0)
    completion_score: Mapped[int] = mapped_column(nullable=False, default=0)

    teacher = relationship("TeacherProfile", back_populates="parent_reports")
    parent = relationship("ParentProfile", back_populates="reports")
    student = relationship("StudentProfile", back_populates="daily_reports")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "parent_id": self.parent_id,
            "student_id": self.student_id,
            "report_date": self.report_date,
            "title": self.title,
            "teacher_note": self.teacher_note,
            "summary_text": self.summary_text,
            "recommendation": self.recommendation,
            "total_assignments": self.total_assignments,
            "completed_count": self.completed_count,
            "in_progress_count": self.in_progress_count,
            "last_assignment_title": self.last_assignment_title,
            "last_progress_percent": self.last_progress_percent,
            "readiness_status": self.readiness_status,
            "help_count": self.help_count,
            "retry_count": self.retry_count,
            "completion_score": self.completion_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
