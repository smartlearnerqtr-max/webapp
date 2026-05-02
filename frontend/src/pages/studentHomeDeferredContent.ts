import type { LessonActivityItem } from '../services/api'
import type { StudentEntryLevelKey, StudentGameActivityType } from './studentHomeMeta'

type DemoGameCard = {
  id: string
  label: string
  media_url: string
  media_kind: string
}

export type CommunicationCard = {
  label: string
  phrase: string
  tone: string
  icon: string
  imageUrl: string
}

export type CareerDetailStep = {
  title: string
  description: string
}

export type CareerDetailMeta = {
  key: string
  title: string
  description: string
  coverImageUrl: string
  meaningTitle: string
  meaningText: string
  videoEmbedUrl: string
  videoNote: string
  steps: CareerDetailStep[]
  skills: string[]
  levels: StudentEntryLevelKey[]
}

const demoGameCards: DemoGameCard[] = [
  { id: 'dog', label: 'Con chó', media_url: '/demo-media/concho.jpg', media_kind: 'image' },
  { id: 'cat', label: 'Con mèo', media_url: '/demo-media/conmeo.jpg', media_kind: 'image' },
  { id: 'fish', label: 'Con cá', media_url: '/demo-media/conca.jpg', media_kind: 'image' },
  { id: 'tiger', label: 'Con hổ', media_url: '/demo-media/conho.webp', media_kind: 'image' },
  { id: 'rabbit', label: 'Con thỏ', media_url: '/demo-media/contho.png', media_kind: 'image' },
]

const communicationCards: CommunicationCard[] = [
  { label: 'Đói', phrase: 'Con đói', tone: 'warm', icon: '🍽️', imageUrl: '/ichan/communication/doi.jpg' },
  { label: 'Khát', phrase: 'Con khát', tone: 'sky', icon: '🥤', imageUrl: '/ichan/communication/khat_nuoc.jpg' },
  { label: 'Đi vệ sinh', phrase: 'Con muốn đi vệ sinh', tone: 'mint', icon: '🚻', imageUrl: '/ichan/communication/di_ve_sinh.png' },
  { label: 'Vui', phrase: 'Con đang vui', tone: 'gold', icon: '😊', imageUrl: '/ichan/communication/vui.jpg' },
  { label: 'Buồn', phrase: 'Con đang buồn', tone: 'rose', icon: '😢', imageUrl: '/ichan/communication/buon.jpg' },
  { label: 'Mệt', phrase: 'Con thấy mệt', tone: 'peach', icon: '😴', imageUrl: '/ichan/communication/met.jpg' },
  { label: 'Chào', phrase: 'Con chào cô', tone: 'indigo', icon: '👋', imageUrl: '/ichan/communication/chao.jpg' },
  { label: 'Cảm ơn', phrase: 'Con cảm ơn', tone: 'green', icon: '🙏', imageUrl: '/ichan/communication/cam_on.jpg' },
]

const aiPromptCards = [
  'Con muốn hỏi bài này làm thế nào?',
  'Con thích vẽ thì có nghề gì phù hợp?',
  'Cô ơi, nhắc con từng bước thật ngắn nhé.',
  'Con muốn luyện nói câu chào lễ phép.',
]

const careerPreviewCards: CareerDetailMeta[] = [
  {
    key: 'lam-vuon',
    title: 'Làm vườn',
    description: 'Chia việc thành từng bước ngắn, rõ ràng, dễ bắt chước.',
    coverImageUrl: '/demo-media/rừng.jpg',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText:
      'Làm vườn giúp em có đôi tay khéo léo và cơ thể khỏe mạnh hơn mỗi ngày. Khi em chăm sóc cây, em đang mang lại màu xanh xinh đẹp và niềm vui cho mọi người xung quanh.',
    videoEmbedUrl: 'https://www.youtube.com/embed/km_3E1HaOSs?rel=0&playsinline=1',
    videoNote: 'Video này giúp bạn hiểu tại sao công việc này lại quan trọng và mang lại niềm vui cho mọi người!',
    steps: [
      { title: 'Chuẩn bị bình tưới', description: 'Lấy nước đầy bình.' },
      { title: 'Tưới gốc cây', description: 'Tưới nhẹ nhàng vào gốc.' },
      { title: 'Cất bình', description: 'Để bình lại chỗ cũ.' },
    ],
    skills: ['Tưới nước', 'Nhận biết cây', 'Giữ nề nếp', 'Quan sát'],
    levels: ['nhe'],
  },
  {
    key: 'sap-xep-do-dung',
    title: 'Sắp xếp đồ dùng',
    description: 'Rèn quan sát, phân loại, và hoàn thành theo trình tự.',
    coverImageUrl: '/demo-media/nha.webp',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText:
      'Sắp xếp đồ dùng giúp em biết giữ mọi thứ gọn gàng và dễ tìm hơn. Khi em phân loại đúng chỗ, em đang rèn tính cẩn thận và giúp không gian xung quanh ngăn nắp hơn.',
    videoEmbedUrl: 'https://www.youtube.com/embed/km_3E1HaOSs?rel=0&playsinline=1',
    videoNote: 'Video minh họa cách làm việc theo thứ tự từng bước, dễ quan sát và dễ bắt chước.',
    steps: [
      { title: 'Nhìn các đồ vật', description: 'Xem có những món nào cần cất.' },
      { title: 'Phân loại', description: 'Đặt các món giống nhau vào cùng một nhóm.' },
      { title: 'Để đúng chỗ', description: 'Cất từng nhóm vào vị trí phù hợp.' },
    ],
    skills: ['Phân loại', 'Ngăn nắp', 'Quan sát', 'Ghi nhớ vị trí'],
    levels: ['nhe'],
  },
  {
    key: 'cham-soc-cay',
    title: 'Chăm sóc cây',
    description: 'Kết hợp vận động nhẹ, ghi nhớ, và nề nếp hằng ngày.',
    coverImageUrl: '/demo-media/dongco.jpg',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText:
      'Chăm sóc cây giúp em học cách kiên nhẫn và biết quan tâm đến những điều nhỏ bé. Mỗi lần em tưới cây hay lau lá, em đang luyện thói quen chăm sóc và giữ môi trường xanh sạch hơn.',
    videoEmbedUrl: 'https://www.youtube.com/embed/km_3E1HaOSs?rel=0&playsinline=1',
    videoNote: 'Video cho em thấy công việc chăm sóc cây có thể nhẹ nhàng, vui và rất gần gũi mỗi ngày.',
    steps: [
      { title: 'Kiểm tra cây', description: 'Nhìn lá và đất để biết cây cần gì.' },
      { title: 'Tưới hoặc lau lá', description: 'Chăm nhẹ nhàng để cây sạch và đủ nước.' },
      { title: 'Dọn khu vực quanh chậu', description: 'Giữ chỗ để cây luôn sạch sẽ.' },
    ],
    skills: ['Kiên nhẫn', 'Chăm sóc cây', 'Giữ sạch sẽ', 'Quan sát thay đổi'],
    levels: ['nhe'],
  },
]

export function loadCommunicationCards() {
  return communicationCards
}

export function loadAiPromptCards() {
  return aiPromptCards
}

export function loadCareerPreviewCards() {
  return careerPreviewCards
}

export function buildStandaloneGameActivity(activityType: StudentGameActivityType): LessonActivityItem {
  const gameConfigs: Record<StudentGameActivityType, { id: number; title: string; config: Record<string, unknown> }> = {
    memory_match: {
      id: -101,
      title: 'Lật thẻ ghi nhớ',
      config: {
        kind: 'memory_match',
        prompt: 'Lật 2 thẻ giống nhau để ghi điểm.',
        pair_count: 5,
        image_cards: demoGameCards,
      },
    },
    quick_tap: {
      id: -102,
      title: 'Chạm đúng nhanh',
      config: {
        kind: 'quick_tap',
        prompt: 'Chạm nhanh vào các thẻ con vật trước khi hết giờ.',
        duration_seconds: 10,
        target_hits: 6,
        simultaneous_cards: 4,
        image_cards: demoGameCards,
      },
    },
    drag_drop: {
      id: -103,
      title: 'Phân loại cảm xúc',
      config: {
        kind: 'drag_drop',
        prompt: 'Kéo từng khuôn mặt vào đúng giỏ cảm xúc.',
        items: ['😀 Mặt vui', '😢 Mặt buồn', '😠 Mặt tức giận'],
        targets: ['Giỏ vui', 'Giỏ buồn', 'Giỏ tức giận'],
      },
    },
    image_puzzle: {
      id: -104,
      title: 'Xếp hình di tích',
      config: {
        kind: 'image_puzzle',
        prompt: 'Ghép 4 mảnh để hoàn thành bức ảnh di tích.',
        image_url: '/demo-media/nha.webp',
        rows: 2,
        cols: 2,
        piece_count: 4,
      },
    },
    basket_toss: {
      id: -105,
      title: 'Bắt bóng rổ',
      config: {
        kind: 'basket_toss',
        prompt: 'Vuốt tay trên quả bóng để ném vào rổ to.',
        target_shots: 5,
      },
    },
    trash_cleanup: {
      id: -106,
      title: 'Siêu nhân dọn rác',
      config: {
        kind: 'trash_cleanup',
        prompt: 'Chạm vào vỏ chuối, bịch nilon và các món rác để đưa vào thùng.',
        trash_icons: ['🍌', '🛍️', '🧃', '📰', '🥤', '🧴'],
        target_count: 6,
      },
    },
  }

  const selectedGame = gameConfigs[activityType]
  return {
    id: selectedGame.id,
    lesson_id: 0,
    title: selectedGame.title,
    activity_type: activityType,
    instruction_text: String(selectedGame.config.prompt ?? ''),
    voice_answer_enabled: false,
    is_required: true,
    sort_order: 1,
    difficulty_stage: 1,
    config_json: JSON.stringify(selectedGame.config),
  }
}
