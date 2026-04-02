import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createLesson, createLessonActivity, fetchLesson, fetchLessons, fetchSubjects } from '../services/api'
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

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'N?ng' },
  { value: 'trung_binh', label: 'Trung b?nh' },
  { value: 'nhe', label: 'Nh?' },
]

const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string; description: string }> = [
  { value: 'multiple_choice', label: 'Ch?n ??p ?n', description: 'T?o c?c l?a ch?n v? ??nh d?u ??p ?n ??ng.' },
  { value: 'matching', label: 'N?i c?p', description: 'T?o c?c c?p th?ng tin ?? h?c sinh gh?p l?i.' },
  { value: 'drag_drop', label: 'K?o th?', description: 'T?o c?c m?c ?? h?c sinh k?o v?o ??ng v? tr?.' },
  { value: 'listen_choose', label: 'Nghe v? ch?n', description: 'Th?m l?i ??c ho?c ?m thanh m?u r?i cho h?c sinh ch?n ??p ?n.' },
  { value: 'watch_answer', label: 'Xem v? tr? l?i', description: 'G?n n?i dung quan s?t r?i y?u c?u tr? l?i sau khi xem.' },
  { value: 'step_by_step', label: 'T?ng b??c', description: 'Chia ho?t ??ng th?nh c?c b??c ng?n, d? theo d?i.' },
  { value: 'aac', label: 'Th? giao ti?p', description: 'T?o b? th? ??n gi?n ?? h? tr? giao ti?p v? ph?n h?i.' },
  { value: 'career_simulation', label: 'M? ph?ng ngh? nghi?p', description: 'Thi?t k? t?nh hu?ng th?c h?nh theo vai tr? ho?c c?ng vi?c.' },
  { value: 'ai_chat', label: 'Trao ??i v?i AI', description: 'G?i ? l?i m? ??u v? m?c ti?u trao ??i v?i tr? l? AI.' },
]

const DEFAULT_CHOICE_OPTIONS = ['??p ?n A', '??p ?n B']
const DEFAULT_MATCHING_PAIRS = ['H?nh tr?n | Tr?n', 'H?nh vu?ng | Vu?ng']
const DEFAULT_DRAG_ITEMS = ['Qu? t?o', 'Con m?o', 'Xe ??p']
const DEFAULT_DRAG_TARGETS = ['Gi? tr?i c?y', '??ng v?t', 'Ph??ng ti?n']
const DEFAULT_STEPS = ['B??c 1: Quan s?t', 'B??c 2: Ch?n ??p ?n', 'B??c 3: Nh?n ph?n h?i']
const DEFAULT_AAC_CARDS = ['Con mu?n u?ng n??c', 'Con c?n gi?p ??', 'Con ?? xong']
const DEFAULT_GOALS = ['Ch?o h?i l?ch s?', 'Tr? l?i ng?n g?n', 'Nh? tr? gi?p khi c?n']

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
      return 'H?y ??c c?u h?i v? ch?n ??p ?n ??ng.'
    case 'matching':
      return 'H?y n?i c?c c?p ph? h?p v?i nhau.'
    case 'drag_drop':
      return 'H?y k?o t?ng m?c v?o ??ng v? tr?.'
    case 'listen_choose':
      return 'H?y nghe k? r?i ch?n ??p ?n ??ng.'
    case 'watch_answer':
      return 'H?y xem n?i dung tr??c r?i tr? l?i c?u h?i.'
    case 'step_by_step':
      return 'H?y l?m l?n l??t t?ng b??c theo h??ng d?n.'
    case 'aac':
      return 'H?y ch?n th? ph? h?p v?i ?i?u em mu?n n?i.'
    case 'career_simulation':
      return 'H?y th?c hi?n ho?t ??ng theo t?nh hu?ng m? ph?ng.'
    case 'ai_chat':
      return 'H?y trao ??i ng?n g?n v?i tr? l? ?? ho?n th?nh nhi?m v?.'
    default:
      return 'H?y l?m theo h??ng d?n c?a ho?t ??ng n?y.'
  }
}

function defaultVoiceEnabledForType(activityType: ActivityType) {
  return activityType === 'listen_choose' || activityType === 'multiple_choice' || activityType === 'aac' || activityType === 'ai_chat'
}

function activityLabel(activityType: ActivityType) {
  return ACTIVITY_TYPES.find((item) => item.value === activityType)?.label ?? activityType
}

function buildActivityConfig(activityType: ActivityType, fields: {
  prompt: string
  choiceOptionsText: string
  correctChoice: string
  matchingPairsText: string
  dragItemsText: string
  dragTargetsText: string
  mediaUrl: string
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
  const [prompt, setPrompt] = useState('C?u h?i ch?nh c?a ho?t ??ng')
  const [choiceOptionsText, setChoiceOptionsText] = useState(DEFAULT_CHOICE_OPTIONS.join('\n'))
  const [correctChoice, setCorrectChoice] = useState(DEFAULT_CHOICE_OPTIONS[0])
  const [matchingPairsText, setMatchingPairsText] = useState(DEFAULT_MATCHING_PAIRS.join('\n'))
  const [dragItemsText, setDragItemsText] = useState(DEFAULT_DRAG_ITEMS.join('\n'))
  const [dragTargetsText, setDragTargetsText] = useState(DEFAULT_DRAG_TARGETS.join('\n'))
  const [mediaUrl, setMediaUrl] = useState('https://example.com/video-bai-hoc')
  const [questionPrompt, setQuestionPrompt] = useState('Sau khi xem xong, em th?y ?i?u g??')
  const [stepListText, setStepListText] = useState(DEFAULT_STEPS.join('\n'))
  const [aacCardsText, setAacCardsText] = useState(DEFAULT_AAC_CARDS.join('\n'))
  const [scenarioText, setScenarioText] = useState('Em v?o vai nh?n vi?n th? vi?n v? gi?p b?n ch?n s?ch ph? h?p.')
  const [successCriteriaText, setSuccessCriteriaText] = useState('Ch?n ??ng vai tr?, l?m ?? b??c, tr? l?i l?ch s?.')
  const [aiStarterPrompt, setAiStarterPrompt] = useState('H?y ??ng vai b?n h?c v? h?i em 3 c?u ng?n v? b?i h?c n?y.')
  const [aiGoalText, setAiGoalText] = useState(DEFAULT_GOALS.join('\n'))
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false)
  const [advancedConfigJson, setAdvancedConfigJson] = useState('')
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
    mutationFn: () => {
      const resolvedConfigJson = showAdvancedConfig ? advancedConfigJson.trim() : generatedConfigJson
      if (resolvedConfigJson) {
        JSON.parse(resolvedConfigJson)
      }
      return createLessonActivity(token!, resolvedSelectedLessonId!, {
        title: activityTitle,
        activity_type: activityType,
        instruction_text: instructionText,
        voice_answer_enabled: voiceAnswerEnabled,
        is_required: true,
        sort_order: (lessonDetailQuery.data?.activities?.length ?? 0) + 1,
        difficulty_stage: 1,
        config_json: resolvedConfigJson,
      })
    },
    onSuccess: async () => {
      setActivityTitle('')
      setActivityFormError(null)
      setShowAdvancedConfig(false)
      setAdvancedConfigJson('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, resolvedSelectedLessonId] }),
      ])
    },
    onError: (error) => {
      setActivityFormError(error instanceof Error ? error.message : 'Kh?ng th? t?o ho?t ??ng')
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
    if (showAdvancedConfig) {
      try {
        JSON.parse(advancedConfigJson.trim())
      } catch {
        setActivityFormError('C?u h?nh n?ng cao ph?i l? JSON h?p l?.')
        return
      }
    }
    createActivityMutation.mutate()
  }

  function handleActivityTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.target.value as ActivityType
    setActivityType(nextType)
    setInstructionText(defaultInstructionForType(nextType))
    setVoiceAnswerEnabled(defaultVoiceEnabledForType(nextType))
    setShowAdvancedConfig(false)
    setAdvancedConfigJson('')
    setActivityFormError(null)
  }

  function toggleAdvancedConfig() {
    if (!showAdvancedConfig) {
      setAdvancedConfigJson(generatedConfigJson)
    }
    setShowAdvancedConfig((current) => !current)
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>B?i h?c v? ho?t ??ng b?n trong b?i h?c</h2>
          <p>M?i b?i h?c g?n v?i m?n h?c, m?c ?? khuy?t t?t ch?nh v? ch?a nhi?u ho?t ??ng nh? ch?n ??p ?n, k?o th?, video ho?c voice.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>T?o b?i h?c</h3>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
              <label>
                Ti?u ?? b?i h?c
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nh?n bi?t h?nh tr?n" />
              </label>
              <label>
                M?n h?c
                <select value={resolvedSubjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Ch?n m?n h?c</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label>
                M?c ?? ch?nh
                <select value={primaryLevel} onChange={(event) => setPrimaryLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                M? t? ng?n
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="B?i h?c c? h? tr? voice" />
              </label>
              <label>
                S? ph?t d? ki?n
                <input value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} inputMode="numeric" />
              </label>
              <button className="action-button" type="submit" disabled={createLessonMutation.isPending}>
                {createLessonMutation.isPending ? '?ang t?o...' : 'T?o b?i h?c'}
              </button>
              {createLessonMutation.error ? <p className="error-text">{(createLessonMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Ch?n b?i h?c ?ang ch?nh</h3>
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
            {!lessonsQuery.data?.length && !lessonsQuery.isLoading ? <p>Ch?a c? b?i h?c n?o, h?y t?o b?i h?c ??u ti?n.</p> : null}
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
              <span>Th?m ho?t ??ng v?o b?i h?c</span>
              <span style={{ fontSize: '1.3rem' }}>{isActivityFormOpen ? '-' : '+'}</span>
            </button>
            {isActivityFormOpen ? (
              <form className="form-stack" onSubmit={handleActivitySubmit}>
                <label>
                  T?n ho?t ??ng
                  <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Ch?n ??p ?n b?ng gi?ng n?i" />
                </label>
                <label>
                  Lo?i ho?t ??ng
                  <select value={activityType} onChange={handleActivityTypeChange}>
                    {ACTIVITY_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <p className="helper-text">{ACTIVITY_TYPES.find((option) => option.value === activityType)?.description}</p>
                <label>
                  H??ng d?n hi?n th? cho h?c sinh
                  <input value={instructionText} onChange={(event) => setInstructionText(event.target.value)} placeholder="H?y ??c ??p ?n ??ng" />
                </label>

                {(activityType === 'multiple_choice' || activityType === 'listen_choose') ? (
                  <div className="config-card">
                    <label>
                      C?u h?i ho?c n?i dung c?n nghe
                      <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="?m n?o l? ?m /a/?" />
                    </label>
                    <label>
                      Danh s?ch l?a ch?n, m?i d?ng m?t ??p ?n
                      <textarea value={choiceOptionsText} onChange={(event) => setChoiceOptionsText(event.target.value)} rows={4} />
                    </label>
                    <label>
                      ??p ?n ??ng
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
                      C?c c?p c?n n?i, m?i d?ng theo m?u Tr?i | Ph?i
                      <textarea value={matchingPairsText} onChange={(event) => setMatchingPairsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'drag_drop' ? (
                  <div className="config-card config-grid-2">
                    <label>
                      C?c m?c c?n k?o, m?i d?ng m?t m?c
                      <textarea value={dragItemsText} onChange={(event) => setDragItemsText(event.target.value)} rows={5} />
                    </label>
                    <label>
                      C?c v? tr? ??ch, m?i d?ng m?t v? tr?
                      <textarea value={dragTargetsText} onChange={(event) => setDragTargetsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'watch_answer' ? (
                  <div className="config-card">
                    <label>
                      Link video ho?c h?nh minh ho?
                      <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://..." />
                    </label>
                    <label>
                      C?u h?i sau khi xem
                      <input value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} placeholder="Em th?y b?n nh? ?ang l?m g??" />
                    </label>
                  </div>
                ) : null}

                {activityType === 'step_by_step' ? (
                  <div className="config-card">
                    <label>
                      C?c b??c h??ng d?n, m?i d?ng m?t b??c
                      <textarea value={stepListText} onChange={(event) => setStepListText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'aac' ? (
                  <div className="config-card">
                    <label>
                      C?c th? giao ti?p, m?i d?ng m?t th?
                      <textarea value={aacCardsText} onChange={(event) => setAacCardsText(event.target.value)} rows={5} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'career_simulation' ? (
                  <div className="config-card">
                    <label>
                      T?nh hu?ng m? ph?ng
                      <textarea value={scenarioText} onChange={(event) => setScenarioText(event.target.value)} rows={4} />
                    </label>
                    <label>
                      Ti?u ch? ho?n th?nh
                      <textarea value={successCriteriaText} onChange={(event) => setSuccessCriteriaText(event.target.value)} rows={3} />
                    </label>
                  </div>
                ) : null}

                {activityType === 'ai_chat' ? (
                  <div className="config-card">
                    <label>
                      L?i m? ??u cho AI
                      <textarea value={aiStarterPrompt} onChange={(event) => setAiStarterPrompt(event.target.value)} rows={4} />
                    </label>
                    <label>
                      M?c ti?u c?n ??t, m?i d?ng m?t m?c ti?u
                      <textarea value={aiGoalText} onChange={(event) => setAiGoalText(event.target.value)} rows={4} />
                    </label>
                  </div>
                ) : null}

                <label className="checkbox-row">
                  <input type="checkbox" checked={voiceAnswerEnabled} onChange={(event) => setVoiceAnswerEnabled(event.target.checked)} />
                  B?t voice answer cho ho?t ??ng n?y
                </label>

                <div className="config-preview">
                  <div className="student-row">
                    <strong>{activityLabel(activityType)}</strong>
                    <span>H? th?ng s? t? t?o c?u h?nh k? thu?t ? ph?a sau.</span>
                  </div>
                  <button className="ghost-button" type="button" onClick={toggleAdvancedConfig}>
                    {showAdvancedConfig ? '?n c?u h?nh n?ng cao' : 'Xem c?u h?nh h? th?ng s? l?u'}
                  </button>
                  {showAdvancedConfig ? (
                    <label>
                      C?u h?nh n?ng cao
                      <textarea value={advancedConfigJson} onChange={(event) => setAdvancedConfigJson(event.target.value)} rows={10} />
                    </label>
                  ) : (
                    <pre className="config-preview-code">{generatedConfigJson}</pre>
                  )}
                </div>

                <button className="action-button" type="submit" disabled={!resolvedSelectedLessonId || createActivityMutation.isPending}>
                  {createActivityMutation.isPending ? '?ang th?m...' : 'Th?m ho?t ??ng'}
                </button>
                {activityFormError ? <p className="error-text">{activityFormError}</p> : null}
                {createActivityMutation.error && !activityFormError ? <p className="error-text">{(createActivityMutation.error as Error).message}</p> : null}
              </form>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Chi ti?t b?i h?c</h3>
            {selectedLesson ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedLesson.title}</strong>
                  <span>{selectedLesson.subject?.name ?? 'Ch?a c? m?n'} / {selectedLesson.primary_level}</span>
                </div>
                <p>{lessonDetailQuery.data?.description ?? selectedLesson.description ?? 'Ch?a c? m? t?.'}</p>
                <div className="student-list compact-list">
                  {lessonDetailQuery.data?.activities?.map((activity) => (
                    <div key={activity.id} className="student-row">
                      <strong>{activity.sort_order}. {activity.title}</strong>
                      <span>{activityLabel(activity.activity_type as ActivityType)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
                      <p>{activity.instruction_text ?? 'Ch?a c? h??ng d?n.'}</p>
                    </div>
                  ))}
                  {!lessonDetailQuery.data?.activities?.length && !lessonDetailQuery.isLoading ? <p>B?i h?c n?y ch?a c? ho?t ??ng n?o.</p> : null}
                </div>
              </div>
            ) : (
              <p>H?y ch?n m?t b?i h?c ?? xem chi ti?t.</p>
            )}
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
