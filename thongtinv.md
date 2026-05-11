# Thiết Kế Giao Diện & Logic Tạo Bài Học - "Bạn Học Thông Minh"

## I. Phân Tích Cấu Trúc Dữ Liệu

### A. Tổng Quan
- **3 Mức độ khuyết tật**: Nặng, Trung bình, Nhẹ
- **Mỗi mức có 13 môn học** (giống nhau ở cả 3 mức)
- **Mỗi môn = 1 Bài học = 2 Hoạt động** (KHÔNG phải 2 bài học)

### B. Cấu Trúc 1 Bài Học

```
1 Bài Học (Lesson)
├── Thông tin cơ bản
│   ├── Tên bài: "Nhận biết nhân vật trong truyện cổ tích"
│   ├── Môn: Ngữ văn
│   ├── Mức độ: Nặng
│   ├── Chủ đề: Truyện cổ tích
│   └── Mô tả ngắn
│
├── Hoạt động 1: Bài Tập (Exercise - Kiến thức cơ bản)
│   ├── Tên: "Chạm đúng nhân vật"
│   ├── Loại: Interactive - Touch/Tap
│   ├── Nội dung:
│   │   ├── Bước 1: Màn hình hiện 2 hình ảnh
│   │   ├── Bước 2: Âm thanh đọc câu hỏi
│   │   └── Bước 3: Học sinh chạm đúng hình
│   ├── Mục tiêu: "Năng lực nhận diện hình ảnh"
│   └── Thường trực: Yes (học sinh thực hiện ngay)
│
└── Hoạt động 2: Hoạt Động (Activity - Rèn kỹ năng)
    ├── Tên: "Nghe truyện qua Tranh động"
    ├── Loại: Narrative - Animation
    ├── Nội dung:
    │   ├── Bước 1: App tự động lật trang truyện
    │   ├── Bước 2: Tranh chuyển động chậm với giọng đọc
    │   └── Bước 3: Học sinh theo dõi 3 phút
    ├── Mục tiêu: "Phẩm chất chăm chỉ, tập trung nghe"
    └── Thường trực: No (thực hiện sau bài tập)
```

---

## II. Thiết Kế Giao Diện Tạo Bài Học

### A. Màn Hình Chính: Tạo Bài Học (Create Lesson)

```
┌─────────────────────────────────────────┐
│ TẠO BÀI HỌC MỚI                    [X]   │
├─────────────────────────────────────────┤
│                                           │
│ 📋 THÔNG TIN BẰNG HỌC                   │
│ ┌─────────────────────────────────────┐ │
│ │ Chọn Mức Độ *                       │ │
│ │ ⭕ Nặng   ⭕ Trung bình   ⭕ Nhẹ    │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Chọn Môn Học * (căn cứ mức độ)     │ │
│ │ [Dropdown v] Ngữ văn               │ │
│ │ Gợi ý: 13 môn (Ngữ văn, Toán,...)│ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Tên Bài Học *                       │ │
│ │ [                                    ] │
│ │ VD: "Nhận biết nhân vật trong..."   │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Chủ Đề/Nội Dung *                  │ │
│ │ [                                    ] │
│ │ VD: "Truyện cổ tích, Kỹ năng tính"│ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Mô Tả Ngắn (Tùy chọn)               │ │
│ │ [Giúp học sinh hiểu bối cảnh       ] │
│ └─────────────────────────────────────┘ │
│                                           │
├─────────────────────────────────────────┤
│ [Tiếp Theo] [Hủy]                       │
└─────────────────────────────────────────┘
```

### B. Màn Hình Bước 2: Tạo Hoạt Động 1 (Bài Tập)

```
┌─────────────────────────────────────────┐
│ TẠO HOẠT ĐỘNG 1: BÀI TẬP              │
│ Môn: Ngữ văn | Mức: Nặng              │
├─────────────────────────────────────────┤
│                                           │
│ 📝 THÔNG TIN HOẠT ĐỘNG 1                │
│ ┌─────────────────────────────────────┐ │
│ │ Tên Hoạt Động * (Bài Tập)          │ │
│ │ [Chạm đúng nhân vật                ] │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Loại Tương Tác *                    │ │
│ │ ⭕ Touch/Tap    ⭕ Drag/Drop       │ │
│ │ ⭕ Voice Input  ⭕ Scroll         │ │
│ │ ⭕ Selection    ⭕ Drawing        │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Mục Tiêu * (Năng lực / Kỹ năng)     │ │
│ │ [Năng lực nhận diện hình ảnh       ] │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ 📋 BƯỚC THỰC HIỆN (Step-by-step)        │
│                                           │
│ BƯỚC 1: Hiển thị                        │
│ ┌─────────────────────────────────────┐ │
│ │ Loại nội dung *                     │ │
│ │ ⭕ Hình ảnh  ⭕ Văn bản  ⭕ Video  │ │
│ │                                     │ │
│ │ Chi tiết: [Màn hình hiện 2 ảnh..   ] │
│ └─────────────────────────────────────┘ │
│                                           │
│ BƯỚC 2: Âm thanh                        │
│ ┌─────────────────────────────────────┐ │
│ │ Loại âm thanh *                     │ │
│ │ ⭕ Text-to-Speech  ⭕ Upload file  │ │
│ │                                     │ │
│ │ Nội dung: [Ai là cô Tấm?          ] │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ BƯỚC 3: Tương Tác Học Sinh              │
│ ┌─────────────────────────────────────┐ │
│ │ Hành động mong muốn *               │ │
│ │ [Dropdown] Chạm vào hình đúng      │ │
│ │                                     │ │
│ │ Xác nhận đúng: Hình cô Tấm         │ │
│ │ Phản hồi thành công: Vỗ tay       │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ BƯỚC 4: Phản Hồi (Tùy chọn)             │
│ ┌─────────────────────────────────────┐ │
│ │ Khi đúng: [Vỗ tay, Sao, Âm thanh ] │ │
│ │ Khi sai:  [Âm báo lỗi, Gợi ý]     │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ✅ Thừ trực: ⭕ Yes  ⭕ No              │
│ (Học sinh làm ngay hay phải chờ?)      │
│                                           │
├─────────────────────────────────────────┤
│ [Tiếp Theo: Hoạt Động 2] [Quay Lại]    │
└─────────────────────────────────────────┘
```

### C. Màn Hình Bước 3: Tạo Hoạt Động 2 (Activity)

```
┌─────────────────────────────────────────┐
│ TẠO HOẠT ĐỘNG 2: HOẠT ĐỘNG              │
│ Môn: Ngữ văn | Mức: Nặng              │
├─────────────────────────────────────────┤
│                                           │
│ 📝 THÔNG TIN HOẠT ĐỘNG 2                │
│ ┌─────────────────────────────────────┐ │
│ │ Tên Hoạt Động * (Hoạt Động)        │ │
│ │ [Nghe truyện qua Tranh động       ] │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Loại Hoạt Động *                   │ │
│ │ ⭕ Narrative (Kể chuyện)            │ │
│ │ ⭕ Process (Quy trình)              │ │
│ │ ⭕ Exploration (Khám phá)           │ │
│ │ ⭕ Simulation (Mô phỏng)            │ │
│ │ ⭕ Game (Trò chơi)                  │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ Mục Tiêu * (Năng lực / Phẩm chất)   │ │
│ │ [Phẩm chất chăm chỉ, tập trung]    │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ 📋 BƯỚC THỰC HIỆN                       │
│                                           │
│ BƯỚC 1: Hành Động Tự Động              │
│ ┌─────────────────────────────────────┐ │
│ │ Mô tả: [App tự động lật trang..   ] │ │
│ │ Thời gian/Điều kiện: [Cứ 3 giây]  │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ BƯỚC 2: Nội Dung Chính                  │
│ ┌─────────────────────────────────────┐ │
│ │ Loại nội dung *                     │ │
│ │ ⭕ Animation  ⭕ Video  ⭕ Image   │ │
│ │                                     │ │
│ │ Mô tả chi tiết: [Tranh chuyển động] │ │
│ │ Thời lượng: [3 phút]                │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ BƯỚC 3: Âm Thanh Kèm Theo               │
│ ┌─────────────────────────────────────┐ │
│ │ Có giọng đọc: ⭕ Yes  ⭕ No         │ │
│ │ Loại: ⭕ TTS  ⭕ Upload file       │ │
│ │ Tốc độ đọc: [Normal] ⭕ Chậm       │ │
│ │ Cảm xúc: ⭕ Bình tĩnh  ⭕ Diễn cảm│ │
│ └─────────────────────────────────────┘ │
│                                           │
│ BƯỚC 4: Tương Tác Học Sinh (Tùy)       │
│ ┌─────────────────────────────────────┐ │
│ │ Cho phép học sinh: ⭕ Tương tác    │ │
│ │                   ⭕ Chỉ xem      │ │
│ │                                     │ │
│ │ Nếu tương tác, cho phép:            │ │
│ │ ☑ Tạm dừng  ☑ Phát lại  ☑ Tua nhanh│ │
│ └─────────────────────────────────────┘ │
│                                           │
│ ✅ Thừa trực: ⭕ No  ⭕ Yes              │
│ (Học sinh phải hoàn thành H1 trước)    │
│                                           │
├─────────────────────────────────────────┤
│ [Hoàn Thành & Lưu] [Quay Lại]           │
└─────────────────────────────────────────┘
```

---

## III. Logic & Workflow Tạo Bài Học

### A. Flow Tạo Bài Học (Teacher Perspective)

```
START
  ↓
[Nhấn: Tạo Bài Học Mới]
  ↓
BƯỚC 1: Chọn Cơ Bản
  ├─ Chọn Mức Độ (Nặng/Trung/Nhẹ)
  ├─ Chọn Môn (13 môn có sẵn)
  ├─ Nhập Tên Bài
  ├─ Nhập Chủ Đề
  └─ Lưu tạm = Lesson trong DB (status: draft)
    ↓
BƯỚC 2: Tạo Hoạt Động 1 (Bài Tập)
  ├─ Tên Hoạt Động
  ├─ Loại Tương Tác (Touch, Drag, Voice, ...)
  ├─ Nhập Bước Thực Hiện (UI Step builder)
  ├─ Nhập Mục Tiêu
  ├─ Chọn Thừ Trực = Yes
  └─ Lưu = LessonActivity #1 (activity_type: exercise)
    ↓
BƯỚC 3: Tạo Hoạt Động 2 (Activity)
  ├─ Tên Hoạt Động
  ├─ Loại (Narrative, Process, ...)
  ├─ Nhập Bước Thực Hiện
  ├─ Nhập Mục Tiêu
  ├─ Chọn Thừ Trực = No
  └─ Lưu = LessonActivity #2 (activity_type: activity)
    ↓
[Review Toàn Bộ Bài Học]
  ├─ Xem H1 + H2 đầy đủ
  ├─ Kiểm tra Thứ Tự (H1 → H2)
  └─ Kiểm tra Mục Tiêu Phù Hợp
    ↓
[Xuất Bản Bài Học]
  └─ status: published
    ↓
END
```

### B. Validation Rules (Quy Tắc Kiểm Tra)

```
✅ BƯỚC 1: THÔNG TIN CƠ BẢN
- Mức Độ: Bắt buộc chọn (1 trong 3)
- Môn Học: Bắt buộc (13 môn)
- Tên Bài: Bắt buộc, 10-100 ký tự
- Chủ Đề: Bắt buộc, 5-100 ký tự
- Mô Tả: Tùy chọn, max 500 ký tự

✅ BƯỚC 2 & 3: HOẠT ĐỘNG
- Tên: Bắt buộc, 5-80 ký tự
- Loại Tương Tác: Bắt buộc chọn
- Mục Tiêu: Bắt buộc, 5-100 ký tự
- Số Bước Tối Thiểu: Ít nhất 3 bước
- Thừ Trực: H1 = Yes, H2 = No (CỨNG)

✅ LOGIC HỌC SINH THỰC HIỆN
- H1 (Bài Tập) là bắt buộc → Unlock H2
- H2 (Hoạt Động) chỉ hiện khi H1 = Complete hoặc Skip
```

---

## IV. Cấu Trúc Database

### A. Bảng Lesson

```sql
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,        -- Môn học (1-13)
  difficulty_level VARCHAR(20) NOT NULL, -- 'nặng', 'trung_bình', 'nhẹ'
  title VARCHAR(255) NOT NULL,        -- Tên bài
  theme VARCHAR(255),                 -- Chủ đề/Nội dung
  description TEXT,                   -- Mô tả
  status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'published'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### B. Bảng LessonActivity

```sql
CREATE TABLE lesson_activities (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,        -- Tên hoạt động
  activity_type VARCHAR(50) NOT NULL, -- 'exercise' hoặc 'activity'
  interaction_type VARCHAR(50),       -- 'touch', 'drag', 'voice', ...
  order_number INTEGER NOT NULL,      -- 1 (H1) hoặc 2 (H2)
  is_primary BOOLEAN DEFAULT FALSE,   -- H1 = True, H2 = False
  objective VARCHAR(255) NOT NULL,    -- Mục tiêu
  steps JSON,                         -- [{step: 1, description: "..."}]
  is_mandatory BOOLEAN DEFAULT TRUE,  -- H1 luôn True
  allows_skip BOOLEAN DEFAULT FALSE,  -- H2 có thể skip
  created_at TIMESTAMP
);
```

### C. Dữ Liệu Steps (JSON Format)

```json
{
  "activity_id": 1,
  "steps": [
    {
      "step_number": 1,
      "title": "Hiển thị",
      "content_type": "image",
      "description": "Màn hình hiện 2 hình ảnh (cô Tấm và con chó)"
    },
    {
      "step_number": 2,
      "title": "Âm thanh",
      "content_type": "audio",
      "description": "Ai là cô Tấm?",
      "tts_voice": "female_vietnamese",
      "speech_rate": "normal"
    },
    {
      "step_number": 3,
      "title": "Tương tác",
      "content_type": "interaction",
      "interaction_type": "tap",
      "correct_answer": "image_2",
      "feedback_success": "Vỗ tay",
      "feedback_error": "Thử lại"
    }
  ]
}
```

---

## V. Giao Diện UI Builder Cho Steps

### A. UI Step Builder (Kéo Thả)

```
┌────────────────────────────────────────────┐
│ BỌ THỰC HIỆN (Kéo thả để sắp xếp)         │
├────────────────────────────────────────────┤
│                                             │
│ BƯỚC 1 ⬜ [════ Hiển thị ════]            │
│         ├─ Loại: [Hình ảnh ▼]             │
│         ├─ URL/Chi tiết: [..upload..]     │
│         └─ [Xóa]                          │
│                                             │
│ BƯỚC 2 ⬜ [════ Âm thanh ════]            │
│         ├─ Loại: [TTS ▼]                  │
│         ├─ Văn bản: [Ai là cô Tấm?]      │
│         ├─ Giọng: [Nữ, Việt ▼]           │
│         ├─ Tốc độ: [Normal ▼]            │
│         └─ [Xóa]                          │
│                                             │
│ BƯỚC 3 ⬜ [════ Tương tác ════]           │
│         ├─ Loại: [Tap ▼]                  │
│         ├─ Đáp án đúng: [Image 2]         │
│         ├─ Phản hồi OK: [Vỗ tay ▼]       │
│         ├─ Phản hồi Sai: [Âm báo ▼]      │
│         └─ [Xóa]                          │
│                                             │
│ [+ Thêm Bước] [─ Xóa Bước Cuối]           │
│                                             │
└────────────────────────────────────────────┘
```

---

## VI. Hạn Chế Cứng (Constraints)

```
1️⃣ MỖI BÀI HỌC = 2 HOẠT ĐỘNG CỨNG
   ✅ Không được có 1 hoạt động, 3 hoạt động hay nhiều hơn
   ✅ H1 luôn là "Bài Tập" (Exercise - có tương tác)
   ✅ H2 luôn là "Hoạt Động" (Activity - hỗ trợ kỹ năng)

2️⃣ THỨ TỰ HOẠT ĐỘNG CỨNG
   ✅ H1 (Bài Tập) → H2 (Hoạt Động)
   ✅ Học sinh PHẢI xong H1 mới unlock H2

3️⃣ CÁCH TẠỌ BẰNG UI WIZARD (3 Bước)
   ✅ Không để người dùng tạo tự do
   ✅ Bắt phải theo: Thông tin → H1 → H2 → Lưu

4️⃣ MỎN PHỤ CHỌN CỨNG
   ✅ Mức Độ: 1 trong 3
   ✅ Môn Học: 1 trong 13
   ✅ Không được tạo môn học mới

5️⃣ MỤC TIÊU BẮT BUỘC
   ✅ H1: "Năng lực ..." (Kiến thức cơ bản)
   ✅ H2: "Phẩm chất ... / Năng lực ..." (Rèn kỹ năng)
```

---

## VII. Validation Backend (API)

### A. Endpoint: POST /api/v1/lessons

```python
{
  "subject_id": 1,                    # Ngữ văn
  "difficulty_level": "nặng",
  "title": "Nhận biết nhân vật...",
  "theme": "Truyện cổ tích",
  "description": "...",
  
  "activities": [
    {
      # HOẠT ĐỘNG 1 (Exercise - Bắt buộc)
      "title": "Chạm đúng nhân vật",
      "activity_type": "exercise",
      "interaction_type": "tap",
      "order_number": 1,
      "is_primary": true,
      "objective": "Năng lực nhận diện hình ảnh",
      "steps": [
        {"step": 1, "type": "display", "content": "..."},
        {"step": 2, "type": "audio", "text": "Ai là cô Tấm?"},
        {"step": 3, "type": "interaction", "correct": "..."}
      ]
    },
    {
      # HOẠT ĐỘNG 2 (Activity - Bắt buộc)
      "title": "Nghe truyện qua Tranh động",
      "activity_type": "activity",
      "interaction_type": "passive",
      "order_number": 2,
      "is_primary": false,
      "objective": "Phẩm chất chăm chỉ",
      "steps": [...]
    }
  ]
}

# Validation:
✅ PHẢI có đúng 2 activities
✅ Activity 1: activity_type = "exercise", order_number = 1
✅ Activity 2: activity_type = "activity", order_number = 2
✅ Mỗi activity PHẢI có ít nhất 3 steps
✅ Mỗi activity PHẢI có objective
```

---

## VIII. Lợi Ích Của Thiết Kế Này

### ✅ Cho Giáo Viên
- Wizard 3 bước rõ ràng, không nhầm lẫn
- Bắt buộc tuân thủ cấu trúc khoa học
- Tự động validate, giảm lỗi

### ✅ Cho Học Sinh
- Luôn có cấu trúc học tập rõ ràng: Kiến thức → Rèn luyện
- 2 hoạt động đủ để học không quá tải
- Thứ tự logic: Nền tảng trước, thực hành sau

### ✅ Cho Hệ Thống
- Dữ liệu nhất quán (không có ngoại lệ)
- Dễ phân tích, report tiến độ
- Dễ scale: Thêm môn → Tự động tạo 2 template hoạt động

---

## IX. Ghi Chú Thêm

### A. Naming Convention Mục Tiêu
```
H1 (Bài Tập - Kiến thức cơ bản):
- "Năng lực nhận diện ..."
- "Năng lực tính toán ..."
- "Kỹ năng ngôn ngữ ..."

H2 (Hoạt Động - Phát triển):
- "Phẩm chất chăm chỉ ..."
- "Năng lực tư duy ..."
- "Kỹ năng giao tiếp ..."
- "Vận động định hướng ..."
```

### B. Tips Cho Giáo Viên Khi Tạo
1. **H1 luôn có tương tác trực tiếp** từ học sinh
2. **H2 hỗ trợ kỹ năng sau khi H1** (kiến thức → rèn luyện)
3. **Mục tiêu H1 ≠ Mục tiêu H2** (tránh trùng lặp)
4. **Steps phải rõ ràng từng bước** (dễ lập trình)
5. **Âm thanh H1 nên ngắn & rõ** (1 câu hỏi)
6. **H2 có thể dài hơn** (3-5 phút)

