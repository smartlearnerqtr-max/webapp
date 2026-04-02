import os
os.environ['DATABASE_URL'] = 'sqlite:///instance/dev.db'

from app import create_app
from app.extensions import db
from app.models import * # Import everything to register with metadata
import random
from datetime import datetime, timedelta

def force_seed():
    app = create_app()
    with app.app_context():
        print("Creating all tables...")
        db.create_all()
        print(f"Tables in metadata: {list(db.metadata.tables.keys())}")
        
        # 1. Subjects
        from app.services.seed_service import seed_subjects, seed_admin_user
        print("Seeding subjects...")
        seed_subjects()
        seed_admin_user()
        
        subjects = Subject.query.all()
        print(f"Subjects count: {len(subjects)}")
        
        # 2. Teachers
        teachers_data = [
            {"email": "co_lan@example.com", "name": "Cô Lan", "school": "Trường Tiểu Học A"},
            {"email": "co_mai@example.com", "name": "Cô Mai", "school": "Trường Tiểu Học B"}
        ]
        teachers = []
        for data in teachers_data:
            user = User.query.filter_by(email=data["email"]).first() or User(
                email=data["email"], password_hash="pbkdf2:sha256:600000$...", role="teacher"
            )
            if not user.id: db.session.add(user); db.session.flush()
            profile = TeacherProfile.query.filter_by(user_id=user.id).first() or TeacherProfile(
                user_id=user.id, full_name=data["name"], school_name=data["school"]
            )
            if not profile.id: db.session.add(profile)
            teachers.append(profile)
        db.session.commit()
        
        # 3. Students & Parents (10 each)
        for t_idx, teacher in enumerate(teachers):
            classroom = Classroom(teacher_id=teacher.id, name=f"Lớp cô {teacher.full_name}", grade_label="1")
            db.session.add(classroom); db.session.flush()
            for sub in subjects:
                db.session.add(ClassSubject(class_id=classroom.id, subject_id=sub.id, is_active=True))
            
            for i in range(1, 11):
                s_name = f"Học sinh {i} ({teacher.full_name})"
                student = StudentProfile(full_name=s_name, disability_level="nhe", created_by_teacher_id=teacher.id)
                db.session.add(student); db.session.flush()
                db.session.add(ClassStudent(class_id=classroom.id, student_id=student.id))
                
                p_email = f"phu_huynh_{t_idx}_{i}@example.com"
                p_user = User(email=p_email, password_hash="...", role="parent")
                db.session.add(p_user); db.session.flush()
                p_profile = ParentProfile(user_id=p_user.id, full_name=f"Phụ huynh {s_name}")
                db.session.add(p_profile); db.session.flush()
                db.session.add(ParentStudentLink(parent_id=p_profile.id, student_id=student.id, linked_by_teacher_id=teacher.id))
        
        db.session.commit()
        print("Seeding complete!")

if __name__ == "__main__":
    force_seed()
