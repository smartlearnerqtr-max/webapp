import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { LessonActivityItem } from '../services/api'
import { completeMyAssignment, fetchMyAssignment, fetchMyAssignments, fetchMyClasses, fetchMyTeachers, joinClassByCredential, startMyAssignment, updateMyAssignmentProgress } from '../services/api'
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

type ActivityPair = {
  left: string
  right: string
}

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

const activityTypeLabelMap: Record<ActivityType, string> = {
  multiple_choice: 'Chọn đáp án',
  matching: 'Nối cặp',
  drag_drop: 'Kéo thả',
  listen_choose: 'Nghe và chọn',
  watch_answer: 'Xem và trả lời',
  step_by_step: 'Từng bước',
  aac: 'Thẻ giao tiếp',
  career_simulation: 'Mô phỏng nghề nghiệp',
  ai_chat: 'Trao đổi với AI',
}

const emptyProgressDraft = {
  progressPercent: '',
  completionScore: '',
  helpCount: '',
  retryCount: '',
  learningSeconds: '',
}

function parseActivityConfig(configJson: string | null) {
  if (!configJson) return null
  try {
    return JSON.parse(configJson) as Record<string, unknown>
  } catch {
    return null
  }
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toPairArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      return {
        left: toText((item as { left?: unknown }).left),
        right: toText((item as { right?: unknown }).right),
      }
    })
    .filter((item): item is ActivityPair => Boolean(item?.left && item.right))
}

function activityLabel(activityType: string) {
  return activityTypeLabelMap[activityType as ActivityType] ?? activityType
}

export function StudentHomePage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [progressDraft, setProgressDraft] = useState(emptyProgressDraft)
  const [joinClassId, setJoinClassId] = useState('')
  const [joinClassPassword, setJoinClassPassword] = useState('')
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, string>>({})
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, string[]>>({})
  const [dragAnswers, setDragAnswers] = useState<Record<number, string[]>>({})
  const [stepAnswers, setStepAnswers] = useState<Record<number, boolean[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({})
  const [aacSelections, setAacSelections] = useState<Record<number, string>>({})

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

  const effectiveSelectedAssignmentId = selectedAssignmentId ?? assignmentsQuery.data?.[0]?.assignment_id ?? null

  const assignmentDetailQuery = useQuery({
    queryKey: ['my-assignment-detail', token, effectiveSelectedAssignmentId],
    queryFn: () => fetchMyAssignment(token!, effectiveSelectedAssignmentId!),
    enabled: Boolean(token && effectiveSelectedAssignmentId),
  })

  const resetProgressDraft = () => setProgressDraft(emptyProgressDraft)

  const refreshStudentQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-assignments', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-assignment-detail', token, effectiveSelectedAssignmentId] }),
      queryClient.invalidateQueries({ queryKey: ['my-classes', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-teachers', token] }),
    ])
  }
  const startMutation = useMutation({
    mutationFn: () => startMyAssignment(token!, effectiveSelectedAssignmentId!),
    onSuccess: async () => {
      resetProgressDraft()
      await refreshStudentQueries()
    },
  })

  const detail = assignmentDetailQuery.data
  const resolvedProgressPercent = progressDraft.progressPercent || String(detail?.progress_percent ?? 0)
  const resolvedCompletionScore = progressDraft.completionScore || String(detail?.completion_score ?? 0)
  const resolvedHelpCount = progressDraft.helpCount || String(detail?.help_count ?? 0)
  const resolvedRetryCount = progressDraft.retryCount || String(detail?.retry_count ?? 0)
  const resolvedLearningSeconds = progressDraft.learningSeconds || String(detail?.total_learning_seconds ?? 0)

  const updateMutation = useMutation({
    mutationFn: () => updateMyAssignmentProgress(token!, effectiveSelectedAssignmentId!, {
      progress_percent: Number(resolvedProgressPercent),
      total_learning_seconds: Number(resolvedLearningSeconds),
      retry_count: Number(resolvedRetryCount),
      help_count: Number(resolvedHelpCount),
      reward_star_count: Number(Number(resolvedProgressPercent) >= 100 ? 3 : 2),
      completion_score: Number(resolvedCompletionScore),
      status: Number(resolvedProgressPercent) >= 100 ? 'completed' : 'in_progress',
    }),
    onSuccess: async () => {
      resetProgressDraft()
      await refreshStudentQueries()
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => completeMyAssignment(token!, effectiveSelectedAssignmentId!),
    onSuccess: async () => {
      resetProgressDraft()
      await refreshStudentQueries()
    },
  })

  const joinClassMutation = useMutation({
    mutationFn: () => joinClassByCredential(token!, {
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

  const totalAssignments = assignmentsQuery.data?.length ?? 0
  const completedCount = assignmentsQuery.data?.filter((item) => item.status === 'completed').length ?? 0
  const inProgressCount = assignmentsQuery.data?.filter((item) => item.status === 'in_progress').length ?? 0
  const latestAssignment = assignmentsQuery.data?.[0] ?? null
  const selectedAssignment = assignmentsQuery.data?.find((item) => item.assignment_id === effectiveSelectedAssignmentId) ?? null
  const joinedClassesLabel = useMemo(() => (myClassesQuery.data ?? []).map((classroom) => classroom.name), [myClassesQuery.data])

  const setDraftField = (field: keyof typeof emptyProgressDraft, value: string) => {
    setProgressDraft((current) => ({ ...current, [field]: value }))
  }

  const applyPreset = (preset: typeof emptyProgressDraft) => {
    setProgressDraft(preset)
  }

  const chooseAssignment = (assignmentId: number) => {
    setSelectedAssignmentId(assignmentId)
    resetProgressDraft()
  }

  function renderActivityCard(activity: LessonActivityItem) {
    const config = parseActivityConfig(activity.config_json)
    const activityType = activity.activity_type as ActivityType

    if (!config) {
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
          </div>
          <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
          <p className="helper-text">Hoạt động này chưa có cấu hình chi tiết nên đang hiển thị ở chế độ mô tả.</p>
        </div>
      )
    }

    if (activityType === 'multiple_choice' || activityType === 'listen_choose') {
      const prompt = toText(config.prompt) || toText(config.audio_text) || activity.instruction_text || 'Hãy chọn đáp án đúng.'
      const choices = toStringArray(config.choices)
      const correct = toText(config.correct)
      const selectedChoice = choiceAnswers[activity.id] ?? ''
      const isCorrect = Boolean(selectedChoice) && selectedChoice === correct
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
          </div>
          <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
          <div className="activity-playground">
            <p className="activity-prompt">{prompt}</p>
            <div className="activity-option-grid">
              {choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={selectedChoice === choice ? 'interactive-option interactive-option-active' : 'interactive-option'}
                  onClick={() => setChoiceAnswers((current) => ({ ...current, [activity.id]: choice }))}
                >
                  {choice}
                </button>
              ))}
            </div>
            {selectedChoice ? (
              <p className={isCorrect ? 'feedback-note feedback-note-success' : 'feedback-note feedback-note-warning'}>
                {isCorrect ? 'Em đã chọn đúng.' : `Em đang chọn ${selectedChoice}. Đáp án đúng là ${correct}.`}
              </p>
            ) : null}
          </div>
        </div>
      )
    }

    if (activityType === 'matching') {
      const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy nối các cặp phù hợp.'
      const pairs = toPairArray(config.pairs)
      const options = pairs.map((pair) => pair.right)
      const answers = matchingAnswers[activity.id] ?? Array.from({ length: pairs.length }, () => '')
      const correctCount = answers.filter((answer, index) => answer === pairs[index]?.right).length
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)}</span>
          </div>
          <p>{prompt}</p>
          <div className="activity-playground activity-list-grid">
            {pairs.map((pair, index) => (
              <label key={`${activity.id}-${pair.left}-${index}`} className="activity-inline-field">
                <span>{pair.left}</span>
                <select
                  value={answers[index] ?? ''}
                  onChange={(event) => {
                    const nextAnswers = [...answers]
                    nextAnswers[index] = event.target.value
                    setMatchingAnswers((current) => ({ ...current, [activity.id]: nextAnswers }))
                  }}
                >
                  <option value="">Chọn cặp đúng</option>
                  {options.map((option) => (
                    <option key={`${pair.left}-${option}`} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
            <p className="feedback-note">Đúng {correctCount}/{pairs.length} cặp.</p>
          </div>
        </div>
      )
    }
    if (activityType === 'drag_drop') {
      const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy kéo từng mục vào đúng vị trí.'
      const items = toStringArray(config.items)
      const targets = toStringArray(config.targets)
      const answers = dragAnswers[activity.id] ?? Array.from({ length: items.length }, () => '')
      const completedCount = answers.filter(Boolean).length
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)}</span>
          </div>
          <p>{prompt}</p>
          <div className="activity-playground activity-list-grid">
            {items.map((item, index) => (
              <label key={`${activity.id}-${item}-${index}`} className="activity-inline-field">
                <span>{item}</span>
                <select
                  value={answers[index] ?? ''}
                  onChange={(event) => {
                    const nextAnswers = [...answers]
                    nextAnswers[index] = event.target.value
                    setDragAnswers((current) => ({ ...current, [activity.id]: nextAnswers }))
                  }}
                >
                  <option value="">Chọn vị trí đích</option>
                  {targets.map((target) => (
                    <option key={`${item}-${target}`} value={target}>{target}</option>
                  ))}
                </select>
              </label>
            ))}
            <p className="feedback-note">Đã gắn {completedCount}/{items.length} mục.</p>
          </div>
        </div>
      )
    }

    if (activityType === 'watch_answer') {
      const mediaUrl = toText(config.media_url)
      const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy xem rồi trả lời câu hỏi.'
      const answer = textAnswers[activity.id] ?? ''
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)}</span>
          </div>
          <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
          <div className="activity-playground">
            {mediaUrl ? (
              <a className="subject-pill" href={mediaUrl} target="_blank" rel="noreferrer">Mở nội dung xem trước</a>
            ) : null}
            <p className="activity-prompt">{prompt}</p>
            <textarea
              value={answer}
              onChange={(event) => setTextAnswers((current) => ({ ...current, [activity.id]: event.target.value }))}
              rows={4}
              placeholder="Em trả lời ở đây"
            />
          </div>
        </div>
      )
    }

    if (activityType === 'step_by_step') {
      const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy làm theo từng bước.'
      const steps = toStringArray(config.steps)
      const answers = stepAnswers[activity.id] ?? Array.from({ length: steps.length }, () => false)
      const doneCount = answers.filter(Boolean).length
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)}</span>
          </div>
          <p>{prompt}</p>
          <div className="activity-playground activity-list-grid">
            {steps.map((step, index) => (
              <label key={`${activity.id}-${index}`} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(answers[index])}
                  onChange={(event) => {
                    const nextAnswers = [...answers]
                    nextAnswers[index] = event.target.checked
                    setStepAnswers((current) => ({ ...current, [activity.id]: nextAnswers }))
                  }}
                />
                <span>{step}</span>
              </label>
            ))}
            <p className="feedback-note">Hoàn thành {doneCount}/{steps.length} bước.</p>
          </div>
        </div>
      )
    }

    if (activityType === 'aac') {
      const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy chọn thẻ phù hợp.'
      const cards = toStringArray(config.cards)
      const selectedCard = aacSelections[activity.id] ?? ''
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)}</span>
          </div>
          <p>{prompt}</p>
          <div className="activity-playground">
            <div className="activity-option-grid">
              {cards.map((card) => (
                <button
                  key={card}
                  type="button"
                  className={selectedCard === card ? 'interactive-option interactive-option-active' : 'interactive-option'}
                  onClick={() => setAacSelections((current) => ({ ...current, [activity.id]: card }))}
                >
                  {card}
                </button>
              ))}
            </div>
            {selectedCard ? <p className="feedback-note feedback-note-success">Em đang chọn: {selectedCard}</p> : null}
          </div>
        </div>
      )
    }

    if (activityType === 'career_simulation') {
      const scenario = toText(config.scenario) || 'Chưa có tình huống mô phỏng.'
      const successCriteria = toText(config.success_criteria)
      const answer = textAnswers[activity.id] ?? ''
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)}</span>
          </div>
          <div className="activity-playground">
            <p className="activity-prompt">{scenario}</p>
            {successCriteria ? <p className="helper-text">Tiêu chí hoàn thành: {successCriteria}</p> : null}
            <textarea
              value={answer}
              onChange={(event) => setTextAnswers((current) => ({ ...current, [activity.id]: event.target.value }))}
              rows={4}
              placeholder="Em sẽ làm gì trong tình huống này?"
            />
          </div>
        </div>
      )
    }

    if (activityType === 'ai_chat') {
      const starterPrompt = toText(config.starter_prompt) || 'Hãy bắt đầu trao đổi ngắn với trợ lý.'
      const goals = toStringArray(config.goals)
      const answer = textAnswers[activity.id] ?? ''
      return (
        <div key={activity.id} className="activity-card">
          <div className="student-row">
            <strong>{activity.sort_order}. {activity.title}</strong>
            <span>{activityLabel(activity.activity_type)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
          </div>
          <div className="activity-playground">
            <p className="activity-prompt">{starterPrompt}</p>
            {goals.length ? (
              <div className="tag-wrap">
                {goals.map((goal) => (
                  <span key={`${activity.id}-${goal}`} className="subject-pill">{goal}</span>
                ))}
              </div>
            ) : null}
            <textarea
              value={answer}
              onChange={(event) => setTextAnswers((current) => ({ ...current, [activity.id]: event.target.value }))}
              rows={4}
              placeholder="Em nhập câu trả lời thử ở đây"
            />
          </div>
        </div>
      )
    }

    return (
      <div key={activity.id} className="activity-card">
        <div className="student-row">
          <strong>{activity.sort_order}. {activity.title}</strong>
          <span>{activityLabel(activity.activity_type)}</span>
        </div>
        <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
      </div>
    )
  }
  return (
    <RequireAuth allowedRoles={['student']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Không gian học sinh</p>
          <h2>Hôm nay em học gì?</h2>
          <p>
            Học sinh có thể tự vào lớp bằng <strong>ID lớp</strong> và <strong>mật khẩu</strong> do giáo viên gửi, sau đó xem bài được giao,
            mở chi tiết bài học, bắt đầu học và cập nhật tiến độ ngay tại đây. Nếu học với nhiều giáo viên, hệ thống sẽ hiển thị đầy đủ trong một dashboard duy nhất.
          </p>
        </section>

        <section className="metrics-grid">
          <article className="mini-card"><span>Tổng assignment</span><strong>{totalAssignments}</strong></article>
          <article className="mini-card"><span>Đang học</span><strong>{inProgressCount}</strong></article>
          <article className="mini-card"><span>Đã xong</span><strong>{completedCount}</strong></article>
          <article className="mini-card"><span>Số giáo viên</span><strong>{myTeachersQuery.data?.length ?? 0}</strong></article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thông tin học sinh</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>{typeof profile?.['full_name'] === 'string' ? String(profile['full_name']) : user?.email ?? 'Học sinh'}</strong>
                <span>{typeof profile?.['preferred_input'] === 'string' ? String(profile['preferred_input']) : 'touch'} / {typeof profile?.['preferred_font_size'] === 'string' ? String(profile['preferred_font_size']) : 'medium'}</span>
              </div>
              <p>Mức độ: {typeof profile?.['disability_level'] === 'string' ? String(profile['disability_level']) : 'chưa rõ'}</p>
              <p>Ghi chú hỗ trợ: {typeof profile?.['support_note'] === 'string' ? String(profile['support_note']) : 'Chưa có ghi chú hỗ trợ.'}</p>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Giáo viên đang dạy em</h3>
            <div className="student-list compact-list">
              {(myTeachersQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.teacher.full_name}</strong>
                  <span>Teacher ID {item.teacher.id} / {item.teacher.school_name ?? 'Chưa cập nhật trường'}</span>
                  <p>Email: {item.teacher.email ?? 'Chưa cập nhật'} | Số điện thoại: {item.teacher.phone ?? 'Chưa cập nhật'}</p>
                  <p>Số lớp đang học với giáo viên này: {item.active_class_count}</p>
                </div>
              ))}
              {!myTeachersQuery.data?.length && !myTeachersQuery.isLoading ? <p>Em chưa liên kết với giáo viên nào.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Tham gia lớp học</h3>
            <div className="form-stack">
              <label>
                ID lớp
                <input value={joinClassId} onChange={(event) => setJoinClassId(event.target.value)} inputMode="numeric" placeholder="Ví dụ: 12" />
              </label>
              <label>
                Mật khẩu vào lớp
                <input value={joinClassPassword} onChange={(event) => setJoinClassPassword(event.target.value.toUpperCase())} placeholder="Ví dụ: AB12CD34" />
              </label>
              <button className="action-button" type="button" disabled={!joinClassId || !joinClassPassword || joinClassMutation.isPending} onClick={() => joinClassMutation.mutate()}>
                {joinClassMutation.isPending ? 'Đang vào lớp...' : 'Vào lớp'}
              </button>
              {joinClassMutation.error ? <p className="error-text">{(joinClassMutation.error as Error).message}</p> : null}
            </div>
            <div className="tag-wrap">
              {(myClassesQuery.data ?? []).map((classroom) => (
                <span key={classroom.id} className="subject-pill">{classroom.name} / GV {classroom.teacher_id}</span>
              ))}
              {!myClassesQuery.data?.length && !myClassesQuery.isLoading ? <p>Em chưa tham gia lớp học nào.</p> : null}
            </div>
            {joinedClassesLabel.length ? <p>Danh sách lớp hiện tại: {joinedClassesLabel.join(', ')}</p> : null}
          </article>

          <article className="roadmap-panel">
            <h3>Bài gần nhất</h3>
            {latestAssignment ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{latestAssignment.assignment?.lesson?.title ?? `Assignment #${latestAssignment.assignment_id}`}</strong>
                  <span>{statusLabelMap[latestAssignment.status] ?? latestAssignment.status}</span>
                </div>
                <p>Tiến độ: {latestAssignment.progress_percent}%</p>
                <p>Readiness: {readinessLabelMap[latestAssignment.readiness_status] ?? latestAssignment.readiness_status}</p>
              </div>
            ) : <p>Chưa có bài học nào được giao cho tài khoản này.</p>}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Danh sách bài học được giao</h3>
            <div className="student-list compact-list">
              {assignmentsQuery.data?.map((item) => (
                <button key={item.id} type="button" className={effectiveSelectedAssignmentId === item.assignment_id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'} onClick={() => chooseAssignment(item.assignment_id)}>
                  {item.assignment?.lesson?.title ?? `Assignment #${item.assignment_id}`}
                </button>
              ))}
              {!assignmentsQuery.data?.length && !assignmentsQuery.isLoading ? <p>Chưa có assignment nào.</p> : null}
            </div>

            {selectedAssignment ? (
              <div className="detail-stack" style={{ marginTop: '1rem' }}>
                <div className="student-row">
                  <strong>{selectedAssignment.assignment?.lesson?.title ?? `Assignment #${selectedAssignment.assignment_id}`}</strong>
                  <span>{statusLabelMap[selectedAssignment.status] ?? selectedAssignment.status}</span>
                </div>
                <p>Tiến độ: {selectedAssignment.progress_percent}% | Điểm: {selectedAssignment.completion_score}</p>
                <p>Readiness: {readinessLabelMap[selectedAssignment.readiness_status] ?? selectedAssignment.readiness_status}</p>
              </div>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Chi tiết bài học</h3>
            {detail ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{detail.lesson?.title ?? detail.assignment?.lesson?.title ?? `Assignment #${detail.assignment_id}`}</strong>
                  <span>{detail.lesson?.subject?.name ?? 'Chưa có môn học'} / {statusLabelMap[detail.status] ?? detail.status}</span>
                </div>
                <p>{detail.lesson?.description ?? 'Chưa có mô tả bài học.'}</p>
                <p>Tiến độ hiện tại: {detail.progress_percent}% | Điểm: {detail.completion_score}</p>
                <div className="tag-wrap">
                  {detail.readiness_reasons.map((reason) => (<span key={reason} className="subject-pill">{reason}</span>))}
                </div>
                <div className="student-list compact-list">
                  {detail.lesson?.activities?.map((activity) => renderActivityCard(activity))}
                  {!detail.lesson?.activities?.length ? <p>Bài học này chưa có activity nào.</p> : null}
                </div>
              </div>
            ) : <p>Hãy chọn một bài học để xem chi tiết.</p>}
          </article>
        </section>
        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thao tác học bài</h3>
            <div className="button-row">
              <button className="action-button" type="button" disabled={!effectiveSelectedAssignmentId || startMutation.isPending} onClick={() => startMutation.mutate()}>
                {startMutation.isPending ? 'Đang bắt đầu...' : 'Bắt đầu bài học'}
              </button>
              <button className="ghost-button" type="button" disabled={!effectiveSelectedAssignmentId} onClick={() => applyPreset({ progressPercent: '50', completionScore: '65', helpCount: '1', retryCount: '0', learningSeconds: '180' })}>
                Mức trung bình
              </button>
              <button className="ghost-button" type="button" disabled={!effectiveSelectedAssignmentId} onClick={() => applyPreset({ progressPercent: '100', completionScore: '95', helpCount: '0', retryCount: '0', learningSeconds: '240' })}>
                Mức hoàn thành tốt
              </button>
            </div>
            {(startMutation.error || updateMutation.error || completeMutation.error) ? (
              <p className="error-text">{(startMutation.error as Error)?.message ?? (updateMutation.error as Error)?.message ?? (completeMutation.error as Error)?.message}</p>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Cập nhật tiến độ</h3>
            <div className="form-stack">
              <label>Phần trăm tiến độ<input value={resolvedProgressPercent} onChange={(event) => setDraftField('progressPercent', event.target.value)} inputMode="numeric" /></label>
              <label>Điểm hoàn thành<input value={resolvedCompletionScore} onChange={(event) => setDraftField('completionScore', event.target.value)} inputMode="numeric" /></label>
              <label>Số lần cần trợ giúp<input value={resolvedHelpCount} onChange={(event) => setDraftField('helpCount', event.target.value)} inputMode="numeric" /></label>
              <label>Số lần học lại<input value={resolvedRetryCount} onChange={(event) => setDraftField('retryCount', event.target.value)} inputMode="numeric" /></label>
              <label>Tổng số giây học<input value={resolvedLearningSeconds} onChange={(event) => setDraftField('learningSeconds', event.target.value)} inputMode="numeric" /></label>
              <div className="button-row">
                <button className="action-button" type="button" disabled={!effectiveSelectedAssignmentId || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu tiến độ'}
                </button>
                <button className="action-button" type="button" disabled={!effectiveSelectedAssignmentId || completeMutation.isPending} onClick={() => completeMutation.mutate()}>
                  {completeMutation.isPending ? 'Đang hoàn thành...' : 'Đánh dấu đã hoàn thành'}
                </button>
              </div>
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
