import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { DonutChartCard } from '../components/DonutChartCard'
import { fetchAssignmentProgress, fetchAssignments } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ thêm',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng nâng độ khó',
}

const statusLabelMap: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
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

  const readinessChartItems = useMemo(() => {
    if (!progressQuery.data?.progresses.length) return []

    const readinessCounts = progressQuery.data.progresses.reduce(
      (result, progress) => {
        if (progress.readiness_status === 'can_ho_tro_them') result.needSupport += 1
        else if (progress.readiness_status === 'san_sang_nang_do_kho') result.readyUp += 1
        else result.onTrack += 1
        return result
      },
      { needSupport: 0, onTrack: 0, readyUp: 0 },
    )

    return [
      { label: 'Cần hỗ trợ', value: readinessCounts.needSupport, color: '#ec6a55', hint: 'Ưu tiên hỗ trợ, nhắc lại hoặc giảm độ khó.' },
      { label: 'Đang phù hợp', value: readinessCounts.onTrack, color: '#335dc4', hint: 'Nhóm học sinh đang học ổn ở mức hiện tại.' },
      { label: 'Sẵn sàng tăng mức', value: readinessCounts.readyUp, color: '#2a8f80', hint: 'Có thể cân nhắc giao bài khó hơn hoặc nâng mục tiêu.' },
    ]
  }, [progressQuery.data])

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Tiến độ</p>
          <h2>Theo dõi học tập tự động</h2>
          <p>Chọn một bài tập để xem dữ liệu học thật mà hệ thống tự đồng bộ từ quá trình làm bài của học sinh.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Chọn bài tập</h3>
            <div className="form-stack">
              <label>
                Bài tập cần xem
                <select value={resolvedSelectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
                  <option value="">Chọn bài tập</option>
                  {assignmentsQuery.data?.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.lesson?.title ?? `Bài tập #${assignment.id}`} - {assignment.classroom?.name ?? 'Không rõ lớp'}
                    </option>
                  ))}
                </select>
              </label>

              <div className="config-card">
                <strong>Dữ liệu ở đây là tự động</strong>
                <p className="helper-text">
                  Giáo viên không cần nhập tay phần trăm tiến độ hay điểm số. Hệ thống lấy từ hoạt động học sinh đã hoàn thành.
                </p>
              </div>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Tổng quan</h3>
            {progressQuery.data ? (
              <>
                <div className="metrics-grid">
                  <div className="mini-card">
                    <span>Học sinh</span>
                    <strong>{progressQuery.data.summary.student_count}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Đã xong</span>
                    <strong>{progressQuery.data.summary.completed_count}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Đang học</span>
                    <strong>{progressQuery.data.summary.in_progress_count}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Cần hỗ trợ</span>
                    <strong>{progressQuery.data.summary.need_support_count}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Sẵn sàng tăng mức</span>
                    <strong>{progressQuery.data.summary.ready_to_increase_count}</strong>
                  </div>
                </div>
                <DonutChartCard
                  title="Biểu đồ readiness"
                  description="Nhìn nhanh nhóm học sinh cần hỗ trợ, đang phù hợp và sẵn sàng tăng độ khó."
                  items={readinessChartItems}
                />
              </>
            ) : (
              <p>Chọn bài tập để xem tổng quan tiến độ.</p>
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
                  <span>{progress.progress_percent}% / {statusLabelMap[progress.status] ?? progress.status}</span>
                </div>
                <p>
                  Readiness: <strong>{readinessLabelMap[progress.readiness_status] ?? progress.readiness_status}</strong>
                </p>
                <p>Điểm hoàn thành: {progress.completion_score} | Trợ giúp: {progress.help_count} | Học lại: {progress.retry_count}</p>
                <div className="tag-wrap">
                  {progress.readiness_reasons.map((reason) => (
                    <span key={reason} className="subject-pill muted-pill">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!progressQuery.data?.progresses.length && !progressQuery.isLoading ? <p>Bài tập này chưa có dữ liệu tiến độ.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
