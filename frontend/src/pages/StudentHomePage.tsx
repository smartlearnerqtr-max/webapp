import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { completeMyAssignment, fetchMyAssignment, fetchMyAssignments, fetchMyClasses, fetchMyTeachers, joinClassByCredential, startMyAssignment, updateMyAssignmentProgress } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'
import { ActivityCard } from '../components/activities/ActivityRenderer'

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

const emptyProgressDraft = {
  progressPercent: '',
  completionScore: '',
  helpCount: '',
  retryCount: '',
  learningSeconds: '',
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
  const answers = { choiceAnswers, matchingAnswers, dragAnswers, stepAnswers, textAnswers, aacSelections }
  const setAnswersMap = { setChoiceAnswers, setMatchingAnswers, setDragAnswers, setStepAnswers, setTextAnswers, setAacSelections }
  return (
    <RequireAuth allowedRoles={['student']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Không gian học sinh</p>
          <h2>Hôm nay em học gì?</h2>
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
                  {detail.lesson?.activities?.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} answers={answers} setAnswers={setAnswersMap} />
                  ))}
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
