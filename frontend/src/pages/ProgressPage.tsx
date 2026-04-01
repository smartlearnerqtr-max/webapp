import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAssignmentProgress, fetchAssignments } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Can ho tro them',
  dang_phu_hop: 'Dang phu hop',
  san_sang_nang_do_kho: 'San sang nang do kho',
}

export function ProgressPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')

  const assignmentsQuery = useQuery({
    queryKey: ['assignments', token],
    queryFn: () => fetchAssignments(token!),
    enabled: Boolean(token),
  })

  const resolvedSelectedAssignmentId = selectedAssignmentId || String(assignmentsQuery.data?.[0]?.id ?? '')

  const progressQuery = useQuery({
    queryKey: ['assignment-progress', token, resolvedSelectedAssignmentId],
    queryFn: () => fetchAssignmentProgress(token!, Number(resolvedSelectedAssignmentId)),
    enabled: Boolean(token && resolvedSelectedAssignmentId),
  })

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Tien do hoc tap va goi y nang do kho</h2>
          <p>Readiness chi la goi y cho giao vien. He thong khong tu dong nang do kho, nhung se tong hop nhung dau hieu de ban quyet dinh.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Chon assignment</h3>
            <div className="form-stack">
              <label>
                Assignment can xem
                <select value={resolvedSelectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
                  <option value="">Chon assignment</option>
                  {assignmentsQuery.data?.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>{assignment.lesson?.title ?? `Assignment #${assignment.id}`} - {assignment.classroom?.name ?? 'Khong ro lop'}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Tong quan</h3>
            {progressQuery.data ? (
              <div className="metrics-grid">
                <div className="info-card mini-card">
                  <span>Hoc sinh</span>
                  <strong>{progressQuery.data.summary.student_count}</strong>
                </div>
                <div className="info-card mini-card">
                  <span>Da xong</span>
                  <strong>{progressQuery.data.summary.completed_count}</strong>
                </div>
                <div className="info-card mini-card">
                  <span>Can ho tro</span>
                  <strong>{progressQuery.data.summary.need_support_count}</strong>
                </div>
                <div className="info-card mini-card">
                  <span>San sang tang muc</span>
                  <strong>{progressQuery.data.summary.ready_to_increase_count}</strong>
                </div>
              </div>
            ) : (
              <p>Chon assignment de xem tong quan tien do.</p>
            )}
          </article>
        </section>

        <section className="roadmap-panel">
          <h3>Chi tiet theo hoc sinh</h3>
          <div className="student-list compact-list">
            {progressQuery.data?.progresses.map((progress) => (
              <div key={progress.id} className="progress-card">
                <div className="student-row">
                  <strong>{progress.student?.full_name ?? `Hoc sinh #${progress.student_id}`}</strong>
                  <span>{progress.progress_percent}% / {progress.status}</span>
                </div>
                <p>
                  Readiness: <strong>{readinessLabelMap[progress.readiness_status] ?? progress.readiness_status}</strong>
                </p>
                <p>Diem hoan thanh: {progress.completion_score} | Tro giup: {progress.help_count} | Hoc lai: {progress.retry_count}</p>
                <div className="tag-wrap">
                  {progress.readiness_reasons.map((reason) => (
                    <span key={reason} className="subject-pill muted-pill">{reason}</span>
                  ))}
                </div>
              </div>
            ))}
            {!progressQuery.data?.progresses.length && !progressQuery.isLoading ? <p>Assignment nay chua co du lieu tien do.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
