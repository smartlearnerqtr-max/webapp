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
type WatchAnswerMode = 'text' | 'voice_ai_grade'

type PairItem = {
  left: string
  right: string
}

type AacImageDraft = {
  label: string
  file: File | null
}

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

type ActivityConfig = Record<string, unknown>

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
  const [primaryLevel, setPrimaryLevel] = useState('trung_binh')
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
  const [scenarioText, setScenarioText] = useState('Em vào vai nhân viên thư viện và giúp bạn nhỏ chọn đúng cuốn sách cần tìm.')
  const [successCriteriaText, setSuccessCriteriaText] = useState('Chọn đúng vai trò, trả lời lịch sự và làm đủ các bước.')
  const [aiStarterPrompt, setAiStarterPrompt] = useState('Hãy hỏi em 3 câu ngắn về bài học này.')
  const [aiGoals, setAiGoals] = useState<string[]>(createDefaultList())

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  })

  const lessonsQuery = useQuery({
    queryKey: ['lessons', token],
    queryFn: () => fetchLessons(token!),
    enabled: Boolean(token),
  })

  const resolvedSubjectId = subjectId || String(subjectsQuery.data?.[0]?.id ?? '')
  const resolvedSelectedLessonId = selectedLessonId ?? lessonsQuery.data?.[0]?.id ?? null

  const lessonDetailQuery = useQuery({
    queryKey: ['lesson-detail', token, resolvedSelectedLessonId],
    queryFn: () => fetchLesson(token!, resolvedSelectedLessonId!),
    enabled: Boolean(token && resolvedSelectedLessonId),
  })

  const selectedLesson = useMemo(
    () => lessonsQuery.data?.find((lesson) => lesson.id === resolvedSelectedLessonId) ?? null,
    [lessonsQuery.data, resolvedSelectedLessonId],
  )
  const lessonActivities = lessonDetailQuery.data?.activities ?? []
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

  useEffect(() => {
    if (!selectedLesson) return
    setEditTitle(selectedLesson.title)
    setEditDescription(selectedLesson.description ?? '')
    setEditSubjectId(String(selectedLesson.subject_id))
    setEditPrimaryLevel(selectedLesson.primary_level)
    setEditEstimatedMinutes(String(selectedLesson.estimated_minutes ?? 15))
  }, [selectedLesson])

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
        primary_level: primaryLevel,
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
        voice_answer_enabled: selectedActivity?.voice_answer_enabled ?? false,
        is_required: selectedActivity?.is_required ?? true,
        sort_order: selectedActivity?.sort_order ?? 1,
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
      return 'Hay tai du 4 anh cho hoat dong the giao tiep.'
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
      return buildMemoryMatchDemoConfig()
    }

    if (activityType === 'quick_tap') {
      return buildQuickTapDemoConfig()
    }

    if (activityType === 'size_order') {
      return buildSizeOrderDemoConfig()
    }

    if (activityType === 'habitat_match') {
      return buildHabitatMatchDemoConfig()
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
            <span>{lessonsQuery.data?.length ?? 0} bài</span>
            <span>{subjectsQuery.data?.length ?? 0} môn</span>
            <span>{lessonDetailQuery.data?.activities?.length ?? 0} hoạt động</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          <article className="mini-card teacher-clean-metric teacher-clean-metric-blue">
            <span>Bài học</span>
            <strong>{lessonsQuery.data?.length ?? 0}</strong>
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
            <span>Mức</span>
            <strong>{levelLabel(primaryLevel)}</strong>
          </article>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Tạo mới</p>
                <h3>Bài học</h3>
              </div>
            </div>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
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
                <label>
                  Mức độ chính
                  <select value={primaryLevel} onChange={(event) => setPrimaryLevel(event.target.value)}>
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

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
                <p className="eyebrow">Danh sách</p>
                <h3>Chọn bài</h3>
              </div>
            </div>
            <div className="tag-wrap">
              {lessonsQuery.data?.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={resolvedSelectedLessonId === lesson.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  {lesson.title}
                </button>
              ))}
            </div>
            {!lessonsQuery.data?.length && !lessonsQuery.isLoading ? <p>Chưa có bài học nào, hãy tạo bài học đầu tiên.</p> : null}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <button type="button" onClick={() => setIsActivityFormOpen((current) => !current)} className="simple-toggle-button">
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
                        <option value="text">Gõ câu trả lời ngắn</option>
                        <option value="voice_ai_grade">Bấm mic, nhan giong noi, AI cham</option>
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

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Quản lý</p>
                <h3>Bài đã tạo</h3>
              </div>
            </div>
            {selectedLesson ? (
              <div className="detail-stack">
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

                <div className="lesson-manage-layout">
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

                  <div className="detail-stack">
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

                          <label>
                            Prompt chính
                            <textarea value={editActivityPrompt} onChange={(event) => handleActivityPromptChange(event.target.value)} rows={3} placeholder="Câu hỏi hoặc nội dung chính" />
                          </label>

                          {isImageUploadOnlyActivity(selectedActivity.activity_type as ActivityType) ? (
                            <label>
                              Chọn ảnh từ máy
                              <input
                                type="file"
                                accept="image/*"
                                disabled={editActivityMediaUploadPending}
                                onChange={(event) => void handleActivityMediaFileChange(event.target.files?.[0] ?? null)}
                              />
                              {editActivityMediaUrl ? <span className="helper-text">Đã có ảnh cho hoạt động này.</span> : null}
                            </label>
                          ) : null}

                          {selectedActivity.activity_type === 'watch_answer' ? (
                            <>
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
                                  <span className="helper-text">Dùng YouTube, TikTok, Google Drive hoặc file video trực tiếp.</span>
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
                                  {editActivityMediaUrl ? <span className="helper-text">Đã có media cho hoạt động này.</span> : null}
                                </label>
                              )}
                            </>
                          ) : null}

                          {editActivityMediaUploadPending ? <p className="helper-text">Đang tải media lên...</p> : null}

                        </div>

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
