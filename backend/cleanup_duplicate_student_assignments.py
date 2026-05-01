import os
from collections import defaultdict
from datetime import datetime

os.environ.setdefault("DATABASE_URL", "sqlite:///instance/dev.db")

from app import create_app
from app.extensions import db
from app.models import LessonActivity, LessonAssignment, LessonAssignmentStudent, StudentLessonProgress


def lesson_richness_score(lesson_id: int) -> tuple[int, int]:
    activities = LessonActivity.query.filter_by(lesson_id=lesson_id).all()
    media_count = 0
    rich_count = 0
    for activity in activities:
        config_json = activity.config_json or ""
        media_count += config_json.count("media_url") + config_json.count("image_url")
        rich_count += (
            config_json.count("/lesson-media/")
            + config_json.count("youtube.com")
            + config_json.count(".mp4")
            + config_json.count(".jpg")
            + config_json.count(".png")
        )
    return rich_count, media_count


def assignment_student_score(assignment: LessonAssignment, student_id: int) -> tuple[int, int, int, float]:
    progress = next((item for item in assignment.progresses if item.student_id == student_id), None)
    progress_percent = int(progress.progress_percent) if progress else 0
    completion_score = int(progress.completion_score) if progress else 0
    reward_star_count = int(progress.reward_star_count) if progress else 0
    created_at = assignment.created_at.timestamp() if isinstance(assignment.created_at, datetime) else 0.0
    return progress_percent, completion_score, reward_star_count, created_at


def cleanup_duplicate_student_assignments() -> None:
    rows = LessonAssignmentStudent.query.all()
    grouped: dict[tuple[int, int], list[LessonAssignmentStudent]] = defaultdict(list)
    for row in rows:
        assignment = db.session.get(LessonAssignment, row.assignment_id)
        if not assignment:
            continue
        grouped[(row.student_id, assignment.lesson_id)].append(row)

    cleaned_groups = 0
    removed_links = 0
    removed_progresses = 0
    removed_assignments = 0

    for (student_id, lesson_id), links in grouped.items():
        if len(links) <= 1:
            continue

        candidate_assignments: list[LessonAssignment] = []
        for link in links:
            assignment = db.session.get(LessonAssignment, link.assignment_id)
            if assignment:
                candidate_assignments.append(assignment)

        if len(candidate_assignments) <= 1:
            continue

        rich_count, media_count = lesson_richness_score(lesson_id)
        keeper = max(
            candidate_assignments,
            key=lambda assignment: (
                rich_count,
                media_count,
                *assignment_student_score(assignment, student_id),
                assignment.id,
            ),
        )

        for assignment in candidate_assignments:
            if assignment.id == keeper.id:
                continue

            assignment_student = LessonAssignmentStudent.query.filter_by(
                assignment_id=assignment.id,
                student_id=student_id,
            ).first()
            if assignment_student:
                db.session.delete(assignment_student)
                removed_links += 1

            progress = StudentLessonProgress.query.filter_by(
                assignment_id=assignment.id,
                student_id=student_id,
            ).first()
            if progress:
                db.session.delete(progress)
                removed_progresses += 1

        cleaned_groups += 1

    db.session.flush()

    for assignment in LessonAssignment.query.all():
        remaining_students = LessonAssignmentStudent.query.filter_by(assignment_id=assignment.id).count()
        remaining_progresses = StudentLessonProgress.query.filter_by(assignment_id=assignment.id).count()
        if remaining_students == 0 and remaining_progresses == 0:
            db.session.delete(assignment)
            removed_assignments += 1

    db.session.commit()
    print(
        {
            "cleaned_groups": cleaned_groups,
            "removed_links": removed_links,
            "removed_progresses": removed_progresses,
            "removed_assignments": removed_assignments,
        }
    )


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        cleanup_duplicate_student_assignments()
