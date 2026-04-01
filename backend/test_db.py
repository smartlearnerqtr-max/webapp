from app import create_app
from app.extensions import db
from app.models import Subject

app = create_app()
with app.app_context():
    print("Checking subjects...")
    count = Subject.query.count()
    print(f"Subject count: {count}")
