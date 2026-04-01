from app import create_app
print("Importing create_app...")
app = create_app()
print("App created.")
with app.app_context():
    print("In app context.")
