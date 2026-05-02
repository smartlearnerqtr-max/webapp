type ActivityType =
  | 'multiple_choice'
  | 'image_choice'
  | 'image_puzzle'
  | 'matching'
  | 'drag_drop'
  | 'listen_choose'
  | 'watch_answer'
  | 'hidden_image_guess'
  | 'step_by_step'
  | 'aac'
  | 'memory_match'
  | 'quick_tap'
  | 'size_order'
  | 'habitat_match'
  | 'career_simulation'
  | 'ai_chat'

export type LessonTemplateLevel = 'nhe' | 'trung_binh' | 'nang'

type ActivityConfig = Record<string, unknown>

type TeacherLessonTemplateActivity = {
  title: string
  activityType: ActivityType
  instructionText: string
  voiceAnswerEnabled?: boolean
  config: ActivityConfig
}

export type TeacherLessonTemplate = {
  id: string
  subjectName: string
  lessonTitle: string
  topicSummary: string
  description: string
  estimatedMinutes: number
  notes?: string
  activities: TeacherLessonTemplateActivity[]
}

const LIGHT_LEVEL_LESSON_TEMPLATES: TeacherLessonTemplate[] = [
  {
    id: 'nhe-ngu-van',
    subjectName: 'Ngữ văn',
    lessonTitle: 'Mức nhẹ - Truyện ngụ ngôn và tục ngữ',
    topicSummary: 'Truyện ngụ ngôn, tục ngữ',
    description: 'Bám đúng bosung.md: sơ đồ tư duy điền khuyết và kể chuyện qua Voice-to-Text.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Sơ đồ tư duy điền khuyết',
        activityType: 'watch_answer',
        instructionText: 'Hiện sơ đồ cốt truyện. Kéo thả các ảnh hoặc từ khóa sự việc vào đúng nhánh trống.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=ngu-van-mindmap',
          media_kind: 'embed',
          prompt: 'Bài tập này giúp em kéo thả các ý chính vào sơ đồ cốt truyện.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Kể chuyện qua Voice-to-Text',
        activityType: 'watch_answer',
        instructionText: 'App hiện câu hỏi mồi “Bài học rút ra là gì?”. Em bấm micro trả lời để app chuyển thành văn bản.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'watch_answer',
          prompt: 'Bài học rút ra là gì?',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'Kiên trì sẽ thành công.',
          accepted_answers: ['Kiên trì sẽ thành công', 'Cần kiên trì', 'Không nên bỏ cuộc', 'Cố gắng thì sẽ thành công'],
        },
      },
    ],
  },
  {
    id: 'nhe-toan',
    subjectName: 'Toán học',
    lessonTitle: 'Mức nhẹ - Số hữu tỉ, tỉ lệ và lăng trụ đứng',
    topicSummary: 'Số hữu tỉ, tỉ lệ thuận nghịch, lăng trụ đứng',
    description: 'Bám đúng bosung.md: bài toán step-by-step và tương tác 3D hình khối.',
    estimatedMinutes: 20,
    activities: [
      {
        title: 'Bài toán Step-by-step',
        activityType: 'watch_answer',
        instructionText: 'Hiện đề bài có tô màu từ khóa. App gợi ý phép tính để em chọn và điền số.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=toan-step',
          media_kind: 'embed',
          prompt: 'Đây là mô-đun step-by-step để giảm tải tư duy trừu tượng cho bài toán.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Tương tác 3D hình khối',
        activityType: 'watch_answer',
        instructionText: 'Hiện khối lăng trụ 3D. Dùng tay xoay khối rồi chạm vào đỉnh hoặc cạnh để app tự đếm.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=toan-prism',
          media_kind: 'embed',
          prompt: 'Xoay khối lăng trụ rồi chạm vào đỉnh hoặc cạnh để app tự đếm số lượng.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-tieng-anh',
    subjectName: 'Tiếng Anh',
    lessonTitle: 'Mức nhẹ - Sức khỏe, giao thông, lễ hội',
    topicSummary: 'Sức khỏe, giao thông, lễ hội',
    description: 'Bám đúng bosung.md: Listen & Choose với từ Festival và đóng vai hội thoại bằng micro.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Listen & Choose - Festival',
        activityType: 'listen_choose',
        instructionText: 'App đọc từ “Festival”. Hiện 3 hình ảnh và em chọn đúng hình Lễ hội.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'listen_choose',
          audio_text: 'Festival',
          audio_lang: 'en-US',
          prompt: 'Nghe từ Festival rồi vuốt sang để tìm đúng hình Lễ hội.',
          image_selection_mode: 'carousel_find',
          image_cards: [
            { id: 'festival-card', label: 'Lễ hội', media_url: '/lesson-media/nhe/light-lab.html?activity=festival-card', media_kind: 'embed' },
            { id: 'hospital-card', label: 'Bệnh viện', media_url: '/lesson-media/nhe/light-lab.html?activity=hospital-card', media_kind: 'embed' },
            { id: 'traffic-card', label: 'Giao thông', media_url: '/lesson-media/nhe/light-lab.html?activity=traffic-card', media_kind: 'embed' },
          ],
          choices: ['festival-card', 'hospital-card', 'traffic-card'],
          correct: 'festival-card',
        },
      },
      {
        title: 'Đóng vai hội thoại (Role-play AI)',
        activityType: 'watch_answer',
        instructionText: 'AI hỏi “How are you?”. Em bấm micro trả lời để AI nhận diện và chấm sao.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'watch_answer',
          prompt: 'How are you?',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'I am fine.',
          accepted_answers: ['I am fine', "I'm fine", 'I am good', "I'm good", 'Fine thank you'],
        },
      },
    ],
  },
  {
    id: 'nhe-khtn',
    subjectName: 'Khoa học tự nhiên',
    lessonTitle: 'Mức nhẹ - Nguyên tử, ánh sáng và từ tính',
    topicSummary: 'Nguyên tử, ánh sáng, từ tính',
    description: 'Bám đúng bosung.md: thực nghiệm ảo với nam châm và sắp xếp vòng nguyên tử.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Thực nghiệm ảo (Kéo thả)',
        activityType: 'watch_answer',
        instructionText: 'Hiện thanh Nam châm cùng đinh sắt và cục gỗ. Kéo Nam châm lại gần để quan sát vật nào bị hút.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=khtn-magnet',
          media_kind: 'embed',
          prompt: 'Thực nghiệm ảo với nam châm giúp em hiểu tính chất vật lý trực quan.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Sắp xếp vòng nguyên tử',
        activityType: 'watch_answer',
        instructionText: 'Hiện hạt nhân ở giữa. Kéo các hạt electron vào đúng quỹ đạo.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=khtn-atom',
          media_kind: 'embed',
          prompt: 'Kéo electron vào quỹ đạo để cụ thể hóa khái niệm nguyên tử.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-lsdl',
    subjectName: 'Lịch sử - Địa lý',
    lessonTitle: 'Mức nhẹ - Các châu lục, phát kiến địa lí, Châu Mỹ',
    topicSummary: 'Các châu lục, phát kiến địa lí, Châu Mỹ',
    description: 'Bám đúng bosung.md: định vị bản đồ trên quả địa cầu và dòng thời gian thám hiểm.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Định vị bản đồ',
        activityType: 'watch_answer',
        instructionText: 'Hiện quả địa cầu có thể xoay. Âm thanh hỏi “Châu Mỹ ở đâu?”, em chạm vào đúng vùng đất đó.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=lsdl-globe',
          media_kind: 'embed',
          prompt: 'Định vị Châu Mỹ trên quả địa cầu trực quan.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Dòng thời gian (Timeline)',
        activityType: 'watch_answer',
        instructionText: 'Hiện mốc thời gian trống. Kéo thả hình ảnh tàu thuyền thám hiểm vào đúng mốc.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=lsdl-timeline',
          media_kind: 'embed',
          prompt: 'Kéo thả tàu thuyền vào đúng mốc để hiểu tiến trình lịch sử.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-cong-nghe',
    subjectName: 'Công nghệ',
    lessonTitle: 'Mức nhẹ - Quy trình trồng trọt và vật nuôi',
    topicSummary: 'Quy trình trồng trọt, vật nuôi',
    description: 'Bám đúng bosung.md: sắp xếp quy trình trồng trọt và phân loại gia súc, gia cầm.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Sắp xếp quy trình',
        activityType: 'watch_answer',
        instructionText: 'Hiện 3 ô trống. Kéo thả tranh theo thứ tự: Làm đất → Gieo hạt → Thu hoạch.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=congnghe-steps',
          media_kind: 'embed',
          prompt: 'Sắp xếp quy trình trồng trọt theo đúng thứ tự.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Phân loại nông cụ/vật nuôi',
        activityType: 'watch_answer',
        instructionText: 'Kéo con Bò, Heo vào ô “Gia súc”; Gà, Vịt vào ô “Gia cầm”.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=congnghe-animals',
          media_kind: 'embed',
          prompt: 'Phân loại vật nuôi theo đúng nhóm công nghệ nông nghiệp.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-gdcd',
    subjectName: 'Giáo dục công dân',
    lessonTitle: 'Mức nhẹ - Tự hào truyền thống và bạo lực học đường',
    topicSummary: 'Tự hào truyền thống, bạo lực học đường',
    description: 'Bám đúng bosung.md: video tình huống A/B và quản lý tài chính ảo.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Video tình huống (A/B)',
        activityType: 'multiple_choice',
        instructionText: 'Xem clip 5 giây bạn bị bắt nạt rồi chọn nút A hoặc B.',
        config: {
          kind: 'multiple_choice',
          media_url: '/lesson-media/nhe/light-lab.html?activity=gdcd-bullying',
          media_kind: 'embed',
          prompt: 'Sau khi xem clip, em chọn A. Báo cô giáo hay B. Đứng xem?',
          choices: ['A. Báo cô giáo', 'B. Đứng xem'],
          correct: 'A. Báo cô giáo',
        },
      },
      {
        title: 'Quản lý tài chính ảo',
        activityType: 'watch_answer',
        instructionText: 'Ngân có 20 xu. Kéo phân bổ tiền vào “Lọ tiết kiệm” và “Mua sắm”.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=gdcd-budget',
          media_kind: 'embed',
          prompt: 'Phân bổ tiền vào hai mục để rèn năng lực quản lý bản thân.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-tin-hoc',
    subjectName: 'Tin học',
    lessonTitle: 'Mức nhẹ - Phần mềm bảng tính và trình chiếu',
    topicSummary: 'Excel, PowerPoint',
    description: 'Bám đúng bosung.md: mô phỏng Excel và tạo slide nhanh bằng template.',
    estimatedMinutes: 20,
    activities: [
      {
        title: 'Mô phỏng Excel',
        activityType: 'watch_answer',
        instructionText: 'Hiện bảng tính đơn giản. Kéo thả hàm SUM vào cột tổng tiền để tính tự động.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=tinhoc-excel',
          media_kind: 'embed',
          prompt: 'Mô phỏng việc kéo hàm SUM vào cột tổng tiền.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Tạo Slide nhanh (Templates)',
        activityType: 'watch_answer',
        instructionText: 'Chọn một khung slide có sẵn. Kéo ảnh cá nhân và nhập tiêu đề.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=tinhoc-slide',
          media_kind: 'embed',
          prompt: 'Tạo một slide nhanh theo template để rèn kỹ năng sản phẩm số.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-gdtc',
    subjectName: 'Giáo dục thể chất',
    lessonTitle: 'Mức nhẹ - Thể dục nhịp điệu và chạy cự li ngắn',
    topicSummary: 'Thể dục nhịp điệu, chạy cự li ngắn',
    description: 'Bám đúng bosung.md: chọn tư thế chạy đúng và AR Camera tập theo nhạc.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Chọn tư thế đúng',
        activityType: 'multiple_choice',
        instructionText: 'Hiện 2 hình ảnh chạy đúng và sai tư thế. Em tick chọn hình đúng.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Hình nào là tư thế chạy đúng?',
          image_selection_mode: 'carousel_find',
          image_cards: [
            { id: 'run-correct-card', label: 'Chạy đúng tư thế', media_url: '/lesson-media/nhe/light-lab.html?activity=run-correct-card', media_kind: 'embed' },
            { id: 'run-wrong-card', label: 'Chạy sai tư thế', media_url: '/lesson-media/nhe/light-lab.html?activity=run-wrong-card', media_kind: 'embed' },
          ],
          choices: ['run-correct-card', 'run-wrong-card'],
          correct: 'run-correct-card',
        },
      },
      {
        title: 'AR Camera - Tập theo nhạc',
        activityType: 'watch_answer',
        instructionText: 'Bật camera trước, màn hình hiện vòng tròn ảo. Em vung tay đập vỡ vòng tròn theo nhịp điệu.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=gdtc-ar',
          media_kind: 'embed',
          prompt: 'Đập vỡ các vòng tròn ảo để phát triển vận động thô.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-am-nhac',
    subjectName: 'Âm nhạc',
    lessonTitle: 'Mức nhẹ - Nhịp điệu và nhạc cụ dân tộc',
    topicSummary: 'Nhịp điệu, nhạc cụ dân tộc',
    description: 'Bám đúng bosung.md: nghe đoán nhạc cụ và đệm hát bằng nốt sáng chạy xuống.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Nghe và đoán nhạc cụ',
        activityType: 'listen_choose',
        instructionText: 'Phát âm thanh tiếng sáo hoặc đàn bầu. Em chọn đúng hình nhạc cụ.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'listen_choose',
          audio_text: 'Tiếng sáo trúc',
          audio_url: '/lesson-media/nhe/audio/flute.ogg',
          prompt: 'Nghe âm thanh rồi tìm đúng nhạc cụ.',
          image_selection_mode: 'carousel_find',
          image_cards: [
            { id: 'sao-card', label: 'Sáo trúc', media_url: '/lesson-media/nhe/light-lab.html?activity=sao-card', media_kind: 'embed' },
            { id: 'dan-bau-card', label: 'Đàn bầu', media_url: '/lesson-media/nhe/light-lab.html?activity=dan-bau-card', media_kind: 'embed' },
          ],
          choices: ['sao-card', 'dan-bau-card'],
          correct: 'sao-card',
        },
      },
      {
        title: 'Đệm hát (Virtual Drum/Piano)',
        activityType: 'watch_answer',
        instructionText: 'Nhạc phát, các nốt sáng chạy xuống. Chạm ngón tay đúng lúc nốt chạm đích để gõ phách.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=amnhac-rhythm',
          media_kind: 'embed',
          prompt: 'Chạm đúng lúc nốt nhạc chạm xuống để đệm hát theo nhịp.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-my-thuat',
    subjectName: 'Mỹ thuật',
    lessonTitle: 'Mức nhẹ - Màu sắc, bố cục và tạo hình 3D',
    topicSummary: 'Màu sắc, bố cục, tạo hình 3D',
    description: 'Bám đúng bosung.md: tô mảng màu và thiết kế thiệp điện tử bằng sticker.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Tô mảng màu (Fill Color)',
        activityType: 'watch_answer',
        instructionText: 'Hiện tranh nét viền dày. Chọn màu trên bảng palette và chạm để đổ màu kín.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=mythuat-fill',
          media_kind: 'embed',
          prompt: 'Chọn màu phù hợp rồi chạm để tô kín hình.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Thiết kế thiệp điện tử',
        activityType: 'watch_answer',
        instructionText: 'Cung cấp kho hình nền và sticker. Kéo thả dán sticker để trang trí bố cục thiệp.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=mythuat-card',
          media_kind: 'embed',
          prompt: 'Thiết kế thiệp điện tử bằng cách thêm sticker vào bố cục.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nhe-gd-dia-phuong',
    subjectName: 'Giáo dục địa phương',
    lessonTitle: 'Mức nhẹ - Đặc sản và kiến trúc Đồng Nai',
    topicSummary: 'Đặc sản và kiến trúc Đồng Nai',
    description: 'Bám đúng bosung.md: flashcard lật mở về Văn miếu Trấn Biên và Gốm Biên Hòa, kèm video tương tác.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Flashcard lật mở',
        activityType: 'watch_answer',
        instructionText: 'Hiện hình Văn miếu Trấn Biên và Gốm Biên Hòa. Chạm để lật xem thông tin ngắn gọn.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=dia-phuong-flashcard',
          media_kind: 'embed',
          prompt: 'Lật thẻ để xem thông tin ngắn gọn về địa danh Đồng Nai.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Video tương tác',
        activityType: 'watch_answer',
        instructionText: 'Xem clip 10 giây. App tự động dừng lại và hỏi: “Đây là gì?”. Em bấm thu âm để trả lời.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nhe/light-lab.html?activity=dia-phuong-video',
          media_kind: 'embed',
          prompt: 'Đây là gì?',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'Văn miếu Trấn Biên',
          accepted_answers: ['Văn miếu Trấn Biên', 'Đây là Văn miếu Trấn Biên', 'Van mieu Tran Bien'],
        },
      },
    ],
  },
]

const MEDIUM_LEVEL_LESSON_TEMPLATES: TeacherLessonTemplate[] = [
  {
    id: 'tb-ngu-van',
    subjectName: 'Ngữ văn',
    lessonTitle: 'Mức trung bình - Truyện ngụ ngôn và tục ngữ',
    topicSummary: 'Truyện ngụ ngôn, tục ngữ',
    description: 'Bài bám file bosung: nhận biết nhân vật bằng hình ảnh và hoàn thành sơ đồ tư duy cốt truyện.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Trắc nghiệm hình ảnh Ếch và Rùa',
        activityType: 'multiple_choice',
        instructionText: 'Nghe câu hỏi rồi chọn đúng nhân vật đang ở đáy giếng.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Ai ngồi đáy giếng?',
          audio_text: 'Ai ngồi đáy giếng?',
          image_selection_mode: 'carousel_find',
          choices: ['frog-card', 'turtle-card'],
          correct: 'frog-card',
          image_cards: [
            { id: 'frog-card', label: 'Ếch', media_url: '/lesson-media/trung-binh/frog-card.svg', media_kind: 'image' },
            { id: 'turtle-card', label: 'Rùa', media_url: '/lesson-media/trung-binh/turtle-card.svg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'Sơ đồ tư duy cốt truyện',
        activityType: 'watch_answer',
        instructionText: 'Kéo thả các sự việc vào đúng ô trống của sơ đồ cốt truyện.',
        config: {
          kind: 'watch_answer',
          prompt: 'Điền đủ sơ đồ tư duy của truyện theo đúng thứ tự.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=ngu-van-mindmap',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-toan',
    subjectName: 'Toán học',
    lessonTitle: 'Mức trung bình - Hình khối và tỉ lệ đơn giản',
    topicSummary: 'Số hữu tỉ, hình lăng trụ đứng, hình chóp',
    description: 'Bài bám file bosung: phân loại vật thể theo hình khối và mô phỏng mua bán bằng xu.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Phân loại hình khối',
        activityType: 'watch_answer',
        instructionText: 'Kéo từng đồ vật vào đúng nhóm hình chóp hoặc lăng trụ đứng.',
        config: {
          kind: 'watch_answer',
          prompt: 'Kéo đồ vật vào nhóm hình học tương ứng.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=toan-shape-sort',
          media_kind: 'embed',
        },
      },
      {
        title: 'Mô phỏng mua bán',
        activityType: 'watch_answer',
        instructionText: 'Đưa đủ 4 xu vào máy tính tiền cho 2 cái kẹo.',
        config: {
          kind: 'watch_answer',
          prompt: '1 cái kẹo giá 2 xu. 2 cái giá mấy xu?',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=toan-coins',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-tieng-anh',
    subjectName: 'Tiếng Anh',
    lessonTitle: 'Mức trung bình - Giao thông, lễ hội, sức khỏe',
    topicSummary: 'Giao thông, lễ hội, sức khỏe',
    description: 'Bài bám file bosung: nghe chọn từ vựng giao thông và luyện flashcard lật mở về lễ hội.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Nghe và chọn - Bus',
        activityType: 'listen_choose',
        instructionText: 'Nghe từ Bus rồi chọn đúng hình xe buýt.',
        config: {
          kind: 'listen_choose',
          audio_text: 'Bus',
          prompt: 'Nghe và chọn đúng hình của từ Bus.',
          image_selection_mode: 'carousel_find',
          choices: ['bus-card', 'bicycle-card'],
          correct: 'bus-card',
          image_cards: [
            { id: 'bus-card', label: 'Xe buýt', media_url: '/lesson-media/trung-binh/bus-card.svg', media_kind: 'image' },
            { id: 'bicycle-card', label: 'Xe đạp', media_url: '/lesson-media/trung-binh/bicycle-card.svg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'Flashcard lễ hội',
        activityType: 'watch_answer',
        instructionText: 'Chạm vào thẻ để lật mở ảnh lễ hội và nghe lại từ vựng.',
        config: {
          kind: 'watch_answer',
          prompt: 'Chạm vào thẻ Festival để xem hình lễ hội và ghi nhớ từ mới.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=tieng-anh-festival',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-khtn',
    subjectName: 'Khoa học tự nhiên',
    lessonTitle: 'Mức trung bình - Nam châm, ánh sáng, nguyên tử',
    topicSummary: 'Nam châm, ánh sáng, cấu tạo nguyên tử',
    description: 'Bài bám file bosung: đúng/sai với tính chất nam châm và thí nghiệm ảo kéo nam châm lại gần vật.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Chọn đúng sai nam châm',
        activityType: 'multiple_choice',
        instructionText: 'Xem hình rồi chọn đúng hay sai cho hiện tượng nam châm hút gỗ.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Nam châm hút gỗ. Đúng hay sai?',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=khtn-magnet',
          media_kind: 'embed',
          choices: ['Sai', 'Đúng', 'Cả hai', 'Không biết'],
          correct: 'Sai',
        },
      },
      {
        title: 'Thí nghiệm ảo nam châm',
        activityType: 'watch_answer',
        instructionText: 'Kéo nam châm lại gần đinh sắt để quan sát hiện tượng hút.',
        config: {
          kind: 'watch_answer',
          prompt: 'Làm thí nghiệm ảo rồi bấm xác nhận khi em quan sát xong.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=khtn-magnet',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-lsdl',
    subjectName: 'Lịch sử - Địa lý',
    lessonTitle: 'Mức trung bình - Châu lục và phát kiến địa lí',
    topicSummary: 'Các châu lục, phát kiến địa lí',
    description: 'Bài bám file bosung: chỉ điểm Châu Mỹ trên địa cầu và nối lộ trình thám hiểm từ châu Âu sang châu Á.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Chỉ điểm bản đồ',
        activityType: 'watch_answer',
        instructionText: 'Chạm vào vùng sáng trên quả địa cầu để tìm Châu Mỹ.',
        config: {
          kind: 'watch_answer',
          prompt: 'Tìm Châu Mỹ trên quả địa cầu 3D mô phỏng.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=lsdl-globe',
          media_kind: 'embed',
        },
      },
      {
        title: 'Dấu chân thám hiểm',
        activityType: 'watch_answer',
        instructionText: 'Bấm để nối đường đi từ châu Âu sang châu Á cho con thuyền chạy.',
        config: {
          kind: 'watch_answer',
          prompt: 'Nối đường từ châu Âu sang châu Á.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=lsdl-route',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-cong-nghe',
    subjectName: 'Công nghệ',
    lessonTitle: 'Mức trung bình - Cây trồng, vật nuôi, nông cụ',
    topicSummary: 'Cây trồng, vật nuôi, dụng cụ nông nghiệp',
    description: 'Bài bám file bosung: nhận biết nông cụ và sắp xếp đúng quy trình trồng cây.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Phân loại nông cụ',
        activityType: 'multiple_choice',
        instructionText: 'Chọn những vật dùng để trồng cây trong nhóm nông cụ.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Vật nào dùng để trồng cây?',
          image_selection_mode: 'carousel_find',
          choices: ['hoe-card', 'shovel-card', 'knife-card', 'bowl-card'],
          correct: 'hoe-card',
          image_cards: [
            { id: 'hoe-card', label: 'Cuốc', media_url: '/lesson-media/trung-binh/hoe-card.svg', media_kind: 'image' },
            { id: 'shovel-card', label: 'Xẻng', media_url: '/lesson-media/trung-binh/shovel-card.svg', media_kind: 'image' },
            { id: 'knife-card', label: 'Dao', media_url: '/lesson-media/trung-binh/knife-card.svg', media_kind: 'image' },
            { id: 'bowl-card', label: 'Chén', media_url: '/lesson-media/trung-binh/bowl-card.svg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'Quy trình trồng cây',
        activityType: 'watch_answer',
        instructionText: 'Kéo ba bước trồng cây vào đúng thứ tự.',
        config: {
          kind: 'watch_answer',
          prompt: 'Sắp xếp quy trình trồng cây.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=congnghe-grow',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-gdcd',
    subjectName: 'Giáo dục công dân',
    lessonTitle: 'Mức trung bình - Cảm xúc và ứng xử học đường',
    topicSummary: 'Quản lý cảm xúc, bạo lực học đường',
    description: 'Bài bám file bosung: mở góc bình tĩnh khi tức giận và chọn cách xử lí đúng khi thấy bắt nạt.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Góc bình tĩnh',
        activityType: 'watch_answer',
        instructionText: 'Bấm nút và làm theo từng bước hít thở để bình tĩnh lại.',
        config: {
          kind: 'watch_answer',
          prompt: 'Khi tức giận, em cần làm gì?',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=gdcd-calm',
          media_kind: 'embed',
        },
      },
      {
        title: 'Xử lý tình huống bắt nạt',
        activityType: 'multiple_choice',
        instructionText: 'Xem clip ngắn rồi chọn cách ứng xử đúng.',
        config: {
          kind: 'multiple_choice',
          media_url: 'https://www.youtube.com/embed/plU2JksBYV0?rel=0&playsinline=1',
          media_kind: 'embed',
          prompt: 'Khi thấy bạn bị bắt nạt, em nên chọn gì?',
          choices: ['Báo cô giáo', 'Đánh lại', 'Bỏ đi', 'Cười theo'],
          correct: 'Báo cô giáo',
        },
      },
    ],
  },
  {
    id: 'tb-tin-hoc',
    subjectName: 'Tin học',
    lessonTitle: 'Mức trung bình - Thiết bị số và an toàn mạng',
    topicSummary: 'Thiết bị số, an toàn mạng',
    description: 'Bài bám file bosung: nhận biết thiết bị đầu vào và đóng vai từ chối chia sẻ mật khẩu.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Chọn thiết bị đầu vào',
        activityType: 'multiple_choice',
        instructionText: 'Chọn đúng thiết bị dùng để gõ chữ.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Cái nào dùng để gõ chữ?',
          image_selection_mode: 'carousel_find',
          choices: ['keyboard-card', 'monitor-card'],
          correct: 'keyboard-card',
          image_cards: [
            { id: 'keyboard-card', label: 'Bàn phím', media_url: '/lesson-media/trung-binh/keyboard-card.svg', media_kind: 'image' },
            { id: 'monitor-card', label: 'Màn hình', media_url: '/lesson-media/trung-binh/monitor-card.svg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'Đóng vai an toàn mạng',
        activityType: 'watch_answer',
        instructionText: 'Đọc tin nhắn rồi bấm nút từ chối để giữ an toàn.',
        config: {
          kind: 'watch_answer',
          prompt: 'Bấm đúng nút khóa hoặc từ chối khi có người xin mật khẩu.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=tinhoc-safe',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-gdtc',
    subjectName: 'Giáo dục thể chất',
    lessonTitle: 'Mức trung bình - Chạy đúng tư thế và tập theo nhạc',
    topicSummary: 'Thể dục nhịp điệu, chạy cự li ngắn',
    description: 'Bài bám file bosung: so sánh đúng sai về tư thế chạy và vận động theo vòng tròn ảo.',
    estimatedMinutes: 15,
    activities: [
      {
        title: 'So sánh tư thế chạy',
        activityType: 'multiple_choice',
        instructionText: 'Quan sát hai hình rồi chọn đúng tư thế chạy.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Hình nào là tư thế chạy đúng?',
          image_selection_mode: 'carousel_find',
          choices: ['run-correct-card', 'run-wrong-card'],
          correct: 'run-correct-card',
          image_cards: [
            { id: 'run-correct-card', label: 'Chạy đúng tư thế', media_url: '/lesson-media/nhe/running-correct.svg', media_kind: 'image' },
            { id: 'run-wrong-card', label: 'Chạy sai tư thế', media_url: '/lesson-media/nhe/running-wrong.svg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'AR tập theo nhạc',
        activityType: 'watch_answer',
        instructionText: 'Chạm vào các vòng tròn ảo theo nhịp 1 2 3 4.',
        config: {
          kind: 'watch_answer',
          prompt: 'Tập theo nhịp bằng cách chạm đủ các vòng tròn ảo.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=gdtc-ar',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-am-nhac',
    subjectName: 'Âm nhạc',
    lessonTitle: 'Mức trung bình - Gõ phách và nhạc cụ dân tộc',
    topicSummary: 'Gõ phách đệm nhịp, nhạc cụ dân tộc',
    description: 'Bài bám file bosung: nghe đoán nhạc cụ và gõ trống ảo theo nốt nhạc chạy xuống.',
    estimatedMinutes: 15,
    activities: [
      {
        title: 'Nghe đoán nhạc cụ',
        activityType: 'multiple_choice',
        instructionText: 'Nghe tên nhạc cụ rồi chọn đúng hình tương ứng.',
        config: {
          kind: 'multiple_choice',
          audio_text: 'Trống',
          prompt: 'Nghe và chọn đúng nhạc cụ vừa được gọi tên.',
          image_selection_mode: 'carousel_find',
          choices: ['drum-card', 'flute-card'],
          correct: 'drum-card',
          image_cards: [
            { id: 'drum-card', label: 'Trống', media_url: '/lesson-media/trung-binh/drum-card.svg', media_kind: 'image' },
            { id: 'flute-card', label: 'Sáo', media_url: '/lesson-media/nhe/photos/bamboo-flute.jpg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'Trống ảo theo nhịp',
        activityType: 'watch_answer',
        instructionText: 'Canh nốt nhạc chạm đích rồi gõ vào mặt trống ảo.',
        config: {
          kind: 'watch_answer',
          prompt: 'Bấm bắt đầu rồi gõ trống đúng nhịp khi nốt nhạc đi xuống.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=amnhac-drum',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-my-thuat',
    subjectName: 'Mỹ thuật',
    lessonTitle: 'Mức trung bình - Tạo hình, đường nét và màu sắc',
    topicSummary: 'Tạo hình 3D, đường nét, màu sắc',
    description: 'Bài bám file bosung: đổ màu kín hình và vuốt tạo dáng cho chiếc bình gốm ảo.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Đổ màu hình vẽ',
        activityType: 'watch_answer',
        instructionText: 'Chọn bảng màu rồi chạm vào hình để đổ màu kín vùng viền.',
        config: {
          kind: 'watch_answer',
          prompt: 'Chọn màu rồi tô hình cho kín vùng trống.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=mythuat-fill',
          media_kind: 'embed',
        },
      },
      {
        title: 'Tạo hình gốm ảo',
        activityType: 'watch_answer',
        instructionText: 'Vuốt tay mô phỏng bằng các nút để tạo dáng chiếc bình gốm.',
        config: {
          kind: 'watch_answer',
          prompt: 'Tạo hình gốm ảo theo từng bước.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=mythuat-pottery',
          media_kind: 'embed',
        },
      },
    ],
  },
  {
    id: 'tb-gd-dia-phuong',
    subjectName: 'Giáo dục địa phương',
    lessonTitle: 'Mức trung bình - Đặc sản Đồng Nai',
    topicSummary: 'Đặc sản Đồng Nai, địa danh địa phương',
    description: 'Bài bám file bosung: tìm Bưởi Tân Triều và xem clip chùa địa phương rồi trả lời câu hỏi.',
    estimatedMinutes: 15,
    activities: [
      {
        title: 'Tìm đặc sản Đồng Nai',
        activityType: 'multiple_choice',
        instructionText: 'Nghe yêu cầu rồi chọn đúng hình Bưởi Tân Triều.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Hãy tìm đúng hình Bưởi Tân Triều.',
          audio_text: 'Tìm Bưởi Tân Triều',
          image_selection_mode: 'carousel_find',
          choices: ['buoi-card', 'vai-card', 'nhan-card'],
          correct: 'buoi-card',
          image_cards: [
            { id: 'buoi-card', label: 'Bưởi Tân Triều', media_url: '/lesson-media/nhe/photos/buoi.jpg', media_kind: 'image' },
            { id: 'vai-card', label: 'Vải thiều', media_url: '/lesson-media/trung-binh/vai-card.svg', media_kind: 'image' },
            { id: 'nhan-card', label: 'Nhãn', media_url: '/lesson-media/trung-binh/nhan-card.svg', media_kind: 'image' },
          ],
        },
      },
      {
        title: 'Video tương tác địa phương',
        activityType: 'multiple_choice',
        instructionText: 'Xem clip chùa địa phương rồi chọn đúng câu trả lời.',
        config: {
          kind: 'multiple_choice',
          media_url: 'https://www.youtube.com/embed/DQhT-cBk7Vo?rel=0&playsinline=1',
          media_kind: 'embed',
          prompt: 'Trong clip này là đình hay chùa?',
          choices: ['Chùa', 'Đình', 'Bến xe', 'Siêu thị'],
          correct: 'Chùa',
        },
      },
    ],
  },
  {
    id: 'tb-hdtn-hn',
    subjectName: 'Hoạt động trải nghiệm',
    lessonTitle: 'Mức trung bình - Soạn cặp và chi tiêu cá nhân',
    topicSummary: 'Quản lý đồ dùng, kế hoạch cá nhân',
    description: 'Bài bám file bosung: soạn cặp đúng môn và kéo xu vào tiết kiệm hoặc mua kẹo.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Soạn cặp sách',
        activityType: 'watch_answer',
        instructionText: 'Chạm sách rồi chạm ô trong balo để soạn đúng theo thời khóa biểu.',
        config: {
          kind: 'watch_answer',
          prompt: 'Soạn đúng sách và vở vào balo ảo.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=hdtn-bag',
          media_kind: 'embed',
        },
      },
      {
        title: 'Chi tiêu cá nhân ảo',
        activityType: 'watch_answer',
        instructionText: 'Chia 20 xu vào heo đất tiết kiệm và mua kẹo.',
        config: {
          kind: 'watch_answer',
          prompt: 'Em có 20 xu. Hãy phân chia một phần tiết kiệm và một phần mua sắm.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=hdtn-budget',
          media_kind: 'embed',
        },
      },
    ],
  },
]

const HEAVY_LEVEL_LESSON_TEMPLATES: TeacherLessonTemplate[] = [
  {
    id: 'nang-ngu-van',
    subjectName: 'Ngữ văn',
    lessonTitle: 'Mức nặng - Truyện ngụ ngôn và tục ngữ',
    topicSummary: 'Truyện ngụ ngôn, tục ngữ',
    description: 'Bám đúng bosung.md: sơ đồ tư duy điền khuyết và kể chuyện qua Voice-to-Text.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Sơ đồ tư duy điền khuyết',
        activityType: 'watch_answer',
        instructionText: 'Hiện sơ đồ cốt truyện. Kéo thả các ảnh hoặc từ khóa sự việc vào đúng nhánh trống.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=ngu-van-mindmap',
          media_kind: 'embed',
          prompt: 'Bài tập này giúp em kéo thả các ý chính vào sơ đồ cốt truyện.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Kể chuyện qua Voice-to-Text',
        activityType: 'watch_answer',
        instructionText: 'App hiện câu hỏi mồi “Bài học rút ra là gì?”. Em bấm micro trả lời để app chuyển thành văn bản.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'watch_answer',
          prompt: 'Bài học rút ra là gì?',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'Kiên trì sẽ thành công.',
          accepted_answers: ['Kiên trì sẽ thành công', 'Cần kiên trì', 'Không nên bỏ cuộc', 'Cố gắng thì sẽ thành công'],
        },
      },
    ],
  },
  {
    id: 'nang-toan',
    subjectName: 'Toán học',
    lessonTitle: 'Mức nặng - Số hữu tỉ, tỉ lệ và lăng trụ đứng',
    topicSummary: 'Số hữu tỉ, tỉ lệ thuận nghịch, lăng trụ đứng',
    description: 'Bám đúng bosung.md: bài toán step-by-step và tương tác 3D hình khối.',
    estimatedMinutes: 20,
    activities: [
      {
        title: 'Bài toán Step-by-step',
        activityType: 'watch_answer',
        instructionText: 'Hiện đề bài có tô màu từ khóa. App gợi ý phép tính để em chọn và điền số.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=toan-step',
          media_kind: 'embed',
          prompt: 'Đây là mô-đun step-by-step để giảm tải tư duy trừu tượng cho bài toán.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Tương tác 3D hình khối',
        activityType: 'watch_answer',
        instructionText: 'Hiện khối lăng trụ 3D. Dùng tay xoay khối rồi chạm vào đỉnh hoặc cạnh để app tự đếm.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=toan-prism',
          media_kind: 'embed',
          prompt: 'Xoay khối lăng trụ rồi chạm vào đỉnh hoặc cạnh để app tự đếm số lượng.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-tieng-anh',
    subjectName: 'Tiếng Anh',
    lessonTitle: 'Mức nặng - Sức khỏe, giao thông, lễ hội',
    topicSummary: 'Sức khỏe, giao thông, lễ hội',
    description: 'Bám đúng bosung.md: Listen & Choose với từ Festival và đóng vai hội thoại bằng micro.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Listen & Choose - Festival',
        activityType: 'listen_choose',
        instructionText: 'App đọc từ “Festival”. Hiện 3 hình ảnh và em chọn đúng hình Lễ hội.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'listen_choose',
          audio_text: 'Festival',
          audio_lang: 'en-US',
          prompt: 'Nghe từ Festival rồi vuốt sang để tìm đúng hình Lễ hội.',
          image_selection_mode: 'carousel_find',
          image_cards: [
            { id: 'festival-card', label: 'Lễ hội', media_url: '/lesson-media/nang/heavy-lab.html?activity=festival-card', media_kind: 'embed' },
            { id: 'hospital-card', label: 'Bệnh viện', media_url: '/lesson-media/nang/heavy-lab.html?activity=hospital-card', media_kind: 'embed' },
            { id: 'traffic-card', label: 'Giao thông', media_url: '/lesson-media/nang/heavy-lab.html?activity=traffic-card', media_kind: 'embed' },
          ],
          choices: ['festival-card', 'hospital-card', 'traffic-card'],
          correct: 'festival-card',
        },
      },
      {
        title: 'Đóng vai hội thoại (Role-play AI)',
        activityType: 'watch_answer',
        instructionText: 'AI hỏi “How are you?”. Em bấm micro trả lời để AI nhận diện và chấm sao.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'watch_answer',
          prompt: 'Nghe câu hỏi “How are you?” rồi bấm micro để trả lời bằng tiếng Anh.',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'I am fine.',
          accepted_answers: ['I am fine', "I'm fine", 'I am good', "I'm good", 'Fine thank you'],
        },
      },
    ],
  },
  {
    id: 'nang-khtn',
    subjectName: 'Khoa học tự nhiên',
    lessonTitle: 'Mức nặng - Nguyên tử, ánh sáng và từ tính',
    topicSummary: 'Nguyên tử, ánh sáng, từ tính',
    description: 'Bám đúng bosung.md: thực nghiệm ảo với nam châm và sắp xếp vòng nguyên tử.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Thực nghiệm ảo (Kéo thả)',
        activityType: 'watch_answer',
        instructionText: 'Hiện thanh Nam châm cùng đinh sắt và cục gỗ. Kéo Nam châm lại gần để quan sát vật nào bị hút.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=khtn-magnet',
          media_kind: 'embed',
          prompt: 'Thực nghiệm ảo với nam châm giúp em hiểu tính chất vật lý trực quan.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Sắp xếp vòng nguyên tử',
        activityType: 'watch_answer',
        instructionText: 'Hiện hạt nhân ở giữa. Kéo các hạt electron vào đúng quỹ đạo.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=khtn-atom',
          media_kind: 'embed',
          prompt: 'Kéo electron vào quỹ đạo để cụ thể hóa khái niệm nguyên tử.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-lsdl',
    subjectName: 'Lịch sử - Địa lý',
    lessonTitle: 'Mức nặng - Các châu lục, phát kiến địa lí, Châu Mỹ',
    topicSummary: 'Các châu lục, phát kiến địa lí, Châu Mỹ',
    description: 'Bám đúng bosung.md: định vị bản đồ trên quả địa cầu và dòng thời gian thám hiểm.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Định vị bản đồ',
        activityType: 'watch_answer',
        instructionText: 'Hiện quả địa cầu có thể xoay. Âm thanh hỏi “Châu Mỹ ở đâu?”, em chạm vào đúng vùng đất đó.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=lsdl-globe',
          media_kind: 'embed',
          prompt: 'Định vị Châu Mỹ trên quả địa cầu trực quan.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Dòng thời gian (Timeline)',
        activityType: 'watch_answer',
        instructionText: 'Hiện mốc thời gian trống. Kéo thả hình ảnh tàu thuyền thám hiểm vào đúng mốc.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=lsdl-timeline',
          media_kind: 'embed',
          prompt: 'Kéo thả tàu thuyền vào đúng mốc để hiểu tiến trình lịch sử.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-cong-nghe',
    subjectName: 'Công nghệ',
    lessonTitle: 'Mức nặng - Quy trình trồng trọt và vật nuôi',
    topicSummary: 'Quy trình trồng trọt, vật nuôi',
    description: 'Bám đúng bosung.md: sắp xếp quy trình trồng trọt và phân loại gia súc, gia cầm.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Sắp xếp quy trình',
        activityType: 'watch_answer',
        instructionText: 'Hiện 3 ô trống. Kéo thả tranh theo thứ tự: Làm đất → Gieo hạt → Thu hoạch.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=congnghe-steps',
          media_kind: 'embed',
          prompt: 'Sắp xếp quy trình trồng trọt theo đúng thứ tự.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Phân loại nông cụ/vật nuôi',
        activityType: 'watch_answer',
        instructionText: 'Kéo con Bò, Heo vào ô “Gia súc”; Gà, Vịt vào ô “Gia cầm”.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=congnghe-animals',
          media_kind: 'embed',
          prompt: 'Phân loại vật nuôi theo đúng nhóm công nghệ nông nghiệp.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-gdcd',
    subjectName: 'Giáo dục công dân',
    lessonTitle: 'Mức nặng - Tự hào truyền thống và bạo lực học đường',
    topicSummary: 'Tự hào truyền thống, bạo lực học đường',
    description: 'Bám đúng bosung.md: video tình huống A/B và quản lý tài chính ảo.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Video tình huống (A/B)',
        activityType: 'multiple_choice',
        instructionText: 'Xem clip 5 giây bạn bị bắt nạt rồi chọn nút A hoặc B.',
        config: {
          kind: 'multiple_choice',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=gdcd-bullying',
          media_kind: 'embed',
          prompt: 'Sau khi xem clip, em chọn A. Báo cô giáo hay B. Đứng xem?',
          choices: ['A. Báo cô giáo', 'B. Đứng xem'],
          correct: 'A. Báo cô giáo',
        },
      },
      {
        title: 'Quản lý tài chính ảo',
        activityType: 'watch_answer',
        instructionText: 'Ngân có 20 xu. Kéo phân bổ tiền vào “Lọ tiết kiệm” và “Mua sắm”.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=gdcd-budget',
          media_kind: 'embed',
          prompt: 'Phân bổ tiền vào hai mục để rèn năng lực quản lý bản thân.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-tin-hoc',
    subjectName: 'Tin học',
    lessonTitle: 'Mức nặng - Phần mềm bảng tính và trình chiếu',
    topicSummary: 'Excel, PowerPoint',
    description: 'Bám đúng bosung.md: mô phỏng Excel và tạo slide nhanh bằng template.',
    estimatedMinutes: 20,
    activities: [
      {
        title: 'Mô phỏng Excel',
        activityType: 'watch_answer',
        instructionText: 'Hiện bảng tính đơn giản. Kéo thả hàm SUM vào cột tổng tiền để tính tự động.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=tinhoc-excel',
          media_kind: 'embed',
          prompt: 'Mô phỏng việc kéo hàm SUM vào cột tổng tiền.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Tạo Slide nhanh (Templates)',
        activityType: 'watch_answer',
        instructionText: 'Chọn một khung slide có sẵn. Kéo ảnh cá nhân và nhập tiêu đề.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=tinhoc-slide',
          media_kind: 'embed',
          prompt: 'Tạo một slide nhanh theo template để rèn kỹ năng sản phẩm số.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-gdtc',
    subjectName: 'Giáo dục thể chất',
    lessonTitle: 'Mức nặng - Thể dục nhịp điệu và chạy cự li ngắn',
    topicSummary: 'Thể dục nhịp điệu, chạy cự li ngắn',
    description: 'Bám đúng bosung.md: chọn tư thế chạy đúng và AR Camera tập theo nhạc.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Chọn tư thế đúng',
        activityType: 'multiple_choice',
        instructionText: 'Hiện 2 hình ảnh chạy đúng và sai tư thế. Em tick chọn hình đúng.',
        config: {
          kind: 'multiple_choice',
          prompt: 'Hình nào là tư thế chạy đúng?',
          image_selection_mode: 'carousel_find',
          image_cards: [
            { id: 'run-correct-card', label: 'Chạy đúng tư thế', media_url: '/lesson-media/nang/heavy-lab.html?activity=run-correct-card', media_kind: 'embed' },
            { id: 'run-wrong-card', label: 'Chạy sai tư thế', media_url: '/lesson-media/nang/heavy-lab.html?activity=run-wrong-card', media_kind: 'embed' },
          ],
          choices: ['run-correct-card', 'run-wrong-card'],
          correct: 'run-correct-card',
        },
      },
      {
        title: 'AR Camera - Tập theo nhạc',
        activityType: 'watch_answer',
        instructionText: 'Bật camera trước, màn hình hiện vòng tròn ảo. Em vung tay đập vỡ vòng tròn theo nhịp điệu.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=gdtc-ar',
          media_kind: 'embed',
          prompt: 'Đập vỡ các vòng tròn ảo để phát triển vận động thô.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-am-nhac',
    subjectName: 'Âm nhạc',
    lessonTitle: 'Mức nặng - Nhịp điệu và nhạc cụ dân tộc',
    topicSummary: 'Nhịp điệu, nhạc cụ dân tộc',
    description: 'Bám đúng bosung.md: nghe đoán nhạc cụ và đệm hát bằng nốt sáng chạy xuống.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Nghe và đoán nhạc cụ',
        activityType: 'listen_choose',
        instructionText: 'Phát âm thanh tiếng sáo hoặc đàn bầu. Em chọn đúng hình nhạc cụ.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'listen_choose',
          audio_text: 'Tiếng sáo trúc',
          audio_url: '/lesson-media/nang/audio/flute.ogg',
          prompt: 'Nghe âm thanh rồi tìm đúng nhạc cụ.',
          image_selection_mode: 'carousel_find',
          image_cards: [
            { id: 'sao-card', label: 'Sáo trúc', media_url: '/lesson-media/nang/heavy-lab.html?activity=sao-card', media_kind: 'embed' },
            { id: 'dan-bau-card', label: 'Đàn bầu', media_url: '/lesson-media/nang/heavy-lab.html?activity=dan-bau-card', media_kind: 'embed' },
          ],
          choices: ['sao-card', 'dan-bau-card'],
          correct: 'sao-card',
        },
      },
      {
        title: 'Đệm hát (Virtual Drum/Piano)',
        activityType: 'watch_answer',
        instructionText: 'Nhạc phát, các nốt sáng chạy xuống. Chạm ngón tay đúng lúc nốt chạm đích để gõ phách.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=amnhac-rhythm',
          media_kind: 'embed',
          prompt: 'Chạm đúng lúc nốt nhạc chạm xuống để đệm hát theo nhịp.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-my-thuat',
    subjectName: 'Mỹ thuật',
    lessonTitle: 'Mức nặng - Màu sắc, bố cục và tạo hình 3D',
    topicSummary: 'Màu sắc, bố cục, tạo hình 3D',
    description: 'Bám đúng bosung.md: tô mảng màu và thiết kế thiệp điện tử bằng sticker.',
    estimatedMinutes: 18,
    activities: [
      {
        title: 'Tô mảng màu (Fill Color)',
        activityType: 'watch_answer',
        instructionText: 'Hiện tranh nét viền dày. Chọn màu trên bảng palette và chạm để đổ màu kín.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=mythuat-fill',
          media_kind: 'embed',
          prompt: 'Chọn màu phù hợp rồi chạm để tô kín hình.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Thiết kế thiệp điện tử',
        activityType: 'watch_answer',
        instructionText: 'Cung cấp kho hình nền và sticker. Kéo thả dán sticker để trang trí bố cục thiệp.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=mythuat-card',
          media_kind: 'embed',
          prompt: 'Thiết kế thiệp điện tử bằng cách thêm sticker vào bố cục.',
          answer_mode: 'none',
        },
      },
    ],
  },
  {
    id: 'nang-gd-dia-phuong',
    subjectName: 'Giáo dục địa phương',
    lessonTitle: 'Mức nặng - Đặc sản và kiến trúc Đồng Nai',
    topicSummary: 'Đặc sản và kiến trúc Đồng Nai',
    description: 'Bám đúng bosung.md: flashcard lật mở về Văn miếu Trấn Biên và Gốm Biên Hòa, kèm video tương tác.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Flashcard lật mở',
        activityType: 'watch_answer',
        instructionText: 'Hiện hình Văn miếu Trấn Biên và Gốm Biên Hòa. Chạm để lật xem thông tin ngắn gọn.',
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=dia-phuong-flashcard',
          media_kind: 'embed',
          prompt: 'Lật thẻ để xem thông tin ngắn gọn về địa danh Đồng Nai.',
          answer_mode: 'none',
        },
      },
      {
        title: 'Video tương tác',
        activityType: 'watch_answer',
        instructionText: 'Xem clip 10 giây. App tự động dừng lại và hỏi: “Đây là gì?”. Em bấm thu âm để trả lời.',
        voiceAnswerEnabled: true,
        config: {
          kind: 'watch_answer',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=dia-phuong-video',
          media_kind: 'embed',
          prompt: 'Đây là gì?',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'Văn miếu Trấn Biên',
          accepted_answers: ['Văn miếu Trấn Biên', 'Đây là Văn miếu Trấn Biên', 'Van mieu Tran Bien'],
        },
      },
    ],
  },
  {
    id: 'nang-hdtn-hn',
    subjectName: 'Hoạt động trải nghiệm',
    lessonTitle: 'Mức nặng - Quản lý đồ dùng và kế hoạch cá nhân',
    topicSummary: 'Quản lý đồ dùng, lên kế hoạch cá nhân',
    description: 'Bám đúng bosung.md: soạn cặp sách theo thời khóa biểu và chi tiêu cá nhân với 20 xu.',
    estimatedMinutes: 16,
    activities: [
      {
        title: 'Soạn cặp sách',
        activityType: 'watch_answer',
        instructionText: 'App hiển thị thời khóa biểu bằng hình môn Toán, Văn. Em kéo đúng cuốn sách vào balo ảo.',
        config: {
          kind: 'watch_answer',
          prompt: 'Soạn đúng sách và vở vào balo ảo theo thời khóa biểu.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=hdtn-bag',
          media_kind: 'embed',
        },
      },
      {
        title: 'Chi tiêu cá nhân (ảo)',
        activityType: 'watch_answer',
        instructionText: 'Phúc có 20 xu. Em kéo xu vào “Heo đất tiết kiệm” hoặc “Mua kẹo”.',
        config: {
          kind: 'watch_answer',
          prompt: 'Em có 20 xu. Hãy chia một phần tiết kiệm và một phần mua kẹo.',
          answer_mode: 'none',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=hdtn-budget',
          media_kind: 'embed',
        },
      },
    ],
  },
]


const lessonTemplateMap: Record<LessonTemplateLevel, TeacherLessonTemplate[]> = {
  nhe: LIGHT_LEVEL_LESSON_TEMPLATES,
  trung_binh: MEDIUM_LEVEL_LESSON_TEMPLATES,
  nang: HEAVY_LEVEL_LESSON_TEMPLATES,
}

export function getLessonTemplatesByLevel(level: LessonTemplateLevel) {
  return lessonTemplateMap[level] ?? []
}
