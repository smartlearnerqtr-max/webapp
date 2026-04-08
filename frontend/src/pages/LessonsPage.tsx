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
  { value: 'nang', label: 'Nang' },
  { value: 'trung_binh', label: 'Trung binh' },
  { value: 'nhe', label: 'Nhe' },
]

const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string; description: string }> = [
  { value: 'multiple_choice', label: 'Chon dap an', description: 'Tao cac lua chon va danh dau dap an dung.' },
  { value: 'matching', label: 'Noi cap', description: 'Tao cac cap thong tin de hoc sinh ghep lai.' },
  { value: 'drag_drop', label: 'Keo tha', description: 'Tao cac muc de hoc sinh keo vao dung vi tri.' },
  { value: 'listen_choose', label: 'Nghe va chon', description: 'Them noi dung nghe roi cho hoc sinh chon dap an.' },
  { value: 'watch_answer', label: 'Xem va tra loi', description: 'Them anh/video roi yeu cau hoc sinh quan sat va tra loi.' },
  { value: 'step_by_step', label: 'Tung buoc', description: 'Chia hoat dong thanh cac buoc ngan, de theo doi.' },
  { value: 'aac', label: 'The giao tiep', description: 'Tao bo the de ho tro giao tiep va phan hoi.' },
  { value: 'career_simulation', label: 'Mo phong nghe nghiep', description: 'Thiet ke tinh huong thuc hanh theo vai tro.' },
  { value: 'ai_chat', label: 'Trao doi voi AI', description: 'Them loi mo dau va muc tieu trao doi voi tro ly AI.' },
]

const DEFAULT_CHOICE_OPTIONS = ['Dap an A', 'Dap an B']
const DEFAULT_MATCHING_PAIRS = ['Hinh tron | Tron', 'Hinh vuong | Vuong']
const DEFAULT_DRAG_ITEMS = ['Qua tao', 'Con meo', 'Xe dap']
const DEFAULT_DRAG_TARGETS = ['Gio trai cay', 'Dong vat', 'Phuong tien']
const DEFAULT_STEPS = ['Buoc 1: Quan sat', 'Buoc 2: Chon dap an', 'Buoc 3: Nhan phan hoi']
const DEFAULT_AAC_CARDS = ['Con muon uong nuoc', 'Con can giup do', 'Con da xong']
const DEFAULT_GOALS = ['Chao hoi lich su', 'Tra loi ngan gon', 'Nho tro giup khi can']

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
      return 'Hay doc cau hoi va chon dap an dung.'
    case 'matching':
      return 'Hay noi cac cap phu hop voi nhau.'
    case 'drag_drop':
      return 'Hay keo tung muc vao dung vi tri.'
    case 'listen_choose':
      return 'Hay nghe ky roi chon dap an dung.'
    case 'watch_answer':
      return 'Hay xem noi dung truoc roi tra loi cau hoi.'
    case 'step_by_step':
      return 'Hay lam lan luot tung buoc theo huong dan.'
    case 'aac':
      return 'Hay chon the phu hop voi dieu em muon noi.'
    case 'career_simulation':
      return 'Hay thuc hien hoat dong theo tinh huong mo phong.'
    case 'ai_chat':
      return 'Hay trao doi ngan gon voi tro ly de hoan thanh nhiem vu.'
    default:
      return 'Hay lam theo huong dan cua hoat dong nay.'
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
  const [prompt, setPrompt] = useState('Cau hoi chinh cua hoat dong')
  const [choiceOptionsText, setChoiceOptionsText] = useState(DEFAULT_CHOICE_OPTIONS.join('\n'))
  const [correctChoice, setCorrectChoice] = useState(DEFAULT_CHOICE_OPTIONS[0])
  const [matchingPairsText, setMatchingPairsText] = useState(DEFAULT_MATCHING_PAIRS.join('\n'))
  const [dragItemsText, setDragItemsText] = useState(DEFAULT_DRAG_ITEMS.join('\n'))
  const [dragTargetsText, setDragTargetsText] = useState(DEFAULT_DRAG_TARGETS.join('\n'))
  const [mediaUrl, setMediaUrl] = useState('')
  const [watchAnswerSource, setWatchAnswerSource] = useState<WatchAnswerSource>('external')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [questionPrompt, setQuestionPrompt] = useState('Sau khi xem xong, em thay dieu gi?')
  const [stepListText, setStepListText] = useState(DEFAULT_STEPS.join('\n'))
  const [aacCardsText, setAacCardsText] = useState(DEFAULT_AAC_CARDS.join('\n'))
  const [scenarioText, setScenarioText] = useState('Em vao vai nhan vien thu vien va giup ban chon sach phu hop.')
  const [successCriteriaText, setSuccessCriteriaText] = useState('Chon dung vai tro, lam du buoc, tra loi lich su.')
  const [aiStarterPrompt, setAiStarterPrompt] = useState('Hay dong vai ban hoc va hoi em 3 cau ngan ve bai hoc nay.')
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
      setActivityFormError(error instanceof Error ? error.message : 'Khong the tao hoat dong')
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
          <h2>Bai hoc va hoat dong ben trong bai hoc</h2>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tao bai hoc</h3>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
              <label>
                Tieu de bai hoc
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhan biet hinh tron" />
              </label>
              <label>
                Mon hoc
                <select value={resolvedSubjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Chon mon hoc</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Muc do chinh
                <select value={primaryLevel} onChange={(event) => setPrimaryLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Mo ta ngan
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Bai hoc co ho tro media" />
              </label>
              <label>
                So phut du kien
                <input value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} inputMode="numeric" />
              </label>
              <button className="action-button" type="submit" disabled={createLessonMutation.isPending}>
                {createLessonMutation.isPending ? 'Dang tao...' : 'Tao bai hoc'}
              </button>
              {createLessonMutation.error ? <p className="error-text">{(createLessonMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chon bai hoc dang chinh</h3>
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
            {!lessonsQuery.data?.length && !lessonsQuery.isLoading ? <p>Chua co bai hoc nao, hay tao bai hoc dau tien.</p> : null}
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
              <span>Them hoat dong vao bai hoc</span>
              <span style={{ fontSize: '1.3rem' }}>{isActivityFormOpen ? '-' : '+'}</span>
            </button>

            {isActivityFormOpen ? (
              <form className="form-stack" onSubmit={handleActivitySubmit}>
                <label>
                  Ten hoat dong
                  <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Xem video va tra loi" />
                </label>

                <label>
                  Loai hoat dong
                  <select value={activityType} onChange={handleActivityTypeChange}>
                    {ACTIVITY_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <p className="helper-text">{ACTIVITY_TYPES.find((option) => option.value === activityType)?.description}</p>

                <label>
                  Huong dan hien thi cho hoc sinh
                  <input value={instructionText} onChange={(event) => setInstructionText(event.target.value)} placeholder="Hay doc va lam theo huong dan" />
                </label>

                {(activityType === 'multiple_choice' || activityType === 'listen_choose') ? (
                  <div className="config-card">
                    <label>
                      Cau hoi hoac noi dung can nghe
                      <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Vat nao co dang tron?" />
                    </label>
                    <label>
                      Danh sach lua chon, moi dong mot dap an
                      <textarea value={choiceOptionsText} onChange={(event) => setChoiceOptionsText(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Dap an dung
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
                      Cac cap can noi, moi dong theo mau Trai | Phai
                      <textarea value={matchingPairsText} onChange={(event) => setMatchingPairsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'drag_drop' ? (
                  <div className="config-card config-grid-2">
                    <label>
                      Cac muc can keo, moi dong mot muc
                      <textarea value={dragItemsText} onChange={(event) => setDragItemsText(event.target.value)} rows={5} />
                    </label>
                    <label>
                      Cac vi tri dich, moi dong mot vi tri
                      <textarea value={dragTargetsText} onChange={(event) => setDragTargetsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'watch_answer' ? (
                  <div className="config-card">
                    <label>
                      Nguon media
                      <select value={watchAnswerSource} onChange={(event) => setWatchAnswerSource(event.target.value as WatchAnswerSource)}>
                        <option value="external">Nhap link ngoai</option>
                        <option value="upload">Tai file tu may</option>
                      </select>
                    </label>

                    {watchAnswerSource === 'external' ? (
                      <label>
                        Link video hoac hinh minh hoa
                        <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://..." />
                      </label>
                    ) : (
                      <label>
                        Chon file video hoac anh
                        <input type="file" accept="image/*,video/*" onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)} />
                      </label>
                    )}

                    {watchAnswerSource === 'upload' && mediaFile ? <p className="helper-text">Da chon: {mediaFile.name}</p> : null}
                    {watchAnswerSource === 'external' ? <p className="helper-text">Ho tro tot nhat voi anh truc tiep, video MP4/WebM, YouTube va Google Drive.</p> : null}

                    <label>
                      Cau hoi sau khi xem
                      <input value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} placeholder="Em thay ban nho dang lam gi?" />
                    </label>
                  </div>
                ) : null}

                {activityType === 'step_by_step' ? (
                  <div className="config-card">
                    <label>
                      Cac buoc huong dan, moi dong mot buoc
                      <textarea value={stepListText} onChange={(event) => setStepListText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'aac' ? (
                  <div className="config-card">
                    <label>
                      Cac the giao tiep, moi dong mot the
                      <textarea value={aacCardsText} onChange={(event) => setAacCardsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'career_simulation' ? (
                  <div className="config-card">
                    <label>
                      Tinh huong mo phong
                      <textarea value={scenarioText} onChange={(event) => setScenarioText(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Tieu chi hoan thanh
                      <textarea value={successCriteriaText} onChange={(event) => setSuccessCriteriaText(event.target.value)} rows={3} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'ai_chat' ? (
                  <div className="config-card">
                    <label>
                      Loi mo dau cho AI
                      <textarea value={aiStarterPrompt} onChange={(event) => setAiStarterPrompt(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Muc tieu can dat, moi dong mot muc tieu
                      <textarea value={aiGoalText} onChange={(event) => setAiGoalText(event.target.value)} rows={4} />
                    </label>
                  </div>
                ) : null}

                <label className="checkbox-row">
                  <input type="checkbox" checked={voiceAnswerEnabled} onChange={(event) => setVoiceAnswerEnabled(event.target.checked)} />
                  Bat voice answer cho hoat dong nay
                </label>

                <button className="action-button" type="submit" disabled={!resolvedSelectedLessonId || createActivityMutation.isPending}>
                  {createActivityMutation.isPending ? 'Dang them...' : 'Them hoat dong'}
                </button>

                {activityFormError ? <p className="error-text">{activityFormError}</p> : null}
              </form>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Chi tiet bai hoc</h3>
            {selectedLesson ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedLesson.title}</strong>
                  <span>{selectedLesson.subject?.name ?? 'Chua co mon'} / {levelLabel(selectedLesson.primary_level)}</span>
                </div>
                <p>{lessonDetailQuery.data?.description ?? selectedLesson.description ?? 'Chua co mo ta.'}</p>
                <div className="student-list compact-list">
                  {lessonDetailQuery.data?.activities?.map((activity) => (
                    <div key={activity.id} className="student-row">
                      <strong>{activity.sort_order}. {activity.title}</strong>
                      <span>{activityLabel(activity.activity_type as ActivityType)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
                      <p>{activity.instruction_text ?? 'Chua co huong dan.'}</p>
                    </div>
                  ))}
                  {!lessonDetailQuery.data?.activities?.length && !lessonDetailQuery.isLoading ? <p>Bai hoc nay chua co hoat dong nao.</p> : null}
                </div>
              </div>
            ) : (
              <p>Hay chon mot bai hoc de xem chi tiet.</p>
            )}
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
