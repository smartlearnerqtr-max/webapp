from __future__ import annotations

import json

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


def _parse_json_list(raw_value: str | None) -> list[object]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


class TeacherCareerCard(TimestampMixin, db.Model):
    __tablename__ = "teacher_career_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    meaning_title: Mapped[str] = mapped_column(String(255), nullable=False, default="Ý nghĩa công việc")
    meaning_text: Mapped[str] = mapped_column(Text, nullable=False)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    video_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    levels_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    teacher = relationship("TeacherProfile", back_populates="career_cards")

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "title": self.title,
            "description": self.description,
            "cover_image_url": self.cover_image_url,
            "meaning_title": self.meaning_title,
            "meaning_text": self.meaning_text,
            "video_url": self.video_url,
            "video_note": self.video_note,
            "steps": _parse_json_list(self.steps_json),
            "skills": _parse_json_list(self.skills_json),
            "levels": _parse_json_list(self.levels_json),
            "status": self.status,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "teacher": self.teacher.to_dict() if self.teacher else None,
        }
