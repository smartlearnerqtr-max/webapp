import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { fetchParents, fetchStudents, fetchTeacherParentGroups, fetchTeacherReports, fetchTeacherSharedStudents, linkParentToStudent, sendDailyReports } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const quickLinks = [
  { to: '/hoc-sinh', title: 'Quan ly ho so hoc sinh', description: 'Xem va bo sung ho so hoc sinh phuc vu cho qua trinh day hoc.' },
  { to: '/lop-hoc', title: 'Quan ly lop hoc', description: 'Tao lop, lay ID lop va mat khau, gan mon hoc va theo doi hoc sinh vao lop.' },
  { to: '/bai-hoc', title: 'Xay dung bai hoc', description: 'Tao bai hoc, activity va cau hinh voice learning.' },
  { to: '/giao-bai', title: 'Giao bai', description: 'Giao bai cho lop va theo doi assignment dang hoat dong.' },
  { to: '/tien-do', title: 'Tien do', description: 'Xem readiness va quyet dinh co nen tang do kho hay khong.' },
  { to: '/cai-dat-ai', title: 'Cai dat AI', description: 'Luu Gemini key va test tro ly AI cho bai hoc.' },
]

export function TeacherHomePage() {
  const token = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedParentId, setSelectedParentId] = useState('')
  const [reportStudentId, setReportStudentId] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportNote, setReportNote] = useState('')

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const parentsQuery = useQuery({
    queryKey: ['parents', token],
    queryFn: () => fetchParents(token!),
    enabled: Boolean(token),
  })

  const parentGroupsQuery = useQuery({
    queryKey: ['teacher-parent-groups', token],
    queryFn: () => fetchTeacherParentGroups(token!),
    enabled: Boolean(token),
  })

  const reportsQuery = useQuery({
    queryKey: ['teacher-reports', token],
    queryFn: () => fetchTeacherReports(token!),
    enabled: Boolean(token),
  })

  const sharedStudentsQuery = useQuery({
    queryKey: ['teacher-shared-students', token],
    queryFn: () => fetchTeacherSharedStudents(token!),
    enabled: Boolean(token),
  })

  const linkedPairKeys = useMemo(
    () => new Set((parentGroupsQuery.data ?? []).map((item) => `${item.student?.id ?? 'x'}-${item.parent?.id ?? 'y'}`)),
    [parentGroupsQuery.data],
  )

  const availableParents = useMemo(() => {
    if (!selectedStudentId) return parentsQuery.data ?? []
    return (parentsQuery.data ?? []).filter((parent) => !linkedPairKeys.has(`${selectedStudentId}-${parent.id}`))
  }, [linkedPairKeys, parentsQuery.data, selectedStudentId])

  const selectedSharedStudent = useMemo(() => {
    if (!selectedStudentId) return null
    return (sharedStudentsQuery.data ?? []).find((item) => String(item.student.id) === selectedStudentId) ?? null
  }, [selectedStudentId, sharedStudentsQuery.data])

  const linkMutation = useMutation({
    mutationFn: () => linkParentToStudent(token!, Number(selectedStudentId), { parent_id: Number(selectedParentId) }),
    onSuccess: async () => {
      setSelectedParentId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-parent-groups', token] }),
        queryClient.invalidateQueries({ queryKey: ['parents', token] }),
        queryClient.invalidateQueries({ queryKey: ['teacher-shared-students', token] }),
      ])
    },
  })

  const reportMutation = useMutation({
    mutationFn: (studentId?: number) => sendDailyReports(token!, {
      student_id: studentId,
      title: reportTitle.trim() || undefined,
      note: reportNote.trim() || undefined,
    }),
    onSuccess: async () => {
      setReportTitle('')
      setReportNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-reports', token] }),
        queryClient.invalidateQueries({ queryKey: ['teacher-parent-groups', token] }),
      ])
    },
  })

  const teacherId = typeof profile?.['id'] === 'number' ? profile['id'] : null
  const studentCount = studentsQuery.data?.length ?? 0
  const parentGroupCount = parentGroupsQuery.data?.length ?? 0
  const reportCount = reportsQuery.data?.length ?? 0
  const sharedStudentCount = sharedStudentsQuery.data?.length ?? 0

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Khong gian giao vien</p>
          <h2>Trung tam dieu hanh lop hoc va phu huynh</h2>
          <p>
            Tai khoan giao vien do admin cap. Sau khi tao lop, giao vien gui <strong>ID lop</strong> va <strong>mat khau</strong> cho hoc sinh tu vao lop.
            Phu huynh co the tim giao vien qua <strong>teacher ID</strong>, giao vien chu dong them phu huynh vao nhom cua tung hoc sinh va gui bao cao hang ngay chi trong mot nut bam.
          </p>
        </section>

        <section className="metrics-grid">
          <article className="mini-card">
            <span>Teacher ID</span>
            <strong>{teacherId ?? '---'}</strong>
          </article>
          <article className="mini-card">
            <span>Hoc sinh dang quan ly</span>
            <strong>{studentCount}</strong>
          </article>
          <article className="mini-card">
            <span>Lien ket phu huynh</span>
            <strong>{parentGroupCount}</strong>
          </article>
          <article className="mini-card">
            <span>Bao cao da gui</span>
            <strong>{reportCount}</strong>
          </article>
          <article className="mini-card">
            <span>Hoc sinh hoc da GV</span>
            <strong>{sharedStudentCount}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Huong dan phoi hop</h3>
            <div className="detail-stack">
              <p>1. Tao lop trong muc Lop hoc de lay ID lop va mat khau cho hoc sinh.</p>
              <p>2. Yeu cau phu huynh gui cho giao vien parent ID cua tai khoan da dang ky.</p>
              <p>3. Chon hoc sinh va phu huynh o day de dua phu huynh vao dung nhom theo doi.</p>
              <p>4. Gui bao cao tung hoc sinh hoac gui tat ca phu huynh vao cuoi ngay.</p>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Gan phu huynh vao hoc sinh</h3>
            <div className="form-stack">
              <label>
                Hoc sinh
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                  <option value="">Chon hoc sinh</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name} - ID {student.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Phu huynh
                <select value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)} disabled={!selectedStudentId}>
                  <option value="">Chon phu huynh</option>
                  {availableParents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name} - ID {parent.id} {parent.email ? `- ${parent.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!selectedStudentId || !selectedParentId || linkMutation.isPending} onClick={() => linkMutation.mutate()}>
                {linkMutation.isPending ? 'Dang lien ket...' : 'Them vao nhom phu huynh'}
              </button>
              {selectedSharedStudent ? (
                <div className="detail-stack">
                  <p>Hoc sinh nay dang hoc voi {selectedSharedStudent.teachers.length} giao vien.</p>
                  <p>Giao vien khac: {selectedSharedStudent.peer_teachers.map((teacher) => teacher.full_name).join(', ') || 'Khong co'}</p>
                </div>
              ) : null}
              {linkMutation.error ? <p className="error-text">{(linkMutation.error as Error).message}</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Hoc sinh dang hoc voi nhieu giao vien</h3>
            <div className="student-list compact-list">
              {(sharedStudentsQuery.data ?? []).map((item) => (
                <button
                  key={item.student.id}
                  type="button"
                  className={selectedStudentId === String(item.student.id) ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                  onClick={() => setSelectedStudentId(String(item.student.id))}
                >
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level} | Lop voi minh: {item.my_active_class_count}</span>
                  <p>Phu huynh da vao nhom voi minh: {item.parent_group_count}</p>
                  <p>Dang hoc cung: {item.peer_teachers.map((teacher) => teacher.full_name).join(', ')}</p>
                </button>
              ))}
              {!sharedStudentsQuery.data?.length && !sharedStudentsQuery.isLoading ? <p>Chua co hoc sinh nao hoc cung giao vien khac.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Phoi hop theo hoc sinh dang chon</h3>
            {selectedSharedStudent ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedSharedStudent.student.full_name}</strong>
                  <span>Co {selectedSharedStudent.teachers.length} giao vien dang lien ket</span>
                </div>
                {selectedSharedStudent.teachers.map((teacher) => (
                  <div key={teacher.id} className="student-row">
                    <strong>{teacher.full_name}</strong>
                    <span>{teacher.is_current_teacher ? 'Giao vien hien tai' : 'Giao vien phoi hop'}</span>
                    <p>{teacher.school_name ?? 'Chua cap nhat truong'} | {teacher.email ?? teacher.phone ?? 'Chua co lien he'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>Chon mot hoc sinh trong danh sach ben trai de xem giao vien phoi hop.</p>
            )}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Gui bao cao hoc tap</h3>
            <div className="form-stack">
              <label>
                Gui theo hoc sinh (bo trong de gui tat ca)
                <select value={reportStudentId} onChange={(event) => setReportStudentId(event.target.value)}>
                  <option value="">Tat ca phu huynh dang lien ket</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Tieu de bao cao
                <input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} placeholder="Bo trong de dung tieu de mac dinh theo ngay" />
              </label>
              <label>
                Ghi chu giao vien
                <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} rows={4} placeholder="Vi du: Hom nay con tap trung tot hon va can nhac them khi doc cham." />
              </label>
              <div className="button-row">
                <button
                  className="action-button"
                  type="button"
                  disabled={reportMutation.isPending || !parentGroupCount}
                  onClick={() => reportMutation.mutate(reportStudentId ? Number(reportStudentId) : undefined)}
                >
                  {reportMutation.isPending ? 'Dang gui...' : reportStudentId ? 'Gui bao cao hoc sinh da chon' : 'Gui bao cao tat ca'}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={reportMutation.isPending || !parentGroupCount}
                  onClick={() => {
                    setReportStudentId('')
                    reportMutation.mutate(undefined)
                  }}
                >
                  Gui cho toan bo phu huynh
                </button>
              </div>
              {reportMutation.error ? <p className="error-text">{(reportMutation.error as Error).message}</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Nhom phu huynh dang theo doi</h3>
            <div className="student-list compact-list">
              {(parentGroupsQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.student?.full_name ?? 'Hoc sinh'}</strong>
                  <span>{item.parent?.full_name ?? 'Phu huynh'} - parent ID {item.parent?.id ?? '---'}</span>
                  <p>Tien do gan nhat: {item.progress_summary.last_progress_percent}% | readiness: {item.progress_summary.readiness_status}</p>
                  <p>Lop: {item.classes.map((classroom) => classroom.name).join(', ') || 'Chua vao lop nao'}</p>
                  <p>Bao cao cuoi: {item.latest_report?.report_date ?? 'Chua gui'}</p>
                </div>
              ))}
              {!parentGroupsQuery.data?.length && !parentGroupsQuery.isLoading ? <p>Chua co lien ket phu huynh nao.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Lich su gui bao cao</h3>
            <div className="student-list compact-list">
              {(reportsQuery.data ?? []).map((report) => (
                <div key={report.id} className="student-row">
                  <strong>{report.student?.full_name ?? `Hoc sinh #${report.student_id}`}</strong>
                  <span>{report.report_date} - {report.parent?.full_name ?? `Phu huynh #${report.parent_id}`}</span>
                  <p>{report.summary_text}</p>
                  {report.teacher_note ? <p>Ghi chu: {report.teacher_note}</p> : null}
                </div>
              ))}
              {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p>Chua co bao cao nao duoc gui.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Dieu huong nhanh</h3>
            <div className="detail-stack">
              {quickLinks.map((item) => (
                <div key={item.to} className="student-row">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                  <Link className="action-button" to={item.to}>
                    Mo chuc nang
                  </Link>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
