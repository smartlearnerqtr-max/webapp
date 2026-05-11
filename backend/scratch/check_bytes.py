file_path = r'd:\CONG_VIIEC\webapp\frontend\src\pages\TeacherHomePage.tsx'
with open(file_path, 'rb') as f:
    lines = f.readlines()

line = lines[329]
print(f"Line 330 bytes: {line}")
# Find non-ascii bytes
non_ascii = [(i, b) for i, b in enumerate(line) if b > 127]
print(f"Non-ascii bytes: {non_ascii}")
