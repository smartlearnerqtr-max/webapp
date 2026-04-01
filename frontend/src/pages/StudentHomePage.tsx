import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { completeMyAssignment, fetchMyAssignment, fetchMyAssignments, fetchMyClasses, fetchMyTeachers, joinClassByCredential, startMyAssignment, updateMyAssignmentProgress } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const statusLabelMap: Record<string, string> = {
  not_started: 'Chua bat dau',
  in_progress: 'Dang hoc',
  completed: 'Da hoan thanh',
}

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Can ho tro them',
  dang_phu_hop: 'Dang phu hop',
  san_sang_nang_do_kho: 'San sang nang do kho',
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

  return (
    <RequireAuth allowedRoles={['student']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Khong gian hoc sinh</p>
          <h2>Hom nay em hoc gi?</h2>
          <p>
            Hoc sinh co the tu vao lop bang <strong>ID lop</strong> va <strong>mat khau</strong> do giao vien gui, sau do xem bai duoc giao,
            mo chi tiet bai hoc, bat dau hoc va cap nhat tien do ngay tai day. Neu hoc voi nhieu giao vien, he thong se hien day du trong mot dashboard duy nhat.
          </p>
        </section>

        <section className="metrics-grid">
          <article className="mini-card">
            <span>Tong assignment</span>
            <strong>{totalAssignments}</strong>
          </article>
          <article className="mini-card">
            <span>Dang hoc</span>
            <strong>{inProgressCount}</strong>
          </article>
          <article className="mini-card">
            <span>Da xong</span>
            <strong>{completedCount}</strong>
          </article>
          <article className="mini-card">
            <span>So giao vien</span>
            <strong>{myTeachersQuery.data?.length ?? 0}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thong tin hoc sinh</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>{typeof profile?.['full_name'] === 'string' ? String(profile['full_name']) : user?.email ?? 'Hoc sinh'}</strong>
                <span>
                  {typeof profile?.['preferred_input'] === 'string' ? String(profile['preferred_input']) : 'touch'} / {' '}
                  {typeof profile?.['preferred_font_size'] === 'string' ? String(profile['preferred_font_size']) : 'medium'}
                </span>
              </div>
              <p>Muc do: {typeof profile?.['disability_level'] === 'string' ? String(profile['disability_level']) : 'chua ro'}</p>
              <p>Ghi chu ho tro: {typeof profile?.['support_note'] === 'string' ? String(profile['support_note']) : 'Chua co ghi chu ho tro.'}</p>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Giao vien dang day em</h3>
            <div className="student-list compact-list">
              {(myTeachersQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.teacher.full_name}</strong>
                  <span>Teacher ID {item.teacher.id} / {item.teacher.school_name ?? 'Chua cap nhat truong'}</span>
                  <p>Email: {item.teacher.email ?? 'Chua cap nhat'} | So dien thoai: {item.teacher.phone ?? 'Chua cap nhat'}</p>
                  <p>So lop dang hoc voi giao vien nay: {item.active_class_count}</p>
                </div>
              ))}
              {!myTeachersQuery.data?.length && !myTeachersQuery.isLoading ? <p>Em chua lien ket voi giao vien nao.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Tham gia lop hoc</h3>
            <div className="form-stack">
              <label>
                ID lop
                <input value={joinClassId} onChange={(event) => setJoinClassId(event.target.value)} inputMode="numeric" placeholder="Vi du: 12" />
              </label>
              <label>
                Mat khau vao lop
                <input value={joinClassPassword} onChange={(event) => setJoinClassPassword(event.target.value.toUpperCase())} placeholder="Vi du: AB12CD34" />
              </label>
              <button className="action-button" type="button" disabled={!joinClassId || !joinClassPassword || joinClassMutation.isPending} onClick={() => joinClassMutation.mutate()}>
                {joinClassMutation.isPending ? 'Dang vao lop...' : 'Vao lop'}
              </button>
              {joinClassMutation.error ? <p className="error-text">{(joinClassMutation.error as Error).message}</p> : null}
            </div>
            <div className="tag-wrap">
              {(myClassesQuery.data ?? []).map((classroom) => (
                <span key={classroom.id} className="subject-pill">{classroom.name} / GV {classroom.teacher_id}</span>
              ))}
              {!myClassesQuery.data?.length && !myClassesQuery.isLoading ? <p>Em chua tham gia lop hoc nao.</p> : null}
            </div>
            {joinedClassesLabel.length ? <p>Danh sach lop hien tai: {joinedClassesLabel.join(', ')}</p> : null}
          </article>

          <article className="roadmap-panel">
            <h3>Bai gan nhat</h3>
            {latestAssignment ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{latestAssignment.assignment?.lesson?.title ?? `Assignment #${latestAssignment.assignment_id}`}</strong>
                  <span>{statusLabelMap[latestAssignment.status] ?? latestAssignment.status}</span>
                </div>
                <p>Tien do: {latestAssignment.progress_percent}%</p>
                <p>Readiness: {readinessLabelMap[latestAssignment.readiness_status] ?? latestAssignment.readiness_status}</p>
              </div>
            ) : (
              <p>Chua co bai hoc nao duoc giao cho tai khoan nay.</p>
            )}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Danh sach bai hoc duoc giao</h3>
            <div className="student-list compact-list">
              {assignmentsQuery.data?.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={effectiveSelectedAssignmentId === item.assignment_id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => chooseAssignment(item.assignment_id)}
                >
                  {item.assignment?.lesson?.title ?? `Assignment #${item.assignment_id}`}
                </button>
              ))}
              {!assignmentsQuery.data?.length && !assignmentsQuery.isLoading ? <p>Chua co assignment nao.</p> : null}
            </div>

            {selectedAssignment ? (
              <div className="detail-stack" style={{ marginTop: '1rem' }}>
                <div className="student-row">
                  <strong>{selectedAssignment.assignment?.lesson?.title ?? `Assignment #${selectedAssignment.assignment_id}`}</strong>
                  <span>{statusLabelMap[selectedAssignment.status] ?? selectedAssignment.status}</span>
                </div>
                <p>Tien do: {selectedAssignment.progress_percent}% | Diem: {selectedAssignment.completion_score}</p>
                <p>Readiness: {readinessLabelMap[selectedAssignment.readiness_status] ?? selectedAssignment.readiness_status}</p>
              </div>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Chi tiet bai hoc</h3>
            {detail ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{detail.lesson?.title ?? detail.assignment?.lesson?.title ?? `Assignment #${detail.assignment_id}`}</strong>
                  <span>{detail.lesson?.subject?.name ?? 'Chua co mon hoc'} / {statusLabelMap[detail.status] ?? detail.status}</span>
                </div>
                <p>{detail.lesson?.description ?? 'Chua co mo ta bai hoc.'}</p>
                <p>Tien do hien tai: {detail.progress_percent}% | Diem: {detail.completion_score}</p>
                <div className="tag-wrap">
                  {detail.readiness_reasons.map((reason) => (
                    <span key={reason} className="subject-pill">{reason}</span>
                  ))}
                </div>
                <div className="student-list compact-list">
                  {detail.lesson?.activities?.map((activity) => (
                    <div key={activity.id} className="student-row">
                      <strong>{activity.sort_order}. {activity.title}</strong>
                      <span>{activity.activity_type} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
                      <p>{activity.instruction_text ?? 'Chua co huong dan.'}</p>
                    </div>
                  ))}
                  {!detail.lesson?.activities?.length ? <p>Bai hoc nay chua co activity nao.</p> : null}
                </div>
              </div>
            ) : (
              <p>Hay chon mot bai hoc de xem chi tiet.</p>
            )}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thao tac hoc bai</h3>
            <div className="button-row">
              <button className="action-button" type="button" disabled={!effectiveSelectedAssignmentId || startMutation.isPending} onClick={() => startMutation.mutate()}>
                {startMutation.isPending ? 'Dang bat dau...' : 'Bat dau bai hoc'}
              </button>
              <button className="ghost-button" type="button" disabled={!effectiveSelectedAssignmentId} onClick={() => applyPreset({
                progressPercent: '50',
                completionScore: '65',
                helpCount: '1',
                retryCount: '0',
                learningSeconds: '180',
              })}>
                Muc trung binh
              </button>
              <button className="ghost-button" type="button" disabled={!effectiveSelectedAssignmentId} onClick={() => applyPreset({
                progressPercent: '100',
                completionScore: '95',
                helpCount: '0',
                retryCount: '0',
                learningSeconds: '240',
              })}>
                Muc hoan thanh tot
              </button>
            </div>
            {(startMutation.error || updateMutation.error || completeMutation.error) ? (
              <p className="error-text">{(startMutation.error as Error)?.message ?? (updateMutation.error as Error)?.message ?? (completeMutation.error as Error)?.message}</p>
            ) : null}
          </article>

          <article className="roadmap-panel">
            <h3>Cap nhat tien do</h3>
            <div className="form-stack">
              <label>
                Phan tram tien do
                <input value={resolvedProgressPercent} onChange={(event) => setDraftField('progressPercent', event.target.value)} inputMode="numeric" />
              </label>
              <label>
                Diem hoan thanh
                <input value={resolvedCompletionScore} onChange={(event) => setDraftField('completionScore', event.target.value)} inputMode="numeric" />
              </label>
              <label>
                So lan can tro giup
                <input value={resolvedHelpCount} onChange={(event) => setDraftField('helpCount', event.target.value)} inputMode="numeric" />
              </label>
              <label>
                So lan hoc lai
                <input value={resolvedRetryCount} onChange={(event) => setDraftField('retryCount', event.target.value)} inputMode="numeric" />
              </label>
              <label>
                Tong so giay hoc
                <input value={resolvedLearningSeconds} onChange={(event) => setDraftField('learningSeconds', event.target.value)} inputMode="numeric" />
              </label>
              <div className="button-row">
                <button className="action-button" type="button" disabled={!effectiveSelectedAssignmentId || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                  {updateMutation.isPending ? 'Dang luu...' : 'Luu tien do'}
                </button>
                <button className="action-button" type="button" disabled={!effectiveSelectedAssignmentId || completeMutation.isPending} onClick={() => completeMutation.mutate()}>
                  {completeMutation.isPending ? 'Dang hoan thanh...' : 'Danh dau da hoan thanh'}
                </button>
              </div>
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
