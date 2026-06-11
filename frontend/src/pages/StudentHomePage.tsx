import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { LazyActivityCard } from '../components/activities/LazyActivityCard'
import { RequireAuth } from '../components/RequireAuth'
import {
  fetchMyCareerCards,
  fetchMySimulationQuizQuestions,
  completeMyAssignment,
  fetchMyAssignment,
  fetchMyAssignments,
  fetchMyClasses,
  fetchMyTeachers,
  joinClassByCredential,
  sendAIChat,
  startMyAssignment,
  synthesizeAISpeech,
  updateMyStudentLevel,
  updateMyAssignmentProgress,
  type ClassItem,
  type CareerCardItem,
  type LessonActivityItem,
  type MyAssignmentDetail,
  type MyAssignmentItem,
  type SimulationQuizQuestionItem,
  type StudentTeacherLinkItem,
} from '../services/api'
import {
  studentEntryOptions,
  studentGameCatalog,
  studentLevelLabelMap,
  studentSubjectCatalog,
  studentTabCopyMap,
  type StudentEntryLevelKey,
  type StudentGameActivityType,
  type StudentPanelKey,
  type StudentSubjectMeta,
} from './studentHomeMeta'
import { useAuthStore } from '../store/authStore'
import { syncStudentFeed, type StudentFeedItem } from '../utils/studentFeedStore'
import type { CommunicationCard } from './studentHomeDeferredContent'

const studentBackgroundImageUrl = '/student-ui/anh4.jpg'
const LEARNING_CELL_SIMULATION_URL = '/simulations/learning-cell/index.html'

const KHTN_SIMULATION_MODELS = [
  { id: 'plant-cell', label: 'Tế bào thực vật' },
  { id: 'animal-cell', label: 'Tế bào động vật' },
  { id: 'white-blood-cell', label: 'Bạch cầu' },
  { id: 'neuron', label: 'Nơ-ron thần kinh' },
  { id: 'dna', label: 'DNA xoắn kép' },
  { id: 'human-heart', label: 'Tim người' },
  { id: 'human-lungs', label: 'Phổi người' },
  { id: 'human-liver', label: 'Gan người' },
  { id: 'human-kidney', label: 'Thận người' },
  { id: 'human-stomach', label: 'Dạ dày' },
] as const

type SimulationModelId = typeof KHTN_SIMULATION_MODELS[number]['id']

function buildSimulationQuizUrl(modelId: string, questions: SimulationQuizQuestionItem[] = []) {
  const params = new URLSearchParams({ model: modelId })
  if (questions.length) {
    params.set(
      'quiz',
      JSON.stringify(
        questions.map((question) => ({
          modelId: question.simulation_key,
          question: question.question_text,
          options: [
            { key: 'A', text: question.option_a },
            { key: 'B', text: question.option_b },
            { key: 'C', text: question.option_c },
            { key: 'D', text: question.option_d },
          ],
          correct: question.correct_option,
          explanation: question.explanation ?? '',
        })),
      ),
    )
  }
  return `${LEARNING_CELL_SIMULATION_URL}?${params.toString()}`
}

const visualThemePresetMap = {
  garden: {
    backgroundImageUrl: studentBackgroundImageUrl,
    accent: '#1f9d87',
    accentStrong: '#126f60',
    accentSoft: 'rgba(31, 157, 135, 0.16)',
    glow: 'rgba(255, 205, 110, 0.28)',
    overlay: 'linear-gradient(180deg, rgba(241, 255, 248, 0.56) 0%, rgba(240, 247, 255, 0.752) 52%, rgba(255, 248, 236, 0.784) 100%)',
  },
  ocean: {
    backgroundImageUrl: studentBackgroundImageUrl,
    accent: '#247bb7',
    accentStrong: '#145581',
    accentSoft: 'rgba(36, 123, 183, 0.16)',
    glow: 'rgba(126, 218, 255, 0.26)',
    overlay: 'linear-gradient(180deg, rgba(232, 249, 255, 0.544) 0%, rgba(236, 248, 255, 0.736) 46%, rgba(247, 253, 255, 0.784) 100%)',
  },
  cosmos: {
    backgroundImageUrl: studentBackgroundImageUrl,
    accent: '#6550d8',
    accentStrong: '#3f2f9d',
    accentSoft: 'rgba(101, 80, 216, 0.16)',
    glow: 'rgba(255, 165, 208, 0.28)',
    overlay: 'linear-gradient(180deg, rgba(238, 233, 255, 0.496) 0%, rgba(238, 241, 255, 0.704) 44%, rgba(250, 245, 255, 0.776) 100%)',
  },
} as const

const statusLabelMap: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
}

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ thêm',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng nâng độ khó',
}

function getCurrentTimestamp() {
  return Date.now()
}

const activityTypeVisualLabelMap: Record<string, string> = {
  memory_match: 'Lật thẻ ghi nhớ',
  quick_tap: 'Chạm đúng nhanh',
  size_order: 'Sắp xếp lớn nhỏ',
  habitat_match: 'Ghép nơi sống',
  image_puzzle: 'Ghép ảnh',
  hidden_image_guess: 'Mở ô đoán hình',
  multiple_choice: 'Chọn đáp án',
  image_choice: 'Nhìn rồi chọn',
  matching: 'Nối đúng',
  drag_drop: 'Kéo và thả',
  listen_choose: 'Nghe và chọn',
  watch_answer: 'Xem rồi trả lời',
  step_by_step: 'Làm từng bước',
  aac: 'Chọn thẻ',
  career_simulation: 'Tình huống',
  ai_chat: 'Trò chuyện',
}

const activityIconMap: Record<string, string> = {
  memory_match: '🧠',
  quick_tap: '⚡',
  size_order: '📏',
  habitat_match: '🏡',
  image_puzzle: '◫',
  hidden_image_guess: '◪',
  multiple_choice: '◉',
  image_choice: '⬒',
  matching: '⋈',
  drag_drop: '↔',
  listen_choose: '◌',
  watch_answer: '▷',
  step_by_step: '⋯',
  aac: '▣',
  career_simulation: '✦',
  ai_chat: '◎',
}


void activityIconMap

type BrowserSpeechRecognitionResultItem = {
  transcript: string
}

type BrowserSpeechRecognitionResult = {
  isFinal: boolean
  0: BrowserSpeechRecognitionResultItem
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<BrowserSpeechRecognitionResult>
}

type BrowserSpeechRecognitionErrorEvent = {
  error: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type CareerVoiceTurn = {
  id: string
  studentText: string
  aiText: string
}

type CareerDetailStep = {
  title: string
  description: string
}

type CareerDetailMeta = {
  key: string
  title: string
  description: string
  coverImageUrl: string
  meaningTitle: string
  meaningText: string
  videoEmbedUrl: string
  rawVideoUrl: string
  videoNote: string
  steps: CareerDetailStep[]
  skills: string[]
  levels: StudentEntryLevelKey[]
}

const cleanStatusLabelMap: Record<string, string> = {
  not_started: 'Mới',
  in_progress: 'Đang học',
  completed: 'Xong',
}

const cleanReadinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ',
  dang_phu_hop: 'Phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng',
}

const cleanActivityTypeVisualLabelMap: Record<string, string> = {
  memory_match: 'Lật thẻ',
  quick_tap: 'Chạm nhanh',
  size_order: 'Lớn nhỏ',
  habitat_match: 'Nơi sống',
  image_puzzle: 'Ghép ảnh',
  hidden_image_guess: 'Đoán hình',
  multiple_choice: 'Chọn đáp án',
  image_choice: 'Nhìn rồi chọn',
  matching: 'Nối đúng',
  drag_drop: 'Kéo thả',
  listen_choose: 'Nghe chọn',
  watch_answer: 'Xem trả lời',
  step_by_step: 'Từng bước',
  aac: 'Chọn thẻ',
  career_simulation: 'Tình huống',
  ai_chat: 'Trò chuyện',
}

const cleanActivityIconMap: Record<string, string> = {
  memory_match: '🧠',
  quick_tap: '⚡',
  size_order: '📏',
  habitat_match: '🏡',
  image_puzzle: '[]',
  hidden_image_guess: '<>',
  multiple_choice: 'A?',
  image_choice: '[=]',
  matching: '~~',
  drag_drop: '<>',
  listen_choose: 'o',
  watch_answer: '>',
  step_by_step: '...',
  aac: '[#]',
  career_simulation: '*',
  ai_chat: '@',
}

const cleanFeedToneIconMap: Record<string, string> = {
  celebration: '*',
  focus: 'o',
  support: '@',
  update: '.',
}

cleanActivityTypeVisualLabelMap.basket_toss = 'Ném bóng'
cleanActivityTypeVisualLabelMap.trash_cleanup = 'Dọn rác'
cleanActivityIconMap.basket_toss = '🏀'
cleanActivityIconMap.trash_cleanup = '🗑️'

function getStudentLevelLabel(level: string) {
  if (level === 'nhe' || level === 'trung_binh' || level === 'nang') {
    return studentLevelLabelMap[level]
  }
  return level || 'Chưa rõ'
}

function contentMatchesStudentLevel(levels: StudentEntryLevelKey[] | null | undefined, studentLevel: string) {
  if (!levels?.length) return false
  return levels.includes(studentLevel as StudentEntryLevelKey)
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function lookupContainsAlias(haystack: string, alias: string) {
  if (!haystack || !alias) return false

  const haystackTokens = haystack.split(/\s+/).filter(Boolean)
  const aliasTokens = alias.split(/\s+/).filter(Boolean)
  if (!haystackTokens.length || !aliasTokens.length) return false

  for (let startIndex = 0; startIndex <= haystackTokens.length - aliasTokens.length; startIndex += 1) {
    let matches = true
    for (let offset = 0; offset < aliasTokens.length; offset += 1) {
      if (haystackTokens[startIndex + offset] !== aliasTokens[offset]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }

  return false
}

function matchStudentSubject(subjectName: string | null | undefined, lessonTitle: string | null | undefined) {
  const haystack = `${normalizeLookupText(subjectName)} ${normalizeLookupText(lessonTitle)}`.trim()
  if (!haystack) return null
  return (
    studentSubjectCatalog.find((item) =>
      item.aliases.some((alias) => lookupContainsAlias(haystack, normalizeLookupText(alias))),
    ) ?? null
  )
}

function resolveAssignmentSubjectMeta(assignment: MyAssignmentItem | null | undefined) {
  return matchStudentSubject(
    assignment?.assignment?.lesson?.subject?.name ?? assignment?.assignment?.subject?.name ?? assignment?.lesson?.subject?.name ?? null,
    assignment?.assignment?.lesson?.title ?? assignment?.lesson?.title ?? null,
  )
}

function resolveAssignmentPrimaryLevel(assignment: MyAssignmentItem | null | undefined) {
  const primaryLevel = assignment?.assignment?.lesson?.primary_level ?? assignment?.lesson?.primary_level ?? ''
  return typeof primaryLevel === 'string' ? primaryLevel.trim() : ''
}

function assignmentMatchesStudentLevel(assignment: MyAssignmentItem | null | undefined, studentLevel: string) {
  const lessonLevel = resolveAssignmentPrimaryLevel(assignment)
  if (!lessonLevel) return true
  return lessonLevel === studentLevel
}

function normalizeCareerEmbedUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) return ''
  if (/^\/.+\.html(?:$|\?)/i.test(trimmedUrl)) return trimmedUrl
  try {
    const url = new URL(trimmedUrl)
    const host = url.hostname.toLowerCase()
    if (url.pathname.endsWith('.html')) return trimmedUrl
    if (host.includes('youtu.be')) {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) return trimmedUrl
      const videoId = url.searchParams.get('v')
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    if (host.includes('drive.google.com')) {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
      if (fileMatch?.[1]) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
      const fileId = url.searchParams.get('id')
      return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : ''
    }
    if (host.includes('tiktok.com')) {
      const pathname = url.pathname.replace(/\/$/, '')
      return pathname ? `https://www.tiktok.com/embed/v2${pathname}` : ''
    }
  } catch {
    return ''
  }
  return ''
}

function isDirectCareerVideoUrl(rawUrl: string) {
  return /\.(mp4|webm|ogg|mov)(?:$|\?)/i.test(rawUrl.trim()) || rawUrl.includes('/api/v1/media/files/')
}

function mapCareerCardItemToMeta(card: CareerCardItem): CareerDetailMeta {
  const rawVideoUrl = card.video_url ?? ''
  return {
    key: `career-${card.id}`,
    title: card.title,
    description: card.description?.trim() || card.meaning_text,
    coverImageUrl: card.cover_image_url?.trim() || studentBackgroundImageUrl,
    meaningTitle: card.meaning_title,
    meaningText: card.meaning_text,
    videoEmbedUrl: normalizeCareerEmbedUrl(rawVideoUrl),
    rawVideoUrl,
    videoNote: card.video_note?.trim() || 'Video giúp em nhìn rõ công việc và học từng bước dễ hơn.',
    steps: card.steps.length ? card.steps : [{ title: 'Bước 1', description: 'Giáo viên chưa nhập chi tiết.' }],
    skills: card.skills,
    levels: card.levels.length ? card.levels : ['nhe'],
  }
}

function renderStudentSubjectArtwork(subjectMeta: StudentSubjectMeta | null | undefined, fallbackSrc: string) {
  return <img src={subjectMeta?.artworkUrl ?? fallbackSrc} alt="" />
}

type StudentAnswerState = {
  choiceAnswers: Record<number, string>
  matchingAnswers: Record<number, string[]>
  dragAnswers: Record<number, string[]>
  stepAnswers: Record<number, boolean[]>
  textAnswers: Record<number, string>
  aacSelections: Record<number, string>
}

type ActivityProgressSummary = {
  totalActivities: number
  completedActivities: number
  progressPercent: number
  completionScore: number
  readyToComplete: boolean
  hasActivityInteraction: boolean
}

type CompletionSummary = {
  title: string
  progressPercent: number
  completionScore: number
  completedActivities: number
  totalActivities: number
  completedAt: number
}

type ActivityCelebrationStar = {
  id: string
  leftPercent: number
  delayMs: number
  durationMs: number
  sizeRem: number
  rotateDeg: number
}

type ActivityCelebrationState = {
  stars: ActivityCelebrationStar[]
  message: string
}

function hasFilledString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasFilledStringArray(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => hasFilledString(item))
}

function hasCompletedBooleanArray(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item === true)
}

function parseActivityConfig(configJson: string | null) {
  if (!configJson) return null
  try {
    return JSON.parse(configJson) as Record<string, unknown>
  } catch {
    return null
  }
}

function textFromConfig(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveActivityGuidanceAudioUrl(activity: LessonActivityItem) {
  const config = parseActivityConfig(activity.config_json)
  return textFromConfig(config?.guidance_audio_url)
}

function resolveActivityGuidanceText(activity: LessonActivityItem) {
  const config = parseActivityConfig(activity.config_json)
  return textFromConfig(config?.guidance_text) || textFromConfig(config?.prompt) || activity.instruction_text || activity.title
}

function activityHasEmbeddedPromptAudio(activity: LessonActivityItem) {
  const config = parseActivityConfig(activity.config_json)
  return Boolean(textFromConfig(config?.audio_text) || textFromConfig(config?.audio_url))
}

function isLocalEmbeddedWatchActivity(activity: LessonActivityItem | null) {
  if (!activity || activity.activity_type !== 'watch_answer') return false
  const config = parseActivityConfig(activity.config_json)
  const mediaUrl = textFromConfig(config?.media_url)
  const answerMode = textFromConfig(config?.answer_mode)
  return Boolean(mediaUrl) && mediaUrl.startsWith('/') && mediaUrl.toLowerCase().includes('.html') && answerMode === 'none'
}

function resolveActivityGuidanceHint(activity: LessonActivityItem) {
  switch (activity.activity_type) {
    case 'multiple_choice':
    case 'image_choice':
    case 'listen_choose':
      return 'Em nghe hoặc nhìn thật kỹ, rồi chọn một đáp án đúng.'
    case 'matching':
      return 'Em nối từng cặp tương ứng với nhau cho đúng.'
    case 'drag_drop':
      return 'Em chạm vào hình hoặc chữ, rồi kéo đến đúng vị trí cần đặt.'
    case 'watch_answer':
      return isLocalEmbeddedWatchActivity(activity)
        ? 'Em làm trực tiếp trong khung bên dưới. Khi xong, em bấm nút xác nhận đã tương tác xong.'
        : 'Em xem kỹ nội dung bên dưới rồi trả lời ngắn gọn.'
    case 'hidden_image_guess':
      return 'Em mở dần từng ô và đoán xem hình đang ẩn là gì.'
    case 'step_by_step':
      return 'Em làm lần lượt từng bước, xong bước nào thì đánh dấu bước đó.'
    case 'aac':
      return 'Em chọn thẻ phù hợp nhất với điều em muốn nói.'
    case 'memory_match':
      return 'Em lật từng thẻ và tìm hai thẻ giống nhau.'
    case 'quick_tap':
      return 'Em bấm bắt đầu rồi chạm thật nhanh vào hình đúng.'
    case 'size_order':
      return 'Em sắp xếp các hình theo đúng thứ tự từ nhỏ đến lớn hoặc theo yêu cầu.'
    case 'habitat_match':
      return 'Em ghép mỗi con vật vào đúng nơi sống của nó.'
    case 'image_puzzle':
      return 'Em ghép các mảnh hình lại để hoàn thành bức tranh.'
    case 'basket_toss':
      return 'Em vuốt tay từ dưới lên trên để ném bóng vào rổ.'
    case 'trash_cleanup':
      return 'Em chạm nhanh vào từng món rác để đưa hết vào thùng.'
    case 'career_simulation':
      return 'Em đọc tình huống rồi trả lời ngắn gọn theo ý của mình.'
    case 'ai_chat':
      return 'Em nói hoặc gõ câu ngắn gọn để trao đổi với trợ lý AI.'
    default:
      return 'Em làm chậm rãi từng bước, nếu cần thì bấm nút nghe lại hướng dẫn.'
  }
}

function buildDetailedActivityGuidance(activity: LessonActivityItem, activityIndex: number, totalActivities: number) {
  const stepText = totalActivities > 0 ? `Câu ${activityIndex + 1} trên ${totalActivities}.` : ''
  const titleText = activity.title ? `Bài này là ${activity.title}.` : ''
  const baseGuidance = sanitizeStudentFacingText(resolveActivityGuidanceText(activity), '')
  const hintText = resolveActivityGuidanceHint(activity)
  return [stepText, titleText, baseGuidance, hintText].filter(Boolean).join(' ')
}

const studentEncouragementMessages = [
  'Giỏi lắm!',
  'Em tuyệt lắm!',
  'Tốt lắm!',
]

const studentEncouragementMessagesVi = [
  'Giỏi lắm!',
  'Em tuyệt lắm!',
  'Tốt lắm!',
]

function resolveStudentEncouragement(activity: LessonActivityItem, activityIndex: number, totalActivities: number) {
  void activity
  void activityIndex
  void totalActivities
  return (
    studentEncouragementMessagesVi[Math.abs(activity.id) % studentEncouragementMessagesVi.length] ??
    studentEncouragementMessagesVi[0] ??
    studentEncouragementMessages[0]
  )
}

function createActivityCelebrationStars(seed: number) {
  return Array.from({ length: 16 }, (_, index) => ({
    id: `${seed}-${index}`,
    leftPercent: 8 + Math.random() * 84,
    delayMs: Math.round(Math.random() * 180),
    durationMs: 820 + Math.round(Math.random() * 360),
    sizeRem: 1.15 + Math.random() * 1.2,
    rotateDeg: -28 + Math.random() * 56,
  }))
}

let activeGuidanceAudio: HTMLAudioElement | null = null
let activeGuidancePlaybackToken = 0
let activeGuidanceAudioUrl: string | null = null
let activeGuidanceAudioShouldRevoke = false

function selectSpeechSynthesisVoice(lang: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const normalizedLang = lang.trim().toLowerCase()
  const exactMatch = voices.find((voice) => voice.lang.toLowerCase() === normalizedLang)
  if (exactMatch) return exactMatch

  const languagePrefix = normalizedLang.split('-')[0]
  const prefixMatch = voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix))
  if (prefixMatch) return prefixMatch

  if (languagePrefix === 'vi') {
    return voices.find((voice) => /viet|vietnam|linh|hoai|mai|an/i.test(voice.name)) ?? null
  }

  return null
}

function clearActiveGuidanceAudio() {
  activeGuidanceAudio?.pause()
  activeGuidanceAudio = null
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  if (activeGuidanceAudioShouldRevoke && activeGuidanceAudioUrl?.startsWith('blob:')) {
    window.URL.revokeObjectURL(activeGuidanceAudioUrl)
  }
  activeGuidanceAudioUrl = null
  activeGuidanceAudioShouldRevoke = false
}

async function playStudentGuidanceText(text: string, lang = 'vi-VN') {
  if (typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false
  const cleanText = text.trim()
  if (!cleanText || !('speechSynthesis' in window)) return false

  activeGuidancePlaybackToken += 1
  const playbackToken = activeGuidancePlaybackToken
  clearActiveGuidanceAudio()

  return await new Promise<boolean>((resolve) => {
    let isSettled = false
    const utterance = new SpeechSynthesisUtterance(cleanText)
    const selectedVoice = selectSpeechSynthesisVoice(lang)
    const cancelWatcher = window.setInterval(() => {
      if (playbackToken !== activeGuidancePlaybackToken) {
        window.clearInterval(cancelWatcher)
        finish(false)
      }
    }, 120)

    const finish = (result: boolean) => {
      if (isSettled) return
      isSettled = true
      window.clearInterval(cancelWatcher)
      if (playbackToken === activeGuidancePlaybackToken) {
        window.speechSynthesis.cancel()
      }
      resolve(result)
    }

    utterance.lang = lang
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.onend = () => finish(true)
    utterance.onerror = () => finish(false)

    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch {
      finish(false)
    }
  })
}

function speechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

function stopStudentEncouragement() {
  activeGuidancePlaybackToken += 1
  if (typeof window !== 'undefined') {
    clearActiveGuidanceAudio()
  }
}

async function playStudentEncouragement(token: string, message: string, cachedAudioUrl?: string) {
  if (typeof window === 'undefined' || !token.trim() || !message.trim()) return false
  stopStudentEncouragement()
  try {
    if (cachedAudioUrl) {
      const played = await playStudentGuidanceAudio(cachedAudioUrl)
      if (played) return true
    }
    const audioBlob = await synthesizeAISpeech(token, { text: message })
    const audioUrl = URL.createObjectURL(audioBlob)
    return await playStudentGuidanceAudio(audioUrl, { revokeOnEnd: true })
  } catch {
    return await playStudentGuidanceText(message)
  }
}

let activeCareerAudio: HTMLAudioElement | null = null
let activeCareerPlaybackToken = 0

function clearCareerAudio() {
  activeCareerAudio?.pause()
  activeCareerAudio = null
}

function stopCareerAudio() {
  activeCareerPlaybackToken += 1
  clearCareerAudio()
}

async function playCareerAudioUrl(audioUrl: string, audioElement?: HTMLAudioElement | null) {
  if (typeof window === 'undefined' || !audioUrl.trim()) return false
  activeCareerPlaybackToken += 1
  const playbackToken = activeCareerPlaybackToken
  clearCareerAudio()

  try {
    const audio = audioElement ?? new Audio(audioUrl)
    audio.src = audioUrl
    audio.preload = 'auto'
    audio.volume = 1
    audio.currentTime = 0
    audio.load()
    audio.onended = () => {
      if (activeCareerAudio === audio) {
        activeCareerAudio = null
      }
    }
    activeCareerAudio = audio
    if (playbackToken !== activeCareerPlaybackToken) return false
    await audio.play()
    return true
  } catch {
    if (playbackToken === activeCareerPlaybackToken) {
      activeCareerAudio = null
    }
    return false
  }
}

async function playCareerReplyFromServer(
  token: string,
  text: string,
  cachedAudioUrl?: string,
  audioElement?: HTMLAudioElement | null,
) {
  if (!text.trim()) return { ok: false as const, reason: 'empty' as const }
  if (cachedAudioUrl) {
    const played = await playCareerAudioUrl(cachedAudioUrl, audioElement)
    return played
      ? { ok: true as const, audioUrl: cachedAudioUrl }
      : { ok: false as const, reason: 'playback_failed' as const, audioUrl: cachedAudioUrl }
  }

  const audioBlob = await synthesizeAISpeech(token, { text })
  const audioUrl = window.URL.createObjectURL(audioBlob)
  const played = await playCareerAudioUrl(audioUrl, audioElement)
  return played ? { ok: true as const, audioUrl } : { ok: false as const, reason: 'playback_failed' as const, audioUrl }
}

function buildCareerSpeechText(text: string) {
  const normalized = text
    .replace(/[*_`#>|~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return ''

  const sentences = normalized.split(/(?<=[.!?…])\s+/u).filter(Boolean)
  const compact = (sentences.slice(0, 2).join(' ') || normalized).trim()

  if (compact.length <= 140) return compact

  const shortened = compact.slice(0, 140)
  const lastSpaceIndex = shortened.lastIndexOf(' ')
  const safeText = lastSpaceIndex > 70 ? shortened.slice(0, lastSpaceIndex) : shortened
  return `${safeText.trim()}.`
}

async function playStudentGuidanceAudio(audioUrl: string, options?: { revokeOnEnd?: boolean }) {
  if (typeof window === 'undefined' || !audioUrl.trim()) return false
  activeGuidancePlaybackToken += 1
  const playbackToken = activeGuidancePlaybackToken
  clearActiveGuidanceAudio()

  return await new Promise<boolean>((resolve) => {
    let isSettled = false
    const audio = new Audio(audioUrl)
    const cancelWatcher = window.setInterval(() => {
      if (playbackToken !== activeGuidancePlaybackToken) {
        window.clearInterval(cancelWatcher)
        finish(false)
      }
    }, 120)

    const finish = (result: boolean) => {
      if (isSettled) return
      isSettled = true
      window.clearInterval(cancelWatcher)
      if (playbackToken === activeGuidancePlaybackToken && activeGuidanceAudio === audio) {
        clearActiveGuidanceAudio()
      }
      resolve(result)
    }

    try {
      audio.preload = 'auto'
      audio.volume = 1
      audio.currentTime = 0
      audio.onended = () => finish(true)
      audio.onerror = () => finish(false)
      activeGuidanceAudioUrl = audioUrl
      activeGuidanceAudioShouldRevoke = Boolean(options?.revokeOnEnd)
      activeGuidanceAudio = audio
      if (playbackToken !== activeGuidancePlaybackToken) {
        finish(false)
        return
      }

      void audio.play().catch(() => {
        finish(false)
      })
    } catch {
      finish(false)
    }
  })
}

function stopStudentGuidance() {
  activeGuidancePlaybackToken += 1
  if (typeof window !== 'undefined') {
    clearActiveGuidanceAudio()
  }
}

function resolvedPuzzlePieceCount(config: Record<string, unknown> | null) {
  const rows = Number(config?.rows ?? 2)
  const cols = Number(config?.cols ?? 3)
  const pieceCount = Number(config?.piece_count ?? rows * cols)
  return Number.isFinite(pieceCount) && pieceCount > 1 ? pieceCount : 6
}

function sanitizeStudentFacingText(value: string | null | undefined, fallback: string) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback

  const withoutTimestamp = raw.replace(/\b20\d{12}\b/g, '').replace(/\s{2,}/g, ' ').trim()
  const cleaned = withoutTimestamp
    .replace(/hoc sinh feed/gi, 'Học sinh')
    .replace(/lop feed video/gi, 'Lớp học')
    .replace(/feed video/gi, 'Bài học')
    .replace(/\b6 buoc\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return cleaned || fallback
}

function resolveStudentDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
  const resolvedFullName = sanitizeStudentFacingText(fullName, '').trim()
  if (resolvedFullName) return resolvedFullName

  const localPart = typeof email === 'string' ? email.trim().split('@')[0] ?? '' : ''
  const readableName = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!readableName) return 'Bạn'

  const titleCased = readableName
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

  return sanitizeStudentFacingText(titleCased, 'Bạn')
}

function isPuzzleSolved(activity: LessonActivityItem, answers: StudentAnswerState) {
  const config = parseActivityConfig(activity.config_json)
  const pieceCount = resolvedPuzzlePieceCount(config)
  const slots = answers.dragAnswers[activity.id]
  if (!Array.isArray(slots) || slots.length !== pieceCount) return false
  return slots.every((pieceId, index) => pieceId === `piece-${index}`)
}

function configObjectArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : []
}

function configStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isMemoryMatchSolved(activity: LessonActivityItem, answers: StudentAnswerState) {
  const config = parseActivityConfig(activity.config_json)
  const cards = configObjectArray(config?.image_cards)
  const requestedPairCount = Number(config?.pair_count ?? cards.length)
  const pairCount = Math.max(0, Math.min(cards.length || requestedPairCount || 0, requestedPairCount || cards.length || 0))
  const matchedIds = configStringArray(answers.dragAnswers[activity.id])
  return pairCount > 0 && matchedIds.length >= pairCount
}

function isQuickTapCompleted(activity: LessonActivityItem, answers: StudentAnswerState) {
  return textFromConfig(answers.textAnswers[activity.id]).startsWith('completed:')
}

function getSizeOrderItems(activity: LessonActivityItem) {
  const config = parseActivityConfig(activity.config_json)
  return configObjectArray(config?.items)
    .map((item, index) => ({
      id: textFromConfig(item.id) || `size-item-${index + 1}`,
      rank: Number(item.rank ?? index + 1) || index + 1,
    }))
    .filter((item) => item.id)
}

function isSizeOrderCompleted(activity: LessonActivityItem, answers: StudentAnswerState) {
  const items = getSizeOrderItems(activity)
  const currentOrder = configStringArray(answers.dragAnswers[activity.id])
  if (!items.length || currentOrder.length !== items.length) return false
  const correctOrder = [...items].sort((left, right) => left.rank - right.rank).map((item) => item.id)
  return currentOrder.every((itemId, index) => itemId === correctOrder[index])
}

function isChoiceAnswerCorrect(activity: LessonActivityItem, answers: StudentAnswerState) {
  const config = parseActivityConfig(activity.config_json)
  const correctAnswer = textFromConfig(config?.correct)
  const currentAnswer = textFromConfig(answers.choiceAnswers[activity.id])
  if (!correctAnswer) return hasFilledString(currentAnswer)
  return currentAnswer === correctAnswer
}

function getActivityScore(activity: LessonActivityItem, answers: StudentAnswerState) {
  if (activity.activity_type === 'size_order') {
    const items = getSizeOrderItems(activity)
    const correctOrder = [...items].sort((left, right) => left.rank - right.rank).map((item) => item.id)
    const currentOrder = configStringArray(answers.dragAnswers[activity.id])
    if (!correctOrder.length || currentOrder.length !== correctOrder.length) return 0
    const correctPositionCount = currentOrder.filter((itemId, index) => itemId === correctOrder[index]).length
    return Math.round((correctPositionCount / correctOrder.length) * 100)
  }

  return isActivityCompleted(activity, answers) ? 100 : 0
}

function isHabitatMatchSolved(activity: LessonActivityItem, answers: StudentAnswerState) {
  const config = parseActivityConfig(activity.config_json)
  const expectedHabitats = configObjectArray(config?.items).map((item) => textFromConfig(item.habitat_id) || textFromConfig(item.habitat))
  const currentAnswers = configStringArray(answers.matchingAnswers[activity.id])
  return expectedHabitats.length > 0 && currentAnswers.length >= expectedHabitats.length && expectedHabitats.every((habitat, index) => habitat && currentAnswers[index] === habitat)
}

function isActivityCompleted(activity: LessonActivityItem, answers: StudentAnswerState) {
  if (activity.activity_type === 'basket_toss' || activity.activity_type === 'trash_cleanup') {
    return hasFilledString(answers.textAnswers[activity.id])
  }

  switch (activity.activity_type) {
    case 'multiple_choice':
    case 'image_choice':
    case 'listen_choose':
      return isChoiceAnswerCorrect(activity, answers)
    case 'image_puzzle':
      return isPuzzleSolved(activity, answers)
    case 'memory_match':
      return isMemoryMatchSolved(activity, answers)
    case 'quick_tap':
      return isQuickTapCompleted(activity, answers)
    case 'size_order':
      return isSizeOrderCompleted(activity, answers)
    case 'habitat_match':
      return isHabitatMatchSolved(activity, answers)
    case 'matching':
      return hasFilledStringArray(answers.matchingAnswers[activity.id])
    case 'drag_drop':
      return hasFilledStringArray(answers.dragAnswers[activity.id])
    case 'step_by_step':
      return hasCompletedBooleanArray(answers.stepAnswers[activity.id])
    case 'watch_answer':
    case 'hidden_image_guess':
    case 'career_simulation':
    case 'ai_chat':
      return hasFilledString(answers.textAnswers[activity.id])
    case 'aac':
      return hasFilledString(answers.aacSelections[activity.id])
    default:
      return false
  }
}

function isVisualSupportAssignment(assignment: MyAssignmentItem | null | undefined) {
  return assignment?.assignment?.classroom?.ui_variant === 'visual_support'
}

function resolveVisualSupportClassroom(
  detail: MyAssignmentDetail | undefined,
  selectedAssignment: MyAssignmentItem | null,
  visualAssignments: MyAssignmentItem[],
) {
  return (
    detail?.assignment?.classroom ??
    selectedAssignment?.assignment?.classroom ??
    visualAssignments[0]?.assignment?.classroom ??
    null
  )
}

function updateAssignmentListCache(
  current: MyAssignmentItem[] | undefined,
  assignmentId: number,
  patch: Partial<MyAssignmentItem>,
) {
  if (!current) return current
  return current.map((item) => (item.assignment_id === assignmentId ? { ...item, ...patch } : item))
}

function buildStudentFeedItems({
  studentId,
  assignments,
  classes,
  teachers,
  detail,
  completedLessonTitle,
  activityProgress,
  liveProgressPercent,
  liveCompletionScore,
}: {
  studentId: number
  assignments: MyAssignmentItem[]
  classes: ClassItem[]
  teachers: StudentTeacherLinkItem[]
  detail: MyAssignmentDetail | undefined
  completedLessonTitle: string
  activityProgress: ActivityProgressSummary
  liveProgressPercent: number
  liveCompletionScore: number
}): StudentFeedItem[] {
  const now = new Date().toISOString()
  const feedItems: StudentFeedItem[] = []

  if (completedLessonTitle) {
    feedItems.push({
      id: `${studentId}:celebration:${completedLessonTitle}`,
      studentId,
      category: 'Kết quả',
      title: `Hoàn thành "${sanitizeStudentFacingText(completedLessonTitle, 'Bài học')}"`,
      description: 'Bài này đã được ghi nhận. Em có thể chọn bài tiếp theo trong danh sách.',
      badge: '3 sao',
      tone: 'celebration',
      updatedAt: now,
      rank: 120,
    })
  }

  if (detail) {
    const title = sanitizeStudentFacingText(
      detail.lesson?.title ?? detail.assignment?.lesson?.title ?? `Bài tập #${detail.assignment_id}`,
      `Bài tập #${detail.assignment_id}`,
    )
    feedItems.push({
      id: `${studentId}:current:${detail.assignment_id}`,
      studentId,
      category: 'Đang học',
      title,
      description: `Đã làm ${activityProgress.completedActivities}/${activityProgress.totalActivities || 0} hoạt động, điểm hiện tại ${liveCompletionScore}.`,
      badge: `${liveProgressPercent}%`,
      tone: liveProgressPercent >= 100 ? 'celebration' : 'focus',
      updatedAt: detail.completed_at ?? now,
      rank: 110,
    })
  }

  assignments.slice(0, 4).forEach((item, index) => {
    feedItems.push({
      id: `${studentId}:assignment:${item.assignment_id}`,
      studentId,
      category: item.assignment?.lesson?.subject?.name ?? 'Bài học',
      title: sanitizeStudentFacingText(item.assignment?.lesson?.title ?? `Bài tập #${item.assignment_id}`, `Bài tập #${item.assignment_id}`),
      description: `${statusLabelMap[item.status] ?? item.status}. ${cleanReadinessLabelMap[item.readiness_status] ?? readinessLabelMap[item.readiness_status] ?? item.readiness_status}.`,
      badge: `${item.progress_percent}%`,
      tone: item.status === 'completed' ? 'celebration' : item.status === 'in_progress' ? 'focus' : 'update',
      updatedAt: item.completed_at ?? item.assignment?.created_at ?? now,
      rank: 90 - index,
    })
  })

  if (classes.length) {
    feedItems.push({
      id: `${studentId}:classes`,
      studentId,
      category: 'Lớp học',
      title: `${classes.length} lớp đang tham gia`,
      description: classes.map((classroom) => classroom.name).join(', '),
      badge: `${classes.length} lớp`,
      tone: 'support',
      updatedAt: now,
      rank: 70,
    })
  }

  if (teachers.length) {
    feedItems.push({
      id: `${studentId}:teachers`,
      studentId,
      category: 'Hỗ trợ',
      title: `${teachers.length} giáo viên đồng hành`,
      description: teachers.map((item) => item.teacher.full_name).join(', '),
      badge: `${teachers.length} GV`,
      tone: 'support',
      updatedAt: now,
      rank: 60,
    })
  }

  if (!assignments.length) {
    feedItems.push({
      id: `${studentId}:empty`,
      studentId,
      category: 'Gợi ý',
      title: 'Chưa có bài mới',
      description: 'Khi giáo viên giao bài, feed này sẽ tự cập nhật để em thấy ngay việc cần làm.',
      badge: 'Mới',
      tone: 'update',
      updatedAt: now,
      rank: 50,
    })
  }

  return feedItems
}

export function StudentHomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const setSession = useAuthStore((state) => state.setSession)
  const queryClient = useQueryClient()
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string | null>(null)
  const [showSimulationModal, setShowSimulationModal] = useState(false)
  const selectedSimulationModelId: SimulationModelId = 'plant-cell'
  useEffect(() => {
    if (showSimulationModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showSimulationModal])
  const [selectedCareerKey, setSelectedCareerKey] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<StudentPanelKey>('learning')
  const [joinClassId, setJoinClassId] = useState('')
  const [joinClassPassword, setJoinClassPassword] = useState('')
  const [completedLessonTitle, setCompletedLessonTitle] = useState('')
  const [activeActivityIndex, setActiveActivityIndex] = useState(0)
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null)
  const [completionLastInteractionAt, setCompletionLastInteractionAt] = useState(0)
  const [activityCelebration, setActivityCelebration] = useState<ActivityCelebrationState | null>(null)
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, string>>({})
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, string[]>>({})
  const [dragAnswers, setDragAnswers] = useState<Record<number, string[]>>({})
  const [stepAnswers, setStepAnswers] = useState<Record<number, boolean[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({})
  const [aacSelections, setAacSelections] = useState<Record<number, string>>({})
  const [studentFeedItems, setStudentFeedItems] = useState<StudentFeedItem[]>([])
  const [activeStandaloneGameType, setActiveStandaloneGameType] = useState<StudentGameActivityType | null>(null)
  const [standaloneGameActivity, setStandaloneGameActivity] = useState<LessonActivityItem | null>(null)
  const [isStandaloneGameLoading, setIsStandaloneGameLoading] = useState(false)
  const [communicationCards, setCommunicationCards] = useState<CommunicationCard[]>([])
  const [isCommunicationCardsLoading, setIsCommunicationCardsLoading] = useState(false)
  const [aiPromptCards, setAiPromptCards] = useState<string[]>([])
  const [isAiPromptCardsLoading, setIsAiPromptCardsLoading] = useState(false)
  const learningBaseSecondsRef = useRef(0)
  const learningSessionStartedAtRef = useRef<number | null>(null)
  const lessonAudioSessionRef = useRef(0)
  const lastAutoSyncKeyRef = useRef('')
  const autoActionKeyRef = useRef('')
  const activityCelebrationTimeoutRef = useRef<number | null>(null)
  const activeQuestionRef = useRef<HTMLElement | null>(null)
  const spokenActivityIdsRef = useRef<Set<number>>(new Set())
  const encouragedActivityIdsRef = useRef<Set<number>>(new Set())
  const encouragementAudioCacheRef = useRef<Record<string, string>>({})
  const careerRecognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const careerTranscriptRef = useRef('')
  const careerAudioCacheRef = useRef<Record<string, string>>({})
  const careerMeaningAudioCacheRef = useRef<Record<string, string>>({})
  const careerAudioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const [careerTurns, setCareerTurns] = useState<CareerVoiceTurn[]>([])
  const [careerTranscript, setCareerTranscript] = useState('')
  const [careerAudioUrl, setCareerAudioUrl] = useState('')
  const [isCareerListening, setIsCareerListening] = useState(false)
  const [careerVoiceError, setCareerVoiceError] = useState<string | null>(null)
  const [isCareerMeaningSpeaking, setIsCareerMeaningSpeaking] = useState(false)
  const [activeCareerMeaningKey, setActiveCareerMeaningKey] = useState<string | null>(null)
  const [careerMeaningError, setCareerMeaningError] = useState<string | null>(null)
  const [lastCommunicationPhrase, setLastCommunicationPhrase] = useState('')
  const [communicationError, setCommunicationError] = useState<string | null>(null)
  const [hasCompletedEntryGate, setHasCompletedEntryGate] = useState(false)
  const entryGateStorageKey = user ? `student-entry-gate:${user.id}` : null
  const currentStudentLevel = typeof profile?.disability_level === 'string' ? String(profile.disability_level) : 'trung_binh'
  const currentStudentLevelLabel = getStudentLevelLabel(currentStudentLevel)

  useEffect(() => {
    if (!entryGateStorageKey) {
      setHasCompletedEntryGate(false)
      return
    }

    setHasCompletedEntryGate(Boolean(window.sessionStorage.getItem(entryGateStorageKey)))
  }, [entryGateStorageKey])

  useEffect(() => {
    if (user?.role !== 'student' || hasCompletedEntryGate) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [hasCompletedEntryGate, user?.role])

  useEffect(() => {
    if (activePanel !== 'communication' || communicationCards.length) return

    let cancelled = false
    setIsCommunicationCardsLoading(true)

    void import('./studentHomeDeferredContent')
      .then((module) => {
        if (cancelled) return
        setCommunicationCards(module.loadCommunicationCards())
      })
      .finally(() => {
        if (!cancelled) {
          setIsCommunicationCardsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activePanel, communicationCards.length])

  useEffect(() => {
    if (activePanel !== 'ai' || aiPromptCards.length) return

    let cancelled = false
    setIsAiPromptCardsLoading(true)

    void import('./studentHomeDeferredContent')
      .then((module) => {
        if (cancelled) return
        setAiPromptCards(module.loadAiPromptCards())
      })
      .finally(() => {
        if (!cancelled) {
          setIsAiPromptCardsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activePanel, aiPromptCards.length])

  const assignmentsQuery = useQuery({
    queryKey: ['my-assignments', token],
    queryFn: () => fetchMyAssignments(token!),
    enabled: Boolean(token && user?.role === 'student'),
  })

  const myClassesQuery = useQuery({
    queryKey: ['my-classes', token],
    queryFn: () => fetchMyClasses(token!),
    enabled: Boolean(token && user?.role === 'student'),
  })

  const myTeachersQuery = useQuery({
    queryKey: ['my-teachers', token],
    queryFn: () => fetchMyTeachers(token!),
    enabled: Boolean(token && user?.role === 'student'),
  })

  const careerCardsQuery = useQuery({
    queryKey: ['my-career-cards', token],
    queryFn: async () => {
      const cards = await fetchMyCareerCards(token!)
      return cards.map(mapCareerCardItemToMeta)
    },
    enabled: Boolean(token && user?.role === 'student'),
  })

  const simulationQuizQuestionsQuery = useQuery({
    queryKey: ['my-simulation-quiz-questions', token],
    queryFn: () => fetchMySimulationQuizQuestions(token!),
    enabled: Boolean(token && user?.role === 'student'),
  })

  const effectiveSelectedAssignmentId = selectedAssignmentId

  const assignmentDetailQuery = useQuery({
    queryKey: ['my-assignment-detail', token, effectiveSelectedAssignmentId],
    queryFn: () => fetchMyAssignment(token!, effectiveSelectedAssignmentId!),
    enabled: Boolean(token && effectiveSelectedAssignmentId),
  })

  const detail = assignmentDetailQuery.data

  const refreshStudentQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-assignments', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-assignment-detail', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-classes', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-teachers', token] }),
    ])
  }

  const cancelLessonAudio = () => {
    lessonAudioSessionRef.current += 1
    stopStudentGuidance()
  }

  const resetActivityAnswers = () => {
    cancelLessonAudio()
    stopStudentEncouragement()
    clearActivityCelebration()
    setChoiceAnswers({})
    setMatchingAnswers({})
    setDragAnswers({})
    setStepAnswers({})
    setTextAnswers({})
    setAacSelections({})
    setActiveActivityIndex(0)
    autoActionKeyRef.current = ''
    spokenActivityIdsRef.current = new Set()
    encouragedActivityIdsRef.current = new Set()
  }

  const closeLessonView = () => {
    cancelLessonAudio()
    setSelectedAssignmentId(null)
    handleStudentPanelChange('learning')
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
  }

  const handleSelectSubject = (subjectKey: string) => {
    cancelLessonAudio()
    setSelectedSubjectKey(subjectKey)
    setSelectedAssignmentId(null)
    setCompletedLessonTitle('')
    setCompletionSummary(null)
    setActiveActivityIndex(0)
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
  }

  const handleBackToSubjects = () => {
    cancelLessonAudio()
    setSelectedSubjectKey(null)
    setSelectedAssignmentId(null)
    setCompletedLessonTitle('')
    setCompletionSummary(null)
    setActiveActivityIndex(0)
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
  }

  const closeStandaloneGame = () => {
    cancelLessonAudio()
    setActiveStandaloneGameType(null)
    setCompletionSummary(null)
    setActiveActivityIndex(0)
    resetActivityAnswers()
  }

  const openCareerDetail = (careerKey: string) => {
    if (!availableCareerCards.some((item) => item.key === careerKey)) return
    stopCareerAudio()
    cancelLessonAudio()
    setActiveCareerMeaningKey(null)
    setCareerMeaningError(null)
    setSelectedCareerKey(careerKey)
  }

  const closeCareerDetail = () => {
    stopCareerAudio()
    cancelLessonAudio()
    setIsCareerMeaningSpeaking(false)
    setActiveCareerMeaningKey(null)
    setCareerMeaningError(null)
    setSelectedCareerKey(null)
  }

  const startMutation = useMutation({
    mutationFn: (assignmentId: number) => startMyAssignment(token!, assignmentId),
    onSuccess: async (updatedProgress, assignmentId) => {
      resetActivityAnswers()
      setCompletedLessonTitle('')
      setCompletionSummary(null)
      learningSessionStartedAtRef.current = getCurrentTimestamp()
      lastAutoSyncKeyRef.current = ''
      queryClient.setQueryData<MyAssignmentItem[] | undefined>(['my-assignments', token], (current) =>
        updateAssignmentListCache(current, assignmentId, updatedProgress),
      )
      queryClient.setQueryData<MyAssignmentDetail | undefined>(
        ['my-assignment-detail', token, assignmentId],
        (current) => (current ? { ...current, ...updatedProgress } : current),
      )
      await refreshStudentQueries()
    },
  })

  const completeMutation = useMutation({
    mutationFn: () =>
      completeMyAssignment(token!, effectiveSelectedAssignmentId!, {
        completion_score: activityProgress.completionScore,
        reward_star_count: activityProgress.completionScore >= 90 ? 3 : activityProgress.completionScore >= 60 ? 2 : 1,
      }),
    onSuccess: async (updatedProgress) => {
      const assignmentId = updatedProgress.assignment_id ?? effectiveSelectedAssignmentId
      const title = sanitizeStudentFacingText(detail?.lesson?.title ?? detail?.assignment?.lesson?.title, 'Bài học')
      setCompletedLessonTitle(title)
      setCompletionSummary({
        title,
        progressPercent: updatedProgress.progress_percent ?? 100,
        completionScore: updatedProgress.completion_score ?? 100,
        completedActivities: activityProgress.totalActivities || activityProgress.completedActivities,
        totalActivities: activityProgress.totalActivities,
        completedAt: getCurrentTimestamp(),
      })
      setCompletionLastInteractionAt(getCurrentTimestamp())
      lastAutoSyncKeyRef.current = ''
      if (assignmentId) {
        queryClient.setQueryData<MyAssignmentItem[] | undefined>(['my-assignments', token], (current) =>
          updateAssignmentListCache(current, assignmentId, updatedProgress),
        )
        queryClient.setQueryData<MyAssignmentDetail | undefined>(
          ['my-assignment-detail', token, assignmentId],
          (current) => (current ? { ...current, ...updatedProgress } : current),
        )
      }
      await refreshStudentQueries()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const updateStudentLevelMutation = useMutation({
    mutationFn: (level: StudentEntryLevelKey) => updateMyStudentLevel(token!, { disability_level: level }),
    onSuccess: async (updatedProfile, level) => {
      if (user && token) {
        const refreshToken = useAuthStore.getState().refreshToken
        if (refreshToken) {
          setSession({
            accessToken: token,
            refreshToken,
            user,
            profile: {
              ...(profile ?? {}),
              ...updatedProfile,
            },
          })
        } else {
          useAuthStore.setState({
            profile: {
              ...(profile ?? {}),
              ...updatedProfile,
            },
          })
        }
      }

      if (entryGateStorageKey) {
        window.sessionStorage.setItem(entryGateStorageKey, JSON.stringify({ level, selectedAt: Date.now() }))
      }

      setHasCompletedEntryGate(true)
      setSelectedAssignmentId(null)
      setSelectedSubjectKey(null)
      setSelectedCareerKey(null)
      setActiveStandaloneGameType(null)
      setCompletedLessonTitle('')
      setCompletionSummary(null)
      resetActivityAnswers()
      handleStudentPanelChange('learning')
      await refreshStudentQueries()
    },
  })

  const joinClassMutation = useMutation({
    mutationFn: () =>
      joinClassByCredential(token!, {
        class_id: Number(joinClassId),
        class_password: joinClassPassword.trim(),
      }),
    onSuccess: async () => {
      setJoinClassId('')
      setJoinClassPassword('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-classes', token] }),
        queryClient.invalidateQueries({ queryKey: ['my-assignments', token] }),
        queryClient.invalidateQueries({ queryKey: ['my-teachers', token] }),
      ])
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('setup')
      nextParams.delete('tab')
      setSearchParams(nextParams, { replace: true })
      setActivePanel('learning')
    },
  })

  const careerChatMutation = useMutation({
    mutationFn: (message: string) =>
      sendAIChat(token!, {
        message,
        context: {
          target_role: user?.role,
          disability_level: currentStudentLevel,
          lesson_title: 'Trò chuyện hướng nghiệp',
          subject_name: 'Định hướng nghề nghiệp',
          activity_type: 'career_guidance_voice',
        },
      }),
    onSuccess: async (data, message) => {
      const aiText = data.text
      setCareerTurns((current) => [
        {
          id: `${getCurrentTimestamp()}`,
          studentText: message,
          aiText,
        },
        ...current,
      ].slice(0, 6))
      setCareerVoiceError(null)
      if (!token) return
      try {
        const speechText = buildCareerSpeechText(aiText)
        const speechResult = await playCareerReplyFromServer(
          token,
          speechText,
          careerAudioCacheRef.current[speechText],
          careerAudioPlayerRef.current,
        )
        if (speechResult.audioUrl) {
          careerAudioCacheRef.current[speechText] = speechResult.audioUrl
          setCareerAudioUrl(speechResult.audioUrl)
        }
        if (!speechResult.ok) {
          setCareerVoiceError('AI đã trả lời. Nếu chưa nghe thấy, em bấm nút phát ở khung audio bên dưới.')
        }
      } catch (error) {
        setCareerVoiceError(error instanceof Error ? error.message : 'AI đã trả lời nhưng chưa tạo được audio.')
      }
    },
    onError: (error) => {
      setCareerVoiceError(error instanceof Error ? error.message : 'AI chưa thể trả lời lúc này.')
    },
  })

  useEffect(() => {
    learningBaseSecondsRef.current = detail?.total_learning_seconds ?? 0
    learningSessionStartedAtRef.current = detail?.status === 'in_progress' ? getCurrentTimestamp() : null
    lastAutoSyncKeyRef.current = ''
  }, [detail?.id, detail?.status, effectiveSelectedAssignmentId])

  const selectedAssignment =
    (assignmentsQuery.data ?? []).find((item) => item.assignment_id === effectiveSelectedAssignmentId) ?? null
  const visualAssignments = useMemo(
    () => (assignmentsQuery.data ?? []).filter((item) => isVisualSupportAssignment(item)),
    [assignmentsQuery.data],
  )
  const preferredAssignments = visualAssignments.length ? visualAssignments : assignmentsQuery.data ?? []
  const visualSupportClassroom = resolveVisualSupportClassroom(detail, selectedAssignment, visualAssignments)
  const visualThemeKey =
    visualSupportClassroom?.visual_theme && Object.prototype.hasOwnProperty.call(visualThemePresetMap, visualSupportClassroom.visual_theme)
      ? (visualSupportClassroom.visual_theme as keyof typeof visualThemePresetMap)
      : 'ocean'
  const resolvedVisualTheme = visualThemePresetMap[visualThemeKey]
  const visualSupportStyle = {
    ['--support-visual-bg-image' as string]: 'none',
    ['--support-visual-overlay' as string]: resolvedVisualTheme.overlay,
    ['--support-visual-accent' as string]: resolvedVisualTheme.accent,
    ['--support-visual-accent-strong' as string]: resolvedVisualTheme.accentStrong,
    ['--support-visual-accent-soft' as string]: resolvedVisualTheme.accentSoft,
    ['--support-visual-glow' as string]: resolvedVisualTheme.glow,
  }
  const studentName = resolveStudentDisplayName(typeof profile?.full_name === 'string' ? profile.full_name : undefined, user?.email)
  const allAssignments = useMemo(
    () => preferredAssignments.filter((item) => assignmentMatchesStudentLevel(item, currentStudentLevel)),
    [currentStudentLevel, preferredAssignments],
  )
  const heroLessonTitle = sanitizeStudentFacingText(detail?.lesson?.title ?? completedLessonTitle, 'Hôm nay học gì?')
  const requestedPanel = searchParams.get('tab')
  const setupIntent = searchParams.get('setup') === '1'
  const resolvedPanel: StudentPanelKey =
    requestedPanel === 'ai' || requestedPanel === 'communication' || requestedPanel === 'settings' || requestedPanel === 'learning'
      ? requestedPanel
      : 'learning'
  const isStudentSetupPending =
    !assignmentsQuery.isLoading &&
    !myClassesQuery.isLoading &&
    !myTeachersQuery.isLoading &&
    !allAssignments.length &&
    !(myClassesQuery.data?.length ?? 0) &&
    !(myTeachersQuery.data?.length ?? 0)

  useEffect(() => {
    if (effectiveSelectedAssignmentId === null) return
    if (allAssignments.some((item) => item.assignment_id === effectiveSelectedAssignmentId)) return
    setSelectedAssignmentId(null)
  }, [allAssignments, effectiveSelectedAssignmentId])

  const chooseAssignment = (assignmentId: number) => {
    const assignment = assignmentsQuery.data?.find((item) => item.assignment_id === assignmentId)
    const subjectMeta = resolveAssignmentSubjectMeta(assignment)
    setSelectedAssignmentId(assignmentId)
    setSelectedSubjectKey(subjectMeta?.key ?? null)
    handleStudentPanelChange('learning')
    setCompletedLessonTitle('')
    setCompletionSummary(null)
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
    if (assignment?.status === 'not_started' && !startMutation.isPending) {
      startMutation.mutate(assignmentId)
    }
  }

  const handleStudentPanelChange = (panel: StudentPanelKey) => {
    setActivePanel(panel)
    const nextParams = new URLSearchParams(searchParams)
    if (panel === 'learning') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', panel)
    }
    setSearchParams(nextParams, { replace: true })
  }

  const handleStudentEntrySelect = (level: StudentEntryLevelKey) => {
    if (!token || updateStudentLevelMutation.isPending) return
    updateStudentLevelMutation.mutate(level)
  }

  useEffect(() => {
    if (activePanel !== resolvedPanel) {
      setActivePanel(resolvedPanel)
    }
  }, [activePanel, resolvedPanel])

  useEffect(() => {
    if (!hasCompletedEntryGate || !isStudentSetupPending) return
    if (!setupIntent && requestedPanel) return
    if (activePanel === 'settings') return
    handleStudentPanelChange('settings')
  }, [activePanel, hasCompletedEntryGate, isStudentSetupPending, requestedPanel, setupIntent])

  const answers = useMemo<StudentAnswerState>(() => ({
    choiceAnswers,
    matchingAnswers,
    dragAnswers,
    stepAnswers,
    textAnswers,
    aacSelections,
  }), [aacSelections, choiceAnswers, dragAnswers, matchingAnswers, stepAnswers, textAnswers])

  const setAnswersMap = {
    setChoiceAnswers,
    setMatchingAnswers,
    setDragAnswers,
    setStepAnswers,
    setTextAnswers,
    setAacSelections,
  }

  const activityProgress: ActivityProgressSummary = (() => {
    const activities = detail?.lesson?.activities ?? []
    const totalActivities = activities.length
    const completedActivities = activities.filter((activity) => isActivityCompleted(activity, answers)).length
    const earnedScore = activities.reduce((totalScore, activity) => totalScore + getActivityScore(activity, answers), 0)
    const progressPercent =
      totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : detail?.progress_percent ?? 0
    const completionScore =
      totalActivities > 0 ? Math.round(earnedScore / totalActivities) : detail?.completion_score ?? detail?.progress_percent ?? 0
    const readyToComplete = totalActivities === 0 || completedActivities >= totalActivities
    return {
      totalActivities,
      completedActivities,
      progressPercent,
      completionScore,
      readyToComplete,
      hasActivityInteraction: completedActivities > 0,
    }
  })()

  const liveProgressPercent = activityProgress.hasActivityInteraction
    ? Math.max(detail?.progress_percent ?? 0, activityProgress.progressPercent)
    : detail?.progress_percent ?? 0

  const liveCompletionScore = activityProgress.hasActivityInteraction
    ? Math.max(detail?.completion_score ?? 0, activityProgress.completionScore)
    : detail?.completion_score ?? 0

  const displayAssignments = useMemo(
    () =>
      allAssignments.map((item) => {
        if (item.assignment_id !== effectiveSelectedAssignmentId) return item
        if (completionSummary) {
          return {
            ...item,
            status: 'completed',
            progress_percent: Math.max(item.progress_percent, completionSummary.progressPercent),
            completion_score: Math.max(item.completion_score, completionSummary.completionScore),
          }
        }
        if (!detail) return item
        return {
          ...item,
          status: detail.status ?? item.status,
          progress_percent: Math.max(item.progress_percent, liveProgressPercent),
          completion_score: Math.max(item.completion_score, liveCompletionScore),
        }
      }),
    [allAssignments, completionSummary, detail, effectiveSelectedAssignmentId, liveCompletionScore, liveProgressPercent],
  )
  const displayCompletedCount = displayAssignments.filter((item) => item.status === 'completed').length
  const totalRewardStars = displayAssignments.reduce((sum, item) => sum + item.reward_star_count, 0)
  const totalInProgressCount = displayAssignments.filter((item) => item.status === 'in_progress').length
  const activeTabCopy = studentTabCopyMap[activePanel] ?? studentTabCopyMap.learning
  const heroSupportCopy =
    activePanel === 'learning'
      ? 'Hôm nay chúng mình cùng khám phá những điều thú vị nhé!'
      : activeTabCopy.title
  const heroBadges = [
    `Mức ${currentStudentLevelLabel}`,
    `⭐ ${displayCompletedCount} bài học hoàn thành`,
    `🏆 ${totalRewardStars} điểm thưởng`,
    `🏫 ${myClassesQuery.data?.length ?? 0} lớp`,
    `👩‍🏫 ${myTeachersQuery.data?.length ?? 0} giáo viên`,
  ]

  const availableStandaloneGames = useMemo(
    () => studentGameCatalog.filter((item) => contentMatchesStudentLevel(item.levels, currentStudentLevel)),
    [currentStudentLevel],
  )

  const availableCareerCards = useMemo(
    () => (careerCardsQuery.data ?? []).filter((item) => contentMatchesStudentLevel(item.levels, currentStudentLevel)),
    [careerCardsQuery.data, currentStudentLevel],
  )

  const selectedSimulationFrameUrl = buildSimulationQuizUrl(selectedSimulationModelId, simulationQuizQuestionsQuery.data ?? [])

  const subjectCards = useMemo(
    () =>
      studentSubjectCatalog.map((subject) => {
        const matchingAssignments = displayAssignments.filter((item) => resolveAssignmentSubjectMeta(item)?.key === subject.key)
        const primaryAssignment = matchingAssignments[0] ?? null
        return {
          ...subject,
          assignmentCount: matchingAssignments.length,
          primaryAssignment,
          matchingAssignments,
        }
      }),
    [displayAssignments],
  )

  const selectedSubjectCard = subjectCards.find((item) => item.key === selectedSubjectKey) ?? null

  const selectedSubjectAssignments = selectedSubjectCard?.matchingAssignments ?? []

  const teacherBadges = useMemo(
    () =>
      (myTeachersQuery.data ?? [])
        .map((item) => ({
          id: item.link_id,
          name: sanitizeStudentFacingText(item.teacher.full_name, 'Giáo viên'),
          schoolName: item.teacher.school_name ? sanitizeStudentFacingText(item.teacher.school_name, 'Lớp học') : '',
        }))
        .slice(0, 4),
    [myTeachersQuery.data],
  )

  const pendingAssignments = useMemo(
    () =>
      displayAssignments
        .filter((item) => item.status !== 'completed')
        .slice(0, 5),
    [displayAssignments],
  )
  const selectedCareerCard = useMemo(
    () => availableCareerCards.find((item) => item.key === selectedCareerKey) ?? null,
    [availableCareerCards, selectedCareerKey],
  )
  const activeStandaloneGameMeta = useMemo(
    () => availableStandaloneGames.find((item) => item.activityType === activeStandaloneGameType) ?? null,
    [activeStandaloneGameType, availableStandaloneGames],
  )

  useEffect(() => {
    if (!selectedCareerKey) return
    if (selectedCareerCard) return
    setSelectedCareerKey(null)
  }, [selectedCareerCard, selectedCareerKey])

  useEffect(() => {
    if (!activeStandaloneGameType) return
    if (activeStandaloneGameMeta) return
    setActiveStandaloneGameType(null)
  }, [activeStandaloneGameMeta, activeStandaloneGameType])

  useEffect(() => {
    if (!activeStandaloneGameType || !activeStandaloneGameMeta) {
      setStandaloneGameActivity(null)
      setIsStandaloneGameLoading(false)
      return
    }

    let cancelled = false
    setIsStandaloneGameLoading(true)

    void import('./studentHomeDeferredContent')
      .then((module) => {
        if (cancelled) return
        setStandaloneGameActivity(module.buildStandaloneGameActivity(activeStandaloneGameType, currentStudentLevel))
      })
      .finally(() => {
        if (!cancelled) {
          setIsStandaloneGameLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeStandaloneGameMeta, activeStandaloneGameType])

  const lessonActivities = useMemo(() => detail?.lesson?.activities ?? [], [detail?.lesson?.activities])
  const boundedActiveActivityIndex = lessonActivities.length ? Math.min(activeActivityIndex, lessonActivities.length - 1) : 0
  const currentActivity = lessonActivities[boundedActiveActivityIndex] ?? null
  const currentActivityCompleted = currentActivity ? isActivityCompleted(currentActivity, answers) : false
  const currentActivitySupportText =
    currentActivity?.instruction_text && normalizeLookupText(currentActivity.instruction_text) !== normalizeLookupText(currentActivity.title)
      ? sanitizeStudentFacingText(currentActivity.instruction_text, '')
      : ''
  const currentActivityCaption =
    currentActivitySupportText ||
    (currentActivity
      ? cleanActivityTypeVisualLabelMap[currentActivity.activity_type] ?? activityTypeVisualLabelMap[currentActivity.activity_type] ?? 'Hoạt động'
      : '')
  const shouldHideCurrentActivityCaption = isLocalEmbeddedWatchActivity(currentActivity)
  const isStudentLessonFocus =
    activePanel === 'learning' && Boolean(detail) && !selectedCareerCard && !activeStandaloneGameType && !completionSummary
  const currentActivityGuidanceAudioUrl = currentActivity ? resolveActivityGuidanceAudioUrl(currentActivity) : ''
  const playActivityGuidance = async (activity: LessonActivityItem | null) => {
    if (!activity) return false
    const playbackSession = lessonAudioSessionRef.current
    const isPlaybackStillAllowed = () => lessonAudioSessionRef.current === playbackSession
    const guidanceAudioUrl = resolveActivityGuidanceAudioUrl(activity)
    const guidanceText = resolveActivityGuidanceText(activity)
    if (guidanceAudioUrl) {
      if (!isPlaybackStillAllowed()) return false
      const played = await playStudentGuidanceAudio(guidanceAudioUrl)
      if (played) return true
    }

    if (!token || !guidanceText.trim()) return false

    try {
      const activityIndex = lessonActivities.findIndex((item) => item.id === activity.id)
      const detailedGuidanceText = buildDetailedActivityGuidance(
        activity,
        activityIndex >= 0 ? activityIndex : boundedActiveActivityIndex,
        lessonActivities.length,
      )
      const audioBlob = await synthesizeAISpeech(token, { text: detailedGuidanceText || guidanceText })
      if (!isPlaybackStillAllowed()) return false
      const audioUrl = window.URL.createObjectURL(audioBlob)
      const played = await playStudentGuidanceAudio(audioUrl, { revokeOnEnd: true })
      if (played) return true
    } catch {
      // Fall through to browser speech synthesis below.
    }

    if (!isPlaybackStillAllowed()) return false
    return await playStudentGuidanceText(guidanceText)
  }

  const clearActivityCelebration = () => {
    if (activityCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(activityCelebrationTimeoutRef.current)
      activityCelebrationTimeoutRef.current = null
    }
    setActivityCelebration(null)
  }

  const triggerActivityCelebration = (seed: number, message: string) => {
    if (activityCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(activityCelebrationTimeoutRef.current)
    }
    setActivityCelebration({
      stars: createActivityCelebrationStars(seed),
      message,
    })
    activityCelebrationTimeoutRef.current = window.setTimeout(() => {
      setActivityCelebration(null)
      activityCelebrationTimeoutRef.current = null
    }, 1200)
  }

  useEffect(() => {
    if (!detail || completionSummary) return
    const frameId = window.requestAnimationFrame(() => {
      activeQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [completionSummary, detail?.id])

  useEffect(() => {
    if (!currentActivity || activePanel !== 'learning' || completionSummary) return
    if (activityHasEmbeddedPromptAudio(currentActivity)) return
    if (spokenActivityIdsRef.current.has(currentActivity.id)) return

    spokenActivityIdsRef.current.add(currentActivity.id)

    const timeout = window.setTimeout(() => {
      void playActivityGuidance(currentActivity)
    }, 320)

    return () => window.clearTimeout(timeout)
  }, [activePanel, completionSummary, currentActivity, currentActivityGuidanceAudioUrl, token])

  useEffect(() => () => {
    lessonAudioSessionRef.current += 1
    stopStudentGuidance()
    stopStudentEncouragement()
    if (activityCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(activityCelebrationTimeoutRef.current)
      activityCelebrationTimeoutRef.current = null
    }
    Object.values(encouragementAudioCacheRef.current).forEach((audioUrl) => {
      if (audioUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(audioUrl)
      }
    })
    encouragementAudioCacheRef.current = {}
  }, [])

  useEffect(() => {
    if (!token) return undefined
    let isActive = true

    void Promise.allSettled(
      studentEncouragementMessagesVi.map(async (message) => {
        if (encouragementAudioCacheRef.current[message]) return
        const audioBlob = await synthesizeAISpeech(token, { text: message })
        const audioUrl = window.URL.createObjectURL(audioBlob)
        if (!isActive) {
          window.URL.revokeObjectURL(audioUrl)
          return
        }
        encouragementAudioCacheRef.current[message] = audioUrl
      }),
    )

    return () => {
      isActive = false
    }
  }, [token])

  useEffect(() => {
    if (!user?.id || user.role !== 'student') return

    const nextFeedItems = buildStudentFeedItems({
      studentId: user.id,
      assignments: assignmentsQuery.data ?? [],
      classes: myClassesQuery.data ?? [],
      teachers: myTeachersQuery.data ?? [],
      detail,
      completedLessonTitle,
      activityProgress,
      liveProgressPercent,
      liveCompletionScore,
    })

    let isActive = true
    void syncStudentFeed(user.id, nextFeedItems)
      .then((items) => {
        if (isActive) setStudentFeedItems(items.slice(0, 6))
      })
      .catch(() => {
        if (isActive) setStudentFeedItems(nextFeedItems.slice(0, 6))
      })

    return () => {
      isActive = false
    }
  }, [
    activityProgress,
    assignmentsQuery.data,
    completedLessonTitle,
    detail,
    liveCompletionScore,
    liveProgressPercent,
    myClassesQuery.data,
    myTeachersQuery.data,
    user?.id,
    user?.role,
  ])

  useEffect(() => {
    if (!token || !detail || !effectiveSelectedAssignmentId || detail.status === 'completed') return
    if (!activityProgress.hasActivityInteraction) return

    if (!learningSessionStartedAtRef.current) {
      learningSessionStartedAtRef.current = getCurrentTimestamp()
    }

    const totalLearningSeconds = Math.max(
      detail.total_learning_seconds ?? 0,
      learningBaseSecondsRef.current +
        Math.max(1, Math.floor((getCurrentTimestamp() - learningSessionStartedAtRef.current) / 1000)),
    )

    const nextPayload = {
      progress_percent: activityProgress.progressPercent,
      completion_score: activityProgress.completionScore,
      total_learning_seconds: totalLearningSeconds,
      reward_star_count: activityProgress.completionScore >= 90 ? 3 : activityProgress.completionScore >= 60 ? 2 : 1,
      status: 'in_progress' as const,
    }

    const nextKey = [
      effectiveSelectedAssignmentId,
      nextPayload.progress_percent,
      nextPayload.completion_score,
      nextPayload.reward_star_count,
      nextPayload.status,
    ].join(':')

    if (lastAutoSyncKeyRef.current === nextKey) return

    const sameAsServer =
      detail.progress_percent === nextPayload.progress_percent &&
      detail.completion_score === nextPayload.completion_score &&
      detail.status === nextPayload.status

    if (sameAsServer) {
      lastAutoSyncKeyRef.current = nextKey
      return
    }

    const timeout = window.setTimeout(async () => {
      lastAutoSyncKeyRef.current = nextKey
      try {
        const updatedProgress = await updateMyAssignmentProgress(token, effectiveSelectedAssignmentId, nextPayload)
        learningBaseSecondsRef.current = updatedProgress.total_learning_seconds ?? nextPayload.total_learning_seconds
        learningSessionStartedAtRef.current = getCurrentTimestamp()
        queryClient.setQueryData<MyAssignmentItem[] | undefined>(['my-assignments', token], (current) =>
          updateAssignmentListCache(current, effectiveSelectedAssignmentId, updatedProgress),
        )
        queryClient.setQueryData<MyAssignmentDetail | undefined>(
          ['my-assignment-detail', token, effectiveSelectedAssignmentId],
          (current) => (current ? { ...current, ...updatedProgress } : current),
        )
      } catch {
        lastAutoSyncKeyRef.current = ''
      }
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [
    activityProgress.completionScore,
    activityProgress.hasActivityInteraction,
    activityProgress.progressPercent,
    detail?.id,
    detail?.progress_percent,
    detail?.completion_score,
    detail?.status,
    effectiveSelectedAssignmentId,
    queryClient,
    token,
  ])

  const handleAutoAdvance = (activityId: number) => {
    if (!effectiveSelectedAssignmentId || completionSummary) return

    const actionKey = `${effectiveSelectedAssignmentId}:${activityId}`
    if (autoActionKeyRef.current === actionKey) return
    autoActionKeyRef.current = actionKey

    const advanceToNextStep = () => {
      const currentIndex = lessonActivities.findIndex((activity) => activity.id === activityId)
      const nextActivity = lessonActivities[currentIndex + 1]
      if (!nextActivity) {
        if (!completeMutation.isPending) {
          completeMutation.mutate()
        }
        return
      }

      setActiveActivityIndex(currentIndex + 1)

      window.requestAnimationFrame(() => {
        activeQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        activeQuestionRef.current?.focus({ preventScroll: true })
      })
    }

    const shouldEncourage = !encouragedActivityIdsRef.current.has(activityId)
    if (!shouldEncourage) {
      advanceToNextStep()
      return
    }

    const currentIndex = lessonActivities.findIndex((activity) => activity.id === activityId)
    const completedActivity = currentIndex >= 0 ? lessonActivities[currentIndex] : currentActivity
    if (!completedActivity) {
      advanceToNextStep()
      return
    }

    encouragedActivityIdsRef.current.add(activityId)
    const encouragementMessage = resolveStudentEncouragement(completedActivity, currentIndex >= 0 ? currentIndex : boundedActiveActivityIndex, lessonActivities.length)
    triggerActivityCelebration(activityId, `Xong câu ${currentIndex >= 0 ? currentIndex + 1 : boundedActiveActivityIndex + 1}!`)
    const cachedEncouragementAudioUrl = encouragementAudioCacheRef.current[encouragementMessage]

    stopStudentGuidance()

    if (!token) {
      window.setTimeout(() => {
        advanceToNextStep()
      }, 700)
      return
    }

    void playStudentEncouragement(token, encouragementMessage, cachedEncouragementAudioUrl)
      .catch(() => false)
      .finally(() => {
        advanceToNextStep()
      })
  }

  useEffect(() => {
    if (!currentActivity || !currentActivityCompleted || completionSummary) return
    const timeout = window.setTimeout(() => {
      handleAutoAdvance(currentActivity.id)
    }, 120)
    return () => window.clearTimeout(timeout)
  }, [completionSummary, currentActivity, currentActivityCompleted, handleAutoAdvance])

  useEffect(() => {
    if (!completionSummary) return
    const timeout = window.setTimeout(() => {
      setCompletionSummary(null)
      setCompletedLessonTitle('')
      closeLessonView()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 10000)
    return () => window.clearTimeout(timeout)
  }, [completionLastInteractionAt, completionSummary])

  const handleGoHome = () => {
    setCompletionSummary(null)
    setCompletedLessonTitle('')
    closeLessonView()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReplayGuidance = () => {
    stopStudentEncouragement()
    void playActivityGuidance(currentActivity)
  }

  const handleRestartAssignment = () => {
    if (!effectiveSelectedAssignmentId || startMutation.isPending) return

    resetActivityAnswers()
    setCompletedLessonTitle('')
    setCompletionSummary(null)
    learningSessionStartedAtRef.current = getCurrentTimestamp()
    lastAutoSyncKeyRef.current = ''
    queryClient.setQueryData<MyAssignmentDetail | undefined>(
      ['my-assignment-detail', token, effectiveSelectedAssignmentId],
      (current) =>
        current
          ? {
              ...current,
              status: 'in_progress',
              progress_percent: 0,
              completion_score: 0,
              reward_star_count: 0,
              completed_at: null,
              retry_count: (current.retry_count ?? 0) + 1,
            }
          : current,
    )
    queryClient.setQueryData<MyAssignmentItem[] | undefined>(['my-assignments', token], (current) =>
      updateAssignmentListCache(current, effectiveSelectedAssignmentId, {
        status: 'in_progress',
        progress_percent: 0,
        completion_score: 0,
        reward_star_count: 0,
        completed_at: null,
      }),
    )
    startMutation.mutate(effectiveSelectedAssignmentId)
  }

  const submitCareerTranscript = (message: string) => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || careerChatMutation.isPending) return
    setCareerTranscript(trimmedMessage)
    careerTranscriptRef.current = trimmedMessage
    careerChatMutation.mutate(trimmedMessage)
  }

  const handleCareerVoiceToggle = () => {
    if (isCareerListening) {
      careerRecognitionRef.current?.stop()
      return
    }

    const RecognitionConstructor = speechRecognitionConstructor()
    if (!RecognitionConstructor) {
      setCareerVoiceError('Thiết bị này chưa hỗ trợ micro hội thoại.')
      return
    }

    try {
      const recognition = new RecognitionConstructor()
      careerTranscriptRef.current = ''
      recognition.lang = 'vi-VN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onstart = () => {
        setIsCareerListening(true)
        setCareerVoiceError(null)
      }
      recognition.onresult = (event) => {
        let nextTranscript = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (result?.isFinal && result[0]?.transcript) {
            nextTranscript = `${nextTranscript} ${result[0].transcript}`.trim()
          }
        }
        if (nextTranscript) {
          careerTranscriptRef.current = nextTranscript
          setCareerTranscript(nextTranscript)
        }
      }
      recognition.onerror = (event) => {
        setCareerVoiceError(
          event.error === 'not-allowed'
            ? 'Em cần cho phép micro để nói chuyện với AI.'
            : 'AI chưa nghe rõ. Em thử nói lại nhé.',
        )
      }
      recognition.onend = () => {
        setIsCareerListening(false)
        careerRecognitionRef.current = null
        if (careerTranscriptRef.current.trim()) {
          submitCareerTranscript(careerTranscriptRef.current)
        }
      }
      careerRecognitionRef.current = recognition
      recognition.start()
    } catch {
      setIsCareerListening(false)
      setCareerVoiceError('Không thể bật micro trên thiết bị này.')
    }
  }

  const handleReplayCareerAnswer = async () => {
    const latestReply = careerTurns[0]?.aiText ?? ''
    if (!latestReply || !token) return
    try {
      const speechText = buildCareerSpeechText(latestReply)
      const speechResult = await playCareerReplyFromServer(
        token,
        speechText,
        careerAudioCacheRef.current[speechText],
        careerAudioPlayerRef.current,
      )
      if (speechResult.audioUrl) {
        careerAudioCacheRef.current[speechText] = speechResult.audioUrl
        setCareerAudioUrl(speechResult.audioUrl)
      }
      if (speechResult.ok) {
        setCareerVoiceError(null)
      } else {
        setCareerVoiceError('Audio đã sẵn sàng. Em bấm nút phát ở khung audio bên dưới nhé.')
      }
    } catch (error) {
      setCareerVoiceError(error instanceof Error ? error.message : 'Chưa tạo được audio để nghe lại.')
    }
  }

  const handlePlayCareerMeaning = async (career: CareerDetailMeta) => {
    if (!token) {
      setCareerMeaningError('Chưa sẵn sàng audio để phát phần này.')
      return
    }

    stopStudentGuidance()
    setCareerMeaningError(null)
    setActiveCareerMeaningKey(career.key)
    setIsCareerMeaningSpeaking(true)

    try {
      const cachedAudioUrl = careerMeaningAudioCacheRef.current[career.key]
      const played = cachedAudioUrl
        ? await playStudentGuidanceAudio(cachedAudioUrl)
        : await (async () => {
            const audioBlob = await synthesizeAISpeech(token, { text: career.meaningText })
            const audioUrl = window.URL.createObjectURL(audioBlob)
            careerMeaningAudioCacheRef.current[career.key] = audioUrl
            return await playStudentGuidanceAudio(audioUrl)
          })()

      if (!played) {
        setCareerMeaningError('Đã tạo audio nhưng chưa phát được trên thiết bị này.')
      }
    } catch (error) {
      setCareerMeaningError(error instanceof Error ? error.message : 'Chưa phát được phần mô tả công việc.')
    } finally {
      setIsCareerMeaningSpeaking(false)
      setActiveCareerMeaningKey(null)
    }
  }

  useEffect(() => () => {
    careerRecognitionRef.current?.stop()
    stopCareerAudio()
    Object.values(careerAudioCacheRef.current).forEach((audioUrl) => {
      if (audioUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(audioUrl)
      }
    })
    careerAudioCacheRef.current = {}
  }, [])

  const openIchanGame = (activityType: StudentGameActivityType) => {
    if (!availableStandaloneGames.some((item) => item.activityType === activityType)) return
    handleStudentPanelChange('learning')
    setSelectedAssignmentId(null)
    setCompletionSummary(null)
    setActiveActivityIndex(0)
    resetActivityAnswers()
    setActiveStandaloneGameType(activityType)
  }

  const handleCommunicationSpeak = async (phrase: string) => {
    setLastCommunicationPhrase(phrase)
    setCommunicationError(null)
    if (!token) {
      setCommunicationError('Chưa sẵn sàng audio để phát câu này.')
      return
    }

    try {
      const audioBlob = await synthesizeAISpeech(token, { text: phrase })
      const audioUrl = window.URL.createObjectURL(audioBlob)
      const played = await playStudentGuidanceAudio(audioUrl, { revokeOnEnd: true })
      if (!played) {
        setCommunicationError('Đã tạo audio nhưng chưa phát được trên thiết bị này.')
      }
    } catch (error) {
      setCommunicationError(error instanceof Error ? error.message : 'Chưa phát được thẻ giao tiếp.')
    }
  }

  const renderIchanJoinCard = (title: string, eyebrow: string) => (
    <article className="student-visual-panel ichan-section">
      <div className="student-visual-section-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="form-stack student-progress-form">
        {isStudentSetupPending ? <p className="helper-text">Tài khoản mới cần vào lớp trước để hiện giáo viên và bài học.</p> : null}
        <label>
          ID lớp
          <input value={joinClassId} onChange={(event) => setJoinClassId(event.target.value)} inputMode="numeric" placeholder="12" />
        </label>
        <label>
          Mã lớp
          <input
            value={joinClassPassword}
            onChange={(event) => setJoinClassPassword(event.target.value.toUpperCase())}
            placeholder="AB12CD34"
          />
        </label>
        <button
          className="action-button"
          type="button"
          disabled={!joinClassId || !joinClassPassword || joinClassMutation.isPending}
          onClick={() => joinClassMutation.mutate()}
        >
          {joinClassMutation.isPending ? 'Đang vào...' : 'Vào lớp'}
        </button>
        {joinClassMutation.error ? <p className="error-text">{(joinClassMutation.error as Error).message}</p> : null}
      </div>
    </article>
  )

  const renderIchanLessonStage = () => {
    if (completionSummary || activePanel !== 'learning') return null

    if (!detail) {
      return (
        <section className="student-visual-empty-panel">
          <strong>{isStudentSetupPending ? 'Vào lớp để bắt đầu.' : 'Chọn một bài để bắt đầu.'}</strong>
          {isStudentSetupPending ? <p className="helper-text">Mở mục Cài đặt rồi nhập ID lớp và mã lớp giáo viên đã cấp.</p> : null}
        </section>
      )
    }

    const currentActivityTypeLabel = currentActivity
      ? cleanActivityTypeVisualLabelMap[currentActivity.activity_type] ?? activityTypeVisualLabelMap[currentActivity.activity_type] ?? 'Hoạt động'
      : null

    return (
      <>
        <section ref={activeQuestionRef} tabIndex={-1} className="student-visual-panel student-visual-question-panel">
          <div className="student-visual-section-head student-visual-lesson-progress-head">
            <div>
              <p className="student-visual-progress-label">TIẾN ĐỘ BÀI HỌC</p>
              <h3>{lessonActivities.length ? `Câu ${boundedActiveActivityIndex + 1} / ${lessonActivities.length}` : 'Câu 0 / 0'}</h3>
              {detail?.lesson?.title ? <p className="student-visual-progress-copy">{sanitizeStudentFacingText(detail.lesson.title, 'Bài học')}</p> : null}
            </div>
            <span className="subject-pill student-visual-progress-pill">{`${activityProgress.completedActivities}/${activityProgress.totalActivities || 0} hoàn thành`}</span>
          </div>

          <div className="student-visual-lesson-grid">
            <div className="student-visual-lesson-main">
              <div className="student-visual-step-dots" aria-label="Tiến độ câu hỏi">
                {lessonActivities.map((activity, index) => {
                  const isCompleted = isActivityCompleted(activity, answers)
                  const isActive = index === boundedActiveActivityIndex
                  return (
                    <span
                      key={activity.id}
                      className={
                        isCompleted
                          ? 'student-visual-step-dot student-visual-step-dot-complete'
                          : isActive
                            ? 'student-visual-step-dot student-visual-step-dot-active'
                            : 'student-visual-step-dot'
                      }
                      aria-hidden="true"
                    />
                  )
                })}
              </div>

              {currentActivity ? (
                <article className={currentActivityCompleted ? 'student-visual-step-card student-visual-step-card-complete' : 'student-visual-step-card'}>
                  {activityCelebration ? (
                    <div className="student-visual-step-star-rain" aria-hidden="true">
                      <div className="student-visual-step-celebration-badge">
                        <span className="student-visual-step-celebration-badge-star">★</span>
                        <strong>{activityCelebration.message}</strong>
                      </div>
                      {activityCelebration.stars.map((star) => (
                        <span
                          key={star.id}
                          className="student-visual-step-falling-star"
                          style={{
                            ['--star-left' as string]: `${star.leftPercent}%`,
                            ['--star-delay' as string]: `${star.delayMs}ms`,
                            ['--star-duration' as string]: `${star.durationMs}ms`,
                            ['--star-size' as string]: `${star.sizeRem}rem`,
                            ['--star-rotate' as string]: `${star.rotateDeg}deg`,
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="student-visual-step-head">
                    <div className="student-visual-step-head-main">
                      <span className="student-visual-step-badge">#{boundedActiveActivityIndex + 1}</span>
                      <div className="student-visual-step-head-copy">
                        <h4>{currentActivity.title}</h4>
                        {!shouldHideCurrentActivityCaption && currentActivityCaption ? <p>{currentActivityCaption}</p> : null}
                      </div>
                    </div>
                    <div className="student-visual-step-head-actions">
                      <button
                        type="button"
                        className="student-visual-audio-button"
                        onClick={handleReplayGuidance}
                        aria-label="Phát lại hướng dẫn"
                        disabled={!currentActivity}
                      >
                        <span aria-hidden="true">🔊</span>
                      </button>
                      <span className={currentActivityCompleted ? 'student-visual-step-state student-visual-step-state-complete' : 'student-visual-step-state'}>
                        {currentActivityCompleted ? 'Xong' : 'Đang làm'}
                      </span>
                    </div>
                  </div>

                  <div className="student-visual-activity-meta">
                    <span className="student-visual-activity-chip">{currentActivityTypeLabel}</span>
                    <span className="student-visual-activity-info">{detail?.lesson?.subject?.name ?? 'Môn học khác'}</span>
                  </div>

                  <LazyActivityCard
                    key={currentActivity.id}
                    activity={currentActivity}
                    answers={answers}
                    setAnswers={setAnswersMap}
                    presentationMode="immersive_square"
                    onAutoAdvance={handleAutoAdvance}
                    loadingLabel="Đang tải bài tập..."
                  />
                </article>
              ) : (
                <p className="helper-text">Chưa có hoạt động.</p>
              )}
            </div>

            <aside className="student-visual-lesson-sidebar">
              <div className="student-visual-sidebar-card">
                <strong>Thông tin bài học</strong>
                <p>{detail?.lesson?.title ? sanitizeStudentFacingText(detail.lesson.title, 'Bài học') : 'Bài học chưa có tiêu đề.'}</p>
                <div className="student-visual-sidebar-row">
                  <span>{`${lessonActivities.length} hoạt động`}</span>
                  <span>{detail?.lesson?.subject?.name ?? 'Không xác định môn'}</span>
                </div>
                <p className="student-visual-sidebar-note">Giao diện này hoạt động với mọi loại nội dung: bài tập, trò chơi, video và đa phương tiện.</p>
              </div>

              {lessonActivities.length ? (
                <div className="student-visual-sidebar-card student-visual-sidebar-activities">
                  <strong>Hoạt động tiếp theo</strong>
                  <ul className="student-visual-activity-timeline">
                    {lessonActivities.map((activity, index) => {
                      const isCompleted = isActivityCompleted(activity, answers)
                      const isActive = index === boundedActiveActivityIndex
                      return (
                        <li key={activity.id} className={isActive ? 'student-visual-activity-item student-visual-activity-item-active' : 'student-visual-activity-item'}>
                          <span className="student-visual-activity-index">{index + 1}</span>
                          <div>
                            <p>{activity.title}</p>
                            <span className={isCompleted ? 'student-visual-activity-status student-visual-activity-status-complete' : 'student-visual-activity-status'}>
                              {isCompleted ? 'Đã xong' : isActive ? 'Đang làm' : 'Chưa làm'}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="student-visual-action-bar" aria-label="Thao tác bài học">
          <button className="ghost-button" type="button" onClick={closeLessonView}>
            Quay lại
          </button>
          <button
            className="action-button"
            type="button"
            disabled={!effectiveSelectedAssignmentId || startMutation.isPending}
            onClick={handleRestartAssignment}
          >
            {startMutation.isPending ? 'Đang mở...' : 'Làm lại'}
          </button>
        </section>
      </>
    )
  }

  const renderIchanLearningHub = () => (
    <section className="ichan-layout">
      <article className="student-visual-panel ichan-section ichan-subject-section">
          <div className="student-visual-section-head ichan-subject-section-head">
            <div>
              <h3 className="ichan-section-title ichan-section-title-accent">CHỌN MÔN HỌC</h3>
            </div>
            <div className="ichan-subject-tools">
              <span className="subject-pill muted-pill">{subjectCards.length}</span>
              <button
                type="button"
                className="ichan-voice-button"
                onClick={activePanel === 'learning' && currentActivity ? handleReplayGuidance : () => handleStudentPanelChange('ai')}
              >
                Điều hướng giọng nói
              </button>
            </div>
          </div>

          <div className="ichan-subject-grid">
            {subjectCards.map((subject) => {
              const isActive = selectedSubjectCard?.key === subject.key
              const hasAssignment = Boolean(subject.primaryAssignment)
              const badgeText = hasAssignment ? `${subject.assignmentCount} bài` : 'Chưa mở'
              return (
                <button
                  key={subject.key}
                  type="button"
                  className={
                    isActive
                      ? 'ichan-subject-card ichan-subject-card-active'
                      : hasAssignment
                        ? 'ichan-subject-card'
                        : 'ichan-subject-card ichan-subject-card-muted'
                  }
                  onClick={() => {
                    handleSelectSubject(subject.key)
                  }}
                  disabled={!hasAssignment}
                  aria-pressed={isActive}
                >
                  <div className="ichan-subject-media">
                    {renderStudentSubjectArtwork(subject, subject.artworkUrl)}
                  </div>
                  <div className="ichan-subject-body">
                    <div className="ichan-inline-pills">
                      <span className={hasAssignment ? 'subject-pill' : 'subject-pill muted-pill'}>{badgeText}</span>
                    </div>
                    <strong>{subject.label}</strong>
                  </div>
                </button>
              )
            })}
          </div>
      </article>

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <h3 className="ichan-section-title ichan-section-title-accent">TRÒ CHƠI</h3>
            </div>
            <span className="subject-pill muted-pill">{availableStandaloneGames.length} mục</span>
          </div>

          <div className="ichan-game-grid">
            {availableStandaloneGames.map((game) => {
              const isAvailableInLesson = lessonActivities.some((activity) => activity.activity_type === game.activityType)
              return (
                <article key={game.key} className="ichan-game-card">
                  <div className="ichan-game-copy">
                    {isAvailableInLesson ? <span className="subject-pill">Có trong bài đang mở</span> : null}
                    <strong>{game.label}</strong>
                    <button className="ghost-button" type="button" onClick={() => openIchanGame(game.activityType)}>
                      Mở trò chơi
                    </button>
                  </div>
                </article>
              )
            })}
            {!availableStandaloneGames.length ? <p className="helper-text">{`Mức ${currentStudentLevelLabel} chưa có trò chơi riêng.`}</p> : null}
          </div>
      </article>

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <h3 className="ichan-section-title ichan-section-title-accent">NGHỀ NGHIỆP</h3>
            </div>
          </div>

          <div className="ichan-career-grid">
            {availableCareerCards.map((item) => (
              <button
                key={item.key}
                type="button"
                className="student-visual-mini-card student-visual-mini-card-soft ichan-career-button"
                onClick={() => openCareerDetail(item.key)}
              >
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </button>
            ))}
            {careerCardsQuery.isLoading && !availableCareerCards.length ? <p className="helper-text">Đang tải nội dung nghề nghiệp...</p> : null}
            {!careerCardsQuery.isLoading && !availableCareerCards.length ? <p className="helper-text">{`Mức ${currentStudentLevelLabel} chưa có nội dung hướng nghiệp riêng.`}</p> : null}
          </div>
      </article>
    </section>
  )

  const renderIchanSubjectAssignmentsPage = () => {
    if (!selectedSubjectCard) return null

    if (showSimulationModal) {
      return (
        <section className="visual-simulation-page" aria-label="Mô phỏng trực quan">
          <header className="visual-simulation-header">
            <button className="ghost-button visual-simulation-back" type="button" onClick={() => setShowSimulationModal(false)}>
              Quay lại
            </button>
            <div>
              <p className="chat-modal-eyebrow">Mô phỏng</p>
              <h3>Mô phỏng trực quan</h3>
            </div>
          </header>
          <div className="visual-simulation-frame-wrap">
            <iframe
              key={selectedSimulationFrameUrl}
              className="visual-simulation-frame"
              title="Mô phỏng trực quan"
              src={selectedSimulationFrameUrl}
              allow="fullscreen; autoplay; encrypted-media; clipboard-write; picture-in-picture; microphone; camera"
              allowFullScreen
            />
          </div>
        </section>
      )
    }

    return (
      <section className="ichan-layout">
        <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <button className="ghost-button" type="button" onClick={handleBackToSubjects}>
                Quay lại
              </button>
              <p className="ichan-section-note" style={{ marginTop: '0.9rem' }}>Chọn bài em muốn học rồi bắt đầu ngay.</p>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
              {selectedSubjectCard?.key === 'khoa-hoc-tu-nhien' ? (
                <button className="ghost-button" type="button" onClick={() => setShowSimulationModal(true)}>
                  Mô phỏng trực quan
                </button>
              ) : null}
              <span className="subject-pill muted-pill">{`${selectedSubjectAssignments.length} bài`}</span>
            </div>
          </div>

          <div className="student-visual-assignment-list ichan-assignment-list">
            {selectedSubjectAssignments.map((item) => {
              const isActive = effectiveSelectedAssignmentId === item.assignment_id
              const subjectMeta = resolveAssignmentSubjectMeta(item)
              const totalActivities = item.assignment?.lesson?.activity_count ?? item.lesson?.activity_count ?? 0
              const completedActivities = totalActivities > 0 ? Math.min(totalActivities, Math.round((item.progress_percent / 100) * totalActivities)) : 0
              const progressContextLabel = totalActivities > 0 ? `${completedActivities}/${totalActivities} hoạt động` : 'Chưa có hoạt động'
              return (
                <button
                  key={item.id}
                  type="button"
                  className={isActive ? 'student-visual-assignment-card student-visual-assignment-card-active ichan-assignment-card-no-art' : 'student-visual-assignment-card ichan-assignment-card-no-art'}
                  onClick={() => chooseAssignment(item.assignment_id)}
                  aria-pressed={isActive}
                >
                  <div className="student-visual-assignment-top">
                    <span className="student-visual-assignment-chip">{cleanStatusLabelMap[item.status] ?? item.status}</span>
                    <span className="student-visual-assignment-score">{item.progress_percent}%</span>
                  </div>
                  <strong>{sanitizeStudentFacingText(item.assignment?.lesson?.title, `Bài ${item.assignment_id}`)}</strong>
                  <p>{subjectMeta?.label ?? item.assignment?.lesson?.subject?.name ?? 'Bài học'}</p>
                  <div className="ichan-assignment-progress-meta">
                    <span>{progressContextLabel}</span>
                    <span>{`${item.progress_percent}% hoàn thành`}</span>
                  </div>
                  <div className="student-auto-progress-track" style={{ ['--progress' as string]: `${item.progress_percent}%` }}>
                    <span />
                  </div>
                </button>
              )
            })}
            {!selectedSubjectAssignments.length && !assignmentsQuery.isLoading ? <p className="helper-text">Môn này chưa có bài để mở.</p> : null}
          </div>
        </article>
      </section>
    )
  }

  const renderIchanStandaloneGamePage = () => {
    if (!standaloneGameActivity) {
      return (
        <section className="ichan-layout">
          <article className="student-visual-panel ichan-section">
            <p className="helper-text">{isStandaloneGameLoading ? 'Đang chuẩn bị trò chơi...' : 'Đang mở trò chơi...'}</p>
          </article>
        </section>
      )
    }

    const currentGameMeta = activeStandaloneGameMeta
    const isStandaloneGameCompleted = isActivityCompleted(standaloneGameActivity, answers)

    return (
      <>
        <section ref={activeQuestionRef} tabIndex={-1} className="student-visual-panel student-visual-question-panel">
          <div className="student-visual-section-head">
            <div>
              <button className="ghost-button" type="button" onClick={closeStandaloneGame}>
                Quay lại
              </button>
              <p className="eyebrow" style={{ marginTop: '0.9rem' }}>Trò chơi</p>
              <h3 className="ichan-section-title">{currentGameMeta?.label ?? standaloneGameActivity.title}</h3>
              <p className="ichan-section-note">{currentGameMeta?.description ?? 'Mở trò chơi và bắt đầu ngay.'}</p>
            </div>
            <span className={isStandaloneGameCompleted ? 'subject-pill' : 'subject-pill muted-pill'}>
              {isStandaloneGameCompleted ? 'Xong' : 'Đang chơi'}
            </span>
          </div>

          <article className={isStandaloneGameCompleted ? 'student-visual-step-card student-visual-step-card-complete' : 'student-visual-step-card'}>
            <div className="student-visual-step-head">
              <span className="student-visual-step-badge">#1</span>
              <div className="student-visual-step-head-actions">
              <span className={isStandaloneGameCompleted ? 'student-visual-step-state student-visual-step-state-complete' : 'student-visual-step-state'}>
                  {isStandaloneGameCompleted ? 'Xong' : 'Đang chơi'}
                </span>
              </div>
            </div>

            <div className="student-visual-step-intro">
              <span className="student-visual-step-icon">{cleanActivityIconMap[standaloneGameActivity.activity_type] ?? '.'}</span>
              <div>
                <h4>{standaloneGameActivity.title}</h4>
                <p>{standaloneGameActivity.instruction_text ?? 'Chơi độc lập, không phụ thuộc môn học.'}</p>
              </div>
            </div>

            <LazyActivityCard
              key={standaloneGameActivity.id}
              activity={standaloneGameActivity}
              answers={answers}
              setAnswers={setAnswersMap}
              presentationMode="immersive_square"
              onAutoAdvance={() => undefined}
              loadingLabel="Đang tải trò chơi..."
            />
          </article>
        </section>

        <section className="student-visual-action-bar" aria-label="Thao tác trò chơi">
          <button className="ghost-button" type="button" onClick={closeStandaloneGame}>
            Quay lại
          </button>
          <button className="action-button" type="button" onClick={openIchanGame.bind(null, standaloneGameActivity.activity_type as StudentGameActivityType)}>
            Chơi lại
          </button>
        </section>
      </>
    )
  }

  const renderIchanCareerDetailPage = () => {
    if (!selectedCareerCard) return null

    return (
      <section className="ichan-layout">
        <article className="student-visual-panel ichan-section ichan-career-detail-page">
          <button className="ghost-button" type="button" onClick={closeCareerDetail}>
            Quay lại thư viện
          </button>

          <div className="ichan-career-hero">
            <img src={selectedCareerCard.coverImageUrl} alt={selectedCareerCard.title} />
            <div className="ichan-career-hero-overlay">
              <h3>{selectedCareerCard.title}</h3>
            </div>
          </div>

          <button
            type="button"
            className="ichan-career-meaning-card"
            onClick={() => void handlePlayCareerMeaning(selectedCareerCard)}
            disabled={isCareerMeaningSpeaking}
          >
            <div className="ichan-career-meaning-head">
              <strong>{selectedCareerCard.meaningTitle}</strong>
              <span>{activeCareerMeaningKey === selectedCareerCard.key && isCareerMeaningSpeaking ? 'Đang đọc' : 'Bấm để nghe'}</span>
            </div>
            <p>{selectedCareerCard.meaningText}</p>
          </button>

          {careerMeaningError ? <p className="error-text">{careerMeaningError}</p> : null}

          <div className="ichan-career-video-shell">
            {selectedCareerCard.videoEmbedUrl ? (
              <iframe
                src={selectedCareerCard.videoEmbedUrl}
                title={`Video nghề nghiệp ${selectedCareerCard.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : isDirectCareerVideoUrl(selectedCareerCard.rawVideoUrl) ? (
              <video src={selectedCareerCard.rawVideoUrl} controls preload="metadata" playsInline />
            ) : (
              <div className="ichan-career-video-note">
                <span>✦</span>
                <p>Giáo viên chưa thêm video cho nghề này.</p>
              </div>
            )}
          </div>

          <div className="ichan-career-video-note">
            <span>✦</span>
            <p>{selectedCareerCard.videoNote}</p>
          </div>

          <section className="ichan-career-steps-section">
            <div className="ichan-career-block-title">
              <span>⦿</span>
              <h4>Các bước thực hiện</h4>
            </div>

            <div className="ichan-career-steps-list">
              {selectedCareerCard.steps.map((step, index) => (
                <article key={step.title} className="ichan-career-step-card">
                  <span className="ichan-career-step-index">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="ichan-career-skills-section">
            <div className="ichan-career-block-title">
              <h4>Kỹ năng bạn sẽ học được:</h4>
            </div>

            <div className="ichan-career-skills-list">
              {selectedCareerCard.skills.map((skill) => (
                <span key={skill} className="ichan-career-skill-pill">{skill}</span>
              ))}
            </div>
          </section>
        </article>
      </section>
    )
  }

  const renderIchanAiPanel = () => (
    <section className="ichan-layout">
      <section className="student-visual-panel ichan-section career-voice-panel" aria-labelledby="student-ai-heading">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Bạn học AI</p>
            </div>
            <span className={isCareerListening ? 'subject-pill career-voice-live' : 'subject-pill muted-pill'}>
              {isCareerListening ? 'Đang nghe' : careerChatMutation.isPending ? 'Đang trả lời' : 'Sẵn sàng'}
            </span>
          </div>

          <div className="career-voice-stage">
            <button
              type="button"
              className={isCareerListening ? 'career-voice-orb career-voice-orb-live' : 'career-voice-orb'}
              onClick={handleCareerVoiceToggle}
              disabled={careerChatMutation.isPending}
              aria-label={isCareerListening ? 'Dừng nói' : 'Bắt đầu nói với AI'}
            >
              <span aria-hidden="true">{isCareerListening ? '■' : '🎙️'}</span>
            </button>

            <div className="career-voice-copy">
              <strong>{isCareerListening ? 'Em cứ nói nhé' : careerChatMutation.isPending ? 'AI đang trả lời' : 'Bấm mic rồi nói'}</strong>
              <p>Ví dụ: "Con thích vẽ thì sau này làm nghề gì?" hoặc "Nhắc con làm bài từng bước."</p>
            </div>

            <button
              type="button"
              className="ghost-button career-voice-replay"
              onClick={handleReplayCareerAnswer}
              disabled={!careerTurns.length || isCareerListening}
            >
              Nghe lại
            </button>
          </div>

          <div className="ichan-prompt-grid">
            {aiPromptCards.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="ichan-prompt-button"
                disabled={careerChatMutation.isPending || isCareerListening}
                onClick={() => submitCareerTranscript(prompt)}
              >
                {prompt}
              </button>
            ))}
            {isAiPromptCardsLoading && !aiPromptCards.length ? <p className="helper-text">Đang tải câu gợi ý...</p> : null}
          </div>

          {careerAudioUrl ? (
            <audio
              ref={careerAudioPlayerRef}
              className="career-voice-audio"
              src={careerAudioUrl}
              controls
              preload="auto"
              aria-label="Audio trả lời của AI"
            />
          ) : null}

          {careerTranscript ? (
            <article className="student-visual-mini-card career-voice-current">
              <span>Em vừa nói</span>
              <strong>{careerTranscript}</strong>
            </article>
          ) : null}

          {careerVoiceError ? <p className="error-text">{careerVoiceError}</p> : null}

          <div className="career-voice-turns" aria-live="polite">
            {careerTurns.map((turn) => (
              <article key={turn.id} className="student-visual-mini-card career-voice-turn">
                <span>Em</span>
                <p>{turn.studentText}</p>
                <span>AI</span>
                <strong>{turn.aiText}</strong>
              </article>
            ))}
            {!careerTurns.length ? (
              <article className="student-visual-mini-card student-visual-mini-card-soft">
                <strong>AI có thể hỗ trợ học bài, luyện nói lịch sự, và gợi ý nghề nghiệp bằng câu ngắn.</strong>
              </article>
            ) : null}
          </div>
      </section>

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Gợi ý</p>
              <h3 className="ichan-section-title">GỢI Ý NGHỀ NGHIỆP</h3>
            </div>
          </div>

          <div className="ichan-career-grid">
            {availableCareerCards.map((item) => (
              <article key={item.title} className="student-visual-mini-card student-visual-mini-card-soft">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
            {careerCardsQuery.isLoading && !availableCareerCards.length ? <p className="helper-text">Đang tải gợi ý nghề nghiệp...</p> : null}
            {!careerCardsQuery.isLoading && !availableCareerCards.length ? <p className="helper-text">{`Mức ${currentStudentLevelLabel} chưa có gợi ý nghề nghiệp riêng.`}</p> : null}
          </div>
      </article>

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Sắp làm</p>
              <h3 className="ichan-section-title">BÀI ĐANG CHỜ</h3>
            </div>
            <span className="subject-pill muted-pill">{pendingAssignments.length}</span>
          </div>

          <div className="student-visual-feed-stack">
            {pendingAssignments.map((item) => (
              <button
                key={item.id}
                type="button"
                className="student-visual-mini-card ichan-plain-button"
                onClick={() => chooseAssignment(item.assignment_id)}
              >
                <span>{cleanStatusLabelMap[item.status] ?? item.status}</span>
                <strong>{sanitizeStudentFacingText(item.assignment?.lesson?.title, `Bài ${item.assignment_id}`)}</strong>
              </button>
            ))}
            {!pendingAssignments.length ? <p className="helper-text">Mọi bài hiện tại đã hoàn thành.</p> : null}
          </div>
      </article>
    </section>
  )

  const renderIchanCommunicationPanel = () => (
    <section className="ichan-layout">
      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Giao tiếp</p>
              <h3 className="ichan-section-title">CHẠM ĐỂ PHÁT ÂM</h3>
              <p className="ichan-section-note">Thẻ nhu cầu và cảm xúc cơ bản để em diễn đạt nhanh.</p>
            </div>
            <span className="subject-pill muted-pill">{communicationCards.length} thẻ</span>
          </div>

          <div className="ichan-communication-grid">
            {communicationCards.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`ichan-communication-card ichan-communication-card-${item.tone}`}
                onClick={() => void handleCommunicationSpeak(item.phrase)}
              >
                <div className="ichan-communication-media" aria-hidden="true">
                  <img src={item.imageUrl} alt="" />
                </div>
                <div className="ichan-communication-copy">
                  <strong>{item.label}</strong>
                  <span>{item.phrase}</span>
                </div>
                <b className="ichan-communication-sound">🔊</b>
              </button>
            ))}
            {isCommunicationCardsLoading && !communicationCards.length ? <p className="helper-text">Đang tải thẻ giao tiếp...</p> : null}
          </div>
      </article>

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Đang nói</p>
              <h3 className="ichan-section-title">CÂU GẦN NHẤT</h3>
            </div>
          </div>

          <div className="ichan-preview-bubble">
            <strong>{lastCommunicationPhrase || 'Chưa chọn thẻ giao tiếp nào.'}</strong>
            <p>Tab này hỗ trợ diễn đạt nhanh, còn luồng tiến độ và báo cáo cho phụ huynh, giáo viên vẫn giữ như hiện tại.</p>
          </div>
          {communicationError ? <p className="error-text">{communicationError}</p> : null}
      </article>
    </section>
  )

  const renderIchanSettingsPanel = () => (
    <section className="ichan-layout">
      <section className="ichan-summary-grid" aria-label="Tổng quan học sinh">
        <article className="student-visual-glass-card">
          <span>Tiến độ</span>
          <strong>{liveProgressPercent}%</strong>
          <p>Bài hiện tại hoặc tiến độ gần nhất.</p>
        </article>
        <article className="student-visual-glass-card">
          <span>Đang học</span>
          <strong>{totalInProgressCount}</strong>
          <p>Số bài đang ở trạng thái tiếp tục.</p>
        </article>
        <article className="student-visual-glass-card">
          <span>Môn có bài</span>
          <strong>{subjectCards.filter((item) => item.assignmentCount > 0).length}</strong>
          <p>Giữ theo logic bài giao hiện tại.</p>
        </article>
        <article className="student-visual-glass-card">
          <span>Hoạt động</span>
          <strong>{activityProgress.totalActivities || 0}</strong>
          <p>Số bước trong bài đang mở.</p>
        </article>
      </section>

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Nhắc việc</p>
              <h3 className="ichan-section-title">HÔM NAY</h3>
            </div>
            <span className="subject-pill muted-pill">{studentFeedItems.length}</span>
          </div>

          <div className="student-visual-feed-stack" aria-live="polite">
            {studentFeedItems.slice(0, 4).map((item) => (
              <article key={item.id} className={`student-visual-feed-card student-visual-feed-card-${item.tone}`}>
                <div className="student-visual-feed-top">
                  <span>{cleanFeedToneIconMap[item.tone] ?? '.'} {item.category}</span>
                  <b>{item.badge}</b>
                </div>
                <strong>{item.title}</strong>
              </article>
            ))}
            {!studentFeedItems.length ? <p className="helper-text">Chưa có nhắc mới.</p> : null}
          </div>
      </article>

      {renderIchanJoinCard('Vào lớp', 'Kết nối')}

      <article className="student-visual-panel ichan-section">
          <div className="student-visual-section-head">
            <div>
              <p className="eyebrow">Đồng hành</p>
              <h3 className="ichan-section-title">GIÁO VIÊN</h3>
            </div>
            <span className="subject-pill muted-pill">{teacherBadges.length}</span>
          </div>

          <div className="ichan-teacher-list">
            {teacherBadges.map((item) => (
              <article key={item.id} className="student-visual-mini-card">
                <span>{item.schoolName || 'Lớp học trực quan'}</span>
                <strong>{item.name}</strong>
              </article>
            ))}
            {!teacherBadges.length ? <p className="helper-text">Chưa có giáo viên liên kết.</p> : null}
          </div>
      </article>
    </section>
  )

  const renderStudentEntryGate = () => (
    <section className="student-entry-gate" aria-label="Chọn mức độ hỗ trợ">
      <div className="student-entry-gate-shell">
        <div className="student-entry-gate-brand">
          <h1>Bạn học thông minh</h1>
        </div>

        <div className="student-entry-gate-panel">
          <div className="student-entry-gate-copy">
            <p className="student-entry-gate-kicker">CHÀO MỪNG BẠN</p>
            <h2>{studentName}</h2>
            <p>{`Hãy chọn mức độ hỗ trợ để bắt đầu. Mức hiện tại: ${currentStudentLevelLabel}.`}</p>
          </div>

          <div className="student-entry-gate-options">
            {studentEntryOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`student-entry-gate-option student-entry-gate-option-${option.key}`}
                disabled={updateStudentLevelMutation.isPending}
                onClick={() => handleStudentEntrySelect(option.key)}
              >
                <strong>{option.title}</strong>
                <span>{option.subtitle}</span>
              </button>
            ))}
          </div>
          {updateStudentLevelMutation.error ? <p className="error-text">{(updateStudentLevelMutation.error as Error).message}</p> : null}
        </div>
      </div>
    </section>
  )

  return (
    <RequireAuth allowedRoles={['student']}>
      <div
        className={
          hasCompletedEntryGate
            ? isStudentLessonFocus
              ? 'student-visual-page student-visual-page-lesson-focus'
              : 'student-visual-page'
            : 'student-visual-page student-visual-page-gated'
        }
        style={visualSupportStyle}
        onPointerDownCapture={completionSummary ? () => setCompletionLastInteractionAt(getCurrentTimestamp()) : undefined}
        onKeyDownCapture={completionSummary ? () => setCompletionLastInteractionAt(getCurrentTimestamp()) : undefined}
      >
        {!hasCompletedEntryGate ? renderStudentEntryGate() : null}
        <section className="student-visual-hero ichan-hero">
          <div className="ichan-hero-banner">
            <div className="ichan-hero-avatar" aria-hidden="true">
              <span>🙂</span>
            </div>

            <div className="student-visual-hero-copy">
              <h2>{`Chào mừng bạn, ${studentName}!`}</h2>
              <p className="ichan-hero-support-copy">{heroSupportCopy}</p>
              {activePanel === 'learning' && detail ? <p className="ichan-hero-note">{`Bài đang mở: ${heroLessonTitle}`}</p> : activePanel !== 'learning' && activeTabCopy.description ? <p className="ichan-hero-note">{activeTabCopy.description}</p> : null}

              <div className="student-visual-badges">
                {heroBadges.map((item) => (
                  <span key={item} className="student-visual-badge">{item}</span>
                ))}
              </div>

              {detail && activePanel === 'learning' ? (
                <div className="student-visual-hero-progress">
                  <div className="student-visual-hero-progress-head">
                    <strong>{cleanStatusLabelMap[detail!.status] ?? detail!.status}</strong>
                    <span>{liveProgressPercent}%</span>
                  </div>
                  <div className="student-auto-progress-track" style={{ ['--progress' as string]: `${liveProgressPercent}%` }}>
                    <span />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ichan-hero-spark" aria-hidden="true">
              <span>✦</span>
            </div>
          </div>
        </section>

        {completionSummary ? (
          <section className="student-visual-celebration student-visual-result-card" aria-live="assertive">
            <div>
              <p className="student-visual-kicker">Hoàn thành</p>
              <div className="student-visual-result-praise">
                <h3>Em giỏi lắm!</h3>
                <span className="student-visual-celebration-star" aria-hidden="true" />
              </div>
              <p className="student-visual-result-lesson-title">{completionSummary.title}</p>
              <div className="student-visual-result-metrics">
                <span>{completionSummary.progressPercent}%</span>
                <span>{completionSummary.completionScore} điểm</span>
                <span>{completionSummary.completedActivities}/{completionSummary.totalActivities || 0}</span>
              </div>
            </div>
            <div className="student-visual-celebration-actions">
              <button type="button" className="student-home-icon" onClick={handleGoHome} aria-label="Về trang chủ">
                Về trang chủ
              </button>
            </div>
          </section>
        ) : null}

        {activePanel === 'learning'
          ? selectedCareerCard
            ? null
            : activeStandaloneGameType
            ? null
            : detail
            ? null
            : selectedSubjectCard
              ? renderIchanSubjectAssignmentsPage()
              : renderIchanLearningHub()
          : null}
        {activePanel === 'ai' ? renderIchanAiPanel() : null}
        {activePanel === 'communication' ? renderIchanCommunicationPanel() : null}
        {activePanel === 'settings' ? renderIchanSettingsPanel() : null}
        {activePanel === 'learning' && selectedCareerCard ? renderIchanCareerDetailPage() : null}
        {activePanel === 'learning' && activeStandaloneGameType ? renderIchanStandaloneGamePage() : null}
        {activePanel === 'learning' && !selectedCareerCard && !activeStandaloneGameType ? renderIchanLessonStage() : null}

        {(startMutation.error || completeMutation.error) ? (
          <p className="error-text student-visual-floating-error">
            {(startMutation.error as Error)?.message ?? (completeMutation.error as Error)?.message}
          </p>
        ) : null}
      </div>
    </RequireAuth>
  )
}
