import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { RequireAuth } from '../components/RequireAuth'
import { ActivityCard } from '../components/activities/ActivityRenderer'
import {
  createLesson,
  createLessonActivity,
  deleteLessonActivity,
  deleteLesson,
  fetchLesson,
  fetchLessons,
  fetchSubjects,
  type SubjectItem,
  updateLesson,
  updateLessonActivity,
  uploadLessonMedia,
} from '../services/api'
import { useAuthStore } from '../store/authStore'

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

type MediaSource = 'external' | 'upload'
type WatchAnswerMode = 'text' | 'voice_ai_grade' | 'none'

type PairItem = {
  left: string
  right: string
}

type AacImageDraft = {
  label: string
  file: File | null
}

type MemoryMatchCardDraft = {
  label: string
  file: File | null
}

type HabitatOptionDraft = {
  id: string
  label: string
}

type HabitatAnimalDraft = {
  label: string
  file: File | null
  habitatId: string
}

type LessonLevel = 'nhe' | 'trung_binh' | 'nang'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nặng' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nhe', label: 'Nhẹ' },
]

const RETIRED_ACTIVITY_TYPES = new Set<string>(['matching', 'step_by_step', 'career_simulation', 'ai_chat', 'drag_drop', 'listen_choose'])

const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string; description: string }> = ([
  { value: 'memory_match', label: 'Lật thẻ ghi nhớ', description: '10 thẻ / 5 cặp' },
  { value: 'quick_tap', label: 'Chạm đúng nhanh', description: '10 giây phản xạ' },
  { value: 'size_order', label: 'Sắp xếp lớn nhỏ', description: 'Xếp theo thứ tự' },
  { value: 'habitat_match', label: 'Ghép nơi sống', description: 'Ảnh + nơi sống' },
  { value: 'multiple_choice', label: 'Chọn đáp án', description: '4 đáp án' },
  { value: 'image_choice', label: 'Nhìn ảnh chọn', description: 'Ảnh + đáp án' },
  { value: 'image_puzzle', label: 'Ghép ảnh', description: 'Cắt mảnh' },
  { value: 'matching', label: 'Nối cặp', description: 'Ghép đôi' },
  { value: 'drag_drop', label: 'Kéo thả', description: 'Phân loại' },
  { value: 'listen_choose', label: 'Nghe chọn', description: 'Audio ngắn' },
  { value: 'watch_answer', label: 'Xem trả lời', description: 'Ảnh/video' },
  { value: 'hidden_image_guess', label: 'Đoán hình', description: 'Mở ô' },
  { value: 'step_by_step', label: 'Từng bước', description: 'Checklist' },
  { value: 'aac', label: 'Thẻ chọn', description: 'Giao tiếp' },
  { value: 'career_simulation', label: 'Tình huống', description: 'Đóng vai' },
  { value: 'ai_chat', label: 'Chat AI', description: 'Hỏi đáp' },
] as Array<{ value: ActivityType; label: string; description: string }>).filter((item) => !RETIRED_ACTIVITY_TYPES.has(item.value))

const CHOICE_SLOT_LABELS = ['A', 'B', 'C', 'D']

function createDefaultChoiceOptions() {
  return ['', '', '', '']
}

function createDefaultPairs(): PairItem[] {
  return [
    { left: '', right: '' },
    { left: '', right: '' },
  ]
}

function createDefaultList(count = 3) {
  return Array.from({ length: count }, () => '')
}

function createDefaultAacImageDrafts(): AacImageDraft[] {
  return Array.from({ length: 4 }, (_, index) => ({
    label: `Đáp án ${index + 1}`,
    file: null,
  }))
}

function createDefaultMemoryMatchCardDrafts(): MemoryMatchCardDraft[] {
  return Array.from({ length: 5 }, (_, index) => ({
    label: `Thẻ ${index + 1}`,
    file: null,
  }))
}

function createDefaultQuickTapTargetDrafts(): MemoryMatchCardDraft[] {
  return Array.from({ length: 4 }, (_, index) => ({
    label: `Mục tiêu ${index + 1}`,
    file: null,
  }))
}

function createDefaultQuickTapDistractorDrafts(): MemoryMatchCardDraft[] {
  return Array.from({ length: 3 }, (_, index) => ({
    label: `Nhiễu ${index + 1}`,
    file: null,
  }))
}

function createDefaultSizeOrderDrafts(): MemoryMatchCardDraft[] {
  return Array.from({ length: 5 }, (_, index) => ({
    label: `Con vật ${index + 1}`,
    file: null,
  }))
}

function createDefaultHabitatOptionDrafts(): HabitatOptionDraft[] {
  return [
    { id: 'habitat-1', label: 'Trong nhà' },
    { id: 'habitat-2', label: 'Rừng' },
    { id: 'habitat-3', label: 'Dưới nước' },
    { id: 'habitat-4', label: 'Đồng cỏ' },
  ]
}

function createDefaultHabitatAnimalDrafts(): HabitatAnimalDraft[] {
  return Array.from({ length: 4 }, (_, index) => ({
    label: `Con vật ${index + 1}`,
    file: null,
    habitatId: '',
  }))
}

function activityLabel(activityType: ActivityType) {
  return ACTIVITY_TYPES.find((item) => item.value === activityType)?.label ?? activityType
}

function levelLabel(level: string) {
  return LEVEL_OPTIONS.find((item) => item.value === level)?.label ?? level
}

function defaultInstructionForType(activityType: ActivityType) {
  switch (activityType) {
    case 'multiple_choice':
      return 'Hãy đọc câu hỏi và chọn đáp án đúng.'
    case 'image_choice':
      return 'Hãy nhìn kỹ hình ảnh rồi chọn đáp án đúng nhất.'
    case 'image_puzzle':
      return 'Hãy kéo từng mảnh ảnh vào đúng vị trí để ghép lại hình hoàn chỉnh.'
    case 'matching':
      return 'Hãy nối các cặp phù hợp với nhau.'
    case 'drag_drop':
      return 'Hãy kéo từng mục vào đúng vị trí.'
    case 'listen_choose':
      return 'Hãy nghe kỹ rồi chọn đáp án đúng.'
    case 'watch_answer':
      return 'Hãy xem nội dung trước rồi trả lời câu hỏi.'
    case 'hidden_image_guess':
      return 'Hãy mở từng ô, đoán hình phía dưới rồi bấm mic để trả lời.'
    case 'step_by_step':
      return 'Hãy làm lần lượt từng bước theo hướng dẫn.'
    case 'aac':
      return 'Hãy chọn thẻ phù hợp với điều em muốn nói.'
    case 'memory_match':
      return 'Lật 2 thẻ giống nhau để ghi nhớ con vật.'
    case 'quick_tap':
      return 'Chạm thật nhanh vào các thẻ con vật trước khi hết giờ.'
    case 'size_order':
      return 'Sắp xếp các con vật theo thứ tự từ bé đến lớn.'
    case 'habitat_match':
      return 'Chọn nơi sống đúng cho từng con vật.'
    case 'career_simulation':
      return 'Hãy làm theo tình huống mô phỏng.'
    case 'ai_chat':
      return 'Hãy trò chuyện ngắn gọn với trợ lý để hoàn thành nhiệm vụ.'
    default:
      return 'Hãy làm theo hướng dẫn của hoạt động.'
  }
}

function defaultVoiceEnabledForType(activityType: ActivityType) {
  return activityType === 'multiple_choice' || activityType === 'image_choice' || activityType === 'listen_choose' || activityType === 'aac' || activityType === 'ai_chat' || activityType === 'hidden_image_guess'
}

function inferMediaKind(mediaUrl: string, mediaFile: File | null, source: MediaSource) {
  if (source === 'upload' && mediaFile) {
    if (mediaFile.type.startsWith('image/')) return 'image'
    if (mediaFile.type.startsWith('video/')) return 'video'
  }

  const normalizedUrl = mediaUrl.trim().toLowerCase()
  if (!normalizedUrl) return ''
  if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(normalizedUrl)) return 'image'
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/.test(normalizedUrl)) return 'video'
  if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be') || normalizedUrl.includes('drive.google.com') || normalizedUrl.includes('tiktok.com')) return 'embed'
  return 'external'
}

function compactLines(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean)
}

function compactPairs(items: PairItem[]) {
  return items
    .map((item) => ({ left: item.left.trim(), right: item.right.trim() }))
    .filter((item) => item.left && item.right)
}

function compactFlexibleLines(rawValue: string) {
  return rawValue
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toTextValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function toStringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toEditablePairItems(value: unknown): PairItem[] {
  if (!Array.isArray(value)) return createDefaultPairs()
  const pairs = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      return {
        left: toTextValue((item as { left?: unknown }).left),
        right: toTextValue((item as { right?: unknown }).right),
      }
    })
    .filter((item): item is PairItem => Boolean(item))

  return pairs.length ? pairs : createDefaultPairs()
}

function toEditableMediaCards(value: unknown, minimum = 0): EditableMediaCard[] {
  const cards = Array.isArray(value)
    ? value
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const rawItem = item as { id?: unknown; label?: unknown; media_url?: unknown; media_kind?: unknown }
        return {
          id: toTextValue(rawItem.id, `card-${index + 1}`),
          label: toTextValue(rawItem.label, `Mục ${index + 1}`),
          media_url: toTextValue(rawItem.media_url),
          media_kind: toTextValue(rawItem.media_kind, 'image'),
        }
      })
      .filter((item): item is EditableMediaCard => Boolean(item))
    : []

  const paddedCards = [...cards]
  while (paddedCards.length < minimum) {
    const index = paddedCards.length
    paddedCards.push({
      id: `card-${index + 1}`,
      label: `Mục ${index + 1}`,
      media_url: '',
      media_kind: 'image',
    })
  }

  return paddedCards
}

function toEditableOrderedItems(value: unknown, minimum = 0): EditableOrderedItem[] {
  const items = Array.isArray(value)
    ? value
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const rawItem = item as { id?: unknown; label?: unknown; media_url?: unknown; media_kind?: unknown; rank?: unknown }
        return {
          id: toTextValue(rawItem.id, `ordered-${index + 1}`),
          label: toTextValue(rawItem.label, `Mục ${index + 1}`),
          media_url: toTextValue(rawItem.media_url),
          media_kind: toTextValue(rawItem.media_kind, 'image'),
          rank: Math.max(1, Number(rawItem.rank ?? index + 1) || index + 1),
        }
      })
      .filter((item): item is EditableOrderedItem => Boolean(item))
    : []

  const paddedItems = [...items]
  while (paddedItems.length < minimum) {
    const index = paddedItems.length
    paddedItems.push({
      id: `ordered-${index + 1}`,
      label: `Mục ${index + 1}`,
      media_url: '',
      media_kind: 'image',
      rank: index + 1,
    })
  }

  return paddedItems
}

function toEditableHabitatOptions(value: unknown, fallbackHabitats: unknown, minimum = 0): EditableHabitatOption[] {
  const options = Array.isArray(value)
    ? value
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const rawItem = item as { id?: unknown; label?: unknown; media_url?: unknown; media_kind?: unknown }
        return {
          id: toTextValue(rawItem.id, `habitat-${index + 1}`),
          label: toTextValue(rawItem.label, `Nơi sống ${index + 1}`),
          media_url: toTextValue(rawItem.media_url),
          media_kind: toTextValue(rawItem.media_kind, 'image'),
        }
      })
      .filter((item): item is EditableHabitatOption => Boolean(item))
    : []

  const fallbackOptions = options.length
    ? options
    : toStringArrayValue(fallbackHabitats).map((item, index) => ({
      id: item || `habitat-${index + 1}`,
      label: item || `Nơi sống ${index + 1}`,
      media_url: '',
      media_kind: 'image',
    }))

  const paddedOptions = [...fallbackOptions]
  while (paddedOptions.length < minimum) {
    const index = paddedOptions.length
    paddedOptions.push({
      id: `habitat-${index + 1}`,
      label: `Nơi sống ${index + 1}`,
      media_url: '',
      media_kind: 'image',
    })
  }

  return paddedOptions
}

function toEditableHabitatItems(value: unknown, minimum = 0): EditableHabitatItem[] {
  const items = Array.isArray(value)
    ? value
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const rawItem = item as {
          id?: unknown
          label?: unknown
          media_url?: unknown
          media_kind?: unknown
          habitat_id?: unknown
          habitat?: unknown
        }
        const habitatId = toTextValue(rawItem.habitat_id, toTextValue(rawItem.habitat))
        return {
          id: toTextValue(rawItem.id, `animal-${index + 1}`),
          label: toTextValue(rawItem.label, `Con vật ${index + 1}`),
          media_url: toTextValue(rawItem.media_url),
          media_kind: toTextValue(rawItem.media_kind, 'image'),
          habitat_id: habitatId,
          habitat: toTextValue(rawItem.habitat, habitatId),
        }
      })
      .filter((item): item is EditableHabitatItem => Boolean(item))
    : []

  const paddedItems = [...items]
  while (paddedItems.length < minimum) {
    const index = paddedItems.length
    paddedItems.push({
      id: `animal-${index + 1}`,
      label: `Con vật ${index + 1}`,
      media_url: '',
      media_kind: 'image',
      habitat_id: '',
      habitat: '',
    })
  }

  return paddedItems
}

type ActivityConfig = Record<string, unknown>

type TeacherLessonTemplateActivity = {
  title: string
  activityType: ActivityType
  instructionText: string
  voiceAnswerEnabled?: boolean
  config: ActivityConfig
}

type TeacherLessonTemplate = {
  id: string
  subjectName: string
  lessonTitle: string
  topicSummary: string
  description: string
  estimatedMinutes: number
  notes?: string
  activities: TeacherLessonTemplateActivity[]
}

function normalizeTemplateLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findSubjectByTemplateName(subjects: SubjectItem[], templateSubjectName: string) {
  const templateKey = normalizeTemplateLookup(templateSubjectName)
  return (
    subjects.find((subject) => normalizeTemplateLookup(subject.name) === templateKey) ??
    subjects.find((subject) => normalizeTemplateLookup(subject.name).includes(templateKey) || templateKey.includes(normalizeTemplateLookup(subject.name))) ??
    null
  )
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

type EditableMediaCard = {
  id: string
  label: string
  media_url: string
  media_kind: string
}

type EditableOrderedItem = EditableMediaCard & {
  rank: number
}

type EditableHabitatItem = EditableMediaCard & {
  habitat_id: string
  habitat: string
}

type EditableHabitatOption = {
  id: string
  label: string
  media_url: string
  media_kind: string
}

const demoAnimalImageCards = [
  { id: 'dog', label: 'Con chó', media_url: '/demo-media/concho.jpg', media_kind: 'image' },
  { id: 'cat', label: 'Con mèo', media_url: '/demo-media/conmeo.jpg', media_kind: 'image' },
  { id: 'fish', label: 'Con cá', media_url: '/demo-media/conca.jpg', media_kind: 'image' },
  { id: 'tiger', label: 'Con hổ', media_url: '/demo-media/conho.webp', media_kind: 'image' },
  { id: 'rabbit', label: 'Con thỏ', media_url: '/demo-media/contho.png', media_kind: 'image' },
]

function buildMemoryMatchDemoConfig(): ActivityConfig {
  return {
    kind: 'memory_match',
    prompt: 'Lật 2 thẻ giống nhau để ghi điểm.',
    pair_count: 5,
    image_cards: demoAnimalImageCards,
  }
}

function buildQuickTapDemoConfig(): ActivityConfig {
  return {
    kind: 'quick_tap',
    prompt: 'Chạm nhanh vào các thẻ con vật trước khi hết giờ.',
    duration_seconds: 10,
    target_hits: 6,
    simultaneous_cards: 4,
    image_cards: demoAnimalImageCards,
  }
}

function buildSizeOrderDemoConfig(): ActivityConfig {
  return {
    kind: 'size_order',
    prompt: 'Sắp xếp các con vật từ bé đến lớn.',
    items: [
      { id: 'cat', label: 'Mèo', media_url: '/demo-media/conmeo.jpg', media_kind: 'image', rank: 1 },
      { id: 'dog', label: 'Chó', media_url: '/demo-media/concho.jpg', media_kind: 'image', rank: 2 },
      { id: 'tiger', label: 'Hổ', media_url: '/demo-media/conho.webp', media_kind: 'image', rank: 3 },
      { id: 'buffalo', label: 'Trâu', media_url: '/demo-media/trau.webp', media_kind: 'image', rank: 4 },
      { id: 'elephant', label: 'Voi', media_url: '/demo-media/voi.jpg', media_kind: 'image', rank: 5 },
    ],
  }
}

function buildHabitatMatchDemoConfig(): ActivityConfig {
  return {
    kind: 'habitat_match',
    prompt: 'Nối con vật với nơi sống phù hợp.',
    habitat_cards: [
      { id: 'home', label: 'Trong nhà', media_url: '', media_kind: 'image' },
      { id: 'forest', label: 'Rừng', media_url: '', media_kind: 'image' },
      { id: 'water', label: 'Dưới nước', media_url: '', media_kind: 'image' },
      { id: 'grassland', label: 'Đồng cỏ', media_url: '', media_kind: 'image' },
    ],
    items: [
      { id: 'cat', label: 'Mèo', media_url: '/demo-media/conmeo.jpg', media_kind: 'image', habitat_id: 'home', habitat: 'Trong nhà' },
      { id: 'tiger', label: 'Hổ', media_url: '/demo-media/conho.webp', media_kind: 'image', habitat_id: 'forest', habitat: 'Rừng' },
      { id: 'fish', label: 'Cá', media_url: '/demo-media/conca.jpg', media_kind: 'image', habitat_id: 'water', habitat: 'Dưới nước' },
      { id: 'buffalo', label: 'Trâu', media_url: '/demo-media/trau.webp', media_kind: 'image', habitat_id: 'grassland', habitat: 'Đồng cỏ' },
    ],
  }
}

void [buildMemoryMatchDemoConfig, buildQuickTapDemoConfig, buildSizeOrderDemoConfig, buildHabitatMatchDemoConfig]

function isImageUploadOnlyActivity(activityType: ActivityType) {
  return activityType === 'image_choice' || activityType === 'image_puzzle' || activityType === 'hidden_image_guess'
}

function isSupportedMediaLink(rawValue: string) {
  const normalizedValue = rawValue.trim().toLowerCase()
  if (!normalizedValue) return false

  return (
    normalizedValue.includes('youtube.com') ||
    normalizedValue.includes('youtu.be') ||
    normalizedValue.includes('drive.google.com') ||
    normalizedValue.includes('tiktok.com') ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/.test(normalizedValue)
  )
}

function parseConfigEditor(value: string): ActivityConfig {
  const trimmedValue = value.trim()
  if (!trimmedValue) return {}

  const parsedValue = JSON.parse(trimmedValue)
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error('Cấu hình phải là một object JSON.')
  }

  return parsedValue as ActivityConfig
}

function formatConfigEditor(config: ActivityConfig) {
  return JSON.stringify(config, null, 2)
}

function normalizeConfigEditorText(configJson: string | null) {
  if (!configJson?.trim()) return '{}'

  try {
    return formatConfigEditor(parseConfigEditor(configJson))
  } catch {
    return configJson
  }
}

function extractEditablePrompt(activityType: ActivityType, config: ActivityConfig, fallback = '') {
  if (typeof config.prompt === 'string') return config.prompt
  if (activityType === 'career_simulation' && typeof config.scenario === 'string') return config.scenario
  if (activityType === 'ai_chat' && typeof config.starter_prompt === 'string') return config.starter_prompt
  return fallback
}

function writeEditablePrompt(activityType: ActivityType, config: ActivityConfig, nextPrompt: string) {
  const nextConfig = { ...config }
  if (activityType === 'career_simulation') {
    nextConfig.scenario = nextPrompt
    return nextConfig
  }
  if (activityType === 'ai_chat') {
    nextConfig.starter_prompt = nextPrompt
    return nextConfig
  }
  nextConfig.prompt = nextPrompt
  return nextConfig
}

function extractEditableMediaUrl(config: ActivityConfig) {
  if (typeof config.media_url === 'string') return config.media_url
  if (typeof config.image_url === 'string') return config.image_url
  if (typeof config.audio_url === 'string') return config.audio_url
  return ''
}

function writeEditableMediaUrl(activityType: ActivityType, config: ActivityConfig, nextMediaUrl: string) {
  const nextConfig = { ...config }
  const mediaKey =
    Object.prototype.hasOwnProperty.call(nextConfig, 'image_url') || activityType === 'image_puzzle' || activityType === 'hidden_image_guess'
      ? 'image_url'
      : Object.prototype.hasOwnProperty.call(nextConfig, 'audio_url') && !Object.prototype.hasOwnProperty.call(nextConfig, 'media_url')
        ? 'audio_url'
        : 'media_url'

  if (nextMediaUrl.trim()) {
    nextConfig[mediaKey] = nextMediaUrl.trim()
  } else {
    delete nextConfig[mediaKey]
  }

  return nextConfig
}

function ChoiceBuilder(props: {
  promptLabel: string
  promptValue: string
  promptPlaceholder: string
  onPromptChange: (value: string) => void
  showPrompt?: boolean
  options: string[]
  correctIndex: number
  onOptionChange: (index: number, value: string) => void
  onCorrectChange: (index: number) => void
}) {
  const { promptLabel, promptValue, promptPlaceholder, onPromptChange, showPrompt = true, options, correctIndex, onOptionChange, onCorrectChange } = props

  return (
    <div className="config-card detail-stack">
      {showPrompt ? (
        <label>
          {promptLabel}
          <input value={promptValue} onChange={(event) => onPromptChange(event.target.value)} placeholder={promptPlaceholder} />
        </label>
      ) : null}

      <div className="detail-stack">
        <strong>4 đáp án gợi ý</strong>
        <div className="builder-grid">
          {options.map((option, index) => (
            <label key={index} className="builder-choice-card">
              <div className="builder-choice-head">
                <span className="subject-pill muted-pill">Đáp án {CHOICE_SLOT_LABELS[index]}</span>
                <label className="builder-radio">
                  <input type="radio" checked={correctIndex === index} onChange={() => onCorrectChange(index)} />
                  <span>Đáp án đúng</span>
                </label>
              </div>
              <input value={option} onChange={(event) => onOptionChange(index, event.target.value)} placeholder={`Nhập đáp án ${CHOICE_SLOT_LABELS[index]}`} />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function PairBuilder(props: {
  title: string
  helper: string
  items: PairItem[]
  onChange: (index: number, field: 'left' | 'right', value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="config-card detail-stack">
      <div className="detail-stack">
        <strong>{props.title}</strong>
        <p className="helper-text">{props.helper}</p>
      </div>

      <div className="builder-stack">
        {props.items.map((item, index) => (
          <div key={index} className="builder-pair-row">
            <input value={item.left} onChange={(event) => props.onChange(index, 'left', event.target.value)} placeholder="Cột bên trái" />
            <input value={item.right} onChange={(event) => props.onChange(index, 'right', event.target.value)} placeholder="Cột bên phải" />
            <button className="ghost-button" type="button" onClick={() => props.onRemove(index)} disabled={props.items.length <= 2}>
              Xóa
            </button>
          </div>
        ))}
      </div>

      <button className="ghost-button" type="button" onClick={props.onAdd}>
        Thêm một cặp
      </button>
    </div>
  )
}

function ListBuilder(props: {
  title: string
  helper: string
  items: string[]
  itemPlaceholder: string
  onChange: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="config-card detail-stack">
      <div className="detail-stack">
        <strong>{props.title}</strong>
        <p className="helper-text">{props.helper}</p>
      </div>

      <div className="builder-stack">
        {props.items.map((item, index) => (
          <div key={index} className="builder-list-row">
            <input value={item} onChange={(event) => props.onChange(index, event.target.value)} placeholder={`${props.itemPlaceholder} ${index + 1}`} />
            <button className="ghost-button" type="button" onClick={() => props.onRemove(index)} disabled={props.items.length <= 2}>
              Xóa
            </button>
          </div>
        ))}
      </div>

      <button className="ghost-button" type="button" onClick={props.onAdd}>
        Thêm dòng
      </button>
    </div>
  )
}

export function LessonsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [activeLessonLevel, setActiveLessonLevel] = useState<LessonLevel>('nhe')
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null)
  const [estimatedMinutes, setEstimatedMinutes] = useState('15')
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSubjectId, setEditSubjectId] = useState('')
  const [editPrimaryLevel, setEditPrimaryLevel] = useState('trung_binh')
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState('15')
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null)
  const [editActivityTitle, setEditActivityTitle] = useState('')
  const [editActivityInstruction, setEditActivityInstruction] = useState('')
  const [editActivitySortOrder, setEditActivitySortOrder] = useState('1')
  const [editActivityVoiceAnswerEnabled, setEditActivityVoiceAnswerEnabled] = useState(false)
  const [editActivityPrompt, setEditActivityPrompt] = useState('')
  const [editActivityMediaUrl, setEditActivityMediaUrl] = useState('')
  const [editActivityMediaSource, setEditActivityMediaSource] = useState<MediaSource>('upload')
  const [editActivityMediaUploadPending, setEditActivityMediaUploadPending] = useState(false)
  const [editActivityConfigJson, setEditActivityConfigJson] = useState('{}')
  const [activityEditorError, setActivityEditorError] = useState<string | null>(null)
  const [previewChoiceAnswers, setPreviewChoiceAnswers] = useState<Record<number, string>>({})
  const [previewTextAnswers, setPreviewTextAnswers] = useState<Record<number, string>>({})
  const [previewMatchingAnswers, setPreviewMatchingAnswers] = useState<Record<number, string[]>>({})
  const [previewDragAnswers, setPreviewDragAnswers] = useState<Record<number, string[]>>({})
  const [previewStepAnswers, setPreviewStepAnswers] = useState<Record<number, boolean[]>>({})
  const [previewAacSelections, setPreviewAacSelections] = useState<Record<number, string>>({})

  const [activityTitle, setActivityTitle] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('multiple_choice')
  const [instructionText, setInstructionText] = useState(defaultInstructionForType('multiple_choice'))
  const [voiceAnswerEnabled, setVoiceAnswerEnabled] = useState(defaultVoiceEnabledForType('multiple_choice'))
  const [activityFormError, setActivityFormError] = useState<string | null>(null)
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false)

  const [questionPrompt, setQuestionPrompt] = useState('Vật nào có dạng hình tròn?')
  const [choiceOptions, setChoiceOptions] = useState<string[]>(createDefaultChoiceOptions())
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState(0)

  const [imageChoicePrompt, setImageChoicePrompt] = useState('Bạn nhìn thấy gì trong tấm ảnh này?')
  const [imageChoiceFile, setImageChoiceFile] = useState<File | null>(null)
  const [imageChoiceOptions, setImageChoiceOptions] = useState<string[]>(createDefaultChoiceOptions())
  const [imageChoiceCorrectIndex, setImageChoiceCorrectIndex] = useState(0)
  const [imagePuzzleFile, setImagePuzzleFile] = useState<File | null>(null)
  const [imagePuzzlePrompt, setImagePuzzlePrompt] = useState('Hãy ghép lại để thành hình con vật hoàn chỉnh.')
  const [imagePuzzleRows, setImagePuzzleRows] = useState('2')
  const [imagePuzzleCols, setImagePuzzleCols] = useState('3')

  const [matchingPairs, setMatchingPairs] = useState<PairItem[]>(createDefaultPairs())
  const [dragItems, setDragItems] = useState<string[]>(createDefaultList())
  const [dragTargets, setDragTargets] = useState<string[]>(createDefaultList())

  const [listenPrompt, setListenPrompt] = useState('Con hãy nghe cô đọc và chọn đáp án đúng.')
  const [listenOptions, setListenOptions] = useState<string[]>(createDefaultChoiceOptions())
  const [listenCorrectIndex, setListenCorrectIndex] = useState(0)

  const [watchAnswerSource, setWatchAnswerSource] = useState<MediaSource>('external')
  const [watchAnswerUrl, setWatchAnswerUrl] = useState('')
  const [watchAnswerFile, setWatchAnswerFile] = useState<File | null>(null)
  const [watchAnswerPrompt, setWatchAnswerPrompt] = useState('Sau khi xem xong, em thấy điều gì?')
  const [watchAnswerMode, setWatchAnswerMode] = useState<WatchAnswerMode>('text')
  const [watchAnswerExpectedAnswer, setWatchAnswerExpectedAnswer] = useState('')
  const [watchAnswerAcceptedAnswers, setWatchAnswerAcceptedAnswers] = useState('')
  const [hiddenGuessFile, setHiddenGuessFile] = useState<File | null>(null)
  const [hiddenGuessPrompt, setHiddenGuessPrompt] = useState('Trong bức ảnh này là con gì?')
  const [hiddenGuessExpectedAnswer, setHiddenGuessExpectedAnswer] = useState('')
  const [hiddenGuessAcceptedAnswers, setHiddenGuessAcceptedAnswers] = useState('')
  const [hiddenGuessRows, setHiddenGuessRows] = useState('3')
  const [hiddenGuessCols, setHiddenGuessCols] = useState('4')

  const [stepList, setStepList] = useState<string[]>(createDefaultList())
  const [aacImageDrafts, setAacImageDrafts] = useState<AacImageDraft[]>(createDefaultAacImageDrafts())
  const [memoryMatchCardDrafts, setMemoryMatchCardDrafts] = useState<MemoryMatchCardDraft[]>(createDefaultMemoryMatchCardDrafts())
  const [quickTapTargetDrafts, setQuickTapTargetDrafts] = useState<MemoryMatchCardDraft[]>(createDefaultQuickTapTargetDrafts())
  const [quickTapDistractorDrafts, setQuickTapDistractorDrafts] = useState<MemoryMatchCardDraft[]>(createDefaultQuickTapDistractorDrafts())
  const [quickTapDurationSeconds, setQuickTapDurationSeconds] = useState('10')
  const [quickTapTargetHits, setQuickTapTargetHits] = useState('6')
  const [quickTapSimultaneousCards, setQuickTapSimultaneousCards] = useState('4')
  const [quickTapSpawnIntervalMs, setQuickTapSpawnIntervalMs] = useState('1600')
  const [sizeOrderDrafts, setSizeOrderDrafts] = useState<MemoryMatchCardDraft[]>(createDefaultSizeOrderDrafts())
  const [habitatOptionDrafts, setHabitatOptionDrafts] = useState<HabitatOptionDraft[]>(createDefaultHabitatOptionDrafts())
  const [habitatAnimalDrafts, setHabitatAnimalDrafts] = useState<HabitatAnimalDraft[]>(createDefaultHabitatAnimalDrafts())
  const [scenarioText, setScenarioText] = useState('Em vào vai nhân viên thư viện và giúp bạn nhỏ chọn đúng cuốn sách cần tìm.')
  const [successCriteriaText, setSuccessCriteriaText] = useState('Chọn đúng vai trò, trả lời lịch sự và làm đủ các bước.')
  const [aiStarterPrompt, setAiStarterPrompt] = useState('Hãy hỏi em 3 câu ngắn về bài học này.')
  const [aiGoals, setAiGoals] = useState<string[]>(createDefaultList())

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  })

  const activeTeacherTemplates = useMemo(() => {
    if (activeLessonLevel === 'nhe') return LIGHT_LEVEL_LESSON_TEMPLATES
    if (activeLessonLevel === 'trung_binh') return MEDIUM_LEVEL_LESSON_TEMPLATES
    return HEAVY_LEVEL_LESSON_TEMPLATES
  }, [activeLessonLevel])
  const templateSubjectMap = useMemo(() => {
    const entries = activeTeacherTemplates.map((template) => [
      template.id,
      findSubjectByTemplateName(subjectsQuery.data ?? [], template.subjectName),
    ] as const)
    return new Map(entries)
  }, [activeTeacherTemplates, subjectsQuery.data])

  const lessonsQuery = useQuery({
    queryKey: ['lessons', token],
    queryFn: () => fetchLessons(token!),
    enabled: Boolean(token),
  })

  const visibleLessons = useMemo(
    () => (lessonsQuery.data ?? []).filter((lesson) => lesson.primary_level === activeLessonLevel),
    [activeLessonLevel, lessonsQuery.data],
  )
  const lessonLevelCounts = useMemo(
    () => ({
      nhe: (lessonsQuery.data ?? []).filter((lesson) => lesson.primary_level === 'nhe').length,
      trung_binh: (lessonsQuery.data ?? []).filter((lesson) => lesson.primary_level === 'trung_binh').length,
      nang: (lessonsQuery.data ?? []).filter((lesson) => lesson.primary_level === 'nang').length,
    }),
    [lessonsQuery.data],
  )
  const resolvedSubjectId = subjectId || String(subjectsQuery.data?.[0]?.id ?? '')
  const resolvedSelectedLessonId =
    selectedLessonId && visibleLessons.some((lesson) => lesson.id === selectedLessonId)
      ? selectedLessonId
      : visibleLessons[0]?.id ?? null

  const lessonDetailQuery = useQuery({
    queryKey: ['lesson-detail', token, resolvedSelectedLessonId],
    queryFn: () => fetchLesson(token!, resolvedSelectedLessonId!),
    enabled: Boolean(token && resolvedSelectedLessonId),
  })

  const selectedLesson = useMemo(
    () => visibleLessons.find((lesson) => lesson.id === resolvedSelectedLessonId) ?? null,
    [resolvedSelectedLessonId, visibleLessons],
  )
  const lessonActivities = useMemo(() => lessonDetailQuery.data?.activities ?? [], [lessonDetailQuery.data?.activities])
  const resolvedSelectedActivityId = selectedActivityId ?? lessonActivities[0]?.id ?? null
  const selectedActivity = useMemo(
    () => lessonActivities.find((activity) => activity.id === resolvedSelectedActivityId) ?? null,
    [lessonActivities, resolvedSelectedActivityId],
  )
  const editablePreviewActivity = useMemo(
    () =>
      selectedActivity
        ? {
            ...selectedActivity,
            title: editActivityTitle || selectedActivity.title,
            instruction_text: editActivityInstruction,
            config_json: editActivityConfigJson,
          }
        : null,
    [editActivityConfigJson, editActivityInstruction, editActivityTitle, selectedActivity],
  )

  const currentActivityDescription = ACTIVITY_TYPES.find((option) => option.value === activityType)?.description ?? ''
  const selectedLessonSubjectName = selectedLesson?.subject?.name ?? 'Chưa có môn'
  const selectedLessonEstimatedMinutes = selectedLesson?.estimated_minutes ?? null
  const canCreateActivity = Boolean(resolvedSelectedLessonId)

  useEffect(() => {
    if (!selectedLesson) return
    setEditTitle(selectedLesson.title)
    setEditDescription(selectedLesson.description ?? '')
    setEditSubjectId(String(selectedLesson.subject_id))
    setEditPrimaryLevel(selectedLesson.primary_level)
    setEditEstimatedMinutes(String(selectedLesson.estimated_minutes ?? 15))
  }, [selectedLesson])

  useEffect(() => {
    if (resolvedSelectedLessonId === selectedLessonId) return
    setSelectedLessonId(resolvedSelectedLessonId)
  }, [resolvedSelectedLessonId, selectedLessonId])

  useEffect(() => {
    if (!lessonActivities.length) {
      if (selectedActivityId !== null) {
        setSelectedActivityId(null)
      }
      return
    }

    if (!lessonActivities.some((activity) => activity.id === resolvedSelectedActivityId)) {
      setSelectedActivityId(lessonActivities[0].id)
    }
  }, [lessonActivities, resolvedSelectedActivityId, selectedActivityId])

  useEffect(() => {
    if (!selectedActivity) {
      setEditActivityTitle('')
      setEditActivityInstruction('')
      setEditActivitySortOrder('1')
      setEditActivityVoiceAnswerEnabled(false)
      setEditActivityPrompt('')
      setEditActivityMediaUrl('')
      setEditActivityMediaSource('upload')
      setEditActivityConfigJson('{}')
      setActivityEditorError(null)
      return
    }

    const activityTypeValue = selectedActivity.activity_type as ActivityType
    const configText = normalizeConfigEditorText(selectedActivity.config_json)
    setEditActivityTitle(selectedActivity.title)
    setEditActivityInstruction(selectedActivity.instruction_text ?? '')
    setEditActivitySortOrder(String(selectedActivity.sort_order ?? 1))
    setEditActivityVoiceAnswerEnabled(selectedActivity.voice_answer_enabled ?? false)
    setEditActivityConfigJson(configText)

    try {
      const config = parseConfigEditor(configText)
      setEditActivityPrompt(extractEditablePrompt(activityTypeValue, config, selectedActivity.instruction_text ?? ''))
      const nextMediaUrl = extractEditableMediaUrl(config)
      setEditActivityMediaUrl(nextMediaUrl)
      setEditActivityMediaSource(
        activityTypeValue === 'watch_answer' && isSupportedMediaLink(nextMediaUrl) ? 'external' : 'upload',
      )
      setActivityEditorError(null)
    } catch {
      setEditActivityPrompt(selectedActivity.instruction_text ?? '')
      setEditActivityMediaUrl('')
      setEditActivityMediaSource('upload')
      setActivityEditorError('JSON của hoạt động này chưa hợp lệ.')
    }
  }, [selectedActivity])

  const createLessonMutation = useMutation({
    mutationFn: () =>
      createLesson(token!, {
        title,
        description,
        subject_id: Number(resolvedSubjectId),
        primary_level: activeLessonLevel,
        estimated_minutes: Number(estimatedMinutes),
        difficulty_stage: 1,
        is_published: true,
      }),
    onSuccess: async (createdLesson) => {
      setTitle('')
      setDescription('')
      setEstimatedMinutes('15')
      await queryClient.invalidateQueries({ queryKey: ['lessons', token] })
      setSelectedLessonId(createdLesson.id)
    },
  })

  const createTemplateLessonMutation = useMutation({
    mutationFn: async (template: TeacherLessonTemplate) => {
      const subject = findSubjectByTemplateName(subjectsQuery.data ?? [], template.subjectName)
      if (!subject) {
        throw new Error(`Không tìm thấy môn "${template.subjectName}" trong hệ thống.`)
      }

      const createdLesson = await createLesson(token!, {
        title: template.lessonTitle,
        description: template.description,
        subject_id: subject.id,
        primary_level: activeLessonLevel,
        estimated_minutes: template.estimatedMinutes,
        difficulty_stage: 1,
        is_published: true,
      })

      for (const [index, activity] of template.activities.entries()) {
        await createLessonActivity(token!, createdLesson.id, {
          title: activity.title,
          activity_type: activity.activityType,
          instruction_text: activity.instructionText,
          voice_answer_enabled: activity.voiceAnswerEnabled ?? defaultVoiceEnabledForType(activity.activityType),
          is_required: true,
          sort_order: index + 1,
          difficulty_stage: 1,
          config_json: JSON.stringify(activity.config),
        })
      }

      return { createdLesson, template, subject }
    },
    onSuccess: async ({ createdLesson, template, subject }) => {
      setTemplateFeedback(`Đã tạo bài mẫu "${template.lessonTitle}" cho môn ${subject.name}.`)
      setSubjectId(String(subject.id))
      setSelectedLessonId(createdLesson.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, createdLesson.id] }),
      ])
    },
    onError: (error) => {
      setTemplateFeedback(error instanceof Error ? error.message : 'Không thể tạo bài mẫu lúc này.')
    },
  })

  const updateLessonMutation = useMutation({
    mutationFn: () =>
      updateLesson(token!, resolvedSelectedLessonId!, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        subject_id: Number(editSubjectId || resolvedSubjectId),
        primary_level: editPrimaryLevel,
        estimated_minutes: Number(editEstimatedMinutes || 15),
        is_published: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, resolvedSelectedLessonId] }),
      ])
    },
  })

  const deleteLessonMutation = useMutation({
    mutationFn: () => deleteLesson(token!, resolvedSelectedLessonId!),
    onSuccess: async () => {
      setSelectedLessonId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token] }),
      ])
    },
  })

  const updateActivityMutation = useMutation({
    mutationFn: async () => {
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      if (
        selectedActivity?.activity_type === 'watch_answer' &&
        editActivityMediaSource === 'external' &&
        editActivityMediaUrl.trim() &&
        !isSupportedMediaLink(editActivityMediaUrl)
      ) {
        throw new Error('Link video chỉ nên dùng YouTube, TikTok, Google Drive hoặc file video trực tiếp.')
      }

      return updateLessonActivity(token!, resolvedSelectedActivityId!, {
        title: editActivityTitle.trim(),
        activity_type: selectedActivity?.activity_type,
        instruction_text: editActivityInstruction.trim(),
        voice_answer_enabled: editActivityVoiceAnswerEnabled,
        is_required: selectedActivity?.is_required ?? true,
        sort_order: Math.max(1, Number(editActivitySortOrder) || 1),
        difficulty_stage: selectedActivity?.difficulty_stage ?? 1,
        config_json: JSON.stringify(parsedConfig),
      })
    },
    onSuccess: async () => {
      setActivityEditorError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, resolvedSelectedLessonId] }),
      ])
    },
    onError: (error) => {
      setActivityEditorError(error instanceof Error ? error.message : 'Không thể lưu hoạt động.')
    },
  })

  const deleteActivityMutation = useMutation({
    mutationFn: () => deleteLessonActivity(token!, resolvedSelectedActivityId!),
    onSuccess: async () => {
      setSelectedActivityId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, resolvedSelectedLessonId] }),
      ])
    },
    onError: (error) => {
      setActivityEditorError(error instanceof Error ? error.message : 'Không thể xóa hoạt động.')
    },
  })

  function updateChoiceOption(
    setter: Dispatch<SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function updatePair(index: number, field: 'left' | 'right', value: string) {
    setMatchingPairs((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  function updateList(
    setter: Dispatch<SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function handleActivityPromptChange(nextValue: string) {
    setEditActivityPrompt(nextValue)
    if (!selectedActivity) return

    try {
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      const nextConfig = writeEditablePrompt(selectedActivity.activity_type as ActivityType, parsedConfig, nextValue)
      setEditActivityConfigJson(formatConfigEditor(nextConfig))
      setActivityEditorError(null)
    } catch {
      setActivityEditorError('JSON chưa hợp lệ. Sửa lại trước khi lưu.')
    }
  }

  function handleActivityMediaUrlChange(nextValue: string) {
    setEditActivityMediaUrl(nextValue)
    if (!selectedActivity) return

    try {
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      const nextConfig = writeEditableMediaUrl(selectedActivity.activity_type as ActivityType, parsedConfig, nextValue)
      setEditActivityConfigJson(formatConfigEditor(nextConfig))
      setActivityEditorError(null)
    } catch {
      setActivityEditorError('JSON chưa hợp lệ. Sửa lại trước khi lưu.')
    }
  }

  function handleActivityConfigJsonChange(nextValue: string) {
    setEditActivityConfigJson(nextValue)
    if (!selectedActivity) return

    try {
      const parsedConfig = parseConfigEditor(nextValue)
      const activityTypeValue = selectedActivity.activity_type as ActivityType
      setEditActivityPrompt(extractEditablePrompt(activityTypeValue, parsedConfig, editActivityInstruction))
      const nextMediaUrl = extractEditableMediaUrl(parsedConfig)
      setEditActivityMediaUrl(nextMediaUrl)
      setEditActivityMediaSource(
        activityTypeValue === 'watch_answer' && isSupportedMediaLink(nextMediaUrl) ? 'external' : 'upload',
      )
      setActivityEditorError(null)
    } catch {
      setActivityEditorError('JSON chưa hợp lệ. Sửa lại trước khi lưu.')
    }
  }

  function handleFormatActivityConfigJson() {
    try {
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      setEditActivityConfigJson(formatConfigEditor(parsedConfig))
      setActivityEditorError(null)
    } catch {
      setActivityEditorError('JSON chưa hợp lệ. Không thể chuẩn hóa.')
    }
  }

  function handleResetActivityConfigJson() {
    if (!selectedActivity) return
    const configText = normalizeConfigEditorText(selectedActivity.config_json)
    setEditActivityConfigJson(configText)

    try {
      const parsedConfig = parseConfigEditor(configText)
      const activityTypeValue = selectedActivity.activity_type as ActivityType
      setEditActivityPrompt(extractEditablePrompt(activityTypeValue, parsedConfig, selectedActivity.instruction_text ?? ''))
      const nextMediaUrl = extractEditableMediaUrl(parsedConfig)
      setEditActivityMediaUrl(nextMediaUrl)
      setEditActivityMediaSource(
        activityTypeValue === 'watch_answer' && isSupportedMediaLink(nextMediaUrl) ? 'external' : 'upload',
      )
      setActivityEditorError(null)
    } catch {
      setActivityEditorError('JSON gốc của hoạt động này chưa hợp lệ.')
    }
  }

  function syncActivityEditorFromConfig(activityTypeValue: ActivityType, config: ActivityConfig, instructionFallback: string) {
    setEditActivityPrompt(extractEditablePrompt(activityTypeValue, config, instructionFallback))
    const nextMediaUrl = extractEditableMediaUrl(config)
    setEditActivityMediaUrl(nextMediaUrl)
    setEditActivityMediaSource(
      activityTypeValue === 'watch_answer' && isSupportedMediaLink(nextMediaUrl) ? 'external' : 'upload',
    )
  }

  function updateActivityConfigState(updater: (config: ActivityConfig) => ActivityConfig) {
    if (!selectedActivity) return

    try {
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      const nextConfig = updater(parsedConfig)
      setEditActivityConfigJson(formatConfigEditor(nextConfig))
      syncActivityEditorFromConfig(selectedActivity.activity_type as ActivityType, nextConfig, editActivityInstruction)
      setActivityEditorError(null)
    } catch {
      setActivityEditorError('Cấu hình hoạt động chưa hợp lệ.')
    }
  }

  async function uploadActivityConfigMedia(
    file: File | null,
    onUploaded: (config: ActivityConfig, uploadedMedia: Awaited<ReturnType<typeof uploadLessonMedia>>) => ActivityConfig,
  ) {
    if (!file || !token || !selectedActivity) return

    setEditActivityMediaUploadPending(true)
    setActivityEditorError(null)

    try {
      const uploadedMedia = await uploadLessonMedia(token, file)
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      const nextConfig = onUploaded(parsedConfig, uploadedMedia)
      setEditActivityConfigJson(formatConfigEditor(nextConfig))
      syncActivityEditorFromConfig(selectedActivity.activity_type as ActivityType, nextConfig, editActivityInstruction)
    } catch (error) {
      setActivityEditorError(error instanceof Error ? error.message : 'Không thể tải media lên.')
    } finally {
      setEditActivityMediaUploadPending(false)
    }
  }

  async function handleActivityMediaFileChange(file: File | null) {
    if (!selectedActivity || !file || !token) return

    const activityTypeValue = selectedActivity.activity_type as ActivityType
    const onlyImageUpload = isImageUploadOnlyActivity(activityTypeValue)

    if (onlyImageUpload && !file.type.startsWith('image/')) {
      setActivityEditorError('Hoạt động này chỉ nhận ảnh tải từ máy.')
      return
    }

    if (activityTypeValue === 'watch_answer' && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setActivityEditorError('Chỉ có thể tải ảnh hoặc video từ máy.')
      return
    }

    setEditActivityMediaUploadPending(true)
    setActivityEditorError(null)

    try {
      const uploadedMedia = await uploadLessonMedia(token, file)
      const parsedConfig = parseConfigEditor(editActivityConfigJson)
      const nextConfig = writeEditableMediaUrl(activityTypeValue, parsedConfig, uploadedMedia.url)

      if (activityTypeValue === 'image_choice' || activityTypeValue === 'watch_answer') {
        nextConfig.media_kind = uploadedMedia.media_kind
      }

      if (activityTypeValue === 'image_puzzle' || activityTypeValue === 'hidden_image_guess') {
        nextConfig.image_kind = uploadedMedia.media_kind
      }

      setEditActivityMediaSource('upload')
      setEditActivityMediaUrl(uploadedMedia.url)
      setEditActivityConfigJson(formatConfigEditor(nextConfig))
    } catch (error) {
      setActivityEditorError(error instanceof Error ? error.message : 'Không thể tải media lên.')
    } finally {
      setEditActivityMediaUploadPending(false)
    }
  }

  function validateActivityForm() {
    if (!resolvedSelectedLessonId) return 'Hãy chọn bài học trước khi thêm hoạt động.'

    if ((activityTitle || activityLabel(activityType)).trim().length === 0) {
      return 'Hãy nhập tên hoạt động.'
    }

    if (activityType === 'multiple_choice') {
      if (!questionPrompt.trim()) return 'Hãy nhập câu hỏi cho hoạt động chọn đáp án.'
      if (choiceOptions.some((option) => !option.trim())) return 'Hãy điền đủ 4 đáp án A, B, C, D.'
    }

    if (activityType === 'listen_choose') {
      if (!listenPrompt.trim()) return 'Hãy nhập nội dung nghe hoặc câu đọc cho học sinh.'
      if (listenOptions.some((option) => !option.trim())) return 'Hãy điền đủ 4 đáp án nghe và chọn.'
    }

    if (activityType === 'image_choice') {
      if (!imageChoicePrompt.trim()) return 'Hãy nhập câu hỏi cho hoạt động nhìn ảnh.'
      if (imageChoiceOptions.some((option) => !option.trim())) return 'Hãy điền đủ 4 đáp án gợi ý cho hoạt động nhìn ảnh.'
      if (!imageChoiceFile) return 'Hãy tải lên một hình ảnh cho hoạt động nhìn ảnh.'
    }

    if (activityType === 'image_puzzle') {
      if (!imagePuzzlePrompt.trim()) return 'Hãy nhập hướng dẫn cho hoạt động ghép mảnh ảnh.'
      if (!imagePuzzleFile) return 'Hãy tải lên một hình ảnh để cắt thành mảnh ghép.'
    }

    if (activityType === 'matching' && compactPairs(matchingPairs).length < 2) {
      return 'Hãy nhập ít nhất 2 cặp nối.'
    }

    if (activityType === 'drag_drop') {
      if (compactLines(dragItems).length < 2) return 'Hãy nhập ít nhất 2 mục cần kéo.'
      if (compactLines(dragTargets).length < 2) return 'Hãy nhập ít nhất 2 vị trí đích.'
    }

    if (activityType === 'watch_answer') {
      if (!watchAnswerPrompt.trim()) return 'Hãy nhập câu hỏi sau khi xem.'
      if (watchAnswerSource === 'upload' && !watchAnswerFile) return 'Hãy chọn ảnh hoặc video từ máy trước khi thêm hoạt động.'
      if (watchAnswerSource === 'external' && !watchAnswerUrl.trim()) return 'Hãy nhập link video trước khi thêm hoạt động.'
      if (watchAnswerSource === 'external' && !isSupportedMediaLink(watchAnswerUrl)) {
        return 'Link video chỉ nên dùng YouTube, TikTok, Google Drive hoặc file video trực tiếp.'
      }
      if (watchAnswerMode === 'voice_ai_grade' && !watchAnswerExpectedAnswer.trim()) return 'Hãy nhập đáp án mẫu để AI chấm câu trả lời bằng giọng nói.'
    }

    if (activityType === 'hidden_image_guess') {
      if (!hiddenGuessPrompt.trim()) return 'Hãy nhập câu hỏi cho hoạt động mở ô đoán hình.'
      if (!hiddenGuessFile) return 'Hãy tải lên một hình ảnh cho hoạt động mở ô đoán hình.'
      if (!hiddenGuessExpectedAnswer.trim()) return 'Hãy nhập đáp án mẫu để AI chấm phần nói của học sinh.'
    }

    if (activityType === 'step_by_step' && compactLines(stepList).length < 2) {
      return 'Hãy nhập ít nhất 2 bước cho hoạt động.'
    }

    if (activityType === 'aac' && aacImageDrafts.some((item) => !item.file)) {
      return 'Hãy tải đủ 4 ảnh cho hoạt động thẻ giao tiếp.'
    }

    if (activityType === 'memory_match' && memoryMatchCardDrafts.filter((item) => item.file).length < 2) {
      return 'Hãy tải lên ít nhất 2 ảnh cho hoạt động lật thẻ ghi nhớ.'
    }

    if (activityType === 'quick_tap' && quickTapTargetDrafts.filter((item) => item.file).length < 2) {
      return 'Hãy tải lên ít nhất 2 ảnh mục tiêu cho hoạt động chạm đúng nhanh.'
    }

    if (activityType === 'size_order' && sizeOrderDrafts.filter((item) => item.file).length < 3) {
      return 'Hãy tải lên ít nhất 3 ảnh cho hoạt động sắp xếp lớn nhỏ.'
    }

    if (activityType === 'habitat_match') {
      const activeHabitats = habitatOptionDrafts.filter((item) => item.label.trim())
      const activeAnimals = habitatAnimalDrafts.filter((item) => item.file)
      if (activeHabitats.length < 2) return 'Hãy nhập ít nhất 2 nơi sống.'
      if (activeAnimals.length < 2) return 'Hãy tải lên ít nhất 2 con vật cho hoạt động ghép nơi sống.'
      if (activeAnimals.some((item) => !item.habitatId)) return 'Hãy chọn nơi sống đúng cho từng con vật đã tải lên.'
    }

    if (activityType === 'career_simulation' && !scenarioText.trim()) {
      return 'Hãy nhập tình huống mô phỏng.'
    }

    if (activityType === 'ai_chat' && !aiStarterPrompt.trim()) {
      return 'Hãy nhập lời mở đầu cho AI.'
    }

    return null
  }

  async function buildActivityPayloadConfig() {
    if (activityType === 'multiple_choice') {
      const choices = choiceOptions.map((option) => option.trim())
      return {
        kind: 'multiple_choice',
        prompt: questionPrompt.trim(),
        choices,
        correct: choices[correctChoiceIndex] ?? choices[0] ?? '',
      }
    }

    if (activityType === 'listen_choose') {
      const choices = listenOptions.map((option) => option.trim())
      return {
        kind: 'listen_choose',
        audio_text: listenPrompt.trim(),
        prompt: listenPrompt.trim(),
        choices,
        correct: choices[listenCorrectIndex] ?? choices[0] ?? '',
      }
    }

    if (activityType === 'image_choice') {
      const uploadedMedia = await uploadLessonMedia(token!, imageChoiceFile!)

      const choices = imageChoiceOptions.map((option) => option.trim())
      return {
        kind: 'image_choice',
        media_url: uploadedMedia.url,
        media_kind: uploadedMedia.media_kind || 'image',
        prompt: imageChoicePrompt.trim(),
        choices,
        correct: choices[imageChoiceCorrectIndex] ?? choices[0] ?? '',
      }
    }

    if (activityType === 'image_puzzle') {
      const uploadedMedia = await uploadLessonMedia(token!, imagePuzzleFile!)

      const rows = Math.max(1, Number(imagePuzzleRows) || 2)
      const cols = Math.max(2, Number(imagePuzzleCols) || 3)

      return {
        kind: 'image_puzzle',
        prompt: imagePuzzlePrompt.trim(),
        image_url: uploadedMedia.url,
        image_kind: uploadedMedia.media_kind || 'image',
        rows,
        cols,
        piece_count: rows * cols,
      }
    }

    if (activityType === 'matching') {
      return {
        kind: 'matching',
        prompt: instructionText.trim(),
        pairs: compactPairs(matchingPairs),
      }
    }

    if (activityType === 'drag_drop') {
      return {
        kind: 'drag_drop',
        prompt: instructionText.trim(),
        items: compactLines(dragItems),
        targets: compactLines(dragTargets),
      }
    }

    if (activityType === 'watch_answer') {
      let mediaUrl = watchAnswerUrl.trim()
      let mediaKind = inferMediaKind(watchAnswerUrl, watchAnswerFile, watchAnswerSource)

      if (watchAnswerSource === 'upload' && watchAnswerFile) {
        const uploadedMedia = await uploadLessonMedia(token!, watchAnswerFile)
        mediaUrl = uploadedMedia.url
        mediaKind = uploadedMedia.media_kind
      }

      return {
        kind: 'watch_answer',
        media_url: mediaUrl,
        media_kind: mediaKind,
        prompt: watchAnswerPrompt.trim(),
        answer_mode: watchAnswerMode,
        expected_answer: watchAnswerMode === 'voice_ai_grade' ? watchAnswerExpectedAnswer.trim() : '',
        accepted_answers: watchAnswerMode === 'voice_ai_grade' ? compactFlexibleLines(watchAnswerAcceptedAnswers) : [],
      }
    }

    if (activityType === 'hidden_image_guess') {
      const uploadedMedia = await uploadLessonMedia(token!, hiddenGuessFile!)

      return {
        kind: 'hidden_image_guess',
        prompt: hiddenGuessPrompt.trim(),
        image_url: uploadedMedia.url,
        image_kind: uploadedMedia.media_kind || 'image',
        overlay_rows: Math.max(2, Number(hiddenGuessRows) || 3),
        overlay_cols: Math.max(2, Number(hiddenGuessCols) || 4),
        expected_answer: hiddenGuessExpectedAnswer.trim(),
        accepted_answers: compactFlexibleLines(hiddenGuessAcceptedAnswers),
      }
    }

    if (activityType === 'step_by_step') {
      return {
        kind: 'step_by_step',
        prompt: instructionText.trim(),
        steps: compactLines(stepList),
      }
    }

    if (activityType === 'aac') {
      const uploadedCards = await Promise.all(
        aacImageDrafts.map(async (item, index) => {
          const uploadedMedia = await uploadLessonMedia(token!, item.file!)
          return {
            id: `aac-card-${index + 1}`,
            label: item.label.trim() || `Đáp án ${index + 1}`,
            media_url: uploadedMedia.url,
            media_kind: uploadedMedia.media_kind || 'image',
          }
        }),
      )

      return {
        kind: 'aac',
        prompt: instructionText.trim(),
        cards: uploadedCards.map((item) => item.label),
        image_cards: uploadedCards,
      }
    }

    if (activityType === 'memory_match') {
      const uploadedCards = await Promise.all(
        memoryMatchCardDrafts
          .filter((item) => item.file)
          .map(async (item, index) => {
            const uploadedMedia = await uploadLessonMedia(token!, item.file!)
            return {
              id: `memory-card-${index + 1}`,
              label: item.label.trim() || `Thẻ ${index + 1}`,
              media_url: uploadedMedia.url,
              media_kind: uploadedMedia.media_kind || 'image',
            }
          }),
      )

      return {
        kind: 'memory_match',
        prompt: instructionText.trim(),
        pair_count: uploadedCards.length,
        image_cards: uploadedCards,
      }
    }

    if (activityType === 'quick_tap') {
      const uploadedTargetCards = await Promise.all(
        quickTapTargetDrafts
          .filter((item) => item.file)
          .map(async (item, index) => {
            const uploadedMedia = await uploadLessonMedia(token!, item.file!)
            return {
              id: `quick-target-${index + 1}`,
              label: item.label.trim() || `Mục tiêu ${index + 1}`,
              media_url: uploadedMedia.url,
              media_kind: uploadedMedia.media_kind || 'image',
            }
          }),
      )
      const uploadedDistractorCards = await Promise.all(
        quickTapDistractorDrafts
          .filter((item) => item.file)
          .map(async (item, index) => {
            const uploadedMedia = await uploadLessonMedia(token!, item.file!)
            return {
              id: `quick-distractor-${index + 1}`,
              label: item.label.trim() || `Nhiễu ${index + 1}`,
              media_url: uploadedMedia.url,
              media_kind: uploadedMedia.media_kind || 'image',
            }
          }),
      )

      return {
        kind: 'quick_tap',
        prompt: instructionText.trim(),
        duration_seconds: Math.max(5, Number(quickTapDurationSeconds) || 10),
        target_hits: Math.max(1, Number(quickTapTargetHits) || 6),
        simultaneous_cards: Math.max(1, Number(quickTapSimultaneousCards) || 4),
        spawn_interval_ms: Math.max(1000, Number(quickTapSpawnIntervalMs) || 1600),
        image_cards: uploadedTargetCards,
        distractor_cards: uploadedDistractorCards,
      }
    }

    if (activityType === 'size_order') {
      const uploadedItems = await Promise.all(
        sizeOrderDrafts
          .filter((item) => item.file)
          .map(async (item, index) => {
            const uploadedMedia = await uploadLessonMedia(token!, item.file!)
            return {
              id: `size-item-${index + 1}`,
              label: item.label.trim() || `Con vật ${index + 1}`,
              media_url: uploadedMedia.url,
              media_kind: uploadedMedia.media_kind || 'image',
              rank: index + 1,
            }
          }),
      )

      return {
        kind: 'size_order',
        prompt: instructionText.trim(),
        items: uploadedItems,
      }
    }

    if (activityType === 'habitat_match') {
      const activeHabitats = habitatOptionDrafts.filter((item) => item.label.trim())
      const habitatLabelById = new Map(activeHabitats.map((item) => [item.id, item.label.trim()]))
      const uploadedAnimals = await Promise.all(
        habitatAnimalDrafts
          .filter((item) => item.file)
          .map(async (item, index) => {
            const uploadedMedia = await uploadLessonMedia(token!, item.file!)
            const habitatId = item.habitatId
            return {
              id: `habitat-item-${index + 1}`,
              label: item.label.trim() || `Con vật ${index + 1}`,
              media_url: uploadedMedia.url,
              media_kind: uploadedMedia.media_kind || 'image',
              habitat_id: habitatId,
              habitat: habitatLabelById.get(habitatId) ?? habitatId,
            }
          }),
      )

      return {
        kind: 'habitat_match',
        prompt: instructionText.trim(),
        habitat_cards: activeHabitats.map((item) => ({
          id: item.id,
          label: item.label.trim(),
          media_url: '',
          media_kind: 'image',
        })),
        items: uploadedAnimals,
      }
    }

    if (activityType === 'career_simulation') {
      return {
        kind: 'career_simulation',
        scenario: scenarioText.trim(),
        success_criteria: successCriteriaText.trim(),
      }
    }

    return {
      kind: 'ai_chat',
      starter_prompt: aiStarterPrompt.trim(),
      goals: compactLines(aiGoals),
    }
  }

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateActivityForm()
      if (validationError) {
        throw new Error(validationError)
      }

      const config = await buildActivityPayloadConfig()
      return createLessonActivity(token!, resolvedSelectedLessonId!, {
        title: activityTitle.trim() || activityLabel(activityType),
        activity_type: activityType,
        instruction_text: instructionText.trim(),
        voice_answer_enabled: voiceAnswerEnabled,
        is_required: true,
        sort_order: (lessonDetailQuery.data?.activities?.length ?? 0) + 1,
        difficulty_stage: 1,
        config_json: JSON.stringify(config),
      })
    },
    onSuccess: async () => {
      setActivityTitle('')
      setActivityFormError(null)
      if (activityType === 'image_choice') {
        setImageChoiceFile(null)
      }
      if (activityType === 'image_puzzle') {
        setImagePuzzleFile(null)
      }
      if (activityType === 'memory_match') {
        setMemoryMatchCardDrafts(createDefaultMemoryMatchCardDrafts())
      }
      if (activityType === 'quick_tap') {
        setQuickTapTargetDrafts(createDefaultQuickTapTargetDrafts())
        setQuickTapDistractorDrafts(createDefaultQuickTapDistractorDrafts())
        setQuickTapDurationSeconds('10')
        setQuickTapTargetHits('6')
        setQuickTapSimultaneousCards('4')
        setQuickTapSpawnIntervalMs('1600')
      }
      if (activityType === 'size_order') {
        setSizeOrderDrafts(createDefaultSizeOrderDrafts())
      }
      if (activityType === 'habitat_match') {
        setHabitatOptionDrafts(createDefaultHabitatOptionDrafts())
        setHabitatAnimalDrafts(createDefaultHabitatAnimalDrafts())
      }
      if (activityType === 'watch_answer') {
        setWatchAnswerFile(null)
        setWatchAnswerUrl('')
        setWatchAnswerMode('text')
        setWatchAnswerExpectedAnswer('')
        setWatchAnswerAcceptedAnswers('')
      }
      if (activityType === 'hidden_image_guess') {
        setHiddenGuessFile(null)
        setHiddenGuessExpectedAnswer('')
        setHiddenGuessAcceptedAnswers('')
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, resolvedSelectedLessonId] }),
      ])
    },
    onError: (error) => {
      setActivityFormError(error instanceof Error ? error.message : 'Không thể tạo hoạt động')
    },
  })

  function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !resolvedSubjectId) return
    createLessonMutation.mutate()
  }

  function loadLessonTemplateToForm(template: TeacherLessonTemplate) {
    const subject = findSubjectByTemplateName(subjectsQuery.data ?? [], template.subjectName)
    setTitle(template.lessonTitle)
    setDescription(template.description)
    setEstimatedMinutes(String(template.estimatedMinutes))
    if (subject) {
      setSubjectId(String(subject.id))
      setTemplateFeedback(`Đã nạp mẫu "${template.lessonTitle}" vào form.`)
    } else {
      setTemplateFeedback(`Đã nạp nội dung mẫu, nhưng chưa tìm thấy môn "${template.subjectName}" trong hệ thống.`)
    }
  }

  function handleActivitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActivityFormError(null)
    createActivityMutation.mutate()
  }

  function applyActivityType(nextType: ActivityType) {
    setActivityType(nextType)
    setInstructionText(defaultInstructionForType(nextType))
    setVoiceAnswerEnabled(defaultVoiceEnabledForType(nextType))
    setActivityFormError(null)
    setActivityTitle('')
  }

  function renderFriendlyActivityEditor() {
    if (!selectedActivity) return null

    let parsedConfig: ActivityConfig
    try {
      parsedConfig = parseConfigEditor(editActivityConfigJson)
    } catch {
      return <p className="error-text">Cấu hình hiện tại chưa hợp lệ, chưa thể hiển thị form sửa thân thiện.</p>
    }

    const activityTypeValue = selectedActivity.activity_type as ActivityType
    const ensureFourChoices = (items: string[]) => {
      const nextItems = [...items]
      while (nextItems.length < 4) nextItems.push('')
      return nextItems.slice(0, 4)
    }

    if (activityTypeValue === 'multiple_choice' || activityTypeValue === 'listen_choose') {
      const options = ensureFourChoices(toStringArrayValue(parsedConfig.choices))
      const correctAnswer = toTextValue(parsedConfig.correct)
      const correctIndex = Math.max(0, options.findIndex((item) => item === correctAnswer))
      const promptValue = activityTypeValue === 'listen_choose' ? toTextValue(parsedConfig.audio_text, editActivityPrompt) : editActivityPrompt

      return (
        <ChoiceBuilder
          promptLabel={activityTypeValue === 'listen_choose' ? 'Nội dung nghe' : 'Câu hỏi chính'}
          promptValue={promptValue}
          promptPlaceholder={activityTypeValue === 'listen_choose' ? 'Ví dụ: Đây là con mèo.' : 'Ví dụ: Con vật nào biết bơi?'}
          onPromptChange={(value) =>
            updateActivityConfigState((currentConfig) => ({
              ...writeEditablePrompt(activityTypeValue, currentConfig, value),
              ...(activityTypeValue === 'listen_choose' ? { audio_text: value } : {}),
            }))
          }
          options={options}
          correctIndex={correctIndex}
          onOptionChange={(index, value) =>
            updateActivityConfigState((currentConfig) => {
              const nextChoices = ensureFourChoices(toStringArrayValue(currentConfig.choices))
              nextChoices[index] = value
              const nextCorrectIndex = Math.max(0, nextChoices.findIndex((item) => item === toTextValue(currentConfig.correct)))
              return {
                ...currentConfig,
                choices: nextChoices,
                correct: nextChoices[nextCorrectIndex] ?? nextChoices[0] ?? '',
              }
            })
          }
          onCorrectChange={(index) =>
            updateActivityConfigState((currentConfig) => {
              const nextChoices = ensureFourChoices(toStringArrayValue(currentConfig.choices))
              return {
                ...currentConfig,
                choices: nextChoices,
                correct: nextChoices[index] ?? '',
              }
            })
          }
        />
      )
    }

    if (activityTypeValue === 'image_choice') {
      const options = ensureFourChoices(toStringArrayValue(parsedConfig.choices))
      const correctAnswer = toTextValue(parsedConfig.correct)
      const correctIndex = Math.max(0, options.findIndex((item) => item === correctAnswer))

      return (
        <div className="config-card detail-stack">
          <label>
            Câu hỏi cho học sinh
            <input value={editActivityPrompt} onChange={(event) => handleActivityPromptChange(event.target.value)} placeholder="Ví dụ: Bạn nhìn thấy gì trong ảnh?" />
          </label>

          <label>
            Chọn ảnh thay thế từ máy
            <input
              type="file"
              accept="image/*"
              disabled={editActivityMediaUploadPending}
              onChange={(event) =>
                void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => ({
                  ...currentConfig,
                  media_url: uploadedMedia.url,
                  media_kind: uploadedMedia.media_kind || 'image',
                }))
              }
            />
            {editActivityMediaUrl ? <span className="helper-text">Đã có ảnh cho activity này.</span> : null}
          </label>

          <ChoiceBuilder
            promptLabel="Đáp án"
            promptValue={editActivityPrompt}
            promptPlaceholder="Ví dụ: Bạn nhìn thấy gì trong ảnh?"
            onPromptChange={handleActivityPromptChange}
            showPrompt={false}
            options={options}
            correctIndex={correctIndex}
            onOptionChange={(index, value) =>
              updateActivityConfigState((currentConfig) => {
                const nextChoices = ensureFourChoices(toStringArrayValue(currentConfig.choices))
                nextChoices[index] = value
                const nextCorrectIndex = Math.max(0, nextChoices.findIndex((item) => item === toTextValue(currentConfig.correct)))
                return {
                  ...currentConfig,
                  choices: nextChoices,
                  correct: nextChoices[nextCorrectIndex] ?? nextChoices[0] ?? '',
                }
              })
            }
            onCorrectChange={(index) =>
              updateActivityConfigState((currentConfig) => {
                const nextChoices = ensureFourChoices(toStringArrayValue(currentConfig.choices))
                return {
                  ...currentConfig,
                  choices: nextChoices,
                  correct: nextChoices[index] ?? '',
                }
              })
            }
          />
        </div>
      )
    }

    if (activityTypeValue === 'image_puzzle') {
      return (
        <div className="config-card detail-stack">
          <label>
            Hướng dẫn cho học sinh
            <input value={editActivityPrompt} onChange={(event) => handleActivityPromptChange(event.target.value)} placeholder="Ví dụ: Hãy ghép lại thành hình con mèo." />
          </label>
          <label>
            Chọn ảnh thay thế từ máy
            <input
              type="file"
              accept="image/*"
              disabled={editActivityMediaUploadPending}
              onChange={(event) =>
                void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => ({
                  ...currentConfig,
                  image_url: uploadedMedia.url,
                  image_kind: uploadedMedia.media_kind || 'image',
                }))
              }
            />
          </label>
          <div className="builder-two-columns">
            <label>
              Số hàng
              <input
                value={String(parsedConfig.rows ?? 2)}
                onChange={(event) =>
                  updateActivityConfigState((currentConfig) => {
                    const rows = Math.max(1, Number(event.target.value) || 2)
                    const cols = Math.max(2, Number(currentConfig.cols ?? 3) || 3)
                    return { ...currentConfig, rows, cols, piece_count: rows * cols }
                  })
                }
                inputMode="numeric"
              />
            </label>
            <label>
              Số cột
              <input
                value={String(parsedConfig.cols ?? 3)}
                onChange={(event) =>
                  updateActivityConfigState((currentConfig) => {
                    const cols = Math.max(2, Number(event.target.value) || 3)
                    const rows = Math.max(1, Number(currentConfig.rows ?? 2) || 2)
                    return { ...currentConfig, rows, cols, piece_count: rows * cols }
                  })
                }
                inputMode="numeric"
              />
            </label>
          </div>
        </div>
      )
    }

    if (activityTypeValue === 'matching') {
      const pairs = toEditablePairItems(parsedConfig.pairs)
      return (
        <PairBuilder
          title="Các cặp cần nối"
          helper="Sửa trực tiếp từng cặp trái - phải."
          items={pairs}
          onChange={(index, field, value) =>
            updateActivityConfigState((currentConfig) => {
              const nextPairs = toEditablePairItems(currentConfig.pairs)
              nextPairs[index] = { ...nextPairs[index], [field]: value }
              return { ...currentConfig, pairs: nextPairs }
            })
          }
          onAdd={() =>
            updateActivityConfigState((currentConfig) => ({
              ...currentConfig,
              pairs: [...toEditablePairItems(currentConfig.pairs), { left: '', right: '' }],
            }))
          }
          onRemove={(index) =>
            updateActivityConfigState((currentConfig) => ({
              ...currentConfig,
              pairs: toEditablePairItems(currentConfig.pairs).filter((_, itemIndex) => itemIndex !== index),
            }))
          }
        />
      )
    }

    if (activityTypeValue === 'drag_drop') {
      const items = toStringArrayValue(parsedConfig.items)
      const targets = toStringArrayValue(parsedConfig.targets)
      return (
        <div className="builder-two-columns">
          <ListBuilder
            title="Các mục cần kéo"
            helper="Mỗi dòng là một mục."
            items={items.length ? items : createDefaultList()}
            itemPlaceholder="Mục cần kéo"
            onChange={(index, value) =>
              updateActivityConfigState((currentConfig) => {
                const nextItems = toStringArrayValue(currentConfig.items)
                while (nextItems.length <= index) nextItems.push('')
                nextItems[index] = value
                return { ...currentConfig, items: nextItems }
              })
            }
            onAdd={() => updateActivityConfigState((currentConfig) => ({ ...currentConfig, items: [...toStringArrayValue(currentConfig.items), ''] }))}
            onRemove={(index) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, items: toStringArrayValue(currentConfig.items).filter((_, itemIndex) => itemIndex !== index) }))}
          />
          <ListBuilder
            title="Các ô đích"
            helper="Mỗi dòng là một vị trí hoặc nhóm."
            items={targets.length ? targets : createDefaultList()}
            itemPlaceholder="Vị trí đích"
            onChange={(index, value) =>
              updateActivityConfigState((currentConfig) => {
                const nextItems = toStringArrayValue(currentConfig.targets)
                while (nextItems.length <= index) nextItems.push('')
                nextItems[index] = value
                return { ...currentConfig, targets: nextItems }
              })
            }
            onAdd={() => updateActivityConfigState((currentConfig) => ({ ...currentConfig, targets: [...toStringArrayValue(currentConfig.targets), ''] }))}
            onRemove={(index) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, targets: toStringArrayValue(currentConfig.targets).filter((_, itemIndex) => itemIndex !== index) }))}
          />
        </div>
      )
    }

    if (activityTypeValue === 'watch_answer') {
      return (
        <div className="config-card detail-stack">
          <label>
            Câu hỏi sau khi xem
            <input value={editActivityPrompt} onChange={(event) => handleActivityPromptChange(event.target.value)} placeholder="Ví dụ: Em thấy bạn nhỏ đang làm gì?" />
          </label>
          <label>
            Cách học sinh trả lời
            <select
              value={toTextValue(parsedConfig.answer_mode, 'text')}
              onChange={(event) =>
                updateActivityConfigState((currentConfig) => ({
                  ...currentConfig,
                  answer_mode: event.target.value,
                }))
              }
            >
              <option value="none">Chỉ xem hoặc tương tác</option>
              <option value="text">Gõ câu trả lời ngắn</option>
              <option value="voice_ai_grade">Bấm mic, nhận giọng nói, AI chấm</option>
            </select>
          </label>
          <label>
            Nguồn video
            <select value={editActivityMediaSource} onChange={(event) => setEditActivityMediaSource(event.target.value as MediaSource)}>
              <option value="external">Dán link video</option>
              <option value="upload">Tải ảnh hoặc video từ máy</option>
            </select>
          </label>
          {editActivityMediaSource === 'external' ? (
            <label>
              Link video
              <input value={editActivityMediaUrl} onChange={(event) => handleActivityMediaUrlChange(event.target.value)} placeholder="YouTube / TikTok / Google Drive" />
            </label>
          ) : (
            <label>
              Chọn ảnh hoặc video từ máy
              <input
                type="file"
                accept="image/*,video/*"
                disabled={editActivityMediaUploadPending}
                onChange={(event) => void handleActivityMediaFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {toTextValue(parsedConfig.answer_mode) === 'voice_ai_grade' ? (
            <>
              <label>
                Đáp án mẫu
                <input
                  value={toTextValue(parsedConfig.expected_answer)}
                  onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, expected_answer: event.target.value }))}
                  placeholder="Ví dụ: con mèo"
                />
              </label>
              <label>
                Đáp án chấp nhận thêm
                <textarea
                  value={toStringArrayValue(parsedConfig.accepted_answers).join(', ')}
                  onChange={(event) =>
                    updateActivityConfigState((currentConfig) => ({
                      ...currentConfig,
                      accepted_answers: compactFlexibleLines(event.target.value),
                    }))
                  }
                  rows={3}
                  placeholder="Ví dụ: mèo, con meo, meo"
                />
              </label>
            </>
          ) : null}
        </div>
      )
    }

    if (activityTypeValue === 'hidden_image_guess') {
      return (
        <div className="config-card detail-stack">
          <label>
            Câu hỏi cho học sinh
            <input value={editActivityPrompt} onChange={(event) => handleActivityPromptChange(event.target.value)} placeholder="Ví dụ: Trong ảnh này là con gì?" />
          </label>
          <label>
            Chọn ảnh thay thế từ máy
            <input
              type="file"
              accept="image/*"
              disabled={editActivityMediaUploadPending}
              onChange={(event) =>
                void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => ({
                  ...currentConfig,
                  image_url: uploadedMedia.url,
                  image_kind: uploadedMedia.media_kind || 'image',
                }))
              }
            />
          </label>
          <div className="builder-two-columns">
            <label>
              Số hàng ô che
              <input
                value={String(parsedConfig.overlay_rows ?? 3)}
                onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, overlay_rows: Math.max(2, Number(event.target.value) || 3) }))}
                inputMode="numeric"
              />
            </label>
            <label>
              Số cột ô che
              <input
                value={String(parsedConfig.overlay_cols ?? 4)}
                onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, overlay_cols: Math.max(2, Number(event.target.value) || 4) }))}
                inputMode="numeric"
              />
            </label>
          </div>
          <label>
            Đáp án mẫu
            <input
              value={toTextValue(parsedConfig.expected_answer)}
              onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, expected_answer: event.target.value }))}
              placeholder="Ví dụ: con gấu"
            />
          </label>
          <label>
            Đáp án chấp nhận thêm
            <textarea
              value={toStringArrayValue(parsedConfig.accepted_answers).join(', ')}
              onChange={(event) =>
                updateActivityConfigState((currentConfig) => ({
                  ...currentConfig,
                  accepted_answers: compactFlexibleLines(event.target.value),
                }))
              }
              rows={3}
              placeholder="Ví dụ: gấu, con gau, gau"
            />
          </label>
        </div>
      )
    }

    if (activityTypeValue === 'step_by_step') {
      const steps = toStringArrayValue(parsedConfig.steps)
      return (
        <ListBuilder
          title="Các bước học sinh cần làm"
          helper="Sửa trực tiếp từng bước."
          items={steps.length ? steps : createDefaultList()}
          itemPlaceholder="Bước"
          onChange={(index, value) =>
            updateActivityConfigState((currentConfig) => {
              const nextItems = toStringArrayValue(currentConfig.steps)
              while (nextItems.length <= index) nextItems.push('')
              nextItems[index] = value
              return { ...currentConfig, steps: nextItems }
            })
          }
          onAdd={() => updateActivityConfigState((currentConfig) => ({ ...currentConfig, steps: [...toStringArrayValue(currentConfig.steps), ''] }))}
          onRemove={(index) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, steps: toStringArrayValue(currentConfig.steps).filter((_, itemIndex) => itemIndex !== index) }))}
        />
      )
    }

    if (activityTypeValue === 'aac') {
      const cards = toEditableMediaCards(parsedConfig.image_cards, 4)
      return (
        <div className="config-card detail-stack">
          <strong>4 thẻ lựa chọn</strong>
          <div className="builder-two-columns">
            {cards.map((item, index) => (
              <div key={item.id} className="config-card detail-stack">
                <strong>Thẻ {index + 1}</strong>
                <label>
                  Chọn ảnh từ máy
                  <input
                    type="file"
                    accept="image/*"
                    disabled={editActivityMediaUploadPending}
                    onChange={(event) =>
                      void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => {
                        const nextCards = toEditableMediaCards(currentConfig.image_cards, 4)
                        nextCards[index] = {
                          ...nextCards[index],
                          media_url: uploadedMedia.url,
                          media_kind: uploadedMedia.media_kind || 'image',
                        }
                        return {
                          ...currentConfig,
                          image_cards: nextCards,
                          cards: nextCards.map((card) => card.label),
                        }
                      })
                    }
                  />
                </label>
                <label>
                  Nhãn hiển thị
                  <input
                    value={item.label}
                    onChange={(event) =>
                      updateActivityConfigState((currentConfig) => {
                        const nextCards = toEditableMediaCards(currentConfig.image_cards, 4)
                        nextCards[index] = { ...nextCards[index], label: event.target.value }
                        return {
                          ...currentConfig,
                          image_cards: nextCards,
                          cards: nextCards.map((card) => card.label),
                        }
                      })
                    }
                    placeholder={`Đáp án ${index + 1}`}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activityTypeValue === 'memory_match') {
      const cards = toEditableMediaCards(parsedConfig.image_cards, Math.max(2, Number(parsedConfig.pair_count ?? 5) || 5))
      return (
        <div className="config-card detail-stack">
          <strong>Các cặp thẻ</strong>
          <div className="builder-two-columns">
            {cards.map((item, index) => (
              <div key={item.id} className="config-card detail-stack">
                <strong>Cặp thẻ {index + 1}</strong>
                <label>
                  Chọn ảnh từ máy
                  <input
                    type="file"
                    accept="image/*"
                    disabled={editActivityMediaUploadPending}
                    onChange={(event) =>
                      void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => {
                        const nextCards = toEditableMediaCards(currentConfig.image_cards, cards.length)
                        nextCards[index] = {
                          ...nextCards[index],
                          media_url: uploadedMedia.url,
                          media_kind: uploadedMedia.media_kind || 'image',
                        }
                        return { ...currentConfig, image_cards: nextCards, pair_count: nextCards.filter((card) => card.media_url).length }
                      })
                    }
                  />
                </label>
                <label>
                  Tên gợi nhớ
                  <input
                    value={item.label}
                    onChange={(event) =>
                      updateActivityConfigState((currentConfig) => {
                        const nextCards = toEditableMediaCards(currentConfig.image_cards, cards.length)
                        nextCards[index] = { ...nextCards[index], label: event.target.value }
                        return { ...currentConfig, image_cards: nextCards }
                      })
                    }
                    placeholder="Ví dụ: Con mèo"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activityTypeValue === 'quick_tap') {
      const targetCards = toEditableMediaCards(parsedConfig.image_cards, 4)
      const distractorCards = toEditableMediaCards(parsedConfig.distractor_cards, 2)
      return (
        <div className="detail-stack">
          <div className="config-card detail-stack">
            <strong>Thiết lập trò chơi</strong>
            <div className="builder-two-columns">
              <label>
                Thời gian chơi (giây)
                <input value={String(parsedConfig.duration_seconds ?? 10)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, duration_seconds: Math.max(5, Number(event.target.value) || 10) }))} inputMode="numeric" />
              </label>
              <label>
                Số lần chạm cần đạt
                <input value={String(parsedConfig.target_hits ?? 6)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, target_hits: Math.max(1, Number(event.target.value) || 6) }))} inputMode="numeric" />
              </label>
              <label>
                Số thẻ rơi cùng lúc
                <input value={String(parsedConfig.simultaneous_cards ?? 4)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, simultaneous_cards: Math.max(1, Number(event.target.value) || 4) }))} inputMode="numeric" />
              </label>
              <label>
                Nhịp xuất hiện thẻ (ms)
                <input value={String(parsedConfig.spawn_interval_ms ?? 1600)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, spawn_interval_ms: Math.max(1000, Number(event.target.value) || 1600) }))} inputMode="numeric" />
              </label>
            </div>
          </div>
          <div className="config-card detail-stack">
            <strong>Ảnh mục tiêu</strong>
            <div className="builder-two-columns">
              {targetCards.map((item, index) => (
                <div key={item.id} className="config-card detail-stack">
                  <strong>Mục tiêu {index + 1}</strong>
                  <label>
                    Chọn ảnh từ máy
                    <input
                      type="file"
                      accept="image/*"
                      disabled={editActivityMediaUploadPending}
                      onChange={(event) =>
                        void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => {
                          const nextCards = toEditableMediaCards(currentConfig.image_cards, targetCards.length)
                          nextCards[index] = {
                            ...nextCards[index],
                            media_url: uploadedMedia.url,
                            media_kind: uploadedMedia.media_kind || 'image',
                          }
                          return { ...currentConfig, image_cards: nextCards }
                        })
                      }
                    />
                  </label>
                  <label>
                    Nhãn
                    <input
                      value={item.label}
                      onChange={(event) =>
                        updateActivityConfigState((currentConfig) => {
                          const nextCards = toEditableMediaCards(currentConfig.image_cards, targetCards.length)
                          nextCards[index] = { ...nextCards[index], label: event.target.value }
                          return { ...currentConfig, image_cards: nextCards }
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="config-card detail-stack">
            <strong>Ảnh gây nhiễu</strong>
            <div className="builder-two-columns">
              {distractorCards.map((item, index) => (
                <div key={item.id} className="config-card detail-stack">
                  <strong>Nhiễu {index + 1}</strong>
                  <label>
                    Chọn ảnh từ máy
                    <input
                      type="file"
                      accept="image/*"
                      disabled={editActivityMediaUploadPending}
                      onChange={(event) =>
                        void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => {
                          const nextCards = toEditableMediaCards(currentConfig.distractor_cards, distractorCards.length)
                          nextCards[index] = {
                            ...nextCards[index],
                            media_url: uploadedMedia.url,
                            media_kind: uploadedMedia.media_kind || 'image',
                          }
                          return { ...currentConfig, distractor_cards: nextCards }
                        })
                      }
                    />
                  </label>
                  <label>
                    Nhãn
                    <input
                      value={item.label}
                      onChange={(event) =>
                        updateActivityConfigState((currentConfig) => {
                          const nextCards = toEditableMediaCards(currentConfig.distractor_cards, distractorCards.length)
                          nextCards[index] = { ...nextCards[index], label: event.target.value }
                          return { ...currentConfig, distractor_cards: nextCards }
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activityTypeValue === 'size_order') {
      const items = toEditableOrderedItems(parsedConfig.items, 3)
      return (
        <div className="config-card detail-stack">
          <strong>Các mục theo thứ tự</strong>
          <div className="builder-stack">
            {items.map((item, index) => (
              <div key={item.id} className="config-card detail-stack">
                <strong>Vị trí {index + 1}</strong>
                <div className="builder-two-columns">
                  <label>
                    Chọn ảnh từ máy
                    <input
                      type="file"
                      accept="image/*"
                      disabled={editActivityMediaUploadPending}
                      onChange={(event) =>
                        void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => {
                          const nextItems = toEditableOrderedItems(currentConfig.items, items.length)
                          nextItems[index] = {
                            ...nextItems[index],
                            media_url: uploadedMedia.url,
                            media_kind: uploadedMedia.media_kind || 'image',
                          }
                          return { ...currentConfig, items: nextItems }
                        })
                      }
                    />
                  </label>
                  <label>
                    Thứ tự đúng
                    <input
                      value={String(item.rank)}
                      onChange={(event) =>
                        updateActivityConfigState((currentConfig) => {
                          const nextItems = toEditableOrderedItems(currentConfig.items, items.length)
                          nextItems[index] = { ...nextItems[index], rank: Math.max(1, Number(event.target.value) || index + 1) }
                          return { ...currentConfig, items: nextItems }
                        })
                      }
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <label>
                  Tên hiển thị
                  <input
                    value={item.label}
                    onChange={(event) =>
                      updateActivityConfigState((currentConfig) => {
                        const nextItems = toEditableOrderedItems(currentConfig.items, items.length)
                        nextItems[index] = { ...nextItems[index], label: event.target.value }
                        return { ...currentConfig, items: nextItems }
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activityTypeValue === 'habitat_match') {
      const options = toEditableHabitatOptions(parsedConfig.habitat_cards, parsedConfig.habitats, 2)
      const items = toEditableHabitatItems(parsedConfig.items, 2)
      return (
        <div className="detail-stack">
          <div className="config-card detail-stack">
            <strong>Danh sách nơi sống</strong>
            <div className="builder-two-columns">
              {options.map((item, index) => (
                <label key={item.id}>
                  Nơi sống {index + 1}
                  <input
                    value={item.label}
                    onChange={(event) =>
                      updateActivityConfigState((currentConfig) => {
                        const nextOptions = toEditableHabitatOptions(currentConfig.habitat_cards, currentConfig.habitats, options.length)
                        nextOptions[index] = { ...nextOptions[index], label: event.target.value }
                        return {
                          ...currentConfig,
                          habitat_cards: nextOptions,
                          habitats: nextOptions.map((option) => option.label),
                        }
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="config-card detail-stack">
            <strong>Các con vật cần ghép</strong>
            <div className="builder-two-columns">
              {items.map((item, index) => (
                <div key={item.id} className="config-card detail-stack">
                  <strong>Con vật {index + 1}</strong>
                  <label>
                    Chọn ảnh từ máy
                    <input
                      type="file"
                      accept="image/*"
                      disabled={editActivityMediaUploadPending}
                      onChange={(event) =>
                        void uploadActivityConfigMedia(event.target.files?.[0] ?? null, (currentConfig, uploadedMedia) => {
                          const nextItems = toEditableHabitatItems(currentConfig.items, items.length)
                          nextItems[index] = {
                            ...nextItems[index],
                            media_url: uploadedMedia.url,
                            media_kind: uploadedMedia.media_kind || 'image',
                          }
                          return { ...currentConfig, items: nextItems }
                        })
                      }
                    />
                  </label>
                  <label>
                    Tên con vật
                    <input
                      value={item.label}
                      onChange={(event) =>
                        updateActivityConfigState((currentConfig) => {
                          const nextItems = toEditableHabitatItems(currentConfig.items, items.length)
                          nextItems[index] = { ...nextItems[index], label: event.target.value }
                          return { ...currentConfig, items: nextItems }
                        })
                      }
                    />
                  </label>
                  <label>
                    Nơi sống đúng
                    <select
                      value={item.habitat_id}
                      onChange={(event) =>
                        updateActivityConfigState((currentConfig) => {
                          const nextItems = toEditableHabitatItems(currentConfig.items, items.length)
                          const nextOptions = toEditableHabitatOptions(currentConfig.habitat_cards, currentConfig.habitats, options.length)
                          const selectedOption = nextOptions.find((option) => option.id === event.target.value)
                          nextItems[index] = {
                            ...nextItems[index],
                            habitat_id: event.target.value,
                            habitat: selectedOption?.label ?? event.target.value,
                          }
                          return { ...currentConfig, items: nextItems }
                        })
                      }
                    >
                      <option value="">Chọn nơi sống</option>
                      {options.filter((option) => option.label.trim()).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activityTypeValue === 'career_simulation') {
      return (
        <div className="config-card detail-stack">
          <label>
            Bối cảnh hoạt động
            <textarea value={toTextValue(parsedConfig.scenario)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, scenario: event.target.value }))} rows={4} />
          </label>
          <label>
            Tiêu chí hoàn thành
            <textarea value={toTextValue(parsedConfig.success_criteria)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, success_criteria: event.target.value }))} rows={3} />
          </label>
        </div>
      )
    }

    if (activityTypeValue === 'ai_chat') {
      const goals = toStringArrayValue(parsedConfig.goals)
      return (
        <div className="detail-stack">
          <div className="config-card detail-stack">
            <label>
              Lời mở đầu cho AI
              <textarea value={toTextValue(parsedConfig.starter_prompt)} onChange={(event) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, starter_prompt: event.target.value }))} rows={4} />
            </label>
          </div>
          <ListBuilder
            title="Mục tiêu học sinh cần đạt"
            helper="Mỗi dòng là một mục tiêu."
            items={goals.length ? goals : createDefaultList()}
            itemPlaceholder="Mục tiêu"
            onChange={(index, value) =>
              updateActivityConfigState((currentConfig) => {
                const nextItems = toStringArrayValue(currentConfig.goals)
                while (nextItems.length <= index) nextItems.push('')
                nextItems[index] = value
                return { ...currentConfig, goals: nextItems }
              })
            }
            onAdd={() => updateActivityConfigState((currentConfig) => ({ ...currentConfig, goals: [...toStringArrayValue(currentConfig.goals), ''] }))}
            onRemove={(index) => updateActivityConfigState((currentConfig) => ({ ...currentConfig, goals: toStringArrayValue(currentConfig.goals).filter((_, itemIndex) => itemIndex !== index) }))}
          />
        </div>
      )
    }

    return null
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow">Bài học</p>
            <h2>Tạo bài, thêm hoạt động</h2>
            <p>Giữ form sâu khi cần, còn phần chọn và xem nhanh được rút gọn.</p>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>{visibleLessons.length} bài</span>
            <span>{subjectsQuery.data?.length ?? 0} môn</span>
            <span>{lessonDetailQuery.data?.activities?.length ?? 0} hoạt động</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          <article className="mini-card teacher-clean-metric teacher-clean-metric-blue">
            <span>Bài học</span>
            <strong>{visibleLessons.length}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-green">
            <span>Hoạt động</span>
            <strong>{lessonDetailQuery.data?.activities?.length ?? 0}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-gold">
            <span>Môn</span>
            <strong>{subjectsQuery.data?.length ?? 0}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-coral">
            <span>Loại đang chọn</span>
            <strong>{activityLabel(activityType)}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-ink">
            <span>Mức đang làm</span>
            <strong>{levelLabel(activeLessonLevel)}</strong>
          </article>
        </section>

        <section className="teacher-flow-summary">
          <article className="teacher-step-card teacher-step-card-active">
            <span>Bước 1</span>
            <strong>Chọn mức</strong>
            <p>{`Đang làm nội dung mức ${levelLabel(activeLessonLevel)}.`}</p>
          </article>
          <article className={title.trim() && resolvedSubjectId ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 2</span>
            <strong>Tạo bài học</strong>
            <p>{title.trim() ? title : 'Nhập tên bài và chọn môn.'}</p>
          </article>
          <article className={resolvedSelectedLessonId ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 3</span>
            <strong>Chọn bài</strong>
            <p>{selectedLesson?.title ?? 'Chưa chọn bài để thêm hoạt động.'}</p>
          </article>
          <article className={isActivityFormOpen ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 4</span>
            <strong>Thêm hoạt động</strong>
            <p>{isActivityFormOpen ? 'Form đang mở để nhập hoạt động.' : 'Mở form khi đã chọn bài.'}</p>
          </article>
          <article className={selectedActivity ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 5</span>
            <strong>Kiểm tra lại</strong>
            <p>{selectedActivity ? 'Đang xem và sửa hoạt động đã chọn.' : 'Chọn hoạt động để xem trước.'}</p>
          </article>
        </section>

        <section className="lessons-workspace">
          <div className="lessons-sidebar-stack">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Bước 1</p>
                <h3>Chọn mức độ</h3>
              </div>
            </div>
            <div className="tag-wrap">
              {LEVEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeLessonLevel === option.value ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setActiveLessonLevel(option.value as LessonLevel)}
                >
                  {`${option.label} (${lessonLevelCounts[option.value as keyof typeof lessonLevelCounts]})`}
                </button>
              ))}
            </div>
            <p className="helper-text">Chọn một mức trước. Bài tạo mới và danh sách bên dưới sẽ đi theo mức này.</p>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Thư viện mẫu</p>
                <h3>Mẫu bài học giáo viên</h3>
              </div>
            </div>
            <div className="student-list compact-list">
              {activeTeacherTemplates.map((template) => {
                const matchedSubject = templateSubjectMap.get(template.id) ?? null
                return (
                  <article key={template.id} className="config-card detail-stack">
                    <div className="student-row">
                      <strong>{template.subjectName}</strong>
                      <span>{template.topicSummary}</span>
                    </div>
                    <p>{template.lessonTitle}</p>
                    <p className="helper-text">{template.description}</p>
                    <p className="helper-text">{`2 hoạt động mẫu: ${template.activities.map((item) => item.title).join(' | ')}`}</p>
                    {template.notes ? <p className="helper-text">{template.notes}</p> : null}
                    <p className="helper-text">
                      {matchedSubject ? `Môn trong hệ thống: ${matchedSubject.name}` : `Chưa tìm thấy môn ${template.subjectName} trong hệ thống`}
                    </p>
                    <div className="button-row">
                      <button className="ghost-button" type="button" onClick={() => loadLessonTemplateToForm(template)}>
                        Nạp vào form
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        disabled={!token || subjectsQuery.isLoading || createTemplateLessonMutation.isPending || !matchedSubject}
                        onClick={() => createTemplateLessonMutation.mutate(template)}
                      >
                        {createTemplateLessonMutation.isPending ? 'Đang tạo bài mẫu...' : 'Tạo nhanh bài mẫu'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
            {!activeTeacherTemplates.length ? <p className="helper-text">Chưa có bài mẫu cho mức này.</p> : null}
            {templateFeedback ? <p className="helper-text">{templateFeedback}</p> : null}
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Bước 2</p>
                <h3>Bài học</h3>
              </div>
            </div>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
              <div className="teacher-inline-note">
                Nếu giáo viên chỉ cần nhập nhanh, phần bắt buộc chỉ có tên bài và môn học. Mức độ sẽ tự bám theo bước 1.
              </div>
              <label>
                Tên bài học
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Nhận biết động vật sống dưới nước" />
              </label>

              <label>
                Môn học
                <select value={resolvedSubjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Chọn môn học</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <details className="config-card">
                <summary className="simple-summary">Tùy chọn thêm</summary>
                <div className="detail-stack">
                  <strong>{`Mức đang tạo: ${levelLabel(activeLessonLevel)}`}</strong>
                  <p className="helper-text">Muốn tạo bài cho mức khác, đổi mức ở bước 1.</p>
                </div>

                <label>
                  Mô tả ngắn
                  <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả nhanh bài học này dùng để rèn kỹ năng gì" />
                </label>

                <label>
                  Số phút dự kiến
                  <input value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} inputMode="numeric" />
                </label>
              </details>

              <button className="action-button" type="submit" disabled={createLessonMutation.isPending}>
                {createLessonMutation.isPending ? 'Đang tạo bài học...' : 'Tạo bài học'}
              </button>
              {createLessonMutation.error ? <p className="error-text">{(createLessonMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Bước 3</p>
                <h3>Chọn bài</h3>
              </div>
            </div>
            <p className="helper-text">{`Đang hiển thị bài thuộc mức ${levelLabel(activeLessonLevel)}.`}</p>
            {selectedLesson ? (
              <div className="teacher-selection-card">
                <span>Bài đang chọn</span>
                <strong>{selectedLesson.title}</strong>
                <p>{`${selectedLessonSubjectName} / ${levelLabel(selectedLesson.primary_level)} / ${lessonActivities.length} hoạt động${selectedLessonEstimatedMinutes ? ` / ${selectedLessonEstimatedMinutes} phút` : ''}`}</p>
              </div>
            ) : (
              <div className="teacher-clean-empty">
                <strong>Chưa có bài được chọn</strong>
                <p>Hãy tạo mới hoặc bấm vào một bài trong danh sách bên dưới để thêm hoạt động.</p>
              </div>
            )}
            <div className="tag-wrap">
              {visibleLessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={resolvedSelectedLessonId === lesson.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  {`${lesson.title} (${levelLabel(lesson.primary_level)})`}
                </button>
              ))}
            </div>
            {!visibleLessons.length && !lessonsQuery.isLoading ? <p>{`Chưa có bài học nào ở mức ${levelLabel(activeLessonLevel)}.`}</p> : null}
          </article>
          </div>

          <article className="roadmap-panel lessons-editor-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Bước 4</p>
                <h3>Thêm hoạt động cho bài đang chọn</h3>
              </div>
              {selectedLesson ? <span className="subject-pill muted-pill">{lessonActivities.length} hoạt động</span> : null}
            </div>
            <div className="teacher-inline-note">
              {selectedLesson
                ? `Bạn đang thêm hoạt động cho bài "${selectedLesson.title}".`
                : 'Hãy chọn một bài ở bước 3 trước khi mở form thêm hoạt động.'}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!canCreateActivity) return
                setIsActivityFormOpen((current) => !current)
              }}
              className={canCreateActivity ? 'simple-toggle-button' : 'simple-toggle-button simple-toggle-button-disabled'}
              disabled={!canCreateActivity}
            >
              <span>Thêm hoạt động</span>
              <span>{isActivityFormOpen ? 'Ẩn bớt' : 'Mở nhanh'}</span>
            </button>

            {isActivityFormOpen ? (
              <form className="form-stack" onSubmit={handleActivitySubmit}>
                <div className="detail-stack">
                  <strong>1. Chọn loại</strong>
                  <div className="builder-type-grid">
                    {ACTIVITY_TYPES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={activityType === option.value ? 'builder-type-card builder-type-card-active' : 'builder-type-card'}
                        onClick={() => applyActivityType(option.value)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="helper-text">{currentActivityDescription}</p>
                </div>

                <div className="config-card detail-stack">
                  <strong>2. Đặt tên và hướng dẫn</strong>
                  <label>
                    Tên hoạt động
                    <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder={activityLabel(activityType)} />
                  </label>
                  <label>
                    Hướng dẫn hiển thị cho học sinh
                    <input value={instructionText} onChange={(event) => setInstructionText(event.target.value)} placeholder="Ví dụ: Hãy nhìn kỹ rồi chọn câu trả lời đúng." />
                  </label>
                </div>

                {activityType === 'multiple_choice' ? (
                  <ChoiceBuilder
                    promptLabel="3. Nhập câu hỏi"
                    promptValue={questionPrompt}
                    promptPlaceholder="Ví dụ: Con vật nào biết bơi?"
                    onPromptChange={setQuestionPrompt}
                    options={choiceOptions}
                    correctIndex={correctChoiceIndex}
                    onOptionChange={(index, value) => updateChoiceOption(setChoiceOptions, index, value)}
                    onCorrectChange={setCorrectChoiceIndex}
                  />
                ) : null}

                {activityType === 'image_choice' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Hình ảnh và đáp án</strong>

                    <label>
                      Câu hỏi cho học sinh
                      <input value={imageChoicePrompt} onChange={(event) => setImageChoicePrompt(event.target.value)} placeholder="Ví dụ: Bạn nhìn thấy gì trong tấm ảnh này?" />
                    </label>

                    <label>
                      Chọn ảnh từ máy
                      <input type="file" accept="image/*" onChange={(event) => setImageChoiceFile(event.target.files?.[0] ?? null)} />
                    </label>

                    {imageChoiceFile ? <p className="helper-text">Đã chọn ảnh: {imageChoiceFile.name}</p> : null}

                    <ChoiceBuilder
                      promptLabel="4. 4 đáp án gợi ý"
                      promptValue={imageChoicePrompt}
                      promptPlaceholder="Ví dụ: Bạn nhìn thấy gì trong tấm ảnh này?"
                      onPromptChange={setImageChoicePrompt}
                      showPrompt={false}
                      options={imageChoiceOptions}
                      correctIndex={imageChoiceCorrectIndex}
                      onOptionChange={(index, value) => updateChoiceOption(setImageChoiceOptions, index, value)}
                      onCorrectChange={setImageChoiceCorrectIndex}
                    />
                  </div>
                ) : null}

                {activityType === 'image_puzzle' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Ảnh gốc để cắt thành mảnh ghép</strong>

                    <label>
                      Hướng dẫn hiện cho học sinh
                      <input value={imagePuzzlePrompt} onChange={(event) => setImagePuzzlePrompt(event.target.value)} placeholder="Ví dụ: Hãy ghép lại thành hình con mèo." />
                    </label>

                    <label>
                      Chọn ảnh từ máy
                      <input type="file" accept="image/*" onChange={(event) => setImagePuzzleFile(event.target.files?.[0] ?? null)} />
                    </label>

                    {imagePuzzleFile ? <p className="helper-text">Đã chọn ảnh: {imagePuzzleFile.name}</p> : null}

                    <div className="builder-two-columns">
                      <label>
                        Số hàng mảnh ghép
                        <input value={imagePuzzleRows} onChange={(event) => setImagePuzzleRows(event.target.value)} inputMode="numeric" />
                      </label>
                      <label>
                        Số cột mảnh ghép
                        <input value={imagePuzzleCols} onChange={(event) => setImagePuzzleCols(event.target.value)} inputMode="numeric" />
                      </label>
                    </div>

                    <p className="helper-text">Gợi ý: để khoảng 5 đến 7 mảnh thì dùng 2 hàng x 3 cột hoặc 2 hàng x 4 cột.</p>
                  </div>
                ) : null}

                {activityType === 'listen_choose' ? (
                  <ChoiceBuilder
                    promptLabel="3. Nội dung nghe"
                    promptValue={listenPrompt}
                    promptPlaceholder="Ví dụ: Cô đọc: Đây là con mèo."
                    onPromptChange={setListenPrompt}
                    options={listenOptions}
                    correctIndex={listenCorrectIndex}
                    onOptionChange={(index, value) => updateChoiceOption(setListenOptions, index, value)}
                    onCorrectChange={setListenCorrectIndex}
                  />
                ) : null}

                {activityType === 'memory_match' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Ảnh cho các cặp lật thẻ</strong>
                    <p className="helper-text">
                      Mỗi ảnh sẽ tự nhân đôi thành 1 cặp giống nhau. Có sẵn 5 ô tải ảnh và bạn cần chọn ít nhất 2 ảnh để tạo hoạt động.
                    </p>

                    <div className="builder-two-columns">
                      {memoryMatchCardDrafts.map((item, index) => (
                        <div key={`memory-match-${index}`} className="config-card detail-stack">
                          <strong>Cặp thẻ {index + 1}</strong>
                          <label>
                            Chọn ảnh từ máy
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] ?? null
                                setMemoryMatchCardDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, file: nextFile } : draft)),
                                )
                              }}
                            />
                          </label>
                          <p className="helper-text">{item.file ? `Đã chọn: ${item.file.name}` : 'Chưa chọn ảnh cho cặp này.'}</p>
                          <label>
                            Tên gợi nhớ cho giáo viên
                            <input
                              value={item.label}
                              onChange={(event) =>
                                setMemoryMatchCardDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                )
                              }
                              placeholder="Ví dụ: Con mèo"
                            />
                          </label>
                        </div>
                      ))}
                    </div>

                    <p className="helper-text">
                      Sau khi bấm thêm, hoạt động sẽ xuất hiện ở khu "Bài đã tạo" bên phải. Bấm vào hoạt động đó để xem bản xem trước như học sinh.
                    </p>
                  </div>
                ) : null}

                {activityType === 'quick_tap' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Thiết lập trò chạm đúng nhanh</strong>
                    <div className="builder-two-columns">
                      <label>
                        Thời gian chơi (giây)
                        <input value={quickTapDurationSeconds} onChange={(event) => setQuickTapDurationSeconds(event.target.value)} inputMode="numeric" />
                      </label>
                      <label>
                        Số lần chạm cần đạt
                        <input value={quickTapTargetHits} onChange={(event) => setQuickTapTargetHits(event.target.value)} inputMode="numeric" />
                      </label>
                      <label>
                        Số thẻ rơi cùng lúc
                        <input value={quickTapSimultaneousCards} onChange={(event) => setQuickTapSimultaneousCards(event.target.value)} inputMode="numeric" />
                      </label>
                      <label>
                        Nhịp xuất hiện thẻ (ms)
                        <input value={quickTapSpawnIntervalMs} onChange={(event) => setQuickTapSpawnIntervalMs(event.target.value)} inputMode="numeric" />
                      </label>
                    </div>

                    <div className="detail-stack">
                      <strong>4. Ảnh mục tiêu</strong>
                      <p className="helper-text">Đây là các ảnh học sinh cần chạm đúng. Cần ít nhất 2 ảnh.</p>
                      <div className="builder-two-columns">
                        {quickTapTargetDrafts.map((item, index) => (
                          <div key={`quick-target-${index}`} className="config-card detail-stack">
                            <strong>Mục tiêu {index + 1}</strong>
                            <label>
                              Chọn ảnh từ máy
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  const nextFile = event.target.files?.[0] ?? null
                                  setQuickTapTargetDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, file: nextFile } : draft)),
                                  )
                                }}
                              />
                            </label>
                            <p className="helper-text">{item.file ? `Đã chọn: ${item.file.name}` : 'Chưa chọn ảnh.'}</p>
                            <label>
                              Tên gợi nhớ
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  setQuickTapTargetDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                  )
                                }
                                placeholder="Ví dụ: Cá"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="detail-stack">
                      <strong>5. Ảnh gây nhiễu</strong>
                      <p className="helper-text">Tùy chọn. Nếu tải lên, học sinh sẽ phải tránh chạm nhầm các ảnh này.</p>
                      <div className="builder-two-columns">
                        {quickTapDistractorDrafts.map((item, index) => (
                          <div key={`quick-distractor-${index}`} className="config-card detail-stack">
                            <strong>Ảnh nhiễu {index + 1}</strong>
                            <label>
                              Chọn ảnh từ máy
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  const nextFile = event.target.files?.[0] ?? null
                                  setQuickTapDistractorDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, file: nextFile } : draft)),
                                  )
                                }}
                              />
                            </label>
                            <p className="helper-text">{item.file ? `Đã chọn: ${item.file.name}` : 'Có thể để trống.'}</p>
                            <label>
                              Tên gợi nhớ
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  setQuickTapDistractorDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                  )
                                }
                                placeholder="Ví dụ: Mèo"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activityType === 'size_order' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Ảnh theo thứ tự từ bé đến lớn</strong>
                    <p className="helper-text">Thứ tự bạn nhập từ trên xuống sẽ là đáp án đúng từ bé nhất đến lớn nhất. Cần ít nhất 3 ảnh.</p>

                    <div className="builder-stack">
                      {sizeOrderDrafts.map((item, index) => (
                        <div key={`size-order-${index}`} className="config-card detail-stack">
                          <strong>Vị trí {index + 1}</strong>
                          <label>
                            Chọn ảnh từ máy
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] ?? null
                                setSizeOrderDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, file: nextFile } : draft)),
                                )
                              }}
                            />
                          </label>
                          <p className="helper-text">{item.file ? `Đã chọn: ${item.file.name}` : 'Có thể để trống.'}</p>
                          <label>
                            Tên con vật / đồ vật
                            <input
                              value={item.label}
                              onChange={(event) =>
                                setSizeOrderDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                )
                              }
                              placeholder="Ví dụ: Con mèo"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activityType === 'habitat_match' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Nơi sống và con vật</strong>
                    <p className="helper-text">Nhập nơi sống trước, sau đó tải ảnh từng con vật và gán đúng nơi sống cho nó.</p>

                    <div className="detail-stack">
                      <strong>4. Danh sách nơi sống</strong>
                      <div className="builder-two-columns">
                        {habitatOptionDrafts.map((item, index) => (
                          <label key={item.id}>
                            Nơi sống {index + 1}
                            <input
                              value={item.label}
                              onChange={(event) =>
                                setHabitatOptionDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                )
                              }
                              placeholder="Ví dụ: Rừng"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="detail-stack">
                      <strong>5. Các con vật cần ghép</strong>
                      <div className="builder-two-columns">
                        {habitatAnimalDrafts.map((item, index) => (
                          <div key={`habitat-animal-${index}`} className="config-card detail-stack">
                            <strong>Con vật {index + 1}</strong>
                            <label>
                              Chọn ảnh từ máy
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  const nextFile = event.target.files?.[0] ?? null
                                  setHabitatAnimalDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, file: nextFile } : draft)),
                                  )
                                }}
                              />
                            </label>
                            <p className="helper-text">{item.file ? `Đã chọn: ${item.file.name}` : 'Có thể để trống.'}</p>
                            <label>
                              Tên con vật
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  setHabitatAnimalDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                  )
                                }
                                placeholder="Ví dụ: Cá"
                              />
                            </label>
                            <label>
                              Nơi sống đúng
                              <select
                                value={item.habitatId}
                                onChange={(event) =>
                                  setHabitatAnimalDrafts((current) =>
                                    current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, habitatId: event.target.value } : draft)),
                                  )
                                }
                              >
                                <option value="">Chọn nơi sống</option>
                                {habitatOptionDrafts.filter((option) => option.label.trim()).map((option) => (
                                  <option key={`${item.label}-${option.id}`} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activityType === 'matching' ? (
                  <PairBuilder
                    title="3. Nhập từng cặp cần nối"
                    helper="Mỗi hàng là một cặp tương ứng, ví dụ trái là hình hoặc từ khóa, phải là đáp án đúng đi cùng."
                    items={matchingPairs}
                    onChange={updatePair}
                    onAdd={() => setMatchingPairs((current) => [...current, { left: '', right: '' }])}
                    onRemove={(index) => setMatchingPairs((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  />
                ) : null}

                {activityType === 'drag_drop' ? (
                  <div className="builder-two-columns">
                    <ListBuilder
                      title="3. Các mục học sinh sẽ kéo"
                      helper="Mỗi dòng là một mục riêng, ví dụ con mèo, quả táo, xe đạp."
                      items={dragItems}
                      itemPlaceholder="Mục cần kéo"
                      onChange={(index, value) => updateList(setDragItems, index, value)}
                      onAdd={() => setDragItems((current) => [...current, ''])}
                      onRemove={(index) => setDragItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    />
                    <ListBuilder
                      title="4. Các ô đích hoặc nhóm"
                      helper="Mỗi dòng là một nhóm hoặc vị trí đích, ví dụ động vật, trái cây, phương tiện."
                      items={dragTargets}
                      itemPlaceholder="Vị trí đích"
                      onChange={(index, value) => updateList(setDragTargets, index, value)}
                      onAdd={() => setDragTargets((current) => [...current, ''])}
                      onRemove={(index) => setDragTargets((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    />
                  </div>
                ) : null}

                {activityType === 'watch_answer' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Nội dung để học sinh xem</strong>
                    <label>
                      Nguồn video
                      <select value={watchAnswerSource} onChange={(event) => setWatchAnswerSource(event.target.value as MediaSource)}>
                        <option value="external">Dán link video</option>
                        <option value="upload">Tải ảnh hoặc video từ máy</option>
                      </select>
                    </label>

                    {watchAnswerSource === 'upload' ? (
                      <label>
                        Chọn ảnh hoặc video từ máy
                        <input type="file" accept="image/*,video/*" onChange={(event) => setWatchAnswerFile(event.target.files?.[0] ?? null)} />
                      </label>
                    ) : (
                      <label>
                        Link video
                        <input value={watchAnswerUrl} onChange={(event) => setWatchAnswerUrl(event.target.value)} placeholder="YouTube / TikTok / Google Drive" />
                      </label>
                    )}

                    {watchAnswerSource === 'upload' && watchAnswerFile ? <p className="helper-text">Đã chọn file: {watchAnswerFile.name}</p> : null}
                    {watchAnswerSource === 'external' ? <p className="helper-text">Dùng link YouTube, TikTok, Google Drive hoặc file video trực tiếp.</p> : null}

                    <label>
                      Câu hỏi sau khi xem
                      <input value={watchAnswerPrompt} onChange={(event) => setWatchAnswerPrompt(event.target.value)} placeholder="Ví dụ: Em thấy bạn nhỏ đang làm gì?" />
                    </label>

                    <label>
                      Cách học sinh trả lời
                      <select
                        value={watchAnswerMode}
                        onChange={(event) => {
                          const nextMode = event.target.value as WatchAnswerMode
                          setWatchAnswerMode(nextMode)
                          if (nextMode === 'voice_ai_grade') {
                            setVoiceAnswerEnabled(true)
                          }
                        }}
                      >
                        <option value="none">Chỉ xem hoặc tương tác</option>
                        <option value="text">Gõ câu trả lời ngắn</option>
                        <option value="voice_ai_grade">Bấm mic, nhận giọng nói, AI chấm</option>
                      </select>
                    </label>

                    {watchAnswerMode === 'voice_ai_grade' ? (
                      <>
                        <label>
                          Đáp án mẫu
                          <input
                            value={watchAnswerExpectedAnswer}
                            onChange={(event) => setWatchAnswerExpectedAnswer(event.target.value)}
                            placeholder="Ví dụ: con mèo"
                          />
                        </label>

                        <label>
                          Đáp án chấp nhận thêm
                          <textarea
                            value={watchAnswerAcceptedAnswers}
                            onChange={(event) => setWatchAnswerAcceptedAnswers(event.target.value)}
                            rows={3}
                            placeholder="Ví dụ: mèo, con meo, meo"
                          />
                        </label>

                        <p className="helper-text">
                          Khi học sinh bấm mic, transcript sẽ được gửi lên server để chấm với Gemini theo đáp án ở trên.
                        </p>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {activityType === 'hidden_image_guess' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Ảnh che ô và đáp án mẫu</strong>

                    <label>
                      Câu hỏi cho học sinh
                      <input value={hiddenGuessPrompt} onChange={(event) => setHiddenGuessPrompt(event.target.value)} placeholder="Ví dụ: Trong bức ảnh này là con gì?" />
                    </label>

                    <label>
                      Chọn ảnh từ máy
                      <input type="file" accept="image/*" onChange={(event) => setHiddenGuessFile(event.target.files?.[0] ?? null)} />
                    </label>

                    {hiddenGuessFile ? <p className="helper-text">Đã chọn ảnh: {hiddenGuessFile.name}</p> : null}

                    <div className="builder-two-columns">
                      <label>
                        Số hàng ô che
                        <input value={hiddenGuessRows} onChange={(event) => setHiddenGuessRows(event.target.value)} inputMode="numeric" />
                      </label>
                      <label>
                        Số cột ô che
                        <input value={hiddenGuessCols} onChange={(event) => setHiddenGuessCols(event.target.value)} inputMode="numeric" />
                      </label>
                    </div>

                    <label>
                      Đáp án mẫu
                      <input value={hiddenGuessExpectedAnswer} onChange={(event) => setHiddenGuessExpectedAnswer(event.target.value)} placeholder="Ví dụ: con gấu" />
                    </label>

                    <label>
                      Đáp án chấp nhận thêm
                      <textarea
                        value={hiddenGuessAcceptedAnswers}
                        onChange={(event) => setHiddenGuessAcceptedAnswers(event.target.value)}
                        rows={3}
                        placeholder="Ví dụ: gấu, con gau, gau"
                      />
                    </label>

                    <p className="helper-text">Học sinh sẽ mở từng ô đen rồi bấm mic để nói. Transcript sẽ được gửi lên AI để so với đáp án mẫu.</p>
                  </div>
                ) : null}

                {activityType === 'step_by_step' ? (
                  <ListBuilder
                    title="3. Các bước học sinh cần làm"
                    helper="Mỗi dòng là một bước rõ ràng, ngắn gọn, dễ thực hiện."
                    items={stepList}
                    itemPlaceholder="Bước"
                    onChange={(index, value) => updateList(setStepList, index, value)}
                    onAdd={() => setStepList((current) => [...current, ''])}
                    onRemove={(index) => setStepList((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  />
                ) : null}

                {activityType === 'aac' ? (
                  <div className="config-card detail-stack">
                    <strong>3. 4 đáp án bằng ảnh</strong>
                    <p className="helper-text">Tải lên đủ 4 ảnh. Nhãn phụ chỉ dùng để giáo viên dễ nhận biết, học sinh sẽ chọn bằng hình ảnh.</p>
                    <div className="builder-two-columns">
                      {aacImageDrafts.map((item, index) => (
                        <div key={`aac-image-${index}`} className="config-card detail-stack">
                          <strong>Ảnh {index + 1}</strong>
                          <label>
                            Chọn ảnh đáp án
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] ?? null
                                setAacImageDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, file: nextFile } : draft)),
                                )
                              }}
                            />
                          </label>
                          {item.file ? <p className="helper-text">Đã chọn: {item.file.name}</p> : null}
                          <label>
                            Nhãn phụ
                            <input
                              value={item.label}
                              onChange={(event) =>
                                setAacImageDrafts((current) =>
                                  current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, label: event.target.value } : draft)),
                                )
                              }
                              placeholder={`Đáp án ${index + 1}`}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activityType === 'career_simulation' ? (
                  <div className="config-card detail-stack">
                    <strong>3. Tình huống mô phỏng</strong>
                    <label>
                      Bối cảnh hoạt động
                      <textarea value={scenarioText} onChange={(event) => setScenarioText(event.target.value)} rows={4} placeholder="Mô tả ngắn gọn tình huống học sinh sẽ tham gia." />
                    </label>
                    <label>
                      Tiêu chí hoàn thành
                      <textarea value={successCriteriaText} onChange={(event) => setSuccessCriteriaText(event.target.value)} rows={3} placeholder="Ví dụ: Trả lời lịch sự, đúng vai, làm đủ bước." />
                    </label>
                  </div>
                ) : null}

                {activityType === 'ai_chat' ? (
                  <div className="builder-two-columns">
                    <div className="config-card detail-stack">
                      <strong>3. Lời mở đầu cho AI</strong>
                      <label>
                        Nội dung AI sẽ nói đầu tiên
                        <textarea value={aiStarterPrompt} onChange={(event) => setAiStarterPrompt(event.target.value)} rows={4} placeholder="Ví dụ: Hãy hỏi em 3 câu ngắn về chủ đề động vật." />
                      </label>
                    </div>
                    <ListBuilder
                      title="4. Mục tiêu học sinh cần đạt"
                      helper="Mỗi dòng là một mục tiêu, ví dụ trả lời ngắn gọn, biết chào hỏi, biết nhờ hỗ trợ."
                      items={aiGoals}
                      itemPlaceholder="Mục tiêu"
                      onChange={(index, value) => updateList(setAiGoals, index, value)}
                      onAdd={() => setAiGoals((current) => [...current, ''])}
                      onRemove={(index) => setAiGoals((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    />
                  </div>
                ) : null}

                <details className="config-card">
                  <summary className="simple-summary">Tùy chọn thêm</summary>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={voiceAnswerEnabled} onChange={(event) => setVoiceAnswerEnabled(event.target.checked)} />
                    Bật trả lời bằng giọng nói
                  </label>
                </details>

                <button className="action-button" type="submit" disabled={!resolvedSelectedLessonId || createActivityMutation.isPending}>
                  {createActivityMutation.isPending ? 'Đang thêm hoạt động...' : 'Thêm hoạt động'}
                </button>

                {activityFormError ? <p className="error-text">{activityFormError}</p> : null}
              </form>
            ) : null}
          </article>

          <article className="roadmap-panel lessons-preview-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Bước 5</p>
                <h3>Kiểm tra và chỉnh bài đang chọn</h3>
              </div>
            </div>
            {selectedLesson ? (
              <div className="detail-stack">
                <div className="teacher-selection-grid">
                  <div className="teacher-selection-card">
                    <span>Bài đang chọn</span>
                    <strong>{selectedLesson.title}</strong>
                    <p>{`${selectedLessonSubjectName} / ${levelLabel(selectedLesson.primary_level)}`}</p>
                  </div>
                  <div className="teacher-selection-card">
                    <span>Hoạt động</span>
                    <strong>{lessonActivities.length}</strong>
                    <p>Chọn từng hoạt động ở cột trái để xem trước và sửa.</p>
                  </div>
                  <div className="teacher-selection-card">
                    <span>Thời lượng</span>
                    <strong>{selectedLessonEstimatedMinutes ? `${selectedLessonEstimatedMinutes} phút` : 'Chưa đặt'}</strong>
                    <p>{selectedLesson.description ?? 'Chưa có mô tả ngắn cho bài học này.'}</p>
                  </div>
                </div>

                <details className="config-card">
                  <summary className="simple-summary">Sửa thông tin bài học</summary>
                  <div className="form-stack">
                    <label>
                      Tên bài
                      <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Tên bài học" />
                    </label>
                    <label>
                      Môn
                      <select value={editSubjectId} onChange={(event) => setEditSubjectId(event.target.value)}>
                        {subjectsQuery.data?.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mức
                      <select value={editPrimaryLevel} onChange={(event) => setEditPrimaryLevel(event.target.value)}>
                        {LEVEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mô tả
                      <input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Mô tả ngắn" />
                    </label>
                    <label>
                      Số phút
                      <input value={editEstimatedMinutes} onChange={(event) => setEditEstimatedMinutes(event.target.value)} inputMode="numeric" />
                    </label>
                  </div>

                  <div className="button-row">
                    <button
                      className="action-button"
                      type="button"
                      disabled={!resolvedSelectedLessonId || updateLessonMutation.isPending || !editTitle.trim()}
                      onClick={() => updateLessonMutation.mutate()}
                    >
                      {updateLessonMutation.isPending ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={!resolvedSelectedLessonId || deleteLessonMutation.isPending}
                      onClick={() => {
                        if (!window.confirm('Bạn muốn xóa bài học này khỏi danh sách?')) return
                        deleteLessonMutation.mutate()
                      }}
                    >
                      {deleteLessonMutation.isPending ? 'Đang xóa...' : 'Xóa bài học'}
                    </button>
                  </div>

                  {updateLessonMutation.error ? <p className="error-text">{(updateLessonMutation.error as Error).message}</p> : null}
                  {deleteLessonMutation.error ? <p className="error-text">{(deleteLessonMutation.error as Error).message}</p> : null}
                </details>

                <div className="lessons-manage-stack">
                  <div className="detail-stack">
                    <div className="student-row">
                      <strong>{selectedLesson.title}</strong>
                      <span>{selectedLesson.subject?.name ?? 'Chưa có môn'} / {levelLabel(selectedLesson.primary_level)}</span>
                      <p>{lessonActivities.length} hoạt động</p>
                    </div>

                    <div className="student-list compact-list lesson-activity-list">
                      {lessonActivities.map((activity) => (
                        <button
                          key={activity.id}
                          className={resolvedSelectedActivityId === activity.id ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                          type="button"
                          onClick={() => {
                            setSelectedActivityId(activity.id)
                            setActivityEditorError(null)
                          }}
                        >
                          <strong>
                            {activity.sort_order}. {activity.title}
                          </strong>
                          <span>{activityLabel(activity.activity_type as ActivityType)}</span>
                          <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
                        </button>
                      ))}
                      {!lessonActivities.length && !lessonDetailQuery.isLoading ? <p>Bài học này chưa có hoạt động nào.</p> : null}
                    </div>
                  </div>

                  <div className="detail-stack lessons-preview-pane">
                    {selectedActivity ? (
                      <>
                        <div className="lesson-activity-toolbar">
                          <span className="subject-pill">Câu {selectedActivity.sort_order}</span>
                          <span className="subject-pill muted-pill">{activityLabel(selectedActivity.activity_type as ActivityType)}</span>
                        </div>

                        <div className="lesson-preview-shell">
                          <ActivityCard
                            activity={editablePreviewActivity ?? selectedActivity}
                            answers={{
                              choiceAnswers: previewChoiceAnswers,
                              textAnswers: previewTextAnswers,
                              matchingAnswers: previewMatchingAnswers,
                              dragAnswers: previewDragAnswers,
                              stepAnswers: previewStepAnswers,
                              aacSelections: previewAacSelections,
                            }}
                            setAnswers={{
                              setChoiceAnswers: setPreviewChoiceAnswers,
                              setTextAnswers: setPreviewTextAnswers,
                              setMatchingAnswers: setPreviewMatchingAnswers,
                              setDragAnswers: setPreviewDragAnswers,
                              setStepAnswers: setPreviewStepAnswers,
                              setAacSelections: setPreviewAacSelections,
                            }}
                          />
                        </div>

                        <div className="form-stack">
                          <label>
                            Tên hoạt động
                            <input value={editActivityTitle} onChange={(event) => setEditActivityTitle(event.target.value)} placeholder="Tên hoạt động" />
                          </label>

                          <label>
                            Hướng dẫn
                            <textarea value={editActivityInstruction} onChange={(event) => setEditActivityInstruction(event.target.value)} rows={3} placeholder="Hướng dẫn ngắn" />
                          </label>

                        </div>

                        {renderFriendlyActivityEditor()}

                        {editActivityMediaUploadPending ? <p className="helper-text">Đang tải media lên...</p> : null}

                        <div className="builder-two-columns">
                          <label>
                            Thứ tự hiển thị
                            <input value={editActivitySortOrder} onChange={(event) => setEditActivitySortOrder(event.target.value)} inputMode="numeric" />
                          </label>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={editActivityVoiceAnswerEnabled}
                              onChange={(event) => setEditActivityVoiceAnswerEnabled(event.target.checked)}
                            />
                            Bật trả lời bằng giọng nói
                          </label>
                        </div>

                        <details className="config-card detail-stack">
                          <summary className="simple-summary">Chế độ nâng cao: sửa JSON</summary>
                          <div className="teacher-clean-section-head">
                            <div>
                              <strong>Cấu hình đầy đủ</strong>
                              <p className="helper-text">Dùng khi cần sửa sâu những gì form thân thiện chưa bao phủ.</p>
                            </div>
                            <div className="button-row">
                              <button className="ghost-button" type="button" onClick={handleFormatActivityConfigJson}>
                                Chuẩn hóa JSON
                              </button>
                              <button className="ghost-button" type="button" onClick={handleResetActivityConfigJson}>
                                Khôi phục gốc
                              </button>
                            </div>
                          </div>

                          <label>
                            JSON cấu hình activity
                            <textarea
                              className="config-textarea"
                              value={editActivityConfigJson}
                              onChange={(event) => handleActivityConfigJsonChange(event.target.value)}
                              rows={14}
                              spellCheck={false}
                              placeholder="Nhập hoặc chỉnh JSON cấu hình của activity"
                            />
                          </label>
                        </details>

                        <div className="button-row">
                          <button
                            className="action-button"
                            type="button"
                            disabled={!editActivityTitle.trim() || updateActivityMutation.isPending || editActivityMediaUploadPending}
                            onClick={() => updateActivityMutation.mutate()}
                          >
                            {updateActivityMutation.isPending ? 'Đang lưu hoạt động...' : 'Lưu hoạt động'}
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={deleteActivityMutation.isPending}
                            onClick={() => {
                              if (!window.confirm('Bạn muốn xóa hoạt động này?')) return
                              deleteActivityMutation.mutate()
                            }}
                          >
                            {deleteActivityMutation.isPending ? 'Đang xóa hoạt động...' : 'Xóa hoạt động'}
                          </button>
                        </div>

                        {activityEditorError ? <p className="error-text">{activityEditorError}</p> : null}
                      </>
                    ) : lessonDetailQuery.isLoading ? (
                      <p>Đang tải hoạt động...</p>
                    ) : (
                      <p>Chọn một hoạt động để xem và sửa.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p>Chọn một bài để sửa hoặc xóa.</p>
            )}
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
