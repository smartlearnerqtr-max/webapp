from app import create_app
from app.extensions import db
import os

app = create_app()
app.config['SQLALCHEMY_ECHO'] = True
with app.app_context():
    print("Creating tables with ECHO...")
    db.create_all()
    print("Tables created.")
