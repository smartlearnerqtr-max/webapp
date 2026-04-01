import random
from datetime import datetime, timedelta
import os

from app import create_app
from app.extensions import db
from app.models import (
    User, TeacherProfile, StudentProfile, ParentProfile, 
    Classroom, ClassStudent, Subject, ClassSubject,
    Lesson, LessonActivity, LessonAssignment, LessonAssignmentStudent,
    StudentLessonProgress, ParentDailyReport, ParentStudentLink
)
from app.utils.security import hash_password

def seed_test_scenario():
    print("Starting test scenario seeding with hardcoded relative path...")
    
    # 1. Ensure subjects exist
    subjects = Subject.query.all()
    if not subjects:
        print("Error: No subjects found. Please run seed-base first.")
        return

    # 2. Create Teachers
    teachers_data = [
        {"email": "co_lan@example.com", "name": "Co Lan", "school": "Truong Tieu Hoc A"},
        {"email": "co_mai@example.com", "name": "Co Mai", "school": "Truong Tieu Hoc B"}
    ]
    
    teachers = []
    for data in teachers_data:
        print(f"Creating/Checking teacher: {data['email']}")
        user = User.query.filter_by(email=data["email"]).first()
        if not user:
            user = User(
                email=data["email"],
                password_hash=hash_password("password123"),
                role="teacher",
                status="active"
            )
            db.session.add(user)
            db.session.flush()
            
            profile = TeacherProfile(
                user_id=user.id,
                full_name=data["name"],
                school_name=data["school"],
                note=f"Giao vien kinh nghiem tu {data['school']}"
            )
            db.session.add(profile)
            teachers.append(profile)
        else:
            teachers.append(user.teacher_profile)

    db.session.commit()
    print(f"Verified {len(teachers)} Teachers.")

    # 3. For each teacher, create 10 Students and 10 Parents
    all_students = []
    for teacher in teachers:
        print(f"Adding students for {teacher.full_name}")
        classroom = Classroom.query.filter_by(teacher_id=teacher.id, name=f"Lop cua {teacher.full_name}").first()
        if not classroom:
            classroom = Classroom(
                teacher_id=teacher.id,
                name=f"Lop cua {teacher.full_name}",
                grade_label="Lop 1",
                description=f"Khong gian hoc tap cua {teacher.full_name}",
                status="active"
            )
            db.session.add(classroom)
            db.session.flush()
            
            # Add all subjects to classroom
            for sub in subjects:
                db.session.add(ClassSubject(class_id=classroom.id, subject_id=sub.id, is_active=True))

        for i in range(1, 11):
            student_name = f"Hoc sinh {i} ({teacher.full_name})"
            p_idx = f"{teacher.id}_{i}"
            parent_email = f"phu_huynh_{p_idx}@example.com"
            parent_name = f"Phu huynh {student_name}"
            
            # Create Student
            student = StudentProfile(
                full_name=student_name,
                disability_level=random.choice(["nhe", "trung_binh"]),
                created_by_teacher_id=teacher.id,
                preferred_input="touch"
            )
            db.session.add(student)
            db.session.flush()
            
            # Enrollment
            db.session.add(ClassStudent(class_id=classroom.id, student_id=student.id, status="active"))
            
            # Create Parent User & Profile
            p_user = User.query.filter_by(email=parent_email).first()
            if not p_user:
                p_user = User(
                    email=parent_email,
                    password_hash=hash_password("password123"),
                    role="parent",
                    status="active"
                )
                db.session.add(p_user)
                db.session.flush()
                
                p_profile = ParentProfile(
                    user_id=p_user.id,
                    full_name=parent_name,
                    relationship_label="Phu huynh"
                )
                db.session.add(p_profile)
                db.session.flush()
            else:
                p_profile = p_user.parent_profile
            
            # Link Parent to Student
            link = ParentStudentLink.query.filter_by(parent_id=p_profile.id, student_id=student.id).first()
            if not link:
                db.session.add(ParentStudentLink(
                    parent_id=p_profile.id,
                    student_id=student.id,
                    linked_by_teacher_id=teacher.id,
                    status="active"
                ))

            all_students.append((student, p_profile, teacher, classroom))

    db.session.commit()
    print("Created Students and Parents.")

    # 4. Create Lessons and Assignments
    print("Creating lessons...")
    lessons = []
    for teacher in teachers:
        for sub in subjects:
            lesson = Lesson(
                created_by_teacher_id=teacher.id,
                subject_id=sub.id,
                title=f"Bai hoc {sub.name} co ban",
                description=f"Huong dan hoc {sub.name} cho tre",
                primary_level="nhe",
                estimated_minutes=15,
                is_published=True
            )
            db.session.add(lesson)
            db.session.flush()
            
            # Add Activity
            db.session.add(LessonActivity(
                lesson_id=lesson.id,
                title="Lam quen con so/chu cai",
                activity_type="interactive_card",
                instruction_text="Hay cham vao hinh anh phu hop",
                sort_order=1
            ))
            
            lessons.append((lesson, teacher))

    db.session.commit()

    # 5. Assign and Progress
    print("Assigning and creating progress...")
    for teacher in teachers:
        teacher_lessons = [l for l, t in lessons if t.id == teacher.id]
        classroom = Classroom.query.filter_by(teacher_id=teacher.id).first()
        
        for lesson in teacher_lessons:
            assignment = LessonAssignment(
                lesson_id=lesson.id,
                class_id=classroom.id,
                subject_id=lesson.subject_id,
                assigned_by_teacher_id=teacher.id,
                target_type="class",
                status="active",
                due_at=(datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
            )
            db.session.add(assignment)
            db.session.flush()
            
            # Random progress for students
            students_in_class = [s for s, p, t, c in all_students if c.id == classroom.id]
            for stu in students_in_class:
                # Add student to assignment
                db.session.add(LessonAssignmentStudent(assignment_id=assignment.id, student_id=stu.id))
                
                # Progress
                progress = StudentLessonProgress(
                    assignment_id=assignment.id,
                    student_id=stu.id,
                    status=random.choice(["completed", "in_progress", "not_started"]),
                    progress_percent=random.randint(0, 100),
                    total_learning_seconds=random.randint(0, 600),
                    reward_star_count=random.randint(0, 5),
                    completion_score=random.randint(0, 100)
                )
                if progress.status == "completed":
                    progress.progress_percent = 100
                    progress.completed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                db.session.add(progress)

    db.session.commit()

    # 6. Daily Reports
    print("Generating reports...")
    for student, parent, teacher, classroom in all_students:
        report = ParentDailyReport(
            teacher_id=teacher.id,
            parent_id=parent.id,
            student_id=student.id,
            report_date=datetime.now().strftime("%Y-%m-%d"),
            title=f"Bao cao ngay {datetime.now().strftime('%d/%m/%Y')} - {student.full_name}",
            summary_text=f"Hom nay {student.full_name} da hoc tap rat cham chi.",
            teacher_note="Phu huynh can nhac nho con tap trung hon vao bai hoc toan.",
            recommendation="Khuyen khich con su dung hinh anh de ghi nho.",
            total_assignments=3,
            completed_count=random.randint(0, 3),
            in_progress_count=1,
            last_progress_percent=random.randint(50, 100),
            readiness_status="tiep_thu_tot"
        )
        db.session.add(report)

    db.session.commit()
    print("Full test scenario seeding completed!")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        seed_test_scenario()
