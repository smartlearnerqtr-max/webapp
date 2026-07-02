from __future__ import annotations

import sys
from dataclasses import dataclass

from app import create_app
from app.extensions import db
from app.models import (
    ClassJoinCredential,
    ClassStudent,
    Classroom,
    ParentProfile,
    StudentProfile,
    TeacherProfile,
    User,
)
from app.services.relationship_service import (
    ensure_parent_student_link,
    ensure_teacher_parent_student_link,
    ensure_teacher_student_link,
)
from app.utils.security import hash_password


DEFAULT_PASSWORD = "App@123"
DEFAULT_SCHOOL = "Trường THCS demo dự thi"


@dataclass(frozen=True)
class DemoStudent:
    full_name: str
    email: str
    level: str
    class_name: str
    class_code_label: str
    class_password: str
    teacher_name: str
    teacher_email: str
    parent_name: str | None = None
    parent_email: str | None = None
    parent_relationship: str | None = None
    student_code: str | None = None


TEST_ACCOUNTS = [
    {
        "role": "admin",
        "email": "giaoviendoimoi@gmail.com",
        "password": "admin12345678",
    },
    {
        "role": "teacher",
        "email": "teacher.levels.demo@example.com",
        "password": "Teacher123!",
        "full_name": "Giáo viên demo 3 mức",
        "school_name": "Lớp demo 3 mức",
    },
    {
        "role": "student",
        "email": "nguyenvana.demo@example.com",
        "password": "Student123!",
        "full_name": "Nguyễn Văn A",
        "level": "nhe",
    },
    {
        "role": "student",
        "email": "nguyenvanb.demo@example.com",
        "password": "Student123!",
        "full_name": "Nguyễn Văn B",
        "level": "trung_binh",
    },
    {
        "role": "student",
        "email": "nguyenvanc.demo@example.com",
        "password": "Student123!",
        "full_name": "Nguyễn Văn C",
        "level": "nang",
    },
    {
        "role": "teacher",
        "email": "visual.teacher.demo@example.com",
        "password": "Teacher123!",
        "full_name": "Cô Minh Họa",
        "school_name": "Lớp học trực quan",
    },
    {
        "role": "student",
        "email": "visual.student.demo@example.com",
        "password": "Student123!",
        "full_name": "Học sinh trực quan demo",
        "level": "nhe",
    },
    {
        "role": "parent",
        "email": "parent@example.com",
        "password": "Parent123!",
        "full_name": "Phụ huynh demo",
        "relationship_label": "Phụ huynh",
    },
]


COMPETITION_STUDENTS = [
    DemoStudent(
        full_name="Trần Phương Uyên",
        email="tranphuonguyen@gmail.com",
        level="nhe",
        class_name="Lớp 7A4",
        class_code_label="5",
        class_password="DE963XEJ",
        teacher_name="Nguyễn Thị Vân",
        teacher_email="nguyenthivan.qtr@gmail.com",
        parent_name="Trần Xuân Ninh",
        parent_email="tranxuanninh@gmail.com",
        parent_relationship="Cha",
        student_code="2026006",
    ),
    DemoStudent(
        full_name="Phan Phi Long",
        email="phanphilong@gmail.com",
        level="trung_binh",
        class_name="Lớp 8A8",
        class_code_label="6",
        class_password="APHLPNRB",
        teacher_name="Nguyễn Văn Hạnh",
        teacher_email="nguyenvanhanh.qtr@gmail.com",
        parent_name="Nguyễn Thanh Hà",
        parent_email="nguyenthanhha.qtr@gmail.com",
        parent_relationship="Me",
        student_code="2026007",
    ),
    DemoStudent(
        full_name="Trần Thanh Quý",
        email="tranthanhquy@gmail.com",
        level="nang",
        class_name="Lớp 6A4",
        class_code_label="7",
        class_password="S8R3BE7G",
        teacher_name="Trịnh Thị Tường Vi",
        teacher_email="trinhthituongvi.qtr@gmail.com",
        student_code="2026008",
        parent_name="Nguyễn Thị Bình",
        parent_email="nguyenthibinh@gmail.com",
        parent_relationship="Me",
    ),
    DemoStudent(
        full_name="Trần Công Minh",
        email="trancongminh@gmail.com",
        level="nang",
        class_name="Lớp 6A5",
        class_code_label="8",
        class_password="PHD9VGZ8",
        teacher_name="Nguyễn Quang Đạo",
        teacher_email="nguyenquangdao.qtr@gmail.com",
        student_code="2026009",
    ),
    DemoStudent(
        full_name="Nguyễn Đăng Khôi",
        email="nguyendangkhoi@gmail.com",
        level="nang",
        class_name="Lớp 6A8",
        class_code_label="9",
        class_password="7YT3MS7P",
        teacher_name="Trần Thịnh Phú",
        teacher_email="tranthinhphu.qtr@gmail.com",
        student_code="2026010",
    ),
    DemoStudent(
        full_name="Lê Nguyễn Hoàng Anh",
        email="lenguyenhoanganh@gmail.com",
        level="nang",
        class_name="Lớp 7A5",
        class_code_label="10",
        class_password="B5EN84WD",
        teacher_name="Nguyễn Thị Hồng",
        teacher_email="nguyenthihong.qtr@gmail.com",
        student_code="2026011",
    ),
    DemoStudent(
        full_name="Vũ Đức Anh",
        email="vuducanh@gmail.com",
        level="nang",
        class_name="Lớp 7A3",
        class_code_label="11",
        class_password="T3ARPUJH",
        teacher_name="Lê Thị Ngọc Mai",
        teacher_email="lethingocmai.qtr@gmail.com",
        student_code="2026012",
    ),
    DemoStudent(
        full_name="Nguyễn Thị Minh Anh",
        email="nguyenthiminhanh@gmail.com",
        level="trung_binh",
        class_name="Lớp 6A7",
        class_code_label="12",
        class_password="CGANUE9J",
        teacher_name="Võ Văn Thà",
        teacher_email="vovantha.qtr@gmail.com",
        student_code="2026013",
    ),
    DemoStudent(
        full_name="Trần Nguyễn Thiên Phúc",
        email="trannguyenthienphuc@gmail.com",
        level="trung_binh",
        class_name="Lớp 7A2",
        class_code_label="16",
        class_password="8PUTFQB6",
        teacher_name="Nguyễn Đức Quân",
        teacher_email="nguyenducquan.qtr@gmail.com",
        student_code="2026014",
    ),
    DemoStudent(
        full_name="Lê Ngọc Như Ý",
        email="lengocnhuy.qtr@gmail.com",
        level="nhe",
        class_name="Lớp 6A6",
        class_code_label="8",
        class_password="89VEWHFJ",
        teacher_name="Hoàng Thị Khôi",
        teacher_email="hoangthikhoi.qtr@gmail.com",
        student_code="2026015",
    ),
    DemoStudent(
        full_name="Phồng Ngọc Thiên Ngân",
        email="phongngocthienngan.qtr@gmail.com",
        level="nhe",
        class_name="Lớp 7A1",
        class_code_label="6",
        class_password="K9WG9DKN",
        teacher_name="Lê Phương Đông",
        teacher_email="lephuongdong.qtr@gmail.com",
        student_code="2026016",
    ),
    DemoStudent(
        full_name="Nguyễn Ngọc Kim Ngân",
        email="nguyenngockimngan.qtr@gmail.com",
        level="nhe",
        class_name="Lớp 9A3",
        class_code_label="5",
        class_password="X338XT9B",
        teacher_name="Đặng Thị Thảo",
        teacher_email="dangthithao.qtr@gmail.com",
        student_code="2026017",
    ),
]


def _normalize_email(email: str | None) -> str | None:
    return (email or "").strip().lower() or None


def _get_or_create_user(email: str, role: str, password: str) -> tuple[User, bool]:
    normalized_email = _normalize_email(email)
    user = User.query.filter_by(email=normalized_email).first()
    if user:
        return user, False
    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        role=role,
        status="active",
    )
    db.session.add(user)
    db.session.flush()
    return user, True


def _ensure_teacher(email: str, full_name: str, password: str = DEFAULT_PASSWORD, school_name: str | None = None) -> tuple[TeacherProfile, bool]:
    user, created_user = _get_or_create_user(email, "teacher", password)
    profile = user.teacher_profile
    created_profile = False
    if not profile:
        profile = TeacherProfile(
            user_id=user.id,
            full_name=full_name,
            school_name=school_name or DEFAULT_SCHOOL,
            note="Tài khoản dự thi được seed từ seed_competition_accounts.py",
        )
        db.session.add(profile)
        db.session.flush()
        created_profile = True
    else:
        profile.full_name = full_name
        if school_name and not profile.school_name:
            profile.school_name = school_name
    return profile, created_user or created_profile


def _ensure_student(email: str, full_name: str, level: str, password: str = DEFAULT_PASSWORD, created_by_teacher_id: int | None = None, student_code: str | None = None) -> tuple[StudentProfile, bool]:
    user, created_user = _get_or_create_user(email, "student", password)
    if student_code and user.phone != student_code:
        existing_code_user = User.query.filter_by(phone=student_code).first()
        if existing_code_user and existing_code_user.id != user.id:
            raise ValueError(f"Student code {student_code} already belongs to user {existing_code_user.id}")
        user.phone = student_code
    profile = user.student_profile
    created_profile = False
    if not profile:
        profile = StudentProfile(
            user_id=user.id,
            full_name=full_name,
            disability_level=level,
            support_note="Dữ liệu demo dự thi.",
            preferred_input="touch",
            created_by_teacher_id=created_by_teacher_id,
        )
        db.session.add(profile)
        db.session.flush()
        created_profile = True
    elif created_by_teacher_id and not profile.created_by_teacher_id:
        profile.created_by_teacher_id = created_by_teacher_id
    if profile:
        profile.full_name = full_name
        profile.disability_level = level
    return profile, created_user or created_profile


def _ensure_parent(email: str, full_name: str, relationship_label: str | None, password: str = DEFAULT_PASSWORD) -> tuple[ParentProfile, bool]:
    user, created_user = _get_or_create_user(email, "parent", password)
    profile = user.parent_profile
    created_profile = False
    if not profile:
        profile = ParentProfile(
            user_id=user.id,
            full_name=full_name,
            relationship_label=relationship_label,
            note="Tài khoản phụ huynh dự thi.",
        )
        db.session.add(profile)
        db.session.flush()
        created_profile = True
    else:
        profile.full_name = full_name
        if relationship_label:
            profile.relationship_label = relationship_label
    return profile, created_user or created_profile


def _ensure_admin(email: str, password: str) -> bool:
    _user, created = _get_or_create_user(email, "admin", password)
    return created


def _ensure_classroom(teacher: TeacherProfile, item: DemoStudent, ui_variant: str = Classroom.UI_VARIANT_STANDARD) -> tuple[Classroom, bool]:
    classroom = Classroom.query.filter_by(teacher_id=teacher.id, name=item.class_name).first()
    if not classroom:
        classroom = (
            Classroom.query.join(ClassJoinCredential)
            .filter(Classroom.teacher_id == teacher.id, ClassJoinCredential.join_password == item.class_password)
            .first()
        )
    created = False
    if not classroom:
        classroom = Classroom(
            teacher_id=teacher.id,
            name=item.class_name,
            grade_label=item.class_name.replace("Lớp ", ""),
            description=f"Mã lớp theo danh sách dự thi: {item.class_code_label}",
            default_disability_level=item.level,
            ui_variant=ui_variant,
            visual_theme=Classroom.VISUAL_THEME_GARDEN,
            status="active",
        )
        db.session.add(classroom)
        db.session.flush()
        created = True
    else:
        classroom.name = item.class_name
        classroom.grade_label = item.class_name.replace("Lớp ", "")
        classroom.status = "active"
        if not classroom.default_disability_level:
            classroom.default_disability_level = item.level
    if classroom.join_credential:
        classroom.join_credential.join_password = item.class_password
    else:
        db.session.add(ClassJoinCredential(class_id=classroom.id, join_password=item.class_password))
        db.session.flush()
    return classroom, created


def _ensure_class_student(classroom: Classroom, student: StudentProfile) -> bool:
    link = ClassStudent.query.filter_by(class_id=classroom.id, student_id=student.id).first()
    if link:
        link.status = "active"
        return False
    db.session.add(ClassStudent(class_id=classroom.id, student_id=student.id, status="active"))
    return True


def _seed_test_accounts() -> dict[str, int]:
    created = {"users": 0, "profiles": 0, "classes": 0, "class_students": 0}

    for account in TEST_ACCOUNTS:
        role = account["role"]
        if role == "admin":
            if _ensure_admin(account["email"], account["password"]):
                created["users"] += 1
        elif role == "teacher":
            _profile, did_create = _ensure_teacher(
                account["email"],
                account["full_name"],
                account["password"],
                account.get("school_name"),
            )
            if did_create:
                created["profiles"] += 1
        elif role == "student":
            _profile, did_create = _ensure_student(
                account["email"],
                account["full_name"],
                account["level"],
                account["password"],
            )
            if did_create:
                created["profiles"] += 1
        elif role == "parent":
            _profile, did_create = _ensure_parent(
                account["email"],
                account["full_name"],
                account.get("relationship_label"),
                account["password"],
            )
            if did_create:
                created["profiles"] += 1

    teacher, _ = _ensure_teacher("teacher.levels.demo@example.com", "Giáo viên demo 3 mức", "Teacher123!", "Lớp demo 3 mức")
    demo_items = [
        DemoStudent("Nguyễn Văn A", "nguyenvana.demo@example.com", "nhe", "Lớp demo 3 mức", "demo", "MUC3TEST", teacher.full_name, teacher.user.email),
        DemoStudent("Nguyễn Văn B", "nguyenvanb.demo@example.com", "trung_binh", "Lớp demo 3 mức", "demo", "MUC3TEST", teacher.full_name, teacher.user.email),
        DemoStudent("Nguyễn Văn C", "nguyenvanc.demo@example.com", "nang", "Lớp demo 3 mức", "demo", "MUC3TEST", teacher.full_name, teacher.user.email),
    ]
    classroom, did_create_class = _ensure_classroom(teacher, demo_items[0])
    if did_create_class:
        created["classes"] += 1
    for demo_item in demo_items:
        student, _ = _ensure_student(demo_item.email, demo_item.full_name, demo_item.level, "Student123!", teacher.id)
        ensure_teacher_student_link(teacher.id, student.id, source="competition_seed")
        if _ensure_class_student(classroom, student):
            created["class_students"] += 1

    visual_teacher, _ = _ensure_teacher("visual.teacher.demo@example.com", "Cô Minh Họa", "Teacher123!", "Lớp học trực quan")
    visual_item = DemoStudent("Học sinh trực quan demo", "visual.student.demo@example.com", "nhe", "Lớp Trực Quan Demo", "visual", "VISUAL08", visual_teacher.full_name, visual_teacher.user.email)
    visual_classroom, did_create_visual_class = _ensure_classroom(visual_teacher, visual_item, Classroom.UI_VARIANT_VISUAL_SUPPORT)
    if did_create_visual_class:
        created["classes"] += 1
    visual_student, _ = _ensure_student(visual_item.email, visual_item.full_name, visual_item.level, "Student123!", visual_teacher.id)
    ensure_teacher_student_link(visual_teacher.id, visual_student.id, source="competition_seed")
    if _ensure_class_student(visual_classroom, visual_student):
        created["class_students"] += 1

    parent = User.query.filter_by(email="parent@example.com").first()
    if parent and parent.parent_profile:
        ensure_parent_student_link(parent.parent_profile.id, visual_student.id)
        ensure_teacher_parent_student_link(visual_teacher.id, parent.parent_profile.id, visual_student.id, source="competition_seed")

    return created


def _seed_competition_students() -> dict[str, int]:
    created = {"teachers": 0, "students": 0, "parents": 0, "classes": 0, "class_students": 0}

    for item in COMPETITION_STUDENTS:
        teacher, created_teacher = _ensure_teacher(item.teacher_email, item.teacher_name)
        if created_teacher:
            created["teachers"] += 1

        student, created_student = _ensure_student(item.email, item.full_name, item.level, created_by_teacher_id=teacher.id, student_code=item.student_code)
        if created_student:
            created["students"] += 1

        classroom, created_class = _ensure_classroom(teacher, item)
        if created_class:
            created["classes"] += 1

        ensure_teacher_student_link(teacher.id, student.id, source="competition_seed")
        if _ensure_class_student(classroom, student):
            created["class_students"] += 1

        if item.parent_email and item.parent_name:
            parent, created_parent = _ensure_parent(item.parent_email, item.parent_name, item.parent_relationship)
            if created_parent:
                created["parents"] += 1
            ensure_parent_student_link(parent.id, student.id)
            ensure_teacher_parent_student_link(teacher.id, parent.id, student.id, source="competition_seed")

    return created


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    app = create_app()
    with app.app_context():
        db.create_all()
        test_counts = _seed_test_accounts()
        competition_counts = _seed_competition_students()
        db.session.commit()

        print("Seed competition accounts completed.")
        print(f"Test/demo created or repaired: {test_counts}")
        print(f"Competition created or repaired: {competition_counts}")
        print("Competition class credentials:")
        for item in COMPETITION_STUDENTS:
            teacher = User.query.filter_by(email=_normalize_email(item.teacher_email)).first().teacher_profile
            classroom = Classroom.query.filter_by(teacher_id=teacher.id, name=item.class_name).first()
            print(
                f"- {item.class_name} / {item.teacher_name}: "
                f"DB class_id={classroom.id}, listed ID={item.class_code_label}, password={item.class_password}"
            )


if __name__ == "__main__":
    main()
