from __future__ import annotations

from ..extensions import db
from ..models import ParentProfile, ParentStudentLink, StudentProfile, Subject, TeacherProfile, User
from ..utils.security import hash_password

BASE_SUBJECTS = [("TOAN", "Toan"), ("VAN", "Van"), ("KHTN", "Khoa hoc tu nhien"), ("KY_NANG_SONG", "Ky nang song")]


def seed_subjects() -> int:
    created = 0
    for index, (code, name) in enumerate(BASE_SUBJECTS, start=1):
        if Subject.query.filter_by(code=code).first():
            continue
        db.session.add(Subject(code=code, name=name, sort_order=index, is_active=True))
        created += 1
    db.session.commit()
    return created


def seed_demo_teacher() -> User:
    existing = User.query.filter_by(email="teacher@example.com").first()
    if existing:
        return existing
    user = User(email="teacher@example.com", phone="0900000001", password_hash=hash_password("123456"), role="teacher", status="active")
    db.session.add(user)
    db.session.flush()
    db.session.add(TeacherProfile(user_id=user.id, full_name="Giao vien demo", school_name="Truong demo"))
    db.session.commit()
    return user


def seed_demo_student() -> User:
    existing = User.query.filter_by(email="student@example.com").first()
    if existing:
        return existing

    teacher_user = seed_demo_teacher()
    student_user = User(
        email="student@example.com",
        phone="0900000002",
        password_hash=hash_password("123456"),
        role="student",
        status="active",
    )
    db.session.add(student_user)
    db.session.flush()
    db.session.add(
        StudentProfile(
            user_id=student_user.id,
            full_name="Hoc sinh demo",
            disability_level="trung_binh",
            support_note="Tai khoan demo de kiem thu assignment",
            preferred_input="voice",
            preferred_read_speed="slow",
            preferred_font_size="large",
            preferred_bg_color="soft_blue",
            created_by_teacher_id=teacher_user.teacher_profile.id if teacher_user.teacher_profile else None,
        )
    )
    db.session.commit()
    return student_user


def seed_demo_parent() -> User:
    existing = User.query.filter_by(email="parent@example.com").first()
    if existing:
        return existing

    student_user = seed_demo_student()
    teacher_user = seed_demo_teacher()
    parent_user = User(
        email="parent@example.com",
        phone="0900000003",
        password_hash=hash_password("123456"),
        role="parent",
        status="active",
    )
    db.session.add(parent_user)
    db.session.flush()

    parent_profile = ParentProfile(
        user_id=parent_user.id,
        full_name="Phu huynh demo",
        relationship_label="Me",
    )
    db.session.add(parent_profile)
    db.session.flush()

    student_profile = student_user.student_profile
    if student_profile and not ParentStudentLink.query.filter_by(parent_id=parent_profile.id, student_id=student_profile.id).first():
        db.session.add(
            ParentStudentLink(
                parent_id=parent_profile.id,
                student_id=student_profile.id,
                linked_by_teacher_id=teacher_user.teacher_profile.id if teacher_user.teacher_profile else None,
                status="active",
            )
        )

    db.session.commit()
    return parent_user
