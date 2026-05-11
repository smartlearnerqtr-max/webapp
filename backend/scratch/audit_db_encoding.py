import sqlite3
import os

db_path = 'instance/dev.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = [
    ('lessons', 'title'),
    ('subjects', 'name'),
    ('teacher_profiles', 'full_name'),
    ('student_profiles', 'full_name'),
    ('parent_profiles', 'full_name'),
    ('lesson_activities', 'title'),
    ('lesson_activities', 'instruction_text'),
]

corruption_markers = ['Ã', 'Ä', 'â€', 'áº', 'á»', 'áº¹']

print("Starting encoding audit...")
for table, column in tables:
    try:
        cursor.execute(f"SELECT id, {column} FROM {table}")
        rows = cursor.fetchall()
        for row_id, content in rows:
            if content and any(marker in content for marker in corruption_markers):
                print(f"CORRUPTION FOUND in {table} (ID: {row_id}, Column: {column}): {content}")
    except sqlite3.OperationalError as e:
        print(f"Skipping {table}.{column}: {e}")

conn.close()
print("Audit complete.")
