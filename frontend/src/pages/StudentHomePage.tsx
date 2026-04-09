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
  startMyAssignment,
  updateMyAssignmentProgress,
  type LessonActivityItem,
  type MyAssignmentDetail,
  type MyAssignmentItem,
} from '../services/api'
import { useAuthStore } from '../store/authStore'

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

type StudentAnswerState = {
  choiceAnswers: Record<number, string>
  matchingAnswers: Record<number, string[]>
  dragAnswers: Record<number, string[]>
  stepAnswers: Record<number, boolean[]>
  textAnswers: Record<number, string>
  aacSelections: Record<number, string>
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

function isActivityCompleted(activity: LessonActivityItem, answers: StudentAnswerState) {
  switch (activity.activity_type) {
    case 'multiple_choice':
    case 'image_choice':
    case 'listen_choose':
      return hasFilledString(answers.choiceAnswers[activity.id])
    case 'matching':
      return hasFilledStringArray(answers.matchingAnswers[activity.id])
    case 'drag_drop':
      return hasFilledStringArray(answers.dragAnswers[activity.id])
    case 'step_by_step':
      return hasCompletedBooleanArray(answers.stepAnswers[activity.id])
    case 'watch_answer':
    case 'career_simulation':
    case 'ai_chat':
      return hasFilledString(answers.textAnswers[activity.id])
    case 'aac':
      return hasFilledString(answers.aacSelections[activity.id])
    default:
      return false
  }
}

function updateAssignmentListCache(
  current: MyAssignmentItem[] | undefined,
  assignmentId: number,
  patch: Partial<MyAssignmentItem>,
) {
  if (!current) return current
  return current.map((item) => (item.assignment_id === assignmentId ? { ...item, ...patch } : item))
}

export function StudentHomePage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [joinClassId, setJoinClassId] = useState('')
  const [joinClassPassword, setJoinClassPassword] = useState('')
  const [completedLessonTitle, setCompletedLessonTitle] = useState('')
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, string>>({})
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, string[]>>({})
  const [dragAnswers, setDragAnswers] = useState<Record<number, string[]>>({})
  const [stepAnswers, setStepAnswers] = useState<Record<number, boolean[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({})
  const [aacSelections, setAacSelections] = useState<Record<number, string>>({})
  const learningBaseSecondsRef = useRef(0)
  const learningSessionStartedAtRef = useRef<number | null>(null)
  const lastAutoSyncKeyRef = useRef('')

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

  const refreshStudentQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-assignments', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-assignment-detail', token, effectiveSelectedAssignmentId] }),
      queryClient.invalidateQueries({ queryKey: ['my-classes', token] }),
      queryClient.invalidateQueries({ queryKey: ['my-teachers', token] }),
    ])
  }

  const resetActivityAnswers = () => {
    setChoiceAnswers({})
    setMatchingAnswers({})
    setDragAnswers({})
    setStepAnswers({})
    setTextAnswers({})
    setAacSelections({})
  }

  const closeLessonView = () => {
    setSelectedAssignmentId(null)
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
  }

  const startMutation = useMutation({
    mutationFn: () => startMyAssignment(token!, effectiveSelectedAssignmentId!),
    onSuccess: async () => {
      learningSessionStartedAtRef.current = Date.now()
      lastAutoSyncKeyRef.current = ''
      await refreshStudentQueries()
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => completeMyAssignment(token!, effectiveSelectedAssignmentId!),
    onSuccess: async () => {
      setCompletedLessonTitle(detail?.lesson?.title ?? detail?.assignment?.lesson?.title ?? 'Bài học')
      closeLessonView()
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

  const detail = assignmentDetailQuery.data

  useEffect(() => {
    learningBaseSecondsRef.current = detail?.total_learning_seconds ?? 0
    learningSessionStartedAtRef.current = detail?.status === 'in_progress' ? Date.now() : null
    lastAutoSyncKeyRef.current = ''
  }, [detail?.id, detail?.total_learning_seconds, detail?.status])

  const totalAssignments = assignmentsQuery.data?.length ?? 0
  const completedCount = assignmentsQuery.data?.filter((item) => item.status === 'completed').length ?? 0
  const inProgressCount = assignmentsQuery.data?.filter((item) => item.status === 'in_progress').length ?? 0
  const latestAssignment = assignmentsQuery.data?.[0] ?? null
  const selectedAssignment =
    assignmentsQuery.data?.find((item) => item.assignment_id === effectiveSelectedAssignmentId) ?? null
  const joinedClassesLabel = useMemo(
    () => (myClassesQuery.data ?? []).map((classroom) => classroom.name),
    [myClassesQuery.data],
  )

  const chooseAssignment = (assignmentId: number) => {
    setSelectedAssignmentId(assignmentId)
    setCompletedLessonTitle('')
    resetActivityAnswers()
    learningSessionStartedAtRef.current = null
    lastAutoSyncKeyRef.current = ''
  }

  const answers: StudentAnswerState = {
    choiceAnswers,
    matchingAnswers,
    dragAnswers,
    stepAnswers,
    textAnswers,
    aacSelections,
  }

  const setAnswersMap = {
    setChoiceAnswers,
    setMatchingAnswers,
    setDragAnswers,
    setStepAnswers,
    setTextAnswers,
    setAacSelections,
  }

  const activityProgress = useMemo(() => {
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
      nextPayload.total_learning_seconds,
      nextPayload.reward_star_count,
      nextPayload.status,
    ].join(':')

    if (lastAutoSyncKeyRef.current === nextKey) return

    const sameAsServer =
      detail.progress_percent === nextPayload.progress_percent &&
      detail.completion_score === nextPayload.completion_score &&
      detail.total_learning_seconds === nextPayload.total_learning_seconds &&
      detail.status === nextPayload.status

    if (sameAsServer) {
      lastAutoSyncKeyRef.current = nextKey
      return
    }

    const timeout = window.setTimeout(async () => {
      lastAutoSyncKeyRef.current = nextKey
      try {
        const updatedProgress = await updateMyAssignmentProgress(token, effectiveSelectedAssignmentId, nextPayload)
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
    detail,
    effectiveSelectedAssignmentId,
    queryClient,
    token,
  ])

  return (
    <RequireAuth allowedRoles={['student']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Không gian học sinh</p>
          <h2>Hôm nay em học gì?</h2>
          <p>
            Mọi bài được giao, hoạt động học tập và tiến độ đều nằm trong cùng một khu vực để em thao tác nhanh hơn và
            dễ theo dõi hơn.
          </p>
        </section>

        {completedLessonTitle ? (
          <section className="roadmap-panel">
            <p className="eyebrow">Hoàn thành bài học</p>
            <h3>{completedLessonTitle}</h3>
            <p>Em đã hoàn thành bài học này và đã quay về trang chủ để chọn bài tiếp theo.</p>
          </section>
        ) : null}

        <section className="metrics-grid">
          <article className="mini-card">
            <span>Tổng bài tập</span>
            <strong>{totalAssignments}</strong>
          </article>
          <article className="mini-card">
            <span>Đang học</span>
            <strong>{inProgressCount}</strong>
          </article>
          <article className="mini-card">
            <span>Đã xong</span>
            <strong>{completedCount}</strong>
          </article>
          <article className="mini-card">
            <span>Số giáo viên</span>
            <strong>{myTeachersQuery.data?.length ?? 0}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thông tin học sinh</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>{typeof profile?.full_name === 'string' ? String(profile.full_name) : user?.email ?? 'Học sinh'}</strong>
                <span>
                  {typeof profile?.preferred_input === 'string' ? String(profile.preferred_input) : 'touch'} /{' '}
                  {typeof profile?.preferred_font_size === 'string' ? String(profile.preferred_font_size) : 'medium'}
                </span>
              </div>
              <p>Mức độ: {typeof profile?.disability_level === 'string' ? String(profile.disability_level) : 'chưa rõ'}</p>
              <p>
                Ghi chú hỗ trợ:{' '}
                {typeof profile?.support_note === 'string' ? String(profile.support_note) : 'Chưa có ghi chú hỗ trợ.'}
              </p>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Giáo viên đang dạy em</h3>
            <div className="student-list compact-list">
              {(myTeachersQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.teacher.full_name}</strong>
                  <span>
                    Giáo viên #{item.teacher.id} / {item.teacher.school_name ?? 'Chưa cập nhật trường'}
                  </span>
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
                <input
                  value={joinClassPassword}
                  onChange={(event) => setJoinClassPassword(event.target.value.toUpperCase())}
                  placeholder="Ví dụ: AB12CD34"
                />
              </label>
              <button
                className="action-button"
                type="button"
                disabled={!joinClassId || !joinClassPassword || joinClassMutation.isPending}
                onClick={() => joinClassMutation.mutate()}
              >
                {joinClassMutation.isPending ? 'Đang vào lớp...' : 'Vào lớp'}
              </button>
              {joinClassMutation.error ? <p className="error-text">{(joinClassMutation.error as Error).message}</p> : null}
            </div>
            <div className="tag-wrap">
              {(myClassesQuery.data ?? []).map((classroom) => (
                <span key={classroom.id} className="subject-pill">
                  {classroom.name} / GV {classroom.teacher_id}
                </span>
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
                  <strong>{latestAssignment.assignment?.lesson?.title ?? `Bài tập #${latestAssignment.assignment_id}`}</strong>
                  <span>{statusLabelMap[latestAssignment.status] ?? latestAssignment.status}</span>
                </div>
                <p>Tiến độ: {latestAssignment.progress_percent}%</p>
                <p>Trạng thái sẵn sàng: {readinessLabelMap[latestAssignment.readiness_status] ?? latestAssignment.readiness_status}</p>
              </div>
            ) : (
              <p>Chưa có bài học nào được giao cho tài khoản này.</p>
            )}
          </article>
        </section>

        <section className="student-learning-layout">
          <article className="roadmap-panel student-assignment-panel">
            <div className="student-panel-head">
              <div>
                <p className="eyebrow">Điều hướng học tập</p>
                <h3>Danh sách bài được giao</h3>
                <p>Chọn bài ở cột này, khu vực bên phải sẽ hiển thị đầy đủ nội dung và hoạt động học tập.</p>
              </div>
              <span className="subject-pill muted-pill">{totalAssignments} bài</span>
            </div>

            <div className="student-assignment-summary">
              <article className="info-card">
                <span>Bài đang học</span>
                <strong>{inProgressCount}</strong>
              </article>
              <article className="info-card">
                <span>Bài đã xong</span>
                <strong>{completedCount}</strong>
              </article>
            </div>

            <div className="student-list compact-list student-assignment-list">
              {assignmentsQuery.data?.map((item) => {
                const isActive = effectiveSelectedAssignmentId === item.assignment_id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={isActive ? 'student-assignment-item student-assignment-item-active' : 'student-assignment-item'}
                    onClick={() => chooseAssignment(item.assignment_id)}
                  >
                    <div className="student-assignment-item-top">
                      <strong>{item.assignment?.lesson?.title ?? `Bài tập #${item.assignment_id}`}</strong>
                      <span className={isActive ? 'subject-pill pill-button-active' : 'subject-pill'}>
                        {statusLabelMap[item.status] ?? item.status}
                      </span>
                    </div>
                    <p className="student-assignment-caption">
                      {item.assignment?.lesson?.subject?.name ?? 'Chưa có môn học'} • Điểm {item.completion_score}
                    </p>
                    <div className="student-assignment-progress" style={{ ['--progress' as string]: `${item.progress_percent}%` }}>
                      <span />
                    </div>
                    <div className="student-assignment-meta">
                      <span>Tiến độ {item.progress_percent}%</span>
                      <span>{readinessLabelMap[item.readiness_status] ?? item.readiness_status}</span>
                    </div>
                  </button>
                )
              })}
              {!assignmentsQuery.data?.length && !assignmentsQuery.isLoading ? <p>Chưa có bài tập nào.</p> : null}
            </div>

            {selectedAssignment ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedAssignment.assignment?.lesson?.title ?? `Bài tập #${selectedAssignment.assignment_id}`}</strong>
                  <span>{statusLabelMap[selectedAssignment.status] ?? selectedAssignment.status}</span>
                </div>
                <p>Tiến độ: {selectedAssignment.progress_percent}% | Điểm: {selectedAssignment.completion_score}</p>
                <p>
                  Trạng thái sẵn sàng:{' '}
                  {readinessLabelMap[selectedAssignment.readiness_status] ?? selectedAssignment.readiness_status}
                </p>
              </div>
            ) : null}
          </article>

          <article className="roadmap-panel student-lesson-panel">
            <div className="student-panel-head">
              <div>
                <p className="eyebrow">Khu vực làm bài</p>
                <h3>Chi tiết bài học</h3>
                <p>Phần này được ưu tiên diện tích lớn hơn để em thao tác thoải mái khi làm các hoạt động.</p>
              </div>
              {detail ? (
                <span className="subject-pill">{detail.lesson?.subject?.name ?? 'Bài học'}</span>
              ) : (
                <span className="subject-pill muted-pill">Chưa chọn bài</span>
              )}
            </div>

            {detail ? (
              <div className="student-lesson-stack">
                <div className="student-lesson-hero">
                  <div className="detail-stack">
                    <p className="eyebrow">Bài đang mở</p>
                    <h3>{detail.lesson?.title ?? detail.assignment?.lesson?.title ?? `Bài tập #${detail.assignment_id}`}</h3>
                    <p>{detail.lesson?.description ?? 'Chưa có mô tả bài học.'}</p>
                  </div>

                  <div className="student-lesson-stats">
                    <article className="info-card">
                      <span>Tiến độ</span>
                      <strong>{liveProgressPercent}%</strong>
                    </article>
                    <article className="info-card">
                      <span>Điểm số</span>
                      <strong>{liveCompletionScore}</strong>
                    </article>
                    <article className="info-card">
                      <span>Trạng thái</span>
                      <strong>{statusLabelMap[detail.status] ?? detail.status}</strong>
                    </article>
                  </div>
                </div>

                {detail.readiness_reasons.length ? (
                  <div className="tag-wrap">
                    {detail.readiness_reasons.map((reason) => (
                      <span key={reason} className="subject-pill">
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                <section className="student-activity-stage">
                  <div className="student-activity-head">
                    <div>
                      <strong>Hoạt động trong bài</strong>
                      <p>{detail.lesson?.activities?.length ?? 0} hoạt động đang sẵn sàng cho em luyện tập.</p>
                    </div>
                    <span className="subject-pill muted-pill">{detail.lesson?.activities?.length ?? 0} hoạt động</span>
                  </div>

                  <div className="student-activity-list">
                    {detail.lesson?.activities?.map((activity) => (
                      <ActivityCard key={activity.id} activity={activity} answers={answers} setAnswers={setAnswersMap} />
                    ))}
                    {!detail.lesson?.activities?.length ? <p>Bài học này chưa có hoạt động nào.</p> : null}
                  </div>
                </section>

                <section className="student-learning-controls">
                  <article className="config-card">
                    <div className="detail-stack">
                      <h4>Thao tác học bài</h4>
                      <p className="helper-text">Em chỉ cần bắt đầu bài, làm các hoạt động và bấm hoàn thành khi đã xong hết.</p>
                    </div>

                    <div className="button-row">
                      <button
                        className="action-button"
                        type="button"
                        disabled={!effectiveSelectedAssignmentId || startMutation.isPending || detail.status === 'completed'}
                        onClick={() => startMutation.mutate()}
                      >
                        {startMutation.isPending ? 'Đang bắt đầu...' : detail.status === 'completed' ? 'Bài đã hoàn thành' : 'Bắt đầu bài học'}
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        disabled={!effectiveSelectedAssignmentId || completeMutation.isPending || detail.status === 'completed' || !activityProgress.readyToComplete}
                        onClick={() => completeMutation.mutate()}
                      >
                        {completeMutation.isPending ? 'Đang hoàn thành...' : 'Đánh dấu đã hoàn thành'}
                      </button>
                      <button className="ghost-button" type="button" onClick={closeLessonView}>
                        Quay về trang chủ
                      </button>
                    </div>

                    {(startMutation.error || completeMutation.error) ? (
                      <p className="error-text">
                        {(startMutation.error as Error)?.message ?? (completeMutation.error as Error)?.message}
                      </p>
                    ) : null}
                  </article>

                  <article className="config-card student-auto-progress-card">
                    <div className="detail-stack">
                      <h4>Tiến độ tự động</h4>
                      <p className="helper-text">Hệ thống tự cập nhật theo số hoạt động em đã làm, em không cần nhập tay nữa.</p>
                    </div>

                    <div className="student-auto-progress-summary">
                      <article className="info-card">
                        <span>Đã làm</span>
                        <strong>
                          {activityProgress.completedActivities}/{activityProgress.totalActivities || 0}
                        </strong>
                      </article>
                      <article className="info-card">
                        <span>Tiến độ hiện tại</span>
                        <strong>{liveProgressPercent}%</strong>
                      </article>
                    </div>

                    <div className="student-auto-progress-track" style={{ ['--progress' as string]: `${liveProgressPercent}%` }}>
                      <span />
                    </div>

                    <div className="student-auto-progress-note">
                      {activityProgress.readyToComplete ? (
                        <p>Tất cả hoạt động đã xong, em có thể bấm hoàn thành bài học.</p>
                      ) : (
                        <p>
                          Em còn {Math.max(activityProgress.totalActivities - activityProgress.completedActivities, 0)} hoạt động chưa hoàn tất.
                        </p>
                      )}
                    </div>
                  </article>
                </section>
              </div>
            ) : (
              <div className="student-empty-stage">
                <strong>Chọn một bài học để bắt đầu.</strong>
                <p>Danh sách bài tập nằm ở cột bên trái. Khi em chọn bài, toàn bộ hoạt động và trạng thái học sẽ hiện tại đây.</p>
              </div>
            )}
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
