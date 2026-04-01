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
          <h2>Dashboard phu huynh</h2>
          <p>
            Phu huynh co the theo doi tien do hoc tap cua con, tra giao vien bang <strong>teacher ID</strong> va nhan bao cao hang ngay do giao vien gui.
          </p>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thong tin tai khoan</h3>
            <div className="metrics-grid">
              <div className="mini-card">
                <span>Parent ID</span>
                <strong>{parentId ?? '---'}</strong>
              </div>
              <div className="mini-card">
                <span>Ho ten</span>
                <strong>{parentName}</strong>
              </div>
              <div className="mini-card">
                <span>So con dang theo doi</span>
                <strong>{childrenQuery.data?.length ?? 0}</strong>
              </div>
              <div className="mini-card">
                <span>Bao cao da nhan</span>
                <strong>{reportsQuery.data?.length ?? 0}</strong>
              </div>
            </div>
            <p>Gui parent ID nay cho giao vien de giao vien them quy vi vao nhom thong bao dung cua con.</p>
          </article>

          <article className="roadmap-panel">
            <h3>Tra giao vien bang teacher ID</h3>
            <div className="form-stack">
              <label>
                Teacher ID
                <input value={teacherIdInput} onChange={(event) => setTeacherIdInput(event.target.value)} inputMode="numeric" placeholder="Vi du: 3" />
              </label>
              <button className="action-button" type="button" disabled={!teacherIdInput || teacherLookupMutation.isPending} onClick={() => teacherLookupMutation.mutate()}>
                {teacherLookupMutation.isPending ? 'Dang tim...' : 'Tim giao vien'}
              </button>
              {teacherLookupMutation.error ? <p className="error-text">{(teacherLookupMutation.error as Error).message}</p> : null}
            </div>

            {teacherLookupMutation.data ? (
              <div className="student-row">
                <strong>{teacherLookupMutation.data.full_name}</strong>
                <span>Teacher ID {teacherLookupMutation.data.id}</span>
                <p>Truong: {teacherLookupMutation.data.school_name ?? 'Chua cap nhat'}</p>
                <p>Email: {teacherLookupMutation.data.email ?? 'Chua cap nhat'} | So dien thoai: {teacherLookupMutation.data.phone ?? 'Chua cap nhat'}</p>
                <p>Ghi chu: {teacherLookupMutation.data.note ?? 'Chua co ghi chu them.'}</p>
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
                    <span>Tong assignment</span>
                    <strong>{item.progress_summary.total_assignments}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Da xong</span>
                    <strong>{item.progress_summary.completed_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Dang hoc</span>
                    <strong>{item.progress_summary.in_progress_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Tien do gan nhat</span>
                    <strong>{item.progress_summary.last_progress_percent}%</strong>
                  </div>
                </div>
                <p>Bai hoc gan nhat: {item.progress_summary.last_assignment_title ?? 'Chua co assignment nao'}</p>
                <p>Readiness: {item.progress_summary.readiness_status}</p>
                <div className="tag-wrap">
                  {item.classes.map((classroom) => (
                    <span key={classroom.id} className="subject-pill">{classroom.name}</span>
                  ))}
                  {!item.classes.length ? <p>Chua duoc gan lop hoc nao.</p> : null}
                </div>
                <div className="tag-wrap">
                  {item.teachers.map((teacher) => (
                    <span key={teacher.id} className="subject-pill">GV {teacher.full_name} / ID {teacher.id}</span>
                  ))}
                  {!item.teachers.length ? <p>Chua co giao vien nao duoc gan cho hoc sinh nay.</p> : null}
                </div>
                <div className="student-list compact-list">
                  {studentReports.slice(0, 3).map((report) => (
                    <div key={report.id} className="student-row">
                      <strong>{report.title}</strong>
                      <span>{report.report_date}</span>
                      <p>{report.summary_text}</p>
                      {report.teacher_note ? <p>Ghi chu giao vien: {report.teacher_note}</p> : null}
                    </div>
                  ))}
                  {!studentReports.length ? <p>Chua co bao cao nao cho hoc sinh nay.</p> : null}
                </div>
              </article>
            )
          })}
          {!childrenQuery.data?.length && !childrenQuery.isLoading ? (
            <article className="roadmap-panel">
              <h3>Chua co lien ket nao</h3>
              <p>Giao vien can lien ket phu huynh voi hoc sinh truoc khi dashboard co du lieu.</p>
            </article>
          ) : null}
        </section>

        <section className="roadmap-panel">
          <h3>Tat ca bao cao da nhan</h3>
          <div className="student-list compact-list">
            {(reportsQuery.data ?? []).map((report) => (
              <div key={report.id} className="student-row">
                <strong>{report.student?.full_name ?? `Hoc sinh #${report.student_id}`}</strong>
                <span>{report.title} / {report.report_date}</span>
                <p>{report.summary_text}</p>
                <p>Khuyen nghi: {report.recommendation ?? 'Chua co'}</p>
                {report.teacher ? <p>Gui boi: {report.teacher.full_name} (Teacher ID {report.teacher.id})</p> : null}
              </div>
            ))}
            {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p>Chua co bao cao nao duoc gui toi tai khoan nay.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
