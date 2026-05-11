import sqlite3
import os

db_path = 'instance/dev.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]

corruption_markers = ['Ã', 'Ä', 'â€', 'áº', 'á»', 'áº¹', 'Ã¡', 'Ã©', 'Ã\xad', 'Ã³', 'Ãº', 'Ã½', 'Ã\xa0', 'Ã¨', 'Ã¬', 'Ã²', 'Ã¹', 'Ã¹', 'Ãµ', 'Ã¢']

print("Starting deep encoding audit...")
total_corrupted_rows = 0

for table in tables:
    try:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        
        for column in columns:
            cursor.execute(f"SELECT id, {column} FROM {table}")
            rows = cursor.fetchall()
            for row_id, content in rows:
                if isinstance(content, str):
                    if any(marker in content for marker in corruption_markers):
                        print(f"CORRUPTION in {table} (ID: {row_id}, Col: {column}): {content[:100]}")
                        total_corrupted_rows += 1
    except Exception as e:
        # Some tables might not have 'id' column or other issues, just skip
        pass

conn.close()
print(f"Deep audit complete. Total corrupted rows found: {total_corrupted_rows}")
