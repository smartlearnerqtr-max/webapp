import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createLesson, createLessonActivity, fetchLesson, fetchLessons, fetchSubjects, uploadLessonMedia } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

type ActivityType =
  | 'multiple_choice'
  | 'matching'
  | 'drag_drop'
  | 'listen_choose'
  | 'watch_answer'
  | 'step_by_step'
  | 'aac'
  | 'career_simulation'
  | 'ai_chat'

type WatchAnswerSource = 'external' | 'upload'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nặng' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nhe', label: 'Nhẹ' },
]

const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string; description: string }> = [
  { value: 'multiple_choice', label: 'Chọn đáp án', description: 'Tạo các lựa chọn và đánh dấu đáp án đúng.' },
  { value: 'matching', label: 'Nối cặp', description: 'Tạo các cặp thông tin để học sinh ghép lại.' },
  { value: 'drag_drop', label: 'Kéo thả', description: 'Tạo các mục để học sinh kéo vào đúng vị trí.' },
  { value: 'listen_choose', label: 'Nghe và chọn', description: 'Thêm nội dung nghe rồi cho học sinh chọn đáp án.' },
  { value: 'watch_answer', label: 'Xem và trả lời', description: 'Thêm ảnh/video rồi yêu cầu học sinh quan sát và trả lời.' },
  { value: 'step_by_step', label: 'Từng bước', description: 'Chia hoạt động thành các bước ngắn, dễ theo dõi.' },
  { value: 'aac', label: 'Thẻ giao tiếp', description: 'Tạo bộ thẻ để hỗ trợ giao tiếp và phản hồi.' },
  { value: 'career_simulation', label: 'Mô phỏng nghề nghiệp', description: 'Thiết kế tình huống thực hành theo vai trò.' },
  { value: 'ai_chat', label: 'Trao đổi với AI', description: 'Thêm lời mở đầu và mục tiêu trao đổi với trợ lý AI.' },
]

const DEFAULT_CHOICE_OPTIONS = ['Đáp án A', 'Đáp án B']
const DEFAULT_MATCHING_PAIRS = ['Hình tròn | Tròn', 'Hình vuông | Vuông']
const DEFAULT_DRAG_ITEMS = ['Quả táo', 'Con mèo', 'Xe đạp']
const DEFAULT_DRAG_TARGETS = ['Giỏ trái cây', 'Động vật', 'Phương tiện']
const DEFAULT_STEPS = ['Bước 1: Quan sát', 'Bước 2: Chọn đáp án', 'Bước 3: Nhận phản hồi']
const DEFAULT_AAC_CARDS = ['Con muốn uống nước', 'Con cần giúp đỡ', 'Con đã xong']
const DEFAULT_GOALS = ['Chào hỏi lịch sự', 'Trả lời ngắn gọn', 'Nhờ trợ giúp khi cần']

function prettifyJson(value: object) {
  return JSON.stringify(value, null, 2)
}

function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parsePairs(value: string) {
  return value
    .split(/\r?\n/)
    .map((row) => row.split('|').map((item) => item.trim()))
    .filter((row) => row[0] && row[1])
    .map(([left, right]) => ({ left, right }))
}

function defaultInstructionForType(activityType: ActivityType) {
  switch (activityType) {
    case 'multiple_choice':
      return 'Hãy đọc câu hỏi và chọn đáp án đúng.'
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
      return 'Hãy thực hiện hoạt động theo tình huống mô phỏng.'
    case 'ai_chat':
      return 'Hãy trao đổi ngắn gọn với trợ lý để hoàn thành nhiệm vụ.'
    default:
      return 'Hãy làm theo hướng dẫn của hoạt động này.'
  }
}

function defaultVoiceEnabledForType(activityType: ActivityType) {
  return activityType === 'listen_choose' || activityType === 'multiple_choice' || activityType === 'aac' || activityType === 'ai_chat'
}

function activityLabel(activityType: ActivityType) {
  return ACTIVITY_TYPES.find((item) => item.value === activityType)?.label ?? activityType
}

function levelLabel(level: string) {
  return LEVEL_OPTIONS.find((item) => item.value === level)?.label ?? level
}

function inferWatchAnswerMediaKind(mediaUrl: string, mediaFile: File | null, source: WatchAnswerSource) {
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

function buildActivityConfig(activityType: ActivityType, fields: {
  prompt: string
  choiceOptionsText: string
  correctChoice: string
  matchingPairsText: string
  dragItemsText: string
  dragTargetsText: string
  mediaUrl: string
  mediaKind: string
  questionPrompt: string
  stepListText: string
  aacCardsText: string
  scenarioText: string
  successCriteriaText: string
  aiStarterPrompt: string
  aiGoalText: string
}) {
  const choiceOptions = parseLines(fields.choiceOptionsText)
  const dragItems = parseLines(fields.dragItemsText)
  const dragTargets = parseLines(fields.dragTargetsText)
  const stepList = parseLines(fields.stepListText)
  const aacCards = parseLines(fields.aacCardsText)
  const aiGoals = parseLines(fields.aiGoalText)

  switch (activityType) {
    case 'multiple_choice':
      return {
        kind: 'multiple_choice',
        prompt: fields.prompt.trim(),
        choices: choiceOptions,
        correct: fields.correctChoice.trim() || choiceOptions[0] || '',
      }
    case 'matching':
      return {
        kind: 'matching',
        prompt: fields.prompt.trim(),
        pairs: parsePairs(fields.matchingPairsText),
      }
    case 'drag_drop':
      return {
        kind: 'drag_drop',
        prompt: fields.prompt.trim(),
        items: dragItems,
        targets: dragTargets,
      }
    case 'listen_choose':
      return {
        kind: 'listen_choose',
        audio_text: fields.prompt.trim(),
        choices: choiceOptions,
        correct: fields.correctChoice.trim() || choiceOptions[0] || '',
      }
    case 'watch_answer':
      return {
        kind: 'watch_answer',
        media_url: fields.mediaUrl.trim(),
        media_kind: fields.mediaKind.trim() || undefined,
        prompt: fields.questionPrompt.trim(),
      }
    case 'step_by_step':
      return {
        kind: 'step_by_step',
        prompt: fields.prompt.trim(),
        steps: stepList,
      }
    case 'aac':
      return {
        kind: 'aac',
        prompt: fields.prompt.trim(),
        cards: aacCards,
      }
    case 'career_simulation':
      return {
        kind: 'career_simulation',
        scenario: fields.scenarioText.trim(),
        success_criteria: fields.successCriteriaText.trim(),
      }
    case 'ai_chat':
      return {
        kind: 'ai_chat',
        starter_prompt: fields.aiStarterPrompt.trim(),
        goals: aiGoals,
      }
    default:
      return {}
  }
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
  const [prompt, setPrompt] = useState('Câu hỏi chính của hoạt động')
  const [choiceOptionsText, setChoiceOptionsText] = useState(DEFAULT_CHOICE_OPTIONS.join('\n'))
  const [correctChoice, setCorrectChoice] = useState(DEFAULT_CHOICE_OPTIONS[0])
  const [matchingPairsText, setMatchingPairsText] = useState(DEFAULT_MATCHING_PAIRS.join('\n'))
  const [dragItemsText, setDragItemsText] = useState(DEFAULT_DRAG_ITEMS.join('\n'))
  const [dragTargetsText, setDragTargetsText] = useState(DEFAULT_DRAG_TARGETS.join('\n'))
  const [mediaUrl, setMediaUrl] = useState('')
  const [watchAnswerSource, setWatchAnswerSource] = useState<WatchAnswerSource>('external')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [questionPrompt, setQuestionPrompt] = useState('Sau khi xem xong, em thấy điều gì?')
  const [stepListText, setStepListText] = useState(DEFAULT_STEPS.join('\n'))
  const [aacCardsText, setAacCardsText] = useState(DEFAULT_AAC_CARDS.join('\n'))
  const [scenarioText, setScenarioText] = useState('Em vào vai nhân viên thư viện và giúp bạn chọn sách phù hợp.')
  const [successCriteriaText, setSuccessCriteriaText] = useState('Chọn đúng vai trò, làm đủ bước, trả lời lịch sự.')
  const [aiStarterPrompt, setAiStarterPrompt] = useState('Hãy đóng vai bạn học và hỏi em 3 câu ngắn về bài học này.')
  const [aiGoalText, setAiGoalText] = useState(DEFAULT_GOALS.join('\n'))
  const [activityFormError, setActivityFormError] = useState<string | null>(null)
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false)

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

  const generatedConfigObject = useMemo(
    () => buildActivityConfig(activityType, {
      prompt,
      choiceOptionsText,
      correctChoice,
      matchingPairsText,
      dragItemsText,
      dragTargetsText,
      mediaUrl,
      mediaKind: inferWatchAnswerMediaKind(mediaUrl, mediaFile, watchAnswerSource),
      questionPrompt,
      stepListText,
      aacCardsText,
      scenarioText,
      successCriteriaText,
      aiStarterPrompt,
      aiGoalText,
    }),
    [
      activityType,
      prompt,
      choiceOptionsText,
      correctChoice,
      matchingPairsText,
      dragItemsText,
      dragTargetsText,
      mediaUrl,
      mediaFile,
      watchAnswerSource,
      questionPrompt,
      stepListText,
      aacCardsText,
      scenarioText,
      successCriteriaText,
      aiStarterPrompt,
      aiGoalText,
    ],
  )

  const generatedConfigJson = useMemo(() => prettifyJson(generatedConfigObject), [generatedConfigObject])
  const choiceOptions = useMemo(() => parseLines(choiceOptionsText), [choiceOptionsText])

  const createLessonMutation = useMutation({
    mutationFn: () => createLesson(token!, {
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

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      let configJson = generatedConfigJson

      if (activityType === 'watch_answer') {
        if (watchAnswerSource === 'upload') {
          if (!mediaFile) {
            throw new Error('Hay chon file anh hoac video truoc khi them hoat dong.')
          }

          const uploadedMedia = await uploadLessonMedia(token!, mediaFile)
          configJson = prettifyJson(buildActivityConfig(activityType, {
            prompt,
            choiceOptionsText,
            correctChoice,
            matchingPairsText,
            dragItemsText,
            dragTargetsText,
            mediaUrl: uploadedMedia.url,
            mediaKind: uploadedMedia.media_kind,
            questionPrompt,
            stepListText,
            aacCardsText,
            scenarioText,
            successCriteriaText,
            aiStarterPrompt,
            aiGoalText,
          }))
        } else if (!mediaUrl.trim()) {
          throw new Error('Hay nhap link video hoac anh truoc khi them hoat dong.')
        }
      }

      return createLessonActivity(token!, resolvedSelectedLessonId!, {
        title: activityTitle,
        activity_type: activityType,
        instruction_text: instructionText,
        voice_answer_enabled: voiceAnswerEnabled,
        is_required: true,
        sort_order: (lessonDetailQuery.data?.activities?.length ?? 0) + 1,
        difficulty_stage: 1,
        config_json: configJson,
      })
    },
    onSuccess: async () => {
      setActivityTitle('')
      setActivityFormError(null)
      setWatchAnswerSource('external')
      setMediaFile(null)
      setMediaUrl('')
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
    if (!activityTitle.trim() || !resolvedSelectedLessonId) return
    createActivityMutation.mutate()
  }

  function handleActivityTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.target.value as ActivityType
    setActivityType(nextType)
    setInstructionText(defaultInstructionForType(nextType))
    setVoiceAnswerEnabled(defaultVoiceEnabledForType(nextType))
    setActivityFormError(null)
    if (nextType !== 'watch_answer') {
      setWatchAnswerSource('external')
      setMediaFile(null)
    }
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Bài học và hoạt động bên trong bài học</h2>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo bài học</h3>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
              <label>
                Tiêu đề bài học
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhận biết hình vuông" />
              </label>
              <label>
                Môn học
                <select value={resolvedSubjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Chọn môn học</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Mức độ chính
                <select value={primaryLevel} onChange={(event) => setPrimaryLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Mô tả ngắn
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Bài học có hỗ trợ media" />
              </label>
              <label>
                Số phút dự kiến
                <input value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} inputMode="numeric" />
              </label>
              <button className="action-button" type="submit" disabled={createLessonMutation.isPending}>
                {createLessonMutation.isPending ? 'Đang tạo...' : 'Tạo bài học'}
              </button>
              {createLessonMutation.error ? <p className="error-text">{(createLessonMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chọn bài học đang chỉnh</h3>
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
            <button
              type="button"
              onClick={() => setIsActivityFormOpen(!isActivityFormOpen)}
              style={{
                width: '100%',
                padding: '1rem',
                marginBottom: '1rem',
                border: 'none',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #3d6fd6 0%, #2446a8 100%)',
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 200ms ease',
              }}
            >
              <span>Thêm hoạt động vào bài học</span>
              <span style={{ fontSize: '1.3rem' }}>{isActivityFormOpen ? '-' : '+'}</span>
            </button>

            {isActivityFormOpen ? (
              <form className="form-stack" onSubmit={handleActivitySubmit}>
                <label>
                  Tên hoạt động
                  <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Xem video và trả lời" />
                </label>

                <label>
                  Loại hoạt động
                  <select value={activityType} onChange={handleActivityTypeChange}>
                    {ACTIVITY_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <p className="helper-text">{ACTIVITY_TYPES.find((option) => option.value === activityType)?.description}</p>

                <label>
                  Hướng dẫn hiển thị cho học sinh
                  <input value={instructionText} onChange={(event) => setInstructionText(event.target.value)} placeholder="Hãy đọc và làm theo hướng dẫn" />
                </label>

                {(activityType === 'multiple_choice' || activityType === 'listen_choose') ? (
                  <div className="config-card">
                    <label>
                      Câu hỏi hoặc nội dung cần nghe
                      <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Vật nào có dạng tròn?" />
                    </label>
                    <label>
                      Danh sách lựa chọn, mỗi dòng một đáp án
                      <textarea value={choiceOptionsText} onChange={(event) => setChoiceOptionsText(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Đáp án đúng
                      <select value={correctChoice} onChange={(event) => setCorrectChoice(event.target.value)}>
                        {choiceOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {activityType === 'matching' ? (
                  <div className="config-card">
                    <label>
                      Các cặp cần nối, mỗi dòng theo mẫu Trái | Phải
                      <textarea value={matchingPairsText} onChange={(event) => setMatchingPairsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'drag_drop' ? (
                  <div className="config-card config-grid-2">
                    <label>
                      Các mục cần kéo, mỗi dòng một mục
                      <textarea value={dragItemsText} onChange={(event) => setDragItemsText(event.target.value)} rows={5} />
                    </label>
                    <label>
                      Các vị trí đích, mỗi dòng một vị trí
                      <textarea value={dragTargetsText} onChange={(event) => setDragTargetsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'watch_answer' ? (
                  <div className="config-card">
                    <label>
                      Nguồn media
                      <select value={watchAnswerSource} onChange={(event) => setWatchAnswerSource(event.target.value as WatchAnswerSource)}>
                        <option value="external">Nhập link ngoài</option>
                        <option value="upload">Tải file từ máy</option>
                      </select>
                    </label>

                    {watchAnswerSource === 'external' ? (
                      <label>
                        Link video hoặc hình minh họa
                        <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://..." />
                      </label>
                    ) : (
                      <label>
                        Chọn file video hoặc ảnh
                        <input type="file" accept="image/*,video/*" onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)} />
                      </label>
                    )}

                    {watchAnswerSource === 'upload' && mediaFile ? <p className="helper-text">Đã chọn: {mediaFile.name}</p> : null}
                    {watchAnswerSource === 'external' ? <p className="helper-text">Hỗ trợ tốt nhất với ảnh trực tiếp, video MP4/WebM, YouTube và Google Drive.</p> : null}

                    <label>
                      Câu hỏi sau khi xem
                      <input value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} placeholder="Em thấy bạn nhỏ đang làm gì?" />
                    </label>
                  </div>
                ) : null}

                {activityType === 'step_by_step' ? (
                  <div className="config-card">
                    <label>
                      Các bước hướng dẫn, mỗi dòng một bước
                      <textarea value={stepListText} onChange={(event) => setStepListText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'aac' ? (
                  <div className="config-card">
                    <label>
                      Các thẻ giao tiếp, mỗi dòng một thẻ
                      <textarea value={aacCardsText} onChange={(event) => setAacCardsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'career_simulation' ? (
                  <div className="config-card">
                    <label>
                      Tình huống mô phỏng
                      <textarea value={scenarioText} onChange={(event) => setScenarioText(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Tiêu chí hoàn thành
                      <textarea value={successCriteriaText} onChange={(event) => setSuccessCriteriaText(event.target.value)} rows={3} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'ai_chat' ? (
                  <div className="config-card">
                    <label>
                      Lời mở đầu cho AI
                      <textarea value={aiStarterPrompt} onChange={(event) => setAiStarterPrompt(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Mục tiêu cần đạt, mỗi dòng một mục tiêu
                      <textarea value={aiGoalText} onChange={(event) => setAiGoalText(event.target.value)} rows={4} />
                    </label>
                  </div>
                ) : null}

                <label className="checkbox-row">
                  <input type="checkbox" checked={voiceAnswerEnabled} onChange={(event) => setVoiceAnswerEnabled(event.target.checked)} />
                  Bật voice answer cho hoạt động này
                </label>

                <button className="action-button" type="submit" disabled={!resolvedSelectedLessonId || createActivityMutation.isPending}>
                  {createActivityMutation.isPending ? 'Đang thêm...' : 'Thêm hoạt động'}
                </button>

                {activityFormError ? <p className="error-text">{activityFormError}</p> : null}
              </form>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Chi tiết bài học</h3>
            {selectedLesson ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedLesson.title}</strong>
                  <span>{selectedLesson.subject?.name ?? 'Chưa có môn'} / {levelLabel(selectedLesson.primary_level)}</span>
                </div>
                <p>{lessonDetailQuery.data?.description ?? selectedLesson.description ?? 'Chưa có mô tả.'}</p>
                <div className="student-list compact-list">
                  {lessonDetailQuery.data?.activities?.map((activity) => (
                    <div key={activity.id} className="student-row">
                      <strong>{activity.sort_order}. {activity.title}</strong>
                      <span>{activityLabel(activity.activity_type as ActivityType)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
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
