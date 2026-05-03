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
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow teacher-clean-title-label">Tiến độ</p>
            <h2>Theo dõi học tập tự động</h2>
            <p className="helper-text">Chọn một bài tập để xem dữ liệu học thật mà hệ thống tự đồng bộ từ quá trình làm bài của học sinh.</p>
          </div>
          <div className="teacher-clean-hero-badges">
             <span>{assignmentsQuery.data?.length || 0} Bài tập đã giao</span>
             <span>{progressQuery.data?.summary.student_count || 0} Học sinh theo dõi</span>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Cấu hình</p>
                <h3>Chọn bài tập cần xem</h3>
              </div>
            </div>
            <div className="form-stack">
              <label>
                Danh sách bài đã giao
                <select 
                  className="teacher-clean-select"
                  value={resolvedSelectedAssignmentId} 
                  onChange={(event) => setSelectedAssignmentId(event.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}
                >
                  <option value="">Chọn bài tập</option>
                  {assignmentsQuery.data?.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.lesson?.title ?? `Bài tập #${assignment.id}`} - {assignment.classroom?.name ?? 'Không rõ lớp'}
                    </option>
                  ))}
                </select>
              </label>

              <div className="config-card" style={{ background: '#f0f7ff', border: 'none' }}>
                <strong>Dữ liệu tự động 100%</strong>
                <p className="helper-text" style={{ color: '#335dc4' }}>
                  Hệ thống tự động chấm điểm và cập nhật tiến độ dựa trên tương tác thực tế của học sinh với bài học AI.
                </p>
              </div>
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Phân tích</p>
                <h3>Mức độ sẵn sàng (Readiness)</h3>
              </div>
            </div>
            {progressQuery.data ? (
              <DonutChartCard
                title=""
                description="Phân loại học sinh dựa trên hiệu suất làm bài và mức độ cần trợ giúp."
                items={readinessChartItems}
              />
            ) : (
              <p>Chọn bài tập để xem phân tích.</p>
            )}
          </article>
        </section>

        <section className="roadmap-panel">
           <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Chi tiết</p>
                <h3>Danh sách học sinh</h3>
              </div>
              {progressQuery.data && (
                <div className="teacher-clean-hero-badges" style={{ margin: 0 }}>
                  <span className="teacher-clean-metric-blue">{progressQuery.data.summary.completed_count} Xong</span>
                  <span className="teacher-clean-metric-gold">{progressQuery.data.summary.in_progress_count} Đang học</span>
                </div>
              )}
            </div>

          <div className="student-list compact-list" style={{ marginTop: '1.5rem' }}>
            {progressQuery.data?.progresses.map((progress) => (
              <div key={progress.id} className="progress-card" style={{ background: '#fff', border: '1px solid #f3f4f6', padding: '1.2rem', borderRadius: '16px', marginBottom: '1rem' }}>
                <div className="student-row" style={{ border: 'none', padding: 0, marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1.1rem' }}>{progress.student?.full_name ?? `Học sinh #${progress.student_id}`}</strong>
                  <span className={`subject-pill ${progress.status === 'completed' ? 'teacher-clean-metric-green' : 'muted-pill'}`}>
                    {progress.progress_percent}% - {statusLabelMap[progress.status] ?? progress.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: '#636e72', marginBottom: '0.8rem' }}>
                   <span>Readiness: <strong style={{ color: progress.readiness_status === 'can_ho_tro_them' ? '#ec6a55' : '#2a8f80' }}>{readinessLabelMap[progress.readiness_status] ?? progress.readiness_status}</strong></span>
                   <span>Điểm: <strong>{progress.completion_score}</strong></span>
                   <span>Trợ giúp: <strong>{progress.help_count}</strong></span>
                </div>
                <div className="tag-wrap">
                  {progress.readiness_reasons.map((reason) => (
                    <span key={reason} className="subject-pill muted-pill" style={{ fontSize: '0.75rem' }}>
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!progressQuery.data?.progresses.length && !progressQuery.isLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                <p>Bài tập này chưa có dữ liệu tiến độ từ học sinh.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
