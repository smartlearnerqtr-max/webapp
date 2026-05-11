import os

file_path = r'd:\CONG_VIIEC\webapp\frontend\src\pages\TeacherHomePage.tsx'
with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Line 330 and 368 (0-indexed 329 and 367)
    if i in [329, 367]:
        # Replace the corrupted character (often shown as \ufffd in Python when errors='replace')
        # with a standard bullet point
        fixed_line = line.replace('\ufffd', '•')
        new_lines.append(fixed_line)
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed TeacherHomePage.tsx")
