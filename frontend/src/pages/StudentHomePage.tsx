import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ActivityCard } from '../components/activities/ActivityRenderer'
import { RequireAuth } from '../components/RequireAuth'
import {
  completeMyAssignment,
  fetchMyAssignment,
  fetchMyAssignments,
  fetchMyClasses,
  fetchMyTeachers,
  joinClassByCredential,
  sendAIChat,
  startMyAssignment,
  synthesizeAISpeech,
  updateMyAssignmentProgress,
  type ClassItem,
  type LessonActivityItem,
  type MyAssignmentDetail,
  type MyAssignmentItem,
  type StudentTeacherLinkItem,
} from '../services/api'
import { useAuthStore } from '../store/authStore'
import { syncStudentFeed, type StudentFeedItem } from '../utils/studentFeedStore'

const studentBackgroundImageUrl = '/student-ui/anh4.jpg'

const visualThemePresetMap = {
  garden: {
    backgroundImageUrl: studentBackgroundImageUrl,
    accent: '#1f9d87',
    accentStrong: '#126f60',
    accentSoft: 'rgba(31, 157, 135, 0.16)',
    glow: 'rgba(255, 205, 110, 0.28)',
    overlay: 'linear-gradient(180deg, rgba(241, 255, 248, 0.7) 0%, rgba(240, 247, 255, 0.94) 52%, rgba(255, 248, 236, 0.98) 100%)',
  },
  ocean: {
    backgroundImageUrl: studentBackgroundImageUrl,
    accent: '#247bb7',
    accentStrong: '#145581',
    accentSoft: 'rgba(36, 123, 183, 0.16)',
    glow: 'rgba(126, 218, 255, 0.26)',
    overlay: 'linear-gradient(180deg, rgba(232, 249, 255, 0.68) 0%, rgba(236, 248, 255, 0.92) 46%, rgba(247, 253, 255, 0.98) 100%)',
  },
  cosmos: {
    backgroundImageUrl: studentBackgroundImageUrl,
    accent: '#6550d8',
    accentStrong: '#3f2f9d',
    accentSoft: 'rgba(101, 80, 216, 0.16)',
    glow: 'rgba(255, 165, 208, 0.28)',
    overlay: 'linear-gradient(180deg, rgba(238, 233, 255, 0.62) 0%, rgba(238, 241, 255, 0.88) 44%, rgba(250, 245, 255, 0.97) 100%)',
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

const activityTypeVisualLabelMap: Record<string, string> = {
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

const feedToneIconMap: Record<string, string> = {
  celebration: '✦',
  focus: '◉',
  support: '◎',
  update: '•',
}

type StudentPanelKey = 'home' | 'progress' | 'info' | 'career' | 'reminders' | 'settings'

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
  image_puzzle: '[]',
  hidden_image_guess: '<>',
  multiple_choice: '()',
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

const studentMenuItems: Array<{ key: StudentPanelKey; label: string; icon: string }> = [
  { key: 'home', label: 'Trang chủ', icon: '[]' },
  { key: 'progress', label: 'Tiến độ', icon: 'o' },
  { key: 'info', label: 'Thông tin', icon: 'i' },
  { key: 'career', label: 'Nghề', icon: '@' },
  { key: 'reminders', label: 'Nhắc', icon: '*' },
  { key: 'settings', label: 'Cài đặt', icon: '=' },
]

const studentArtworkPool = ['/student-ui/anh1.jpg', '/student-ui/anh2.jpg', '/student-ui/anh3.jpg', '/student-ui/anh4.jpg']

function resolveStudentArtwork(seed = 0) {
  return studentArtworkPool[Math.abs(seed) % studentArtworkPool.length]
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
  return textFromConfig(config?.audio_url) || textFromConfig(config?.guidance_audio_url)
}

let activeGuidanceAudio: HTMLAudioElement | null = null
let activeGuidancePlaybackToken = 0
let activeGuidanceAudioUrl: string | null = null

function clearActiveGuidanceAudio() {
  activeGuidanceAudio?.pause()
  activeGuidanceAudio = null
  if (activeGuidanceAudioUrl?.startsWith('blob:')) {
    window.URL.revokeObjectURL(activeGuidanceAudioUrl)
  }
  activeGuidanceAudioUrl = null
}

function speechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
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

async function playStudentGuidanceAudio(audioUrl: string) {
  if (typeof window === 'undefined' || !audioUrl.trim()) return false
  activeGuidancePlaybackToken += 1
  const playbackToken = activeGuidancePlaybackToken
  clearActiveGuidanceAudio()

  try {
    const audio = new Audio(audioUrl)
    audio.preload = 'auto'
    audio.volume = 1
    audio.onended = () => {
      if (activeGuidanceAudio === audio) {
        clearActiveGuidanceAudio()
      }
    }
    audio.onerror = () => {
      if (activeGuidanceAudio === audio) {
        clearActiveGuidanceAudio()
      }
    }
    activeGuidanceAudioUrl = audioUrl
    activeGuidanceAudio = audio
    if (playbackToken !== activeGuidancePlaybackToken) return false
    await audio.play()
    return true
  } catch {
    if (playbackToken === activeGuidancePlaybackToken) {
      clearActiveGuidanceAudio()
    }
    return false
  }
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

function isPuzzleSolved(activity: LessonActivityItem, answers: StudentAnswerState) {
  const config = parseActivityConfig(activity.config_json)
  const pieceCount = resolvedPuzzlePieceCount(config)
  const slots = answers.dragAnswers[activity.id]
  if (!Array.isArray(slots) || slots.length !== pieceCount) return false
  return slots.every((pieceId, index) => pieceId === `piece-${index}`)
}

function isActivityCompleted(activity: LessonActivityItem, answers: StudentAnswerState) {
  switch (activity.activity_type) {
    case 'multiple_choice':
    case 'image_choice':
    case 'listen_choose':
      return hasFilledString(answers.choiceAnswers[activity.id])
    case 'image_puzzle':
      return isPuzzleSolved(activity, answers)
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
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [activePanel, setActivePanel] = useState<StudentPanelKey>('home')
  const [joinClassId, setJoinClassId] = useState('')
  const [joinClassPassword, setJoinClassPassword] = useState('')
  const [completedLessonTitle, setCompletedLessonTitle] = useState('')
  const [activeActivityIndex, setActiveActivityIndex] = useState(0)
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null)
  const [completionLastInteractionAt, setCompletionLastInteractionAt] = useState(0)
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, string>>({})
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, string[]>>({})
  const [dragAnswers, setDragAnswers] = useState<Record<number, string[]>>({})
  const [stepAnswers, setStepAnswers] = useState<Record<number, boolean[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({})
  const [aacSelections, setAacSelections] = useState<Record<number, string>>({})
  const [studentFeedItems, setStudentFeedItems] = useState<StudentFeedItem[]>([])
  const learningBaseSecondsRef = useRef(0)
  const learningSessionStartedAtRef = useRef<number | null>(null)
  const lastAutoSyncKeyRef = useRef('')
  const autoActionKeyRef = useRef('')
  const activeQuestionRef = useRef<HTMLElement | null>(null)
  const spokenActivityIdsRef = useRef<Set<number>>(new Set())
  const careerRecognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const careerTranscriptRef = useRef('')
  const careerAudioCacheRef = useRef<Record<string, string>>({})
  const careerAudioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const [careerTurns, setCareerTurns] = useState<CareerVoiceTurn[]>([])
  const [careerTranscript, setCareerTranscript] = useState('')
  const [careerAudioUrl, setCareerAudioUrl] = useState('')
  const [isCareerListening, setIsCareerListening] = useState(false)
  const [careerVoiceError, setCareerVoiceError] = useState<string | null>(null)

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

  const resetActivityAnswers = () => {
    stopStudentGuidance()
    setChoiceAnswers({})
    setMatchingAnswers({})
    setDragAnswers({})
    setStepAnswers({})
    setTextAnswers({})
    setAacSelections({})
    setActiveActivityIndex(0)
    autoActionKeyRef.current = ''
    spokenActivityIdsRef.current = new Set()
  }

  const closeLessonView = () => {
    stopStudentGuidance()
    setSelectedAssignmentId(null)
    setActivePanel('home')
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
  }

  const startMutation = useMutation({
    mutationFn: (assignmentId: number) => startMyAssignment(token!, assignmentId),
    onSuccess: async (updatedProgress, assignmentId) => {
      resetActivityAnswers()
      setCompletedLessonTitle('')
      setCompletionSummary(null)
      learningSessionStartedAtRef.current = Date.now()
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
    mutationFn: () => completeMyAssignment(token!, effectiveSelectedAssignmentId!),
    onSuccess: async (updatedProgress) => {
      const title = sanitizeStudentFacingText(detail?.lesson?.title ?? detail?.assignment?.lesson?.title, 'Bài học')
      setCompletedLessonTitle(title)
      setCompletionSummary({
        title,
        progressPercent: updatedProgress.progress_percent ?? 100,
        completionScore: updatedProgress.completion_score ?? 100,
        completedActivities: activityProgress.totalActivities || activityProgress.completedActivities,
        totalActivities: activityProgress.totalActivities,
        completedAt: Date.now(),
      })
      setCompletionLastInteractionAt(Date.now())
      lastAutoSyncKeyRef.current = ''
      await refreshStudentQueries()
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
    },
  })

  const careerChatMutation = useMutation({
    mutationFn: (message: string) =>
      sendAIChat(token!, {
        message,
        context: {
          target_role: user?.role,
          disability_level: typeof profile?.disability_level === 'string' ? String(profile.disability_level) : 'nhe',
          lesson_title: 'Trò chuyện hướng nghiệp',
          subject_name: 'Định hướng nghề nghiệp',
          activity_type: 'career_guidance_voice',
        },
      }),
    onSuccess: async (data, message) => {
      const aiText = data.text
      setCareerTurns((current) => [
        {
          id: `${Date.now()}`,
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
    learningSessionStartedAtRef.current = detail?.status === 'in_progress' ? Date.now() : null
    lastAutoSyncKeyRef.current = ''
  }, [detail?.id, detail?.status, effectiveSelectedAssignmentId])

  const totalAssignments = assignmentsQuery.data?.length ?? 0
  const completedCount = assignmentsQuery.data?.filter((item) => item.status === 'completed').length ?? 0
  const selectedAssignment =
    assignmentsQuery.data?.find((item) => item.assignment_id === effectiveSelectedAssignmentId) ?? null
  const visualAssignments = useMemo(
    () => (assignmentsQuery.data ?? []).filter((item) => isVisualSupportAssignment(item)),
    [assignmentsQuery.data],
  )
  const visualSupportClassroom = resolveVisualSupportClassroom(detail, selectedAssignment, visualAssignments)
  const visualThemeKey =
    visualSupportClassroom?.visual_theme && Object.prototype.hasOwnProperty.call(visualThemePresetMap, visualSupportClassroom.visual_theme)
      ? (visualSupportClassroom.visual_theme as keyof typeof visualThemePresetMap)
      : 'garden'
  const resolvedVisualTheme = visualThemePresetMap[visualThemeKey]
  const visualSupportStyle = {
    ['--support-visual-bg-image' as string]: `url("${studentBackgroundImageUrl}")`,
    ['--support-visual-overlay' as string]: resolvedVisualTheme.overlay,
    ['--support-visual-accent' as string]: resolvedVisualTheme.accent,
    ['--support-visual-accent-strong' as string]: resolvedVisualTheme.accentStrong,
    ['--support-visual-accent-soft' as string]: resolvedVisualTheme.accentSoft,
    ['--support-visual-glow' as string]: resolvedVisualTheme.glow,
  }
  const studentName =
    typeof profile?.full_name === 'string' && profile.full_name.trim()
      ? sanitizeStudentFacingText(profile.full_name, 'Học sinh')
      : user?.email ?? 'Học sinh'
  const allAssignments = visualAssignments.length ? visualAssignments : assignmentsQuery.data ?? []
  const heroLessonTitle = sanitizeStudentFacingText(detail?.lesson?.title ?? completedLessonTitle, 'Hôm nay học gì?')

  const chooseAssignment = (assignmentId: number) => {
    const assignment = assignmentsQuery.data?.find((item) => item.assignment_id === assignmentId)
    setSelectedAssignmentId(assignmentId)
    setActivePanel('home')
    setCompletedLessonTitle('')
    setCompletionSummary(null)
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
    if (assignment?.status === 'not_started' && !startMutation.isPending) {
      startMutation.mutate(assignmentId)
    }
  }

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

  const activityProgress = useMemo<ActivityProgressSummary>(() => {
    const activities = detail?.lesson?.activities ?? []
    const totalActivities = activities.length
    const completedActivities = activities.filter((activity) => isActivityCompleted(activity, answers)).length
    const progressPercent =
      totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : detail?.progress_percent ?? 0
    const completionScore = progressPercent
    const readyToComplete = totalActivities === 0 || completedActivities >= totalActivities
    return {
      totalActivities,
      completedActivities,
      progressPercent,
      completionScore,
      readyToComplete,
      hasActivityInteraction: completedActivities > 0,
    }
  }, [detail?.lesson?.activities, detail?.progress_percent, answers])

  const liveProgressPercent = activityProgress.hasActivityInteraction
    ? Math.max(detail?.progress_percent ?? 0, activityProgress.progressPercent)
    : detail?.progress_percent ?? 0

  const liveCompletionScore = activityProgress.hasActivityInteraction
    ? Math.max(detail?.completion_score ?? 0, activityProgress.completionScore)
    : detail?.completion_score ?? 0

  const lessonActivities = useMemo(() => detail?.lesson?.activities ?? [], [detail?.lesson?.activities])
  const currentActivity = lessonActivities[activeActivityIndex] ?? null
  const currentActivityCompleted = currentActivity ? isActivityCompleted(currentActivity, answers) : false
  const currentActivityGuidanceAudioUrl = currentActivity ? resolveActivityGuidanceAudioUrl(currentActivity) : ''

  useEffect(() => {
    if (activeActivityIndex >= lessonActivities.length && lessonActivities.length > 0) {
      setActiveActivityIndex(lessonActivities.length - 1)
    }
  }, [activeActivityIndex, lessonActivities.length])

  useEffect(() => {
    if (!detail || completionSummary) return
    const frameId = window.requestAnimationFrame(() => {
      activeQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [completionSummary, detail?.id])

  useEffect(() => {
    if (!currentActivity || !currentActivityGuidanceAudioUrl || activePanel !== 'home' || completionSummary) return
    if (spokenActivityIdsRef.current.has(currentActivity.id)) return

    spokenActivityIdsRef.current.add(currentActivity.id)

    const timeout = window.setTimeout(() => {
      void playStudentGuidanceAudio(currentActivityGuidanceAudioUrl)
    }, 320)

    return () => window.clearTimeout(timeout)
  }, [activePanel, completionSummary, currentActivity, currentActivityGuidanceAudioUrl])

  useEffect(() => () => {
    stopStudentGuidance()
  }, [])

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
      learningSessionStartedAtRef.current = Date.now()
    }

    const totalLearningSeconds = Math.max(
      detail.total_learning_seconds ?? 0,
      learningBaseSecondsRef.current +
        Math.max(1, Math.floor((Date.now() - learningSessionStartedAtRef.current) / 1000)),
    )

    const nextPayload = {
      progress_percent: activityProgress.progressPercent,
      completion_score: activityProgress.completionScore,
      total_learning_seconds: totalLearningSeconds,
      reward_star_count: activityProgress.progressPercent >= 100 ? 3 : activityProgress.progressPercent >= 60 ? 2 : 1,
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
        learningSessionStartedAtRef.current = Date.now()
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

  useEffect(() => {
    if (!currentActivity || !currentActivityCompleted || completionSummary) return
    const timeout = window.setTimeout(() => {
      handleAutoAdvance(currentActivity.id)
    }, 420)
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
    if (!currentActivityGuidanceAudioUrl) return
    void playStudentGuidanceAudio(currentActivityGuidanceAudioUrl)
  }

  const handleRestartAssignment = () => {
    if (!effectiveSelectedAssignmentId || startMutation.isPending) return

    resetActivityAnswers()
    setCompletedLessonTitle('')
    setCompletionSummary(null)
    learningSessionStartedAtRef.current = Date.now()
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

  const renderStudentFeed = () => (
    <section className="student-feed-panel student-feed-panel-visual" aria-labelledby="student-feed-heading">
      <div className="student-feed-head">
        <div>
          <h3 id="student-feed-heading">Nhắc</h3>
        </div>
        <span className="subject-pill muted-pill">{studentFeedItems.length}</span>
      </div>
      <div className="student-feed-list" aria-live="polite">
        {studentFeedItems.map((item) => (
          <article key={item.id} className={`student-feed-item student-feed-item-${item.tone}`}>
            <div>
              <span>{feedToneIconMap[item.tone] ?? '•'} {item.category}</span>
              <strong>{item.title}</strong>
            </div>
            <b>{item.badge}</b>
          </article>
        ))}
        {!studentFeedItems.length ? <p>Chưa có nhắc mới.</p> : null}
      </div>
    </section>
  )

  void renderStudentFeed

  const renderProgressPanel = () => (
    <section className="student-visual-panel student-visual-subpanel" aria-labelledby="student-progress-heading">
      <div className="student-visual-section-head">
        <div>
          <p className="eyebrow">Theo dõi</p>
          <h3 id="student-progress-heading">Tiến độ</h3>
        </div>
        <span className="subject-pill muted-pill">{completedCount}/{allAssignments.length || totalAssignments || 0}</span>
      </div>

      <div className="student-visual-overview-grid student-visual-overview-grid-compact">
        <article className="student-visual-glass-card">
          <span>Bai</span>
          <strong>{allAssignments.length || totalAssignments}</strong>
          <p>Sẵn sàng</p>
        </article>
        <article className="student-visual-glass-card">
          <span>Xong</span>
          <strong>{completedCount}</strong>
          <p>Da hoan thanh</p>
        </article>
        <article className="student-visual-glass-card">
          <span>Hiện tại</span>
          <strong>{detail ? `${liveProgressPercent}%` : '--'}</strong>
          <p>{detail ? heroLessonTitle : 'Chua mo bai'}</p>
        </article>
      </div>

      <div className="student-visual-progress-list">
        {allAssignments.map((item) => (
          <article key={item.id} className="student-visual-mini-card">
            <div className="student-visual-mini-card-head">
              <strong>{sanitizeStudentFacingText(item.assignment?.lesson?.title, `Bài ${item.assignment_id}`)}</strong>
              <span>{cleanStatusLabelMap[item.status] ?? item.status}</span>
            </div>
            <div className="student-auto-progress-track" style={{ ['--progress' as string]: `${item.progress_percent}%` }}>
              <span />
            </div>
          </article>
        ))}
        {!allAssignments.length && !assignmentsQuery.isLoading ? <p className="helper-text">Chưa có bài học.</p> : null}
      </div>
    </section>
  )

  const renderInfoPanel = () => (
    <section className="student-visual-panel student-visual-subpanel" aria-labelledby="student-info-heading">
      <div className="student-visual-section-head">
        <div>
          <p className="eyebrow">Thông tin</p>
          <h3 id="student-info-heading">Lớp và giáo viên</h3>
        </div>
      </div>

      <div className="student-visual-info-grid">
        <article className="student-visual-mini-card">
          <div className="student-visual-mini-card-head">
            <strong>Học sinh</strong>
            <span>{studentName}</span>
          </div>
          <p>{myClassesQuery.data?.length ?? 0} lop</p>
        </article>
        <article className="student-visual-mini-card">
          <div className="student-visual-mini-card-head">
            <strong>Giáo viên</strong>
            <span>{myTeachersQuery.data?.length ?? 0}</span>
          </div>
          <div className="tag-wrap">
            {(myTeachersQuery.data ?? []).map((item) => (
              <span key={item.link_id} className="subject-pill">{item.teacher.full_name}</span>
            ))}
            {!myTeachersQuery.data?.length && !myTeachersQuery.isLoading ? <span className="subject-pill muted-pill">Chưa có</span> : null}
          </div>
        </article>
      </div>

      <div className="tag-wrap">
        {(myClassesQuery.data ?? []).map((classroom) => (
          <span key={classroom.id} className="subject-pill">
            {sanitizeStudentFacingText(classroom.name, 'Lớp học')}
          </span>
        ))}
        {!myClassesQuery.data?.length && !myClassesQuery.isLoading ? <span className="subject-pill muted-pill">Chưa vào lớp</span> : null}
      </div>
    </section>
  )

  const renderRemindersPanel = () => (
    <section className="student-visual-panel student-visual-subpanel" aria-labelledby="student-reminders-heading">
      <div className="student-visual-section-head">
        <div>
          <p className="eyebrow">Nhớ</p>
          <h3 id="student-reminders-heading">Nhắc việc</h3>
        </div>
        <span className="subject-pill muted-pill">{studentFeedItems.length}</span>
      </div>

      <div className="student-visual-feed-stack" aria-live="polite">
        {studentFeedItems.map((item) => (
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
    </section>
  )

  const renderCareerPanel = () => (
    <section className="student-visual-panel student-visual-subpanel career-voice-panel" aria-labelledby="student-career-heading">
      <div className="student-visual-section-head">
        <div>
          <p className="eyebrow">AI</p>
          <h3 id="student-career-heading">Hướng nghiệp</h3>
        </div>
        <span className={isCareerListening ? 'subject-pill career-voice-live' : 'subject-pill muted-pill'}>
          {isCareerListening ? 'Đang nghe' : careerChatMutation.isPending ? 'AI nghĩ' : 'Voice'}
        </span>
      </div>

      <div className="career-voice-stage">
        <button
          type="button"
          className={isCareerListening ? 'career-voice-orb career-voice-orb-live' : 'career-voice-orb'}
          onClick={handleCareerVoiceToggle}
          disabled={careerChatMutation.isPending}
          aria-label={isCareerListening ? 'Dừng nói' : 'Bắt đầu nói với AI hướng nghiệp'}
        >
          <span aria-hidden="true">{isCareerListening ? '■' : '🎙️'}</span>
        </button>

        <div className="career-voice-copy">
          <strong>{isCareerListening ? 'Em cứ nói nhé' : careerChatMutation.isPending ? 'AI đang trả lời' : 'Bấm mic rồi nói'}</strong>
          <p>Ví dụ: “Con thích vẽ thì sau này làm nghề gì?”</p>
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

      {careerAudioUrl ? (
        <audio
          ref={careerAudioPlayerRef}
          className="career-voice-audio"
          src={careerAudioUrl}
          controls
          preload="auto"
          aria-label="Audio trả lời hướng nghiệp"
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
            <strong>AI sẽ hỏi ngắn, trả lời ngắn và gợi ý nghề phù hợp với sở thích của em.</strong>
          </article>
        ) : null}
      </div>
    </section>
  )

  const renderSettingsPanel = () => (
    <section className="student-visual-panel student-visual-subpanel" aria-labelledby="student-settings-heading">
      <div className="student-visual-section-head">
        <div>
          <p className="eyebrow">Cài đặt</p>
          <h3 id="student-settings-heading">Vào lớp</h3>
        </div>
      </div>

      <div className="student-visual-settings-layout">
        <div className="form-stack student-progress-form">
          <label>
            ID
            <input value={joinClassId} onChange={(event) => setJoinClassId(event.target.value)} inputMode="numeric" placeholder="12" />
          </label>
          <label>
            Mã
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

        <article className="student-visual-mini-card student-visual-mini-card-soft">
          <div className="student-visual-mini-card-head">
            <strong>Không gian</strong>
            <span>{myClassesQuery.data?.length ?? 0} lop</span>
          </div>
          <p>Menu này giữ các phần phụ để trang chủ gọn hơn.</p>
        </article>
      </div>
    </section>
  )

  const renderSecondaryPanel = () => {
    switch (activePanel) {
      case 'progress':
        return renderProgressPanel()
      case 'info':
        return renderInfoPanel()
      case 'career':
        return renderCareerPanel()
      case 'reminders':
        return renderRemindersPanel()
      case 'settings':
        return renderSettingsPanel()
      default:
        return null
    }
  }

  return (
    <RequireAuth allowedRoles={['student']}>
      <div
        className="student-visual-page"
        style={visualSupportStyle}
        onPointerDownCapture={completionSummary ? () => setCompletionLastInteractionAt(Date.now()) : undefined}
        onKeyDownCapture={completionSummary ? () => setCompletionLastInteractionAt(Date.now()) : undefined}
      >
        <section className="student-visual-hero">
          <div className="student-visual-hero-copy">
            <p className="student-visual-kicker">Student</p>
            <h2>{studentName}</h2>
            <p>{activePanel === 'home' ? heroLessonTitle : studentMenuItems.find((item) => item.key === activePanel)?.label ?? 'Trang chủ'}</p>

            <div className="student-visual-badges">
              <span className="student-visual-badge">Bài {allAssignments.length || totalAssignments}</span>
              <span className="student-visual-badge">Xong {completedCount}</span>
              <span className="student-visual-badge">GV {myTeachersQuery.data?.length ?? 0}</span>
            </div>

            {detail && activePanel === 'home' ? (
              <div className="student-visual-hero-progress">
                <div className="student-visual-hero-progress-head">
                  <strong>{cleanStatusLabelMap[detail.status] ?? detail.status}</strong>
                  <span>{liveProgressPercent}%</span>
                </div>
                <div className="student-auto-progress-track" style={{ ['--progress' as string]: `${liveProgressPercent}%` }}>
                  <span />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <nav className="student-visual-menu" aria-label="Menu học sinh">
          {studentMenuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activePanel === item.key ? 'student-visual-menu-button student-visual-menu-button-active' : 'student-visual-menu-button'}
              onClick={() => setActivePanel(item.key)}
              aria-pressed={activePanel === item.key}
            >
              <span className="student-visual-menu-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

          {completionSummary ? (
            <section className="student-visual-celebration student-visual-result-card" aria-live="assertive">
              <div>
                <p className="student-visual-kicker">Xong</p>
                <h3>{completionSummary.title}</h3>
                <div className="student-visual-result-metrics">
                  <span>{completionSummary.progressPercent}%</span>
                  <span>{completionSummary.completionScore} d</span>
                  <span>{completionSummary.completedActivities}/{completionSummary.totalActivities || 0}</span>
                </div>
              </div>
              <button type="button" className="student-home-icon" onClick={handleGoHome} aria-label="Về trang chủ">
                []
              </button>
            </section>
          ) : null}

          {activePanel === 'home' ? (
          <section className="student-visual-home-grid">
            <article className="student-visual-panel">
              <div className="student-visual-section-head">
                <div>
                  <p className="eyebrow">Học</p>
                  <h3>Chọn bài</h3>
                </div>
                <span className="subject-pill muted-pill">{allAssignments.length || totalAssignments}</span>
              </div>

              <div className="student-visual-assignment-list">
                {allAssignments.map((item) => {
                  const isActive = effectiveSelectedAssignmentId === item.assignment_id
                  const art = resolveStudentArtwork(item.assignment_id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={isActive ? 'student-visual-assignment-card student-visual-assignment-card-active' : 'student-visual-assignment-card'}
                      onClick={() => chooseAssignment(item.assignment_id)}
                      aria-pressed={isActive}
                    >
                      <div className="student-visual-assignment-art">
                        <img src={art} alt="" />
                      </div>
                      <div className="student-visual-assignment-top">
                        <span className="student-visual-assignment-chip">{cleanStatusLabelMap[item.status] ?? item.status}</span>
                        <span className="student-visual-assignment-score">{item.progress_percent}%</span>
                      </div>
                      <strong>{sanitizeStudentFacingText(item.assignment?.lesson?.title, `Bài ${item.assignment_id}`)}</strong>
                      <p>{item.assignment?.lesson?.subject?.name ?? 'Bài học'}</p>
                      <div className="student-auto-progress-track" style={{ ['--progress' as string]: `${item.progress_percent}%` }}>
                        <span />
                      </div>
                    </button>
                  )
                })}
                {!allAssignments.length && !assignmentsQuery.isLoading ? <p className="helper-text">Chưa có bài.</p> : null}
              </div>
            </article>

            <article className="student-visual-panel student-visual-side-story">
              <div className="student-visual-section-head">
                <div>
                  <p className="eyebrow">Góc nhỏ</p>
                  <h3>Sẵn sàng học</h3>
                </div>
              </div>
              <div className="student-visual-side-story-art">
                <img src="/student-ui/canhcut.jpg" alt="" />
              </div>
              <div className="student-visual-side-story-copy">
                <strong>{sanitizeStudentFacingText(detail?.lesson?.title, 'Chọn bài học em muốn làm')}</strong>
                <p>{detail ? `${activityProgress.completedActivities}/${activityProgress.totalActivities || 0} câu` : 'Mỗi bài sẽ hiện từng câu một.'}</p>
              </div>
            </article>
          </section>
          ) : renderSecondaryPanel()}

          {activePanel === 'home' && detail && !completionSummary ? (
            <>
              <section ref={activeQuestionRef} tabIndex={-1} className="student-visual-panel student-visual-question-panel">
                <div className="student-visual-section-head">
                  <div>
                    <p className="eyebrow">Câu hỏi</p>
                    <h3>{lessonActivities.length ? `${activeActivityIndex + 1}/${lessonActivities.length}` : '0/0'}</h3>
                  </div>
                  <span className="subject-pill">{activityProgress.completedActivities}/{activityProgress.totalActivities || 0}</span>
                </div>

                <div className="student-visual-step-dots" aria-label="Tiến độ câu hỏi">
                  {lessonActivities.map((activity, index) => {
                    const isCompleted = isActivityCompleted(activity, answers)
                    const isActive = index === activeActivityIndex
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
                    <div className="student-visual-step-head">
                      <span className="student-visual-step-badge">#{activeActivityIndex + 1}</span>
                      <div className="student-visual-step-head-actions">
                        <button
                          type="button"
                          className="student-visual-audio-button"
                          onClick={handleReplayGuidance}
                          aria-label="Phát lại hướng dẫn"
                          disabled={!currentActivityGuidanceAudioUrl}
                        >
                          <span aria-hidden="true">🔊</span>
                        </button>
                        <span className={currentActivityCompleted ? 'student-visual-step-state student-visual-step-state-complete' : 'student-visual-step-state'}>
                          {currentActivityCompleted ? 'ok' : '...'}
                        </span>
                      </div>
                    </div>

                    <div className="student-visual-step-intro">
                      <span className="student-visual-step-icon">{cleanActivityIconMap[currentActivity.activity_type] ?? activityIconMap[currentActivity.activity_type] ?? '.'}</span>
                      <div>
                        <h4>{currentActivity.title}</h4>
                        <p>{cleanActivityTypeVisualLabelMap[currentActivity.activity_type] ?? activityTypeVisualLabelMap[currentActivity.activity_type] ?? 'Hoạt động'}</p>
                      </div>
                    </div>

                    <ActivityCard
                      key={currentActivity.id}
                      activity={currentActivity}
                      answers={answers}
                      setAnswers={setAnswersMap}
                      presentationMode="immersive_square"
                      onAutoAdvance={handleAutoAdvance}
                    />
                  </article>
                ) : (
                  <p className="helper-text">Chưa có hoạt động.</p>
                )}
              </section>

                <section className="student-visual-action-bar" aria-label="Thao tác bài học">
                <button className="ghost-button" type="button" onClick={closeLessonView}>
                  Đổi bài
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
          ) : activePanel === 'home' && !completionSummary ? (
            <section className="student-visual-empty-panel">
              <strong>Chọn một bài để bắt đầu.</strong>
            </section>
          ) : null}

          {(startMutation.error || completeMutation.error) ? (
            <p className="error-text student-visual-floating-error">
              {(startMutation.error as Error)?.message ?? (completeMutation.error as Error)?.message}
            </p>
          ) : null}

      </div>
    </RequireAuth>
  )
}
