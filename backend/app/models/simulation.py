from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class TeacherSimulationQuizQuestion(TimestampMixin, db.Model):
    __tablename__ = "teacher_simulation_quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    subject_code: Mapped[str] = mapped_column(String(30), nullable=False, default="KHTN", index=True)
    simulation_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    simulation_title: Mapped[str] = mapped_column(String(255), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option: Mapped[str] = mapped_column(String(1), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    teacher = relationship("TeacherProfile")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "subject_code": self.subject_code,
            "simulation_key": self.simulation_key,
            "simulation_title": self.simulation_title,
            "question_text": self.question_text,
            "option_a": self.option_a,
            "option_b": self.option_b,
            "option_c": self.option_c,
            "option_d": self.option_d,
            "correct_option": self.correct_option,
            "explanation": self.explanation,
            "status": self.status,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
