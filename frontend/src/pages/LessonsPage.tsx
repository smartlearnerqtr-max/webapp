import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { RequireAuth } from '../components/RequireAuth'
import {
  createLesson,
  createLessonActivity,
  fetchLesson,
  fetchLessons,
  fetchSubjects,
  uploadLessonMedia,
} from '../services/api'
import { useAuthStore } from '../store/authStore'

type ActivityType =
  | 'multiple_choice'
  | 'image_choice'
  | 'matching'
  | 'drag_drop'
  | 'listen_choose'
  | 'watch_answer'
  | 'step_by_step'
  | 'aac'
  | 'career_simulation'
  | 'ai_chat'

type MediaSource = 'external' | 'upload'

type PairItem = {
  left: string
  right: string
}

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nặng' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nhe', label: 'Nhẹ' },
]

const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string; description: string }> = [
  { value: 'multiple_choice', label: 'Chọn đáp án', description: 'Tạo câu hỏi trắc nghiệm nhanh với 4 đáp án để giáo viên chọn đáp án đúng.' },
  { value: 'image_choice', label: 'Nhìn ảnh chọn đáp án', description: 'Tải ảnh lên rồi đặt câu hỏi để học sinh nhìn ảnh và chọn 1 trong 4 đáp án.' },
  { value: 'matching', label: 'Nối cặp', description: 'Dùng cho bài ghép khái niệm, ghép chữ với hình hoặc ghép đồ vật tương ứng.' },
  { value: 'drag_drop', label: 'Kéo thả', description: 'Phù hợp với bài phân loại, sắp xếp đồ vật hoặc ghép mục vào đúng nhóm.' },
  { value: 'listen_choose', label: 'Nghe và chọn', description: 'Giáo viên nhập câu đọc hoặc lời thoại ngắn, học sinh nghe và chọn đáp án.' },
  { value: 'watch_answer', label: 'Xem rồi trả lời', description: 'Thêm ảnh hoặc video rồi cho học sinh trả lời ngắn sau khi quan sát.' },
  { value: 'step_by_step', label: 'Làm theo từng bước', description: 'Chia nhiệm vụ thành các bước nhỏ để học sinh hoàn thành tuần tự.' },
  { value: 'aac', label: 'Thẻ giao tiếp', description: 'Tạo các thẻ để học sinh chọn ý muốn nói hoặc nhu cầu cần hỗ trợ.' },
  { value: 'career_simulation', label: 'Mô phỏng tình huống', description: 'Dùng cho các hoạt động vào vai hoặc thực hành tình huống thực tế.' },
  { value: 'ai_chat', label: 'Hỏi đáp với AI', description: 'Tạo cuộc hội thoại ngắn để học sinh luyện phản hồi hoặc giao tiếp.' },
]

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
    case 'matching':
      return 'Hãy nối các cặp phù hợp với nhau.'
    case 'drag_drop':
      return 'Hãy kéo từng mục vào đúng vị trí.'
    case 'listen_choose':
      return 'Hãy nghe kỹ rồi chọn đáp án đúng.'
    case 'watch_answer':
      return 'Hãy xem nội dung trước rồi trả lời câu hỏi.'
    case 'step_by_step':
      return 'Hãy làm lần lượt từng bước theo hướng dẫn.'
    case 'aac':
      return 'Hãy chọn thẻ phù hợp với điều em muốn nói.'
    case 'career_simulation':
      return 'Hãy làm theo tình huống mô phỏng.'
    case 'ai_chat':
      return 'Hãy trò chuyện ngắn gọn với trợ lý để hoàn thành nhiệm vụ.'
    default:
      return 'Hãy làm theo hướng dẫn của hoạt động.'
  }
}

function defaultVoiceEnabledForType(activityType: ActivityType) {
  return activityType === 'multiple_choice' || activityType === 'image_choice' || activityType === 'listen_choose' || activityType === 'aac' || activityType === 'ai_chat'
}

function inferMediaKind(mediaUrl: string, mediaFile: File | null, source: MediaSource) {
  if (source === 'upload' && mediaFile) {
    if (mediaFile.type.startsWith('image/')) return 'image'
    if (mediaFile.type.startsWith('video/')) return 'video'
  }

  const normalizedUrl = mediaUrl.trim().toLowerCase()
  if (!normalizedUrl) return ''
  if (/\.(png|jpe?g|gif|webp)(\?.*)?$/.test(normalizedUrl)) return 'image'
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/.test(normalizedUrl)) return 'video'
  if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be') || normalizedUrl.includes('drive.google.com')) return 'embed'
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
  const [imageChoiceSource, setImageChoiceSource] = useState<MediaSource>('upload')
  const [imageChoiceUrl, setImageChoiceUrl] = useState('')
  const [imageChoiceFile, setImageChoiceFile] = useState<File | null>(null)
  const [imageChoiceOptions, setImageChoiceOptions] = useState<string[]>(createDefaultChoiceOptions())
  const [imageChoiceCorrectIndex, setImageChoiceCorrectIndex] = useState(0)

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

  const [stepList, setStepList] = useState<string[]>(createDefaultList())
  const [aacCards, setAacCards] = useState<string[]>(createDefaultList())
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

  const currentActivityDescription = ACTIVITY_TYPES.find((option) => option.value === activityType)?.description ?? ''

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
      if (imageChoiceSource === 'upload' && !imageChoiceFile) return 'Hãy tải lên một hình ảnh cho hoạt động nhìn ảnh.'
      if (imageChoiceSource === 'external' && !imageChoiceUrl.trim()) return 'Hãy nhập link hình ảnh cho hoạt động nhìn ảnh.'
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
      if (watchAnswerSource === 'upload' && !watchAnswerFile) return 'Hãy chọn file ảnh hoặc video trước khi thêm hoạt động.'
      if (watchAnswerSource === 'external' && !watchAnswerUrl.trim()) return 'Hãy nhập link ảnh hoặc video trước khi thêm hoạt động.'
    }

    if (activityType === 'step_by_step' && compactLines(stepList).length < 2) {
      return 'Hãy nhập ít nhất 2 bước cho hoạt động.'
    }

    if (activityType === 'aac' && compactLines(aacCards).length < 2) {
      return 'Hãy nhập ít nhất 2 thẻ giao tiếp.'
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
      let mediaUrl = imageChoiceUrl.trim()
      let mediaKind = inferMediaKind(imageChoiceUrl, imageChoiceFile, imageChoiceSource)

      if (imageChoiceSource === 'upload' && imageChoiceFile) {
        const uploadedMedia = await uploadLessonMedia(token!, imageChoiceFile)
        mediaUrl = uploadedMedia.url
        mediaKind = uploadedMedia.media_kind
      }

      const choices = imageChoiceOptions.map((option) => option.trim())
      return {
        kind: 'image_choice',
        media_url: mediaUrl,
        media_kind: mediaKind || 'image',
        prompt: imageChoicePrompt.trim(),
        choices,
        correct: choices[imageChoiceCorrectIndex] ?? choices[0] ?? '',
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
      return {
        kind: 'aac',
        prompt: instructionText.trim(),
        cards: compactLines(aacCards),
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
        setImageChoiceUrl('')
      }
      if (activityType === 'watch_answer') {
        setWatchAnswerFile(null)
        setWatchAnswerUrl('')
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
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Tạo bài học và thêm hoạt động</h2>
          <p>
            Form này được làm lại theo cách giáo viên dễ dùng hơn: mỗi loại hoạt động có ô nhập riêng, rõ từng bước và
            không cần suy nghĩ theo kiểu cấu hình kỹ thuật.
          </p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo bài học mới</h3>
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
            <h3>Chọn bài học đang sửa</h3>
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
              <span>Thêm hoạt động vào bài học</span>
              <span>{isActivityFormOpen ? 'Ẩn bớt' : 'Mở nhanh'}</span>
            </button>

            {isActivityFormOpen ? (
              <form className="form-stack" onSubmit={handleActivitySubmit}>
                <div className="detail-stack">
                  <strong>1. Chọn loại hoạt động</strong>
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
                      Nguồn hình ảnh
                      <select value={imageChoiceSource} onChange={(event) => setImageChoiceSource(event.target.value as MediaSource)}>
                        <option value="upload">Tải ảnh từ máy</option>
                        <option value="external">Dùng link ảnh</option>
                      </select>
                    </label>

                    {imageChoiceSource === 'upload' ? (
                      <label>
                        Chọn ảnh
                        <input type="file" accept="image/*" onChange={(event) => setImageChoiceFile(event.target.files?.[0] ?? null)} />
                      </label>
                    ) : (
                      <label>
                        Link ảnh
                        <input value={imageChoiceUrl} onChange={(event) => setImageChoiceUrl(event.target.value)} placeholder="https://..." />
                      </label>
                    )}

                    {imageChoiceSource === 'upload' && imageChoiceFile ? <p className="helper-text">Đã chọn ảnh: {imageChoiceFile.name}</p> : null}

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
                      Nguồn media
                      <select value={watchAnswerSource} onChange={(event) => setWatchAnswerSource(event.target.value as MediaSource)}>
                        <option value="external">Nhập link ngoài</option>
                        <option value="upload">Tải file từ máy</option>
                      </select>
                    </label>

                    {watchAnswerSource === 'upload' ? (
                      <label>
                        Chọn ảnh hoặc video
                        <input type="file" accept="image/*,video/*" onChange={(event) => setWatchAnswerFile(event.target.files?.[0] ?? null)} />
                      </label>
                    ) : (
                      <label>
                        Link ảnh hoặc video
                        <input value={watchAnswerUrl} onChange={(event) => setWatchAnswerUrl(event.target.value)} placeholder="https://..." />
                      </label>
                    )}

                    {watchAnswerSource === 'upload' && watchAnswerFile ? <p className="helper-text">Đã chọn file: {watchAnswerFile.name}</p> : null}

                    <label>
                      Câu hỏi sau khi xem
                      <input value={watchAnswerPrompt} onChange={(event) => setWatchAnswerPrompt(event.target.value)} placeholder="Ví dụ: Em thấy bạn nhỏ đang làm gì?" />
                    </label>
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
                  <ListBuilder
                    title="3. Các thẻ giao tiếp"
                    helper="Mỗi dòng là một câu hoặc ý ngắn để học sinh chọn."
                    items={aacCards}
                    itemPlaceholder="Thẻ giao tiếp"
                    onChange={(index, value) => updateList(setAacCards, index, value)}
                    onAdd={() => setAacCards((current) => [...current, ''])}
                    onRemove={(index) => setAacCards((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  />
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
            <h3>Chi tiết bài học đang chọn</h3>
            {selectedLesson ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedLesson.title}</strong>
                  <span>
                    {selectedLesson.subject?.name ?? 'Chưa có môn'} / {levelLabel(selectedLesson.primary_level)}
                  </span>
                </div>
                <p>{lessonDetailQuery.data?.description ?? selectedLesson.description ?? 'Chưa có mô tả.'}</p>

                <div className="student-list compact-list">
                  {lessonDetailQuery.data?.activities?.map((activity) => (
                    <div key={activity.id} className="student-row">
                      <strong>
                        {activity.sort_order}. {activity.title}
                      </strong>
                      <span>{activityLabel(activity.activity_type as ActivityType)}</span>
                      <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
                    </div>
                  ))}
                  {!lessonDetailQuery.data?.activities?.length && !lessonDetailQuery.isLoading ? <p>Bài học này chưa có hoạt động nào.</p> : null}
                </div>
              </div>
            ) : (
              <p>Hãy chọn một bài học để xem chi tiết.</p>
            )}
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
