import os

def check_file_for_real_corruption(file_path):
    # Search for common mojibake patterns
    # Ã¡ (á), Ã© (é), Ã­ (í), Ã³ (ó), Ãº (ú), Ã½ (ý)
    # Ã (à), Ã¨ (è), Ã¬ (ì), Ã² (ò), Ã¹ (ù)
    # Ã¢ (â), Ãª (ê), Ã´ (ô)
    # ... and many others
    
    # These are usually sequences of 2 or more high-bit characters that look like valid UTF-8 but are actually Latin-1
    pattern = re.compile(r'[\xc2-\xc3][\x80-\xbf]')
    
    if not os.path.exists(file_path):
        return

    print(f"--- Checking {file_path} ---")
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
            # Try to find sequences that look like mojibake
            # Actually, most mojibake is valid UTF-8 but represents the wrong characters.
            # Example: "Đã" encoded as UTF-8 is \xc4\x90\u00e3
            # If interpreted as Latin-1 and then re-encoded to UTF-8, it becomes something else.
            
            # Let's just search for the specific markers the user reported before
            markers = [b'\xc3\x83', b'\xc3\x84', b'\xc3\xa2\xe2\x82\xac', b'\xc3\xa1\xba']
            for m in markers:
                if m in content:
                    print(f"Found potential mojibake marker {m} in {file_path}")
    except Exception as e:
        print(f"Error: {e}")

import re
files = [
    'frontend/src/pages/TeacherHomePage.tsx',
    'frontend/src/pages/StudentHomePage.tsx',
    'frontend/src/pages/studentHomeDeferredContent.ts',
    'frontend/src/pages/ParentPage.tsx',
    'frontend/src/pages/LessonsPage.tsx',
    'frontend/src/pages/ClassesPage.tsx',
    'frontend/src/data/lessonTemplates.ts',
]

for f in files:
    check_file_for_real_corruption(os.path.join('d:/CONG_VIIEC/webapp', f))
