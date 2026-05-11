export type LessonLevel = 'nang' | 'trung_binh' | 'nhe';
export type ActivityType = 'exercise' | 'activity';
export type InteractionType = 'touch' | 'drag' | 'voice' | 'scroll' | 'selection' | 'drawing';

export interface StepItem {
  step_number: number;
  title: string;
  content_type: string;
  description: string;
}

export interface ActivityTemplate {
  title: string;
  activity_type: ActivityType;
  interaction_type?: InteractionType;
  objective: string;
  steps: StepItem[];
}

export interface LessonTemplate {
  subject_id: number;
  subject_name: string;
  icon: string;
  title: string;
  theme: string;
  description: string;
  h1: ActivityTemplate;
  h2: ActivityTemplate;
}

export const SUBJECT_TEMPLATES: Record<LessonLevel, LessonTemplate[]> = {
  nang: [
    {
      subject_id: 1,
      subject_name: 'Ngữ văn',
      icon: '📚',
      title: 'Nhận biết nhân vật trong truyện cổ tích',
      theme: 'Truyện cổ tích',
      description: 'Giúp học sinh nhận biết các nhân vật quen thuộc qua hình ảnh và âm thanh sinh động.',
      h1: {
        title: 'Chạm đúng nhân vật',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực nhận diện hình ảnh',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện 2 hình ảnh (Ví dụ: Cô Tấm và con chó).' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh app đọc: "Ai là cô Tấm?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm đúng hình cô Tấm -> Vỗ tay.' },
        ]
      },
      h2: {
        title: 'Nghe truyện bằng Tranh động (Animation)',
        activity_type: 'activity',
        objective: 'Phẩm chất chăm chỉ, tập trung nghe 3 phút',
        steps: [
          { step_number: 1, title: 'Hành động tự động', content_type: 'auto_action', description: 'App tự động lật từng trang truyện.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'animation', description: 'Tranh chuyển động chậm, ít chi tiết, có giọng đọc truyện diễn cảm.' },
          { step_number: 3, title: 'Âm thanh kèm theo', content_type: 'audio', description: 'Giọng đọc truyện diễn cảm xuyên suốt.' },
        ]
      }
    },
    {
      subject_id: 2,
      subject_name: 'Toán học',
      icon: '🔢',
      title: 'Nhận biết số lượng 1-3 và Hình khối cơ bản',
      theme: 'Số lượng và Hình khối',
      description: 'Làm quen với các con số nhỏ và hình khối cơ bản qua thao tác kéo thả.',
      h1: {
        title: 'Kéo thả đếm số',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Năng lực tính toán cơ bản (số lượng nhỏ)',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 1 cái rổ và 3 quả táo.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Cho cô 2 quả táo".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo (drag) 2 quả táo thả vào rổ.' },
        ]
      },
      h2: {
        title: 'Phân loại hình khối',
        activity_type: 'activity',
        objective: 'Nhận thức tư duy cụ thể',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 2 hộp: 1 hộp hình Tròn, 1 hộp hình Vuông.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'interaction', description: 'Hiện các khối gỗ trên màn hình.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh nhấp chọn các khối gỗ bỏ vào đúng hộp.' },
        ]
      }
    },
    {
      subject_id: 3,
      subject_name: 'Tiếng Anh',
      icon: '🔤',
      title: 'Nhận biết Màu sắc (Red, Blue) và Khẩu lệnh (Stand up)',
      theme: 'Màu sắc và Khẩu lệnh',
      description: 'Học tiếng Anh cơ bản qua màu sắc và các hành động bắt chước.',
      h1: {
        title: 'Flashcard Âm thanh',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực ngôn ngữ cơ bản',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện màu Đỏ.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'App đọc "Red".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm vào màn hình để nghe lại và học phát âm (bập bẹ).' },
        ]
      },
      h2: {
        title: 'Học qua bắt chước hành động (TPR)',
        activity_type: 'activity',
        objective: 'Kỹ năng phản xạ xã hội',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'video', description: 'App chiếu video 1 bạn nhỏ đứng lên, có chữ "Stand up".' },
          { step_number: 2, title: 'Tương tác AI', content_type: 'ai_camera', description: 'Camera AI của App quét xem học sinh có đứng lên theo không.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'feedback', description: 'Thưởng sao nếu học sinh thực hiện đúng.' },
        ]
      }
    },
    {
      subject_id: 4,
      subject_name: 'Khoa học tự nhiên',
      icon: '🔬',
      title: 'Cơ thể người (Mắt, mũi, miệng) và Vật sống / Không sống',
      theme: 'Cơ thể và Môi trường',
      description: 'Nhận biết các bộ phận cơ thể và phân biệt vật sống quanh ta.',
      h1: {
        title: 'Ghép bộ phận',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Năng lực khoa học, nhận biết bản thân',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện khuôn mặt trống.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Hiện các bộ phận Mắt, Mũi, Miệng bên cạnh.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo thả Mắt, Mũi, Miệng vào đúng vị trí.' },
        ]
      },
      h2: {
        title: 'Phân loại Sinh học',
        activity_type: 'activity',
        objective: 'Phân biệt tính chất sự vật',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình chia làm 2 bên: Rừng cây (vật sống) và Căn phòng (vật không sống).' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo Con chó vào rừng, Cái ghế vào phòng.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Âm thanh xác nhận đúng/sai cho từng vật.' },
        ]
      }
    },
    {
      subject_id: 5,
      subject_name: 'Lịch sử - Địa lí',
      icon: '🌦️',
      title: 'Thời tiết (Nắng/Mưa) và Phương tiện giao thông',
      theme: 'Thời tiết và Giao thông',
      description: 'Tìm hiểu về thời tiết và các loại phương tiện giao thông cơ bản.',
      h1: {
        title: 'Chọn đồ vật theo thời tiết',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực thích ứng tự nhiên',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Màn hình đang đổ mưa (có tiếng mưa).' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Mưa rồi, lấy gì đây?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn cái Ô thay vì Kính râm.' },
        ]
      },
      h2: {
        title: 'Ghép đúng đường đi',
        activity_type: 'activity',
        objective: 'Nhận diện không gian',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'App hiện đường thủy và đường bộ.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo Thuyền xuống nước, kéo Ô tô lên bờ.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Phương tiện chuyển động khi đặt đúng đường.' },
        ]
      }
    },
    {
      subject_id: 6,
      subject_name: 'Công nghệ',
      icon: '⚙️',
      title: 'Nhận diện vật cấm/nguy hiểm trong nhà',
      theme: 'An toàn gia đình',
      description: 'Dạy học sinh nhận biết và tránh xa các vật dụng nguy hiểm trong nhà.',
      h1: {
        title: 'Thẻ cảnh báo AAC',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Kỹ năng tự bảo vệ an toàn',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện Ổ điện, Dao nhọn, Bát cơm.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Hiện các thẻ cảnh báo dấu X màu đỏ.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo thẻ dấu X dán lên Ổ điện và Dao.' },
        ]
      },
      h2: {
        title: 'Sắp xếp đồ dùng nhà bếp',
        activity_type: 'activity',
        objective: 'Năng lực công nghệ gia đình',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình là 1 cái kệ bát.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh dùng tay chạm để xếp bát to dưới, bát nhỏ trên.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Âm thanh khen ngợi khi xếp đúng trật tự.' },
        ]
      }
    },
    {
      subject_id: 7,
      subject_name: 'Giáo dục công dân',
      icon: '🤝',
      title: 'Hành vi đạo đức (Chào hỏi, Bỏ rác)',
      theme: 'Đạo đức và Ứng xử',
      description: 'Hình thành thói quen tốt và nhận biết hành vi đúng sai.',
      h1: {
        title: 'Chọn mặt Cười/Mếu',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Nhận thức hành vi đúng sai',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'video', description: 'App chiếu video ngắn (3s) một bạn vứt rác ra sân.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn icon Mặt mếu ☹️.' },
          { step_number: 3, title: 'Tương tác tiếp', content_type: 'interaction', description: 'Nếu video bạn nhặt rác -> chọn Mặt cười 😊.' },
        ]
      },
      h2: {
        title: 'Thực hành chào hỏi',
        activity_type: 'activity',
        objective: 'Kỹ năng giao tiếp xã hội',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'App hiện hình cô giáo.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Con chào cô ạ".' },
          { step_number: 3, title: 'Tương tác', content_type: 'voice', description: 'Học sinh nhấn Micro để bập bẹ nói chữ "Ạ". App xác nhận -> Thưởng hoa.' },
        ]
      }
    },
    {
      subject_id: 8,
      subject_name: 'Tin học',
      icon: '💻',
      title: 'Nhận biết thiết bị máy tính',
      theme: 'Làm quen máy tính',
      description: 'Nhận diện các bộ phận cơ bản của máy tính và cách sử dụng máy tính bảng.',
      h1: {
        title: 'Ghép cặp (Matching)',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Nhận diện công nghệ',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện biểu tượng: Con chuột thật và Chuột máy tính.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh "Chuột máy tính đâu?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm đúng hình.' },
        ]
      },
      h2: {
        title: 'Thực hành Tap/Swipe',
        activity_type: 'activity',
        objective: 'Làm chủ thiết bị số đơn giản (Tablet)',
        steps: [
          { step_number: 1, title: 'Tương tác 1', content_type: 'interaction', description: 'Các hoạt động vuốt (Swipe) trái phải để lật trang.' },
          { step_number: 2, title: 'Tương tác 2', content_type: 'interaction', description: 'Chạm (Tap) để bật sáng màn hình.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Màn hình phản ứng theo từng thao tác chạm vuốt.' },
        ]
      }
    },
    {
      subject_id: 9,
      subject_name: 'Giáo dục thể chất',
      icon: '🏃',
      title: 'Vận động định hướng',
      theme: 'Vận động cơ bản',
      description: 'Phát triển năng lực thể chất qua việc bắt chước và trò chơi vận động.',
      h1: {
        title: 'Video làm mẫu chậm',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực thể chất, bắt chước hành động',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'video', description: 'Phát video Thầy giáo tập vươn vai.' },
          { step_number: 2, title: 'Hành động', content_type: 'interaction', description: 'Học sinh nhìn và tập theo.' },
          { step_number: 3, title: 'Xác nhận', content_type: 'interaction', description: 'Chạm vào nút "Em đã làm được" để hoàn thành.' },
        ]
      },
      h2: {
        title: 'AR Camera (Thực tế ảo)',
        activity_type: 'activity',
        objective: 'Vận động thô',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'ai_camera', description: 'Học sinh đứng trước màn hình thiết bị.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'animation', description: 'App hiện các vòng tròn ảo bay tới.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh vung tay để "đập" vỡ các vòng tròn ảo.' },
        ]
      }
    },
    {
      subject_id: 10,
      subject_name: 'Nghệ thuật (Âm nhạc)',
      icon: '🎵',
      title: 'Nhận biết nhịp điệu',
      theme: 'Nhịp điệu âm thanh',
      description: 'Cảm thụ âm thanh và nhận diện các loại nhạc cụ phổ biến.',
      h1: {
        title: 'Gõ phách ảo',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Cảm thụ âm thanh',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện 1 cái trống.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'animation', description: 'Nốt nhạc rơi xuống chạm mặt trống.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh lấy ngón tay vỗ vào màn hình đúng nhịp.' },
        ]
      },
      h2: {
        title: 'Nhận diện nhạc cụ',
        activity_type: 'activity',
        objective: 'Phân biệt âm thanh',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện cây Đàn guitar và cái Kèn.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Bấm vào Đàn nghe tiếng đàn tưng tưng.' },
          { step_number: 3, title: 'So sánh', content_type: 'audio', description: 'Bấm vào Kèn để nghe và phân biệt âm thanh khác biệt.' },
        ]
      }
    },
    {
      subject_id: 11,
      subject_name: 'Nghệ thuật (Mĩ thuật)',
      icon: '🎨',
      title: 'Tô màu và tạo hình đơn giản',
      theme: 'Màu sắc và Tạo hình',
      description: 'Phát triển khiếu thẩm mĩ và sự khéo léo qua việc tô màu và dán sticker.',
      h1: {
        title: 'Tô mảng màu (Fill Color)',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực thẩm mĩ',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình có hình quả cam viền đen dày.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Hiện bảng màu cơ bản bên dưới.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Chọn màu Cam đổ vào mảng trống.' },
        ]
      },
      h2: {
        title: 'Bóc dán Sticker ảo',
        activity_type: 'activity',
        objective: 'Khéo léo ngón tay, tư duy bố cục',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện bức tranh Vườn hoa.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Hiện kho Sticker con ong, bươm bướm.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Kéo thả Sticker gắn vào bức tranh.' },
        ]
      }
    },
    {
      subject_id: 12,
      subject_name: 'Giáo dục Địa phương',
      icon: '🍊',
      title: 'Nhận diện đặc sản Đồng Nai',
      theme: 'Quê hương Đồng Nai',
      description: 'Tìm hiểu về các loại đặc sản địa phương qua hình ảnh trực quan.',
      h1: {
        title: 'Flashcard Hình ảnh lớn',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Hiểu biết môi trường sống',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện hình quả Bưởi Tân Triều.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Quả bưởi".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm để lật thẻ xem hình ruột bưởi.' },
        ]
      },
      h2: {
        title: 'Ghép 2 mảnh',
        activity_type: 'activity',
        objective: 'Tư duy ghép nối',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Quả bưởi bị cắt làm đôi trên màn hình.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo 2 nửa lại gần nhau để khớp thành quả hoàn chỉnh.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Quả bưởi phát sáng khi được ghép đúng.' },
        ]
      }
    },
    {
      subject_id: 13,
      subject_name: 'HĐ Trải nghiệm, Hướng nghiệp',
      icon: '🧩',
      title: 'Kỹ năng tự phục vụ cơ bản (Rửa tay, giao tiếp)',
      theme: 'Kỹ năng sống',
      description: 'Rèn luyện các thói quen tự phục vụ và kỹ năng giao tiếp cơ bản.',
      h1: {
        title: 'Task Analysis (Phân tích bước)',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Duy trì thói quen cá nhân',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'App chiếu 3 thẻ: Mở vòi nước, Lấy xà phòng, Rửa tay.' },
          { step_number: 2, title: 'Yêu cầu', content_type: 'audio', description: 'Âm thanh: "Sắp xếp đúng thứ tự rửa tay".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo thả vào đúng thứ tự 1-2-3.' },
        ]
      },
      h2: {
        title: 'Bảng AAC Giao tiếp',
        activity_type: 'activity',
        objective: 'Hỗ trợ ngôn ngữ',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện các hình ảnh: Nước, Cơm, Đi vệ sinh, Mệt, Chơi.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh bấm vào một hình bất kỳ.' },
          { step_number: 3, title: 'Âm thanh', content_type: 'audio', description: 'App phát loa nói thay học sinh (Ví dụ: "Con muốn uống nước").' },
        ]
      }
    },
  ],
  trung_binh: [
    {
      subject_id: 1,
      subject_name: 'Ngữ văn',
      icon: '📚',
      title: 'Truyện ngụ ngôn và Tục ngữ',
      theme: 'Văn học dân gian',
      description: 'Tiếp cận các câu chuyện đạo lý và tục ngữ qua hình ảnh minh họa và sơ đồ tư duy.',
      h1: {
        title: 'Trắc nghiệm hình ảnh',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực nhận diện nhân vật',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện truyện "Ếch ngồi đáy giếng".' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Câu hỏi: "Ai là người ngồi ở đáy giếng?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn hình con Ếch trong 3 phương án.' },
        ]
      },
      h2: {
        title: 'Hoàn thành sơ đồ tư duy',
        activity_type: 'activity',
        objective: 'Năng lực tư duy logic, hệ thống cốt truyện',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện sơ đồ cốt truyện còn trống.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Hiện các ô chữ: Mở đầu, Diễn biến, Kết thúc.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo thả các ô chữ vào đúng vị trí sơ đồ.' },
        ]
      }
    },
    {
      subject_id: 2,
      subject_name: 'Toán học',
      icon: '🔢',
      title: 'Hình khối và mua bán đơn giản',
      theme: 'Hình học và tính toán thực tế',
      description: 'Nhận biết hình chóp, hình lăng trụ và vận dụng phép tính đơn giản qua tình huống mua bán bằng xu.',
      h1: {
        title: 'Phân loại hình học',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Năng lực nhận diện hình học không gian',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện các vật thể thực tế: Kim tự tháp, Hộp sữa.' },
          { step_number: 2, title: 'Yêu cầu', content_type: 'audio', description: 'Âm thanh: "Đâu là hình chóp?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo Kim tự tháp vào ô Hình chóp.' },
        ]
      },
      h2: {
        title: 'Mô phỏng mua bán',
        activity_type: 'activity',
        objective: 'Vận dụng toán học vào đời sống',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'App hiện 1 quầy hàng có kẹo giá 2 xu.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Học sinh có 5 xu trên màn hình.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo 2 xu vào máy tính tiền để mua kẹo.' },
        ]
      }
    },
    {
      subject_id: 3,
      subject_name: 'Tiếng Anh',
      icon: '🔤',
      title: 'Health, Traffic and Festival',
      theme: 'Sức khỏe, Giao thông, Lễ hội',
      description: 'Mở rộng vốn từ vựng về các chủ đề quen thuộc và luyện nghe cơ bản.',
      h1: {
        title: 'Listen and Choose',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực nghe hiểu từ vựng',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện hình Xe buýt, Xe đạp, Ô tô.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'App phát âm: "Bus".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm đúng hình Xe buýt.' },
        ]
      },
      h2: {
        title: 'Flashcard lật mở (Lễ hội)',
        activity_type: 'activity',
        objective: 'Ghi nhớ hình ảnh và âm thanh',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện thẻ chữ "Festival".' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh lật thẻ để xem hình Lễ hội Trung thu.' },
          { step_number: 3, title: 'Âm thanh', content_type: 'audio', description: 'Nghe lại từ vựng kèm tiếng nhạc lễ hội.' },
        ]
      }
    },
    {
      subject_id: 4,
      subject_name: 'Khoa học tự nhiên',
      icon: '🔬',
      title: 'Nam châm và lực hút',
      theme: 'Khám phá hiện tượng vật lý',
      description: 'Tìm hiểu tính chất của nam châm qua câu hỏi đúng sai và thí nghiệm kéo thả trực quan.',
      h1: {
        title: 'Đúng/Sai về nam châm',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực tìm hiểu tự nhiên',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện Nam châm hút một cái đinh sắt.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Hỏi: "Nam châm có hút sắt không?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn nút Đúng.' },
        ]
      },
      h2: {
        title: 'Thí nghiệm ảo kéo thả',
        activity_type: 'activity',
        objective: 'Tư duy thực nghiệm trực quan',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện một thanh nam châm lớn và các vật: Đinh, Gỗ, Nhựa.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh dùng tay kéo nam châm lại gần từng vật.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Vật bằng sắt sẽ "bay" dính vào nam châm.' },
        ]
      }
    },
    {
      subject_id: 5,
      subject_name: 'Lịch sử - Địa lí',
      icon: '🌦️',
      title: 'Châu lục và Phát kiến địa lí',
      theme: 'Địa lý thế giới',
      description: 'Làm quen với các châu lục và các cuộc thám hiểm lịch sử qua bản đồ 3D.',
      h1: {
        title: 'Tìm Châu Mỹ trên quả địa cầu',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Định vị không gian địa lý',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Hiện quả địa cầu 3D có thể xoay.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Châu Mỹ ở đâu?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm vào đúng vùng đất Châu Mỹ.' },
        ]
      },
      h2: {
        title: 'Dấu chân thám hiểm',
        activity_type: 'activity',
        objective: 'Năng lực lịch sử trực quan',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'App hiện sơ đồ lộ trình đi từ Châu Âu sang Châu Á.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh nhấn các điểm nút để nối đường cho con thuyền chạy.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Con thuyền sẽ chạy theo đường học sinh vừa nối.' },
        ]
      }
    },
    {
      subject_id: 6,
      subject_name: 'Công nghệ',
      icon: '⚙️',
      title: 'Nông cụ và quy trình trồng cây',
      theme: 'Nông nghiệp cơ bản',
      description: 'Nhận biết nông cụ quen thuộc và sắp xếp đúng các bước cơ bản trong quy trình trồng cây.',
      h1: {
        title: 'Nhận diện nông cụ',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Kỹ năng công nghệ nông nghiệp',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện Cái Cuốc, Cái Xẻng, Con Dao.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Cái gì dùng để đào đất?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn hình Cái Xẻng.' },
        ]
      },
      h2: {
        title: 'Sắp xếp quy trình trồng cây',
        activity_type: 'activity',
        objective: 'Tư duy quy trình',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 3 tranh: Gieo hạt, Tưới nước, Hái quả.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo thả các tranh vào ô thứ tự 1, 2, 3.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Hình ảnh cây lớn lên khi đặt đúng thứ tự.' },
        ]
      }
    },
    {
      subject_id: 7,
      subject_name: 'Giáo dục công dân',
      icon: '🤝',
      title: 'Quản lý cảm xúc và Ứng xử học đường',
      theme: 'Kỹ năng xã hội',
      description: 'Học cách bình tĩnh và xử lý các tình huống bắt nạt học đường.',
      h1: {
        title: 'Góc bình tĩnh',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực quản lý bản thân',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Màn hình hiện biểu tượng hít thở (vòng tròn giãn nở).' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Hướng dẫn: "Hãy hít vào thật sâu khi vòng tròn to lên".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh nhấn giữ nút cho đến khi vòng tròn đầy.' },
        ]
      },
      h2: {
        title: 'Xử lý tình huống bắt nạt',
        activity_type: 'activity',
        objective: 'Phẩm chất nhân ái, kỹ năng bảo vệ',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'video', description: 'Xem video 1 bạn bị bạn khác trêu chọc.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Hiện 3 nút: A. Báo cô, B. Đánh lại, C. Đứng xem.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Nếu chọn A -> Hiện hình cô giáo đến giúp đỡ.' },
        ]
      }
    },
    {
      subject_id: 8,
      subject_name: 'Tin học',
      icon: '💻',
      title: 'Thiết bị số và An toàn mạng',
      theme: 'Tin học đời sống',
      description: 'Nhận biết các thiết bị đầu vào/đầu ra và học cách bảo mật thông tin cá nhân.',
      h1: {
        title: 'Chọn thiết bị đầu vào',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực tin học cơ bản',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Màn hình hiện Bàn phím, Màn hình, Loa.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Câu hỏi: "Cái nào dùng để gõ chữ?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn hình Bàn phím.' },
        ]
      },
      h2: {
        title: 'Đóng vai an toàn mạng',
        activity_type: 'activity',
        objective: 'Kỹ năng tự bảo vệ không gian số',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Hiện 1 tin nhắn ảo: "Cho mình xin mật khẩu của bạn".' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn nút: "Không cho" hoặc "Báo người lớn".' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Lời khen: "Bạn đã bảo vệ máy tính rất tốt".' },
        ]
      }
    },
    {
      subject_id: 9,
      subject_name: 'Giáo dục thể chất',
      icon: '🏃',
      title: 'Chạy cự li ngắn và Vận động theo nhạc',
      theme: 'Phát triển thể lực',
      description: 'Luyện tập tư thế chạy đúng và tham gia các trò chơi vận động ảo.',
      h1: {
        title: 'So sánh tư thế chạy',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Nhận thức vận động đúng',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 2 hình: Bạn A chạy khom lưng, Bạn B chạy thẳng lưng.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Câu hỏi: "Bạn nào chạy đúng tư thế?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn bạn B.' },
        ]
      },
      h2: {
        title: 'Tập theo nhạc ảo',
        activity_type: 'activity',
        objective: 'Vận động tinh và phối hợp',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Phát nhạc nhịp điệu nhanh.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'animation', description: 'Các điểm sáng hiện trên màn hình theo nhịp.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh lấy tay chạm nhanh vào các điểm sáng khi chúng hiện lên.' },
        ]
      }
    },
    {
      subject_id: 10,
      subject_name: 'Nghệ thuật (Âm nhạc)',
      icon: '🎵',
      title: 'Gõ phách và Nhạc cụ dân tộc',
      theme: 'Âm nhạc truyền thống',
      description: 'Nghe và nhận diện các loại nhạc cụ dân tộc Việt Nam.',
      h1: {
        title: 'Nghe đoán nhạc cụ',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực cảm thụ âm nhạc',
        steps: [
          { step_number: 1, title: 'Âm thanh', content_type: 'audio', description: 'Phát âm thanh tiếng Trống.' },
          { step_number: 2, title: 'Hiển thị', content_type: 'image', description: 'Hiện cái Trống và cái Sáo.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm vào đúng hình cái Trống.' },
        ]
      },
      h2: {
        title: 'Trống ảo theo nhịp',
        activity_type: 'activity',
        objective: 'Kỹ năng giữ nhịp',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'animation', description: 'Học sinh gõ vào mặt trống ảo.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'App hiện các chấm tròn rơi từ trên xuống.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Âm thanh tiếng trống phát ra vang dội khi gõ trúng.' },
        ]
      }
    },
    {
      subject_id: 11,
      subject_name: 'Nghệ thuật (Mĩ thuật)',
      icon: '🎨',
      title: 'Tạo hình, Đường nét and Màu sắc',
      theme: 'Sáng tạo mĩ thuật',
      description: 'Sáng tạo các tác phẩm nghệ thuật qua việc tạo hình gốm and phối màu.',
      h1: {
        title: 'Đổ màu hình vẽ',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Sáng tạo màu sắc',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Bức tranh ngôi nhà có các vùng chưa tô màu.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Học sinh tự chọn màu yêu thích trong bảng palette.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Chạm vào mái nhà, cửa sổ để đổ màu.' },
        ]
      },
      h2: {
        title: 'Tạo hình gốm ảo',
        activity_type: 'activity',
        objective: 'Tư duy hình khối 3D',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Hiện một khối đất sét trên bàn xoay.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh vuốt ngón tay để kéo đất sét cao lên hoặc phình to ra.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Khối đất sét biến dạng theo đúng hướng vuốt tay.' },
        ]
      }
    },
    {
      subject_id: 12,
      subject_name: 'Giáo dục Địa phương',
      icon: '🍊',
      title: 'Đặc sản Đồng Nai',
      theme: 'Sản vật địa phương',
      description: 'Nhận biết and tìm hiểu về các loại bưởi, sầu riêng đặc sản vùng Đồng Nai.',
      h1: {
        title: 'Tìm bưởi Tân Triều',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Hiểu biết đặc sản quê hương',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện Sầu riêng, Bưởi, Nhãn.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Yêu cầu: "Tìm cho cô hình Bưởi Tân Triều".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn hình quả Bưởi.' },
        ]
      },
      h2: {
        title: 'Video tương tác',
        activity_type: 'activity',
        objective: 'Kỹ năng quan sát địa điểm',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'video', description: 'Xem clip giới thiệu về vườn bưởi Đồng Nai.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Đến đoạn hái bưởi, video dừng lại.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'selection', description: 'Hiện 2 nút: A. Bưởi chín (màu vàng), B. Bưởi xanh. Chọn A.' },
        ]
      }
    },
    {
      subject_id: 13,
      subject_name: 'HĐ Trải nghiệm, Hướng nghiệp',
      icon: '🧩',
      title: 'Soạn cặp sách and Chi tiêu cá nhân',
      theme: 'Tự lập and Tài chính',
      description: 'Học cách tự chuẩn bị đồ dùng học tập and quản lý tiền tiết kiệm ảo.',
      h1: {
        title: 'Soạn cặp sách',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Kỹ năng tự phục vụ',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện cái Balo and các cuốn sách: Toán, Văn, Đồ chơi.' },
          { step_number: 2, title: 'Yêu cầu', content_type: 'audio', description: 'Âm thanh: "Hãy soạn sách đi học, không lấy đồ chơi".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo sách Toán, Văn vào Balo.' },
        ]
      },
      h2: {
        title: 'Chi tiêu cá nhân ảo',
        activity_type: 'activity',
        objective: 'Kỹ năng quản lý tài chính cơ bản',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Em có 10 xu.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo 2 xu vào heo đất, 1 xu mua kẹo.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Heo đất phát âm thanh vui tai khi nhận tiền.' },
        ]
      }
    }
  ],
  nhe: [
    {
      subject_id: 1,
      subject_name: 'Ngữ văn',
      icon: '📚',
      title: 'Mức nhẹ - Truyện ngụ ngôn và Tục ngữ',
      theme: 'Truyện ngụ ngôn, tục ngữ',
      description: 'Tiếp cận sâu hơn vào nội dung truyện qua sơ đồ tư duy và luyện nói với AI.',
      h1: {
        title: 'Sơ đồ tư duy điền khuyết',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Năng lực tổng hợp thông tin',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện sơ đồ cốt truyện. Kéo thả các ảnh hoặc từ khóa sự việc vào đúng nhánh trống.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh hướng dẫn: "Kéo sự việc mở đầu vào ô số 1".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh kéo thả từ khóa vào nhánh sơ đồ.' },
        ]
      },
      h2: {
        title: 'Kể chuyện qua Voice-to-Text',
        activity_type: 'activity',
        objective: 'Kỹ năng diễn đạt và rút ra bài học',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'App hiện câu hỏi mồi: "Bài học rút ra là gì?".' },
          { step_number: 2, title: 'Tương tác', content_type: 'voice', description: 'Học sinh bấm micro trả lời (Ví dụ: "Kiên trì sẽ thành công").' },
          { step_number: 3, title: 'Phản hồi', content_type: 'text', description: 'App chuyển thành văn bản hiển thị lên màn hình và tặng lời khen.' },
        ]
      }
    },
    {
      subject_id: 2,
      subject_name: 'Toán học',
      icon: '🔢',
      title: 'Mức nhẹ - Số hữu tỉ, tỉ lệ và Lăng trụ đứng',
      theme: 'Toán học ứng dụng',
      description: 'Giải quyết các bài toán phức tạp hơn qua hướng dẫn từng bước và mô hình 3D.',
      h1: {
        title: 'Bài toán Step-by-step',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực giải quyết vấn đề',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'text', description: 'Hiện đề bài có tô màu từ khóa quan trọng.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'App gợi ý phép tính: "Chúng ta cần thực hiện phép cộng hay trừ?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn phép tính và điền số vào ô trống.' },
        ]
      },
      h2: {
        title: 'Tương tác 3D hình khối',
        activity_type: 'activity',
        objective: 'Phát triển tư duy không gian 3D',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Hiện khối lăng trụ đứng 3D có thể xoay 360 độ.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh dùng tay xoay khối rồi chạm vào các đỉnh.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'App tự động đếm số đỉnh khi học sinh chạm vào.' },
        ]
      }
    },
    {
      subject_id: 3,
      subject_name: 'Tiếng Anh',
      icon: '🔤',
      title: 'Mức nhẹ - Health, Traffic and Festival',
      theme: 'Giao tiếp Tiếng Anh',
      description: 'Luyện tập giao tiếp tiếng Anh cơ bản và nghe hiểu trong các tình huống thực tế.',
      h1: {
        title: 'Listen and Choose - Festival',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực nghe hiểu nâng cao',
        steps: [
          { step_number: 1, title: 'Âm thanh', content_type: 'audio', description: 'App đọc từ "Festival".' },
          { step_number: 2, title: 'Hiển thị', content_type: 'image', description: 'Hiện 3 hình ảnh: Lễ hội, Bệnh viện, Giao thông.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh vuốt sang để tìm đúng hình Lễ hội.' },
        ]
      },
      h2: {
        title: 'Đóng vai hội thoại (Role-play AI)',
        activity_type: 'activity',
        objective: 'Kỹ năng giao tiếp và phản xạ ngôn ngữ',
        steps: [
          { step_number: 1, title: 'Âm thanh', content_type: 'audio', description: 'AI hỏi: "How are you?".' },
          { step_number: 2, title: 'Tương tác', content_type: 'voice', description: 'Học sinh bấm micro trả lời: "I am fine".' },
          { step_number: 3, title: 'Phản hồi', content_type: 'ai_feedback', description: 'AI nhận diện giọng nói và chấm sao cho phát âm.' },
        ]
      }
    },
    {
      subject_id: 4,
      subject_name: 'Khoa học tự nhiên',
      icon: '🔬',
      title: 'Mức nhẹ - Nguyên tử, Ánh sáng và Từ tính',
      theme: 'Khoa học thực nghiệm',
      description: 'Tìm hiểu cấu tạo nguyên tử và các tính chất vật lý qua mô phỏng 3D.',
      h1: {
        title: 'Thực nghiệm ảo nam châm',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Năng lực tìm tòi, khám phá thế giới tự nhiên',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện thanh Nam châm cùng đinh sắt và cục gỗ.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo Nam châm lại gần các vật.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Quan sát vật nào bị hút và giải thích (có âm thanh giải thích).' },
        ]
      },
      h2: {
        title: 'Sắp xếp vòng nguyên tử',
        activity_type: 'activity',
        objective: 'Tư duy trừu tượng hóa mô hình',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Hiện hạt nhân nguyên tử ở giữa.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo các hạt electron vào đúng các quỹ đạo vòng ngoài.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Nguyên tử phát sáng khi các hạt được đặt đúng vị trí.' },
        ]
      }
    },
    {
      subject_id: 5,
      subject_name: 'Lịch sử - Địa lí',
      icon: '🌦️',
      title: 'Mức nhẹ - Châu lục và Phát kiến địa lí',
      theme: 'Địa lý và Lịch sử thế giới',
      description: 'Định vị địa lý trên bản đồ 3D và tìm hiểu các mốc lịch sử thám hiểm.',
      h1: {
        title: 'Định vị bản đồ',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Kỹ năng sử dụng bản đồ số',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Hiện quả địa cầu xoay tròn.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Hỏi: "Châu Mỹ nằm ở đâu?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chạm vào đúng vùng đất đó trên bản đồ 3D.' },
        ]
      },
      h2: {
        title: 'Dòng thời gian (Timeline)',
        activity_type: 'activity',
        objective: 'Năng lực tư duy lịch sử theo trình tự',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện các mốc thời gian trống.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo thả hình ảnh tàu thuyền thám hiểm vào đúng mốc năm.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'text', description: 'App hiện thông tin tóm tắt về cuộc phát kiến đó.' },
        ]
      }
    },
    {
      subject_id: 6,
      subject_name: 'Công nghệ',
      icon: '⚙️',
      title: 'Mức nhẹ - Quy trình Trồng trọt và Vật nuôi',
      theme: 'Nông nghiệp công nghệ',
      description: 'Tìm hiểu quy trình trồng trọt và phân loại các nhóm vật nuôi nông nghiệp.',
      h1: {
        title: 'Sắp xếp quy trình',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Tư duy quy trình công nghệ',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 3 ô trống và các tranh: Làm đất, Gieo hạt, Thu hoạch.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Âm thanh: "Đầu tiên chúng ta phải làm gì?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Kéo thả tranh theo thứ tự đúng.' },
        ]
      },
      h2: {
        title: 'Phân loại nông nghiệp',
        activity_type: 'activity',
        objective: 'Kỹ năng phân tích và nhóm sự vật',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 2 ô: Gia súc và Gia cầm.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo Con Bò, Con Heo vào "Gia súc"; Gà, Vịt vào "Gia cầm".' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Tiếng con vật vang lên khi học sinh phân loại đúng.' },
        ]
      }
    },
    {
      subject_id: 7,
      subject_name: 'Giáo dục công dân',
      icon: '🤝',
      title: 'Mức nhẹ - Tự hào truyền thống và Bạo lực học đường',
      theme: 'Đạo đức và Kỹ năng sống',
      description: 'Học cách xử lý tình huống thực tế và quản lý tài chính cá nhân đơn giản.',
      h1: {
        title: 'Video tình huống (A/B)',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực giải quyết vấn đề xã hội',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'video', description: 'Xem clip ngắn bạn bị bắt nạt.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Chọn A. Báo cô giáo hoặc B. Đứng xem.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Cảnh báo/Khen ngợi dựa trên lựa chọn của học sinh.' },
        ]
      },
      h2: {
        title: 'Quản lý tài chính ảo',
        activity_type: 'activity',
        objective: 'Năng lực quản lý bản thân và tài chính',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Nhân vật có 20 xu.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo phân bổ tiền vào "Lọ tiết kiệm" và "Mua sắm".' },
          { step_number: 3, title: 'Phản hồi', content_type: 'text', description: 'App giải thích ý nghĩa của việc tiết kiệm.' },
        ]
      }
    },
    {
      subject_id: 8,
      subject_name: 'Tin học',
      icon: '💻',
      title: 'Mức nhẹ - Phần mềm Bảng tính và Trình chiếu',
      theme: 'Kỹ năng phần mềm',
      description: 'Làm quen với các thao tác cơ bản trong Excel và PowerPoint qua mô phỏng.',
      h1: {
        title: 'Mô phỏng Excel',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Làm quen với dữ liệu số',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện bảng tính đơn giản.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo thả hàm SUM vào cột tổng tiền để tính tự động.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Kết quả hiện ra kèm tiếng vỗ tay.' },
        ]
      },
      h2: {
        title: 'Tạo Slide nhanh (Templates)',
        activity_type: 'activity',
        objective: 'Kỹ năng thiết kế sản phẩm số cơ bản',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Chọn một khung slide có sẵn.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo ảnh cá nhân vào slide và nhập tiêu đề ngắn.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Slide hiện lên đẹp mắt với hiệu ứng chuyển trang.' },
        ]
      }
    },
    {
      subject_id: 9,
      subject_name: 'Giáo dục thể chất',
      icon: '🏃',
      title: 'Mức nhẹ - Thể dục nhịp điệu và Chạy cự li ngắn',
      theme: 'Phát triển thể chất nâng cao',
      description: 'Luyện tập các động tác thể dục theo nhịp điệu và tư thế chạy chuyên nghiệp.',
      h1: {
        title: 'Chọn tư thế chạy đúng',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Nhận thức vận động',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện 2 hình ảnh chạy đúng và sai tư thế.' },
          { step_number: 2, title: 'Âm thanh', content_type: 'audio', description: 'Câu hỏi: "Đâu là tư thế chạy giúp em không bị đau lưng?".' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh click chọn hình ảnh đúng.' },
        ]
      },
      h2: {
        title: 'AR Camera - Tập theo nhạc',
        activity_type: 'activity',
        objective: 'Vận động thô và phối hợp đa giác quan',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'ai_camera', description: 'Bật camera trước, màn hình hiện các vòng tròn ảo.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'animation', description: 'Phát nhạc nhịp điệu.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh vung tay đập vỡ vòng tròn theo nhịp điệu.' },
        ]
      }
    },
    {
      subject_id: 10,
      subject_name: 'Nghệ thuật (Âm nhạc)',
      icon: '🎵',
      title: 'Mức nhẹ - Nhịp điệu và Nhạc cụ dân tộc',
      theme: 'Cảm thụ âm nhạc nâng cao',
      description: 'Khám phá âm thanh của các nhạc cụ truyền thống và luyện tập giữ nhịp.',
      h1: {
        title: 'Nghe và đoán nhạc cụ',
        activity_type: 'exercise',
        interaction_type: 'selection',
        objective: 'Năng lực cảm thụ và nhận diện âm thanh',
        steps: [
          { step_number: 1, title: 'Âm thanh', content_type: 'audio', description: 'Phát âm thanh tiếng Sáo trúc hoặc Đàn bầu.' },
          { step_number: 2, title: 'Hiển thị', content_type: 'image', description: 'Hiện 3 hình nhạc cụ dân tộc.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Học sinh chọn đúng hình nhạc cụ vừa nghe.' },
        ]
      },
      h2: {
        title: 'Đệm hát (Virtual Drum/Piano)',
        activity_type: 'activity',
        objective: 'Kỹ năng giữ nhịp điệu đa dạng',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Nhạc phát, các nốt sáng chạy từ trên xuống.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Chạm ngón tay đúng lúc nốt chạm đích để gõ phách.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Hiệu ứng pháo hoa khi học sinh gõ trúng liên tiếp.' },
        ]
      }
    },
    {
      subject_id: 11,
      subject_name: 'Nghệ thuật (Mĩ thuật)',
      icon: '🎨',
      title: 'Mức nhẹ - Màu sắc, Bố cục và Tạo hình 3D',
      theme: 'Sáng tạo mĩ thuật ứng dụng',
      description: 'Thiết kế các sản phẩm mĩ thuật số với bố cục và màu sắc hài hòa.',
      h1: {
        title: 'Tô mảng màu (Fill Color)',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Năng lực thẩm mĩ và phối màu',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện tranh nét viền dày, chia mảng rõ ràng.' },
          { step_number: 2, title: 'Nội dung chính', content_type: 'image', description: 'Bảng màu đa dạng hơn.' },
          { step_number: 3, title: 'Tương tác', content_type: 'interaction', description: 'Chọn màu phù hợp và chạm để đổ màu kín vùng trống.' },
        ]
      },
      h2: {
        title: 'Thiết kế thiệp điện tử',
        activity_type: 'activity',
        objective: 'Năng lực thiết kế và tư duy bố cục',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Cung cấp kho hình nền và sticker đa dạng.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo thả dán sticker để trang trí thiệp.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Tấm thiệp hoàn chỉnh có thể gửi đi (ảo).' },
        ]
      }
    },
    {
      subject_id: 12,
      subject_name: 'Giáo dục Địa phương',
      icon: '🍊',
      title: 'Mức nhẹ - Đặc sản và Kiến trúc Đồng Nai',
      theme: 'Tìm hiểu quê hương Đồng Nai',
      description: 'Khám phá các địa danh lịch sử và đặc sản nổi tiếng của Đồng Nai qua flashcard.',
      h1: {
        title: 'Flashcard lật mở',
        activity_type: 'exercise',
        interaction_type: 'touch',
        objective: 'Hiểu biết di sản văn hóa địa phương',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện hình Văn miếu Trấn Biên và Gốm Biên Hòa.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Chạm để lật xem thông tin ngắn gọn về địa danh.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'Giọng đọc thông tin lịch sử của địa danh.' },
        ]
      },
      h2: {
        title: 'Video tương tác địa phương',
        activity_type: 'activity',
        objective: 'Kỹ năng quan sát và trả lời câu hỏi',
        steps: [
          { step_number: 1, title: 'Nội dung chính', content_type: 'video', description: 'Xem clip giới thiệu địa danh 10 giây.' },
          { step_number: 2, title: 'Tương tác', content_type: 'voice', description: 'App hỏi: "Đây là đâu?". Học sinh bấm thu âm trả lời.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'ai_feedback', description: 'AI nhận diện và xác nhận câu trả lời.' },
        ]
      }
    },
    {
      subject_id: 13,
      subject_name: 'HĐ Trải nghiệm, Hướng nghiệp',
      icon: '🧩',
      title: 'Mức nhẹ - Quản lý đồ dùng và Kế hoạch cá nhân',
      theme: 'Kỹ năng sống nâng cao',
      description: 'Luyện tập kỹ năng tự chuẩn bị và lên kế hoạch cho các hoạt động cá nhân.',
      h1: {
        title: 'Soạn cặp sách (Time management)',
        activity_type: 'exercise',
        interaction_type: 'drag',
        objective: 'Kỹ năng quản lý thời gian và đồ dùng',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'image', description: 'Hiện thời khóa biểu bằng hình ảnh.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo đúng cuốn sách tương ứng vào balo ảo.' },
          { step_number: 3, title: 'Phản hồi', content_type: 'animation', description: 'Balo đóng lại khi đã soạn đủ sách.' },
        ]
      },
      h2: {
        title: 'Chi tiêu cá nhân (ảo)',
        activity_type: 'activity',
        objective: 'Năng lực ra quyết định tài chính',
        steps: [
          { step_number: 1, title: 'Hiển thị', content_type: 'animation', description: 'Em có 20 xu.' },
          { step_number: 2, title: 'Tương tác', content_type: 'interaction', description: 'Kéo xu vào "Heo đất tiết kiệm" hoặc "Mua kẹo".' },
          { step_number: 3, title: 'Phản hồi', content_type: 'audio', description: 'App giải thích hậu quả của việc chi tiêu hết tiền.' },
        ]
      }
    }
  ]
};
