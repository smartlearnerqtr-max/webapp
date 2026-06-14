export type StudentPanelKey = 'learning' | 'ai' | 'communication' | 'settings'

export type StudentEntryLevelKey = 'nang' | 'trung_binh' | 'nhe'

export type StudentSubjectMeta = {
  key: string
  label: string
  artworkUrl: string
  aliases: string[]
  comingSoon?: boolean
}

export type StudentGameActivityType =
  | 'memory_match'
  | 'quick_tap'
  | 'drag_drop'
  | 'image_puzzle'
  | 'basket_toss'
  | 'trash_cleanup'

export type StudentGameMeta = {
  key: string
  label: string
  description: string
  activityType: StudentGameActivityType
  artworkUrl: string
  levels: StudentEntryLevelKey[]
}

export const studentTabCopyMap: Record<StudentPanelKey, { title: string; description: string }> = {
  learning: {
    title: 'Chọn môn học và bài phù hợp hôm nay',
    description: '',
  },
  ai: {
    title: 'Bạn học AI luôn nghe và trả lời ngắn gọn',
    description: 'Dùng micro hoặc câu hỏi mẫu để xin gợi ý, luyện nói, và nhận hỗ trợ từng bước.',
  },
  communication: {
    title: 'Thẻ giao tiếp hằng ngày',
    description: 'Chạm vào thẻ để phát âm nhanh nhu cầu, cảm xúc, hoặc lời chào cơ bản.',
  },
  settings: {
    title: 'Cài đặt và kết nối lớp học',
    description: 'Xem nhanh tiến độ, nhắc việc, giáo viên đồng hành, và thêm lớp mới tại đây.',
  },
}

export const studentSubjectCatalog: StudentSubjectMeta[] = [
  { key: 'toan-hoc', label: 'Toán học', artworkUrl: '/ichan/subjects/toan-hoc.jpg', aliases: ['toan hoc', 'so hoc', 'toan'] },
  { key: 'ngu-van', label: 'Ngữ văn', artworkUrl: '/ichan/subjects/ngu-van.jpg', aliases: ['ngu van', 'van hoc', 'van'] },
  { key: 'tieng-anh', label: 'Tiếng Anh', artworkUrl: '/ichan/subjects/tieng-anh.jpg', aliases: ['tieng anh', 'english', 'anh van'] },
  {
    key: 'khoa-hoc-tu-nhien',
    label: 'Khoa học tự nhiên',
    artworkUrl: '/ichan/subjects/khoa-hoc-tu-nhien.jpg',
    aliases: ['khoa hoc tu nhien', 'khtn', 'dong vat', 'thuc vat'],
  },
  { key: 'cong-nghe', label: 'Công nghệ', artworkUrl: '/ichan/subjects/cong-nghe.jpg', aliases: ['cong nghe', 'ky thuat'] },
  { key: 'tin-hoc', label: 'Tin học', artworkUrl: '/ichan/subjects/tin-hoc.jpg', aliases: ['tin hoc', 'may tinh'], comingSoon: true },
  {
    key: 'lich-su-dia-ly',
    label: 'Lịch sử - Địa lý',
    artworkUrl: '/ichan/subjects/lich-su-dia-ly.jpg',
    aliases: ['lich su dia ly', 'lich su', 'dia ly', 'viet nam'],
  },
  {
    key: 'giao-duc-cong-dan',
    label: 'Giáo dục công dân',
    artworkUrl: '/ichan/subjects/giao-duc-cong-dan.jpg',
    aliases: ['giao duc cong dan', 'gdcd', 'cong dan'],
  },
  {
    key: 'giao-duc-dia-phuong',
    label: 'Giáo dục địa phương',
    artworkUrl: '/ichan/subjects/giao-duc-dia-phuong.jpg',
    aliases: ['giao duc dia phuong', 'dia phuong'],
    comingSoon: true,
  },
  {
    key: 'hoat-dong-trai-nghiem',
    label: 'Hoạt động trải nghiệm',
    artworkUrl: '/ichan/subjects/hoat-dong-trai-nghiem.jpg',
    aliases: ['hoat dong trai nghiem', 'trai nghiem'],
    comingSoon: true,
  },
  { key: 'ky-nang-song', label: 'Kỹ năng sống', artworkUrl: '/ichan/subjects/ky-nang-song.jpg', aliases: ['ky nang song', 'tu phuc vu', 'giao tiep lich su'] },
  { key: 'my-thuat', label: 'Mỹ thuật', artworkUrl: '/ichan/subjects/my-thuat.jpg', aliases: ['my thuat', 've', 've tranh'] },
  { key: 'am-nhac', label: 'Âm nhạc', artworkUrl: '/ichan/subjects/am-nhac.jpg', aliases: ['am nhac', 'hat'], comingSoon: true },
]

export const studentGameCatalog: StudentGameMeta[] = [
  {
    key: 'memory-match',
    label: 'Lật thẻ ghi nhớ',
    description: 'Lật đúng 2 thẻ giống nhau để ghi điểm.',
    activityType: 'memory_match',
    artworkUrl: '/ichan/games/cat-card.svg',
    levels: ['nhe'],
  },
  {
    key: 'quick-tap',
    label: 'Chạm đúng nhanh',
    description: 'Chạm thật nhanh vào thẻ mục tiêu trước khi hết giờ.',
    activityType: 'quick_tap',
    artworkUrl: '/ichan/games/swipe-dog-card.svg',
    levels: ['nhe'],
  },
  {
    key: 'emotion-sort',
    label: 'Phân loại cảm xúc',
    description: 'Phân loại khuôn mặt vui, buồn, tức giận vào đúng giỏ.',
    activityType: 'drag_drop',
    artworkUrl: '/ichan/communication/vui.jpg',
    levels: ['trung_binh'],
  },
  {
    key: 'heritage-puzzle',
    label: 'Xếp hình di tích',
    description: 'Ghép 4 mảnh để hoàn thành bức ảnh di tích.',
    activityType: 'image_puzzle',
    artworkUrl: '/ichan/subjects/lich-su-dia-ly.jpg',
    levels: ['trung_binh'],
  },
  {
    key: 'basket-toss',
    label: 'Bắt bóng rổ',
    description: 'Vuốt tay trên quả bóng để ném vào rổ to.',
    activityType: 'basket_toss',
    artworkUrl: '/student-ui/anh2.jpg',
    levels: ['nang'],
  },
  {
    key: 'trash-cleanup',
    label: 'Siêu nhân dọn rác',
    description: 'Chạm vào rác để đưa vào thùng và làm sạch màn hình.',
    activityType: 'trash_cleanup',
    artworkUrl: '/student-ui/cayxanh.jpg',
    levels: ['nang'],
  },
]

export const studentEntryOptions: Array<{ key: StudentEntryLevelKey; title: string; subtitle: string }> = [
  { key: 'nang', title: 'MỨC ĐỘ NẶNG', subtitle: 'Hình ảnh & Âm thanh' },
  { key: 'trung_binh', title: 'MỨC ĐỘ TRUNG BÌNH', subtitle: 'Sơ đồ tư duy' },
  { key: 'nhe', title: 'MỨC ĐỘ NHẸ', subtitle: 'Lộ trình chuẩn' },
]

export const studentLevelLabelMap: Record<StudentEntryLevelKey, string> = {
  nhe: 'Nhẹ',
  trung_binh: 'Trung bình',
  nang: 'Nặng',
}
