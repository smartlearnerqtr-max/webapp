from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class TeacherStudentLink(TimestampMixin, db.Model):
    __tablename__ = 'teacher_student_links'
    __table_args__ = (UniqueConstraint('teacher_id', 'student_id', name='uq_teacher_student_link'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey('teacher_profiles.id'), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('student_profiles.id'), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default='active')
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    teacher = relationship('TeacherProfile', back_populates='student_links')
    student = relationship('StudentProfile', back_populates='teacher_links')

    def to_dict(self) -> dict[str, object]:
        return {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'student_id': self.student_id,
            'status': self.status,
            'source': self.source,
            'student': self.student.to_dict() if self.student else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class TeacherParentStudentLink(TimestampMixin, db.Model):
    __tablename__ = 'teacher_parent_student_links'
    __table_args__ = (UniqueConstraint('teacher_id', 'parent_id', 'student_id', name='uq_teacher_parent_student_link'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey('teacher_profiles.id'), nullable=False, index=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey('parent_profiles.id'), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('student_profiles.id'), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default='active')
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    teacher = relationship('TeacherProfile', back_populates='parent_group_links')
    parent = relationship('ParentProfile', back_populates='teacher_group_links')
    student = relationship('StudentProfile', back_populates='teacher_parent_links')

    def to_dict(self) -> dict[str, object]:
        return {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'parent_id': self.parent_id,
            'student_id': self.student_id,
            'status': self.status,
            'source': self.source,
            'parent': self.parent.to_dict() if self.parent else None,
            'student': self.student.to_dict() if self.student else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
