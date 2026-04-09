import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { BarChartCard } from '../components/BarChartCard'
import { RequireAuth } from '../components/RequireAuth'
import {
  fetchParents,
  fetchStudents,
  fetchTeacherParentGroups,
  fetchTeacherReports,
  fetchTeacherSharedStudents,
  linkParentToStudent,
  sendDailyReports,
} from '../services/api'
import { useAuthStore } from '../store/authStore'

const quickLinks = [
  { to: '/hoc-sinh', title: 'Hồ sơ học sinh', description: 'Thêm và cập nhật thông tin học sinh.' },
  { to: '/lop-hoc', title: 'Lớp học', description: 'Tạo lớp, lấy mật khẩu và quản lý sĩ số.' },
  { to: '/bai-hoc', title: 'Bài học', description: 'Tạo bài học và hoạt động nhanh gọn.' },
  { to: '/giao-bai', title: 'Giao bài', description: 'Chọn lớp, bài học và giao trong vài bước.' },
  { to: '/tien-do', title: 'Tiến độ', description: 'Xem mức độ sẵn sàng và kết quả học tập.' },
  { to: '/cai-dat-ai', title: 'Cài đặt AI', description: 'Kiểm tra key và trợ lý AI.' },
]

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ thêm',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng nâng độ khó',
}

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

  const teacherId = typeof profile?.id === 'number' ? profile.id : null
  const studentCount = studentsQuery.data?.length ?? 0
  const parentGroupCount = parentGroupsQuery.data?.length ?? 0
  const reportCount = reportsQuery.data?.length ?? 0
  const sharedStudentCount = sharedStudentsQuery.data?.length ?? 0

  const teacherOverviewChartItems = [
    { label: 'Học sinh', value: studentCount, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
    { label: 'Liên kết phụ huynh', value: parentGroupCount, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
    { label: 'Báo cáo đã gửi', value: reportCount, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
    { label: 'Học cùng GV khác', value: sharedStudentCount, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
  ]

  const parentGroupProgressChartItems = useMemo(() => {
    const summary = (parentGroupsQuery.data ?? []).reduce(
      (accumulator, item) => {
        accumulator.totalAssignments += item.progress_summary.total_assignments
        accumulator.completedCount += item.progress_summary.completed_count
        accumulator.inProgressCount += item.progress_summary.in_progress_count
        return accumulator
      },
      { totalAssignments: 0, completedCount: 0, inProgressCount: 0 },
    )

    const remainingCount = Math.max(summary.totalAssignments - summary.completedCount - summary.inProgressCount, 0)

    return [
      { label: 'Tổng bài đang theo dõi', value: summary.totalAssignments, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
      { label: 'Đã hoàn thành', value: summary.completedCount, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
      { label: 'Đang học', value: summary.inProgressCount, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
      { label: 'Chưa bắt đầu', value: remainingCount, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
    ]
  }, [parentGroupsQuery.data])

  const readinessChartItems = useMemo(() => {
    const groups = parentGroupsQuery.data ?? []
    const readinessCounts = groups.reduce(
      (accumulator, item) => {
        const status = item.progress_summary.readiness_status
        if (status === 'can_ho_tro_them') accumulator.needSupport += 1
        if (status === 'dang_phu_hop') accumulator.onTrack += 1
        if (status === 'san_sang_nang_do_kho') accumulator.readyUp += 1
        return accumulator
      },
      { needSupport: 0, onTrack: 0, readyUp: 0 },
    )

    return [
      { label: 'Cần hỗ trợ', value: readinessCounts.needSupport, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
      { label: 'Đang phù hợp', value: readinessCounts.onTrack, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
      { label: 'Sẵn sàng tăng mức', value: readinessCounts.readyUp, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
    ]
  }, [parentGroupsQuery.data])

  const averageLatestProgress = useMemo(() => {
    const groups = parentGroupsQuery.data ?? []
    if (!groups.length) return 0

    const total = groups.reduce((sum, item) => sum + item.progress_summary.last_progress_percent, 0)
    return Math.round(total / groups.length)
  }, [parentGroupsQuery.data])

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Giáo viên</p>
          <h2>Trung tâm điều hành gọn gàng</h2>
          <p>Theo dõi lớp học, gắn phụ huynh và gửi báo cáo nhanh mà không cần đi qua quá nhiều form.</p>
        </section>

        <section className="metrics-grid">
          <article className="mini-card">
            <span>Teacher ID</span>
            <strong>{teacherId ?? '---'}</strong>
          </article>
          <article className="mini-card">
            <span>Học sinh</span>
            <strong>{studentCount}</strong>
          </article>
          <article className="mini-card">
            <span>Phụ huynh đã liên kết</span>
            <strong>{parentGroupCount}</strong>
          </article>
          <article className="mini-card">
            <span>Báo cáo đã gửi</span>
            <strong>{reportCount}</strong>
          </article>
          <article className="mini-card">
            <span>Học sinh học cùng GV khác</span>
            <strong>{sharedStudentCount}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Tổng quan nhanh</h3>
            <BarChartCard
              title="Thống kê hiện tại"
              description="Nhìn nhanh khối lượng quản lý trong ngày."
              items={teacherOverviewChartItems}
            />
          </article>

          <article className="roadmap-panel">
            <h3>Readiness</h3>
            <BarChartCard
              title="Mức độ sẵn sàng"
              description="Dùng để ưu tiên nhóm cần hỗ trợ trước."
              items={readinessChartItems}
              emptyMessage="Chưa có liên kết phụ huynh nên chưa có dữ liệu readiness."
            />
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Việc cần làm hôm nay</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>1. Tạo hoặc chọn lớp</strong>
                <span>Lấy ID lớp và mật khẩu cho học sinh vào lớp.</span>
              </div>
              <div className="student-row">
                <strong>2. Gắn phụ huynh</strong>
                <span>Chọn học sinh và parent ID đúng để theo dõi tiến độ.</span>
              </div>
              <div className="student-row">
                <strong>3. Gửi báo cáo</strong>
                <span>Gửi nhanh cho một học sinh hoặc toàn bộ phụ huynh.</span>
              </div>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Gắn phụ huynh vào học sinh</h3>
            <div className="form-stack">
              <label>
                Học sinh
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                  <option value="">Chọn học sinh</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name} - ID {student.id}</option>
                  ))}
                </select>
              </label>

              <label>
                Phụ huynh
                <select value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)} disabled={!selectedStudentId}>
                  <option value="">Chọn phụ huynh</option>
                  {availableParents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name} - ID {parent.id} {parent.email ? `- ${parent.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="action-button"
                type="button"
                disabled={!selectedStudentId || !selectedParentId || linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
              >
                {linkMutation.isPending ? 'Đang liên kết...' : 'Thêm vào nhóm phụ huynh'}
              </button>

              {selectedSharedStudent ? (
                <details className="config-card">
                  <summary className="simple-summary">Thông tin phối hợp</summary>
                  <p>Học sinh này đang học với {selectedSharedStudent.teachers.length} giáo viên.</p>
                  <p>Giáo viên khác: {selectedSharedStudent.peer_teachers.map((teacher) => teacher.full_name).join(', ') || 'Không có'}</p>
                </details>
              ) : null}

              {linkMutation.error ? <p className="error-text">{(linkMutation.error as Error).message}</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Gửi báo cáo học tập</h3>
            <div className="form-stack">
              <label>
                Gửi theo học sinh
                <select value={reportStudentId} onChange={(event) => setReportStudentId(event.target.value)}>
                  <option value="">Tất cả phụ huynh đang liên kết</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name}</option>
                  ))}
                </select>
              </label>

              <details className="config-card">
                <summary className="simple-summary">Tùy chọn thêm</summary>
                <label>
                  Tiêu đề báo cáo
                  <input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} placeholder="Bỏ trống để dùng tiêu đề mặc định" />
                </label>
                <label>
                  Ghi chú giáo viên
                  <textarea
                    value={reportNote}
                    onChange={(event) => setReportNote(event.target.value)}
                    rows={4}
                    placeholder="Viết ngắn gọn điều cần phụ huynh lưu ý."
                  />
                </label>
              </details>

              <div className="button-row">
                <button
                  className="action-button"
                  type="button"
                  disabled={reportMutation.isPending || !parentGroupCount}
                  onClick={() => reportMutation.mutate(reportStudentId ? Number(reportStudentId) : undefined)}
                >
                  {reportMutation.isPending ? 'Đang gửi...' : reportStudentId ? 'Gửi cho học sinh đã chọn' : 'Gửi tất cả'}
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
                  Gửi cho toàn bộ phụ huynh
                </button>
              </div>

              {reportMutation.error ? <p className="error-text">{(reportMutation.error as Error).message}</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Nhóm phụ huynh đang theo dõi</h3>
            <BarChartCard
              title="Tiến độ của nhóm phụ huynh"
              description="Tổng hợp assignment đang hiển thị bên phụ huynh."
              items={parentGroupProgressChartItems}
              emptyMessage="Chưa có liên kết phụ huynh nên chưa có tiến độ để hiển thị."
            />
            <p className="helper-text">Tiến độ gần nhất trung bình của nhóm: {averageLatestProgress}%.</p>
            <div className="student-list compact-list">
              {(parentGroupsQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.student?.full_name ?? 'Học sinh'}</strong>
                  <span>{item.parent?.full_name ?? 'Phụ huynh'} - parent ID {item.parent?.id ?? '---'}</span>
                  <p>Tiến độ gần nhất: {item.progress_summary.last_progress_percent}%</p>
                  <p>Readiness: {readinessLabelMap[item.progress_summary.readiness_status] ?? item.progress_summary.readiness_status}</p>
                  <p>Lớp: {item.classes.map((classroom) => classroom.name).join(', ') || 'Chưa vào lớp nào'}</p>
                </div>
              ))}
              {!parentGroupsQuery.data?.length && !parentGroupsQuery.isLoading ? <p>Chưa có liên kết phụ huynh nào.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Học sinh học cùng giáo viên khác</h3>
            <div className="student-list compact-list">
              {(sharedStudentsQuery.data ?? []).map((item) => (
                <button
                  key={item.student.id}
                  type="button"
                  className={selectedStudentId === String(item.student.id) ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                  onClick={() => setSelectedStudentId(String(item.student.id))}
                >
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level} | Lớp với mình: {item.my_active_class_count}</span>
                  <p>Phụ huynh đã vào nhóm với mình: {item.parent_group_count}</p>
                  <p>Đang học cùng: {item.peer_teachers.map((teacher) => teacher.full_name).join(', ')}</p>
                </button>
              ))}
              {!sharedStudentsQuery.data?.length && !sharedStudentsQuery.isLoading ? <p>Chưa có học sinh nào học cùng giáo viên khác.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Lịch sử báo cáo và điều hướng</h3>
            <div className="detail-stack">
              <details className="config-card" open>
                <summary className="simple-summary">Lịch sử báo cáo</summary>
                <div className="student-list compact-list">
                  {(reportsQuery.data ?? []).map((report) => (
                    <div key={report.id} className="student-row">
                      <strong>{report.student?.full_name ?? `Học sinh #${report.student_id}`}</strong>
                      <span>{report.report_date} - {report.parent?.full_name ?? `Phụ huynh #${report.parent_id}`}</span>
                      <p>{report.summary_text}</p>
                      {report.teacher_note ? <p>Ghi chú: {report.teacher_note}</p> : null}
                    </div>
                  ))}
                  {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p>Chưa có báo cáo nào được gửi.</p> : null}
                </div>
              </details>

              <details className="config-card">
                <summary className="simple-summary">Điều hướng nhanh</summary>
                <div className="detail-stack">
                  {quickLinks.map((item) => (
                    <div key={item.to} className="student-row">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <Link className="action-button" to={item.to}>
                        Mở chức năng
                      </Link>
                    </div>
                  ))}
                </div>
              </details>

              {selectedSharedStudent ? (
                <details className="config-card">
                  <summary className="simple-summary">Danh sách giáo viên phối hợp</summary>
                  <div className="detail-stack">
                    {selectedSharedStudent.teachers.map((teacher) => (
                      <div key={teacher.id} className="student-row">
                        <strong>{teacher.full_name}</strong>
                        <span>{teacher.is_current_teacher ? 'Giáo viên hiện tại' : 'Giáo viên phối hợp'}</span>
                        <p>{teacher.school_name ?? 'Chưa cập nhật trường'} | {teacher.email ?? teacher.phone ?? 'Chưa có liên hệ'}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
