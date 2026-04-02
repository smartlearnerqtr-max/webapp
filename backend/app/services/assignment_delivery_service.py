from __future__ import annotations

from ..extensions import db
from ..models import Classroom, LessonAssignment, LessonAssignmentStudent, StudentLessonProgress


def ensure_student_has_active_assignments(classroom: Classroom, student_id: int) -> list[LessonAssignment]:
    assignments = LessonAssignment.query.filter_by(class_id=classroom.id, status='active').order_by(LessonAssignment.created_at.desc()).all()
    created_assignments: list[LessonAssignment] = []

    for assignment in assignments:
        assignment_student = LessonAssignmentStudent.query.filter_by(assignment_id=assignment.id, student_id=student_id).first()
        progress = StudentLessonProgress.query.filter_by(assignment_id=assignment.id, student_id=student_id).first()
        created_any = False

        if not assignment_student:
            db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=student_id))
            created_any = True

        if not progress:
            db.session.add(
                StudentLessonProgress(
                    assignment_id=assignment.id,
                    student_id=student_id,
                    status='not_started',
                    progress_percent=0,
                )
            )
            created_any = True

        if created_any:
            created_assignments.append(assignment)

    return created_assignments
