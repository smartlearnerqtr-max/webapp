import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAssignmentProgress, fetchAssignments } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ thêm',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng nâng độ khó',
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
          <h2>Tiến độ học tập và gợi ý nâng độ khó</h2>
          <p>Readiness chỉ là gợi ý cho giáo viên. Hệ thống không tự động nâng độ khó, nhưng sẽ tổng hợp những dấu hiệu để bạn quyết định.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Chọn assignment</h3>
            <div className="form-stack">
              <label>
                Assignment cần xem
                <select value={resolvedSelectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
                  <option value="">Chọn assignment</option>
                  {assignmentsQuery.data?.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>{assignment.lesson?.title ?? `Assignment #${assignment.id}`} - {assignment.classroom?.name ?? 'Không rõ lớp'}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Tổng quan</h3>
            {progressQuery.data ? (
              <div className="metrics-grid">
                <div className="info-card mini-card">
                  <span>Học sinh</span>
                  <strong>{progressQuery.data.summary.student_count}</strong>
                </div>
                <div className="info-card mini-card">
                  <span>Đã xong</span>
                  <strong>{progressQuery.data.summary.completed_count}</strong>
                </div>
                <div className="info-card mini-card">
                  <span>Cần hỗ trợ</span>
                  <strong>{progressQuery.data.summary.need_support_count}</strong>
                </div>
                <div className="info-card mini-card">
                  <span>Sẵn sàng tăng mức</span>
                  <strong>{progressQuery.data.summary.ready_to_increase_count}</strong>
                </div>
              </div>
            ) : (
              <p>Chọn assignment để xem tổng quan tiến độ.</p>
            )}
          </article>
        </section>

        <section className="roadmap-panel">
          <h3>Chi tiết theo học sinh</h3>
          <div className="student-list compact-list">
            {progressQuery.data?.progresses.map((progress) => (
              <div key={progress.id} className="progress-card">
                <div className="student-row">
                  <strong>{progress.student?.full_name ?? `Học sinh #${progress.student_id}`}</strong>
                  <span>{progress.progress_percent}% / {progress.status}</span>
                </div>
                <p>
                  Readiness: <strong>{readinessLabelMap[progress.readiness_status] ?? progress.readiness_status}</strong>
                </p>
                <p>Điểm hoàn thành: {progress.completion_score} | Trợ giúp: {progress.help_count} | Học lại: {progress.retry_count}</p>
                <div className="tag-wrap">
                  {progress.readiness_reasons.map((reason) => (
                    <span key={reason} className="subject-pill muted-pill">{reason}</span>
                  ))}
                </div>
              </div>
            ))}
            {!progressQuery.data?.progresses.length && !progressQuery.isLoading ? <p>Assignment này chưa có dữ liệu tiến độ.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
