import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { fetchParentChildren, fetchParentReports, fetchTeacherByIdForParent } from '../services/api'
import type { ParentReportItem } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

export function ParentPage() {
  const token = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const [teacherIdInput, setTeacherIdInput] = useState('')

  const childrenQuery = useQuery({
    queryKey: ['parent-children', token],
    queryFn: () => fetchParentChildren(token!),
    enabled: Boolean(token),
  })

  const reportsQuery = useQuery({
    queryKey: ['parent-reports', token],
    queryFn: () => fetchParentReports(token!),
    enabled: Boolean(token),
  })

  const teacherLookupMutation = useMutation({
    mutationFn: () => fetchTeacherByIdForParent(token!, Number(teacherIdInput)),
  })

  const reportsByStudent = useMemo(() => {
    const grouped = new Map<number, ParentReportItem[]>()
    for (const report of reportsQuery.data ?? []) {
      const current = grouped.get(report.student_id) ?? []
      grouped.set(report.student_id, [...current, report])
    }
    return grouped
  }, [reportsQuery.data])

  const parentId = typeof profile?.['id'] === 'number' ? profile['id'] : null
  const parentName = typeof profile?.['full_name'] === 'string' ? String(profile['full_name']) : 'Phu huynh'

  return (
    <RequireAuth allowedRoles={['parent']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Dashboard phụ huynh</h2>
          <p>
            Phụ huynh có thể theo dõi tiến độ học tập của con, tra giáo viên bằng <strong>teacher ID</strong> và nhận báo cáo hàng ngày do giáo viên gửi.
          </p>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thông tin tài khoản</h3>
            <div className="metrics-grid">
              <div className="mini-card">
                <span>Parent ID</span>
                <strong>{parentId ?? '---'}</strong>
              </div>
              <div className="mini-card">
                <span>Họ tên</span>
                <strong>{parentName}</strong>
              </div>
              <div className="mini-card">
                <span>Số con đang theo dõi</span>
                <strong>{childrenQuery.data?.length ?? 0}</strong>
              </div>
              <div className="mini-card">
                <span>Báo cáo đã nhận</span>
                <strong>{reportsQuery.data?.length ?? 0}</strong>
              </div>
            </div>
            <p>Gửi parent ID này cho giáo viên để giáo viên thêm quý vị vào nhóm thông báo đúng của con.</p>
          </article>

          <article className="roadmap-panel">
            <h3>Tra giáo viên bằng teacher ID</h3>
            <div className="form-stack">
              <label>
                Teacher ID
                <input value={teacherIdInput} onChange={(event) => setTeacherIdInput(event.target.value)} inputMode="numeric" placeholder="Ví dụ: 3" />
              </label>
              <button className="action-button" type="button" disabled={!teacherIdInput || teacherLookupMutation.isPending} onClick={() => teacherLookupMutation.mutate()}>
                {teacherLookupMutation.isPending ? 'Đang tìm...' : 'Tìm giáo viên'}
              </button>
              {teacherLookupMutation.error ? <p className="error-text">{(teacherLookupMutation.error as Error).message}</p> : null}
            </div>

            {teacherLookupMutation.data ? (
              <div className="student-row">
                <strong>{teacherLookupMutation.data.full_name}</strong>
                <span>Teacher ID {teacherLookupMutation.data.id}</span>
                <p>Trường: {teacherLookupMutation.data.school_name ?? 'Chưa cập nhật'}</p>
                <p>Email: {teacherLookupMutation.data.email ?? 'Chưa cập nhật'} | Số điện thoại: {teacherLookupMutation.data.phone ?? 'Chưa cập nhật'}</p>
                <p>Ghi chú: {teacherLookupMutation.data.note ?? 'Chưa có ghi chú thêm.'}</p>
              </div>
            ) : null}
          </article>
        </section>

        <section className="dashboard-grid">
          {childrenQuery.data?.map((item) => {
            const studentReports = reportsByStudent.get(item.student.id) ?? []
            return (
              <article key={item.student.id} className="roadmap-panel">
                <div className="student-row">
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level} / {item.student.preferred_input}</span>
                </div>
                <div className="metrics-grid">
                  <div className="info-card mini-card">
                    <span>Tổng assignment</span>
                    <strong>{item.progress_summary.total_assignments}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Đã xong</span>
                    <strong>{item.progress_summary.completed_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Đang học</span>
                    <strong>{item.progress_summary.in_progress_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Tiến độ gần nhất</span>
                    <strong>{item.progress_summary.last_progress_percent}%</strong>
                  </div>
                </div>
                <p>Bài học gần nhất: {item.progress_summary.last_assignment_title ?? 'Chưa có assignment nào'}</p>
                <p>Readiness: {item.progress_summary.readiness_status}</p>
                <div className="tag-wrap">
                  {item.classes.map((classroom) => (
                    <span key={classroom.id} className="subject-pill">{classroom.name}</span>
                  ))}
                  {!item.classes.length ? <p>Chưa được gắn lớp học nào.</p> : null}
                </div>
                <div className="tag-wrap">
                  {item.teachers.map((teacher) => (
                    <span key={teacher.id} className="subject-pill">GV {teacher.full_name} / ID {teacher.id}</span>
                  ))}
                  {!item.teachers.length ? <p>Chưa có giáo viên nào được gắn cho học sinh này.</p> : null}
                </div>
                <div className="student-list compact-list">
                  {studentReports.slice(0, 3).map((report) => (
                    <div key={report.id} className="student-row">
                      <strong>{report.title}</strong>
                      <span>{report.report_date}</span>
                      <p>{report.summary_text}</p>
                      {report.teacher_note ? <p>Ghi chú giáo viên: {report.teacher_note}</p> : null}
                    </div>
                  ))}
                  {!studentReports.length ? <p>Chưa có báo cáo nào cho học sinh này.</p> : null}
                </div>
              </article>
            )
          })}
          {!childrenQuery.data?.length && !childrenQuery.isLoading ? (
            <article className="roadmap-panel">
              <h3>Chưa có liên kết nào</h3>
              <p>Giáo viên cần liên kết phụ huynh với học sinh trước khi dashboard có dữ liệu.</p>
            </article>
          ) : null}
        </section>

        <section className="roadmap-panel">
          <h3>Tất cả báo cáo đã nhận</h3>
          <div className="student-list compact-list">
            {(reportsQuery.data ?? []).map((report) => (
              <div key={report.id} className="student-row">
                <strong>{report.student?.full_name ?? `Học sinh #${report.student_id}`}</strong>
                <span>{report.title} / {report.report_date}</span>
                <p>{report.summary_text}</p>
                <p>Khuyến nghị: {report.recommendation ?? 'Chưa có'}</p>
                {report.teacher ? <p>Gửi bởi: {report.teacher.full_name} (Teacher ID {report.teacher.id})</p> : null}
              </div>
            ))}
            {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p>Chưa có báo cáo nào được gửi tới tài khoản này.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
