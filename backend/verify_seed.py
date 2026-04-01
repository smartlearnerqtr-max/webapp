from app import create_app
from app.extensions import db
from app.models import Subject
import os

# Force a relative path that works for SQLite on Windows
os.environ['DATABASE_URL'] = 'sqlite:///instance/dev.db'

app = create_app()
print(f"FORCED DATABASE_URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
with app.app_context():
    print("Creating tables (if missing)...")
    db.create_all()
    print("Checking subjects...")
    try:
        count = Subject.query.count()
        print(f"Subject count: {count}")
    except Exception as e:
        print(f"Error: {e}")
