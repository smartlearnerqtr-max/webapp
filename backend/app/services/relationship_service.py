from __future__ import annotations

from ..extensions import db
from ..models import ParentStudentLink, StudentProfile, TeacherParentStudentLink, TeacherStudentLink


def ensure_teacher_student_link(teacher_id: int, student_id: int, source: str | None = None) -> tuple[TeacherStudentLink, bool]:
    link = TeacherStudentLink.query.filter_by(teacher_id=teacher_id, student_id=student_id).first()
    created = False
    if not link:
        link = TeacherStudentLink(teacher_id=teacher_id, student_id=student_id, status='active', source=source)
        db.session.add(link)
        created = True
    else:
        link.status = 'active'
        if source and not link.source:
            link.source = source
    return link, created


def sync_legacy_teacher_student_links(teacher_id: int) -> int:
    created_count = 0
    legacy_students = StudentProfile.query.filter_by(created_by_teacher_id=teacher_id).all()
    for student in legacy_students:
        _link, created = ensure_teacher_student_link(teacher_id, student.id, source='legacy_created_by_teacher')
        if created:
            created_count += 1
    return created_count


def teacher_has_student_access(teacher_id: int, student: StudentProfile | None) -> bool:
    if not student:
        return False
    if TeacherStudentLink.query.filter_by(teacher_id=teacher_id, student_id=student.id, status='active').first():
        return True
    if student.created_by_teacher_id == teacher_id:
        ensure_teacher_student_link(teacher_id, student.id, source='legacy_created_by_teacher')
        return True
    return False


def ensure_parent_student_link(parent_id: int, student_id: int) -> tuple[ParentStudentLink, bool]:
    link = ParentStudentLink.query.filter_by(parent_id=parent_id, student_id=student_id).first()
    created = False
    if not link:
        link = ParentStudentLink(parent_id=parent_id, student_id=student_id, status='active')
        db.session.add(link)
        created = True
    else:
        link.status = 'active'
    return link, created


def ensure_teacher_parent_student_link(teacher_id: int, parent_id: int, student_id: int, source: str | None = None) -> tuple[TeacherParentStudentLink, bool]:
    link = TeacherParentStudentLink.query.filter_by(teacher_id=teacher_id, parent_id=parent_id, student_id=student_id).first()
    created = False
    if not link:
        link = TeacherParentStudentLink(
            teacher_id=teacher_id,
            parent_id=parent_id,
            student_id=student_id,
            status='active',
            source=source,
        )
        db.session.add(link)
        created = True
    else:
        link.status = 'active'
        if source and not link.source:
            link.source = source
    return link, created


def sync_legacy_teacher_parent_links(teacher_id: int) -> int:
    created_count = 0
    legacy_links = ParentStudentLink.query.filter_by(linked_by_teacher_id=teacher_id, status='active').all()
    for link in legacy_links:
        _group_link, created = ensure_teacher_parent_student_link(teacher_id, link.parent_id, link.student_id, source='legacy_teacher_parent')
        if created:
            created_count += 1
    return created_count
