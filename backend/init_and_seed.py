from app import create_app
from app.extensions import db
from app.services.seed_service import seed_subjects, seed_admin_user

app = create_app()
with app.app_context():
    print("Creating tables...")
    db.create_all()
    print("Tables created.")
    subjects_created = seed_subjects()
    print(f"Subjects created: {subjects_created}")
    admin = seed_admin_user()
    print(f"Admin created: {admin.email}")
