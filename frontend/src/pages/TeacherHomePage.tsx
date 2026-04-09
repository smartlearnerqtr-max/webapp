import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { BarChartCard } from '../components/BarChartCard'
import { ChatDock } from '../components/ChatDock'
import { RequireAuth } from '../components/RequireAuth'
import {
  fetchParents,
  fetchStudents,
  fetchTeacherMessages,
  fetchTeacherParentGroups,
  fetchTeacherReports,
  fetchTeacherSharedStudents,
  linkParentToStudent,
  markTeacherMessagesRead,
  sendDailyReports,
  sendTeacherMessage,
} from '../services/api'
import type { ParentTeacherConversationItem } from '../services/api'
import { useAuthStore } from '../store/authStore'

const quickLinks = [
  { to: '/hoc-sinh', title: 'Hồ sơ học sinh', description: 'Thêm và cập nhật thông tin nền của học sinh.' },
  { to: '/lop-hoc', title: 'Lớp học', description: 'Tạo lớp, lấy mã vào lớp và quản lý sĩ số.' },
  { to: '/bai-hoc', title: 'Bài học', description: 'Tạo bài học và hoạt động theo từng bước dễ nhập.' },
  { to: '/giao-bai', title: 'Giao bài', description: 'Chọn lớp, chọn bài học rồi giao trong vài thao tác.' },
  { to: '/tien-do', title: 'Tiến độ', description: 'Theo dõi dữ liệu học tập mà hệ thống tự cập nhật từ học sinh.' },
  { to: '/cai-dat-ai', title: 'Cài đặt AI', description: 'Kiểm tra trợ lý AI và trạng thái kết nối.' },
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
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedConversationKey, setSelectedConversationKey] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [selectedChatStudentId, setSelectedChatStudentId] = useState('')
  const [conversationSearchTerm, setConversationSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(conversationSearchTerm)

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

  const conversationsQuery = useQuery({
    queryKey: ['teacher-messages', token],
    queryFn: () => fetchTeacherMessages(token!),
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
        queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] }),
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

  const conversations = conversationsQuery.data ?? []
  const unreadConversationCount = conversations.reduce((count, item) => count + item.unread_count, 0)

  const conversationStudentOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const conversation of conversations) {
      if (conversation.student) {
        options.set(String(conversation.student.id), conversation.student.full_name)
      }
    }
    return Array.from(options.entries()).map(([id, fullName]) => ({ id, fullName }))
  }, [conversations])

  const filteredConversations = useMemo(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase()
    return conversations.filter((conversation) => {
      if (selectedChatStudentId && String(conversation.student?.id ?? '') !== selectedChatStudentId) return false
      if (!keyword) return true

      const haystack = [
        conversation.parent?.full_name,
        conversation.parent?.relationship_label,
        conversation.student?.full_name,
        conversation.latest_message?.message,
      ].join(' ').toLowerCase()

      return haystack.includes(keyword)
    })
  }, [conversations, deferredSearchTerm, selectedChatStudentId])

  const selectedConversation = useMemo(
    () => filteredConversations.find((item) => item.conversation_key === selectedConversationKey) ?? filteredConversations[0] ?? null,
    [filteredConversations, selectedConversationKey],
  )

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConversationKey('')
      return
    }

    if (!selectedConversationKey || !filteredConversations.some((item) => item.conversation_key === selectedConversationKey)) {
      setSelectedConversationKey(filteredConversations[0].conversation_key)
    }
  }, [filteredConversations, selectedConversationKey])

  const sendMessageMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) => sendTeacherMessage(token!, {
      parent_id: conversation.parent?.id ?? 0,
      student_id: conversation.student?.id ?? 0,
      message: messageDraft.trim(),
    }),
    onSuccess: async () => {
      setMessageDraft('')
      await queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] })
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) => markTeacherMessagesRead(token!, {
      parent_id: conversation.parent?.id ?? 0,
      student_id: conversation.student?.id ?? 0,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] })
    },
  })

  useEffect(() => {
    if (!isChatOpen || !selectedConversation || selectedConversation.unread_count <= 0 || markReadMutation.isPending) return
    markReadMutation.mutate(selectedConversation)
  }, [isChatOpen, markReadMutation, selectedConversation])

  const teacherId = typeof profile?.id === 'number' ? profile.id : null
  const studentCount = studentsQuery.data?.length ?? 0
  const parentGroupCount = parentGroupsQuery.data?.length ?? 0
  const reportCount = reportsQuery.data?.length ?? 0
  const sharedStudentCount = sharedStudentsQuery.data?.length ?? 0

  const teacherOverviewChartItems = [
    { label: 'Học sinh', value: studentCount, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
    { label: 'Liên kết phụ huynh', value: parentGroupCount, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
    { label: 'Báo cáo đã gửi', value: reportCount, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
    { label: 'Tin nhắn chưa đọc', value: unreadConversationCount, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
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
          <h2>Trung tâm điều hành gọn gàng và sạch hơn</h2>
          <p>Mình đã tách chat thành cửa sổ nổi riêng. Trang giáo viên giờ tập trung vào vận hành, còn trao đổi với phụ huynh sẽ mở bằng một nút chat ở góc màn hình.</p>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Tiến độ được cập nhật tự động</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>Không cần nhập tay tiến độ</strong>
                <span>Hệ thống tự ghi nhận từ hoạt động học sinh đã làm trong từng bài học.</span>
              </div>
              <div className="student-row">
                <strong>Giáo viên tập trung vào điều phối</strong>
                <span>Tạo bài, giao bài, xem dữ liệu và hỗ trợ đúng học sinh đang cần thêm trợ giúp.</span>
              </div>
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Luồng làm việc đề xuất</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>1. Tạo bài và hoạt động</strong>
                <span>Thiết kế bài học ngắn, rõ và vừa sức với học sinh.</span>
              </div>
              <div className="student-row">
                <strong>2. Giao bài cho lớp</strong>
                <span>Sau khi giao, hệ thống tự theo dõi trạng thái học tập và phần trăm hoàn thành.</span>
              </div>
              <div className="student-row">
                <strong>3. Chat và gửi báo cáo</strong>
                <span>Dùng dữ liệu học thật để phản hồi cho phụ huynh nhanh, rõ và đúng ngữ cảnh.</span>
              </div>
            </div>
          </article>
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
            <span>Tin nhắn chưa đọc</span>
            <strong>{unreadConversationCount}</strong>
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
              description="Nhìn nhanh khối lượng theo dõi và phối hợp trong ngày."
              items={teacherOverviewChartItems}
            />
          </article>

          <article className="roadmap-panel">
            <h3>Readiness</h3>
            <BarChartCard
              title="Mức độ sẵn sàng"
              description="Dữ liệu này đến từ quá trình học của học sinh, giúp ưu tiên nhóm cần hỗ trợ trước."
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
                <span>Lấy ID lớp và mật khẩu để học sinh vào lớp nhanh.</span>
              </div>
              <div className="student-row">
                <strong>2. Gắn phụ huynh</strong>
                <span>Phụ huynh sẽ thấy tiến độ tự động khi đã được liên kết đúng với học sinh.</span>
              </div>
              <div className="student-row">
                <strong>3. Trả lời nhanh bằng icon chat</strong>
                <span>Không còn khung chat chen vào giữa dashboard, chỉ bấm icon là mở hộp chat riêng.</span>
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
                    <option key={student.id} value={student.id}>
                      {student.full_name} - ID {student.id}
                    </option>
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
              <div className="config-card">
                <strong>Dữ liệu báo cáo được lấy tự động</strong>
                <p className="helper-text">Báo cáo dùng tiến độ, độ sẵn sàng và mức hoàn thành gần nhất từ quá trình học của học sinh.</p>
              </div>

              <label>
                Gửi theo học sinh
                <select value={reportStudentId} onChange={(event) => setReportStudentId(event.target.value)}>
                  <option value="">Tất cả phụ huynh đang liên kết</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
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
                  <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} rows={4} placeholder="Viết ngắn gọn điều phụ huynh cần lưu ý thêm." />
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
              description="Tổng hợp dữ liệu học tập được hệ thống tự đồng bộ sang phía phụ huynh."
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

      <ChatDock
        viewerRole="teacher"
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((current) => !current)}
        title="Chat với phụ huynh"
        subtitle="Bấm để mở hộp chat nổi"
        unreadCount={unreadConversationCount}
        conversations={filteredConversations}
        selectedConversationKey={selectedConversationKey}
        onSelectConversation={setSelectedConversationKey}
        studentOptions={conversationStudentOptions}
        selectedStudentId={selectedChatStudentId}
        onStudentFilterChange={setSelectedChatStudentId}
        searchTerm={conversationSearchTerm}
        onSearchTermChange={setConversationSearchTerm}
        searchPlaceholder="Nhập tên phụ huynh, học sinh hoặc nội dung gần nhất"
        selectedConversation={selectedConversation}
        renderConversationLabel={(conversation) => `${conversation.student?.full_name ?? 'Học sinh'} • ${conversation.parent?.full_name ?? 'Phụ huynh'}`}
        renderConversationMeta={(conversation) => conversation.parent?.relationship_label ?? 'Phụ huynh đang theo dõi'}
        emptyListTitle="Chưa có đoạn chat nào"
        emptyListDescription="Sau khi gắn phụ huynh vào học sinh, khung chat sẽ xuất hiện để giáo viên trao đổi trực tiếp."
        emptySearchTitle="Không tìm thấy đoạn chat phù hợp"
        emptySearchDescription="Thử đổi học sinh hoặc xóa từ khóa tìm kiếm để hiện lại danh sách đầy đủ."
        emptyChatTitle="Chưa có tin nhắn nào"
        emptyChatDescription="Bạn có thể mở đầu bằng một lời nhắn ngắn để phụ huynh biết cách phối hợp với bài học hiện tại."
        counterpartName={(conversation) => conversation.parent?.full_name ?? 'Phụ huynh'}
        chatContextLabel={(conversation) => `Trao đổi về ${conversation.student?.full_name ?? 'học sinh'}`}
        messageDraft={messageDraft}
        onMessageDraftChange={setMessageDraft}
        onSend={() => { if (selectedConversation) sendMessageMutation.mutate(selectedConversation) }}
        sendPending={sendMessageMutation.isPending}
        sendError={sendMessageMutation.error ? (sendMessageMutation.error as Error).message : null}
        messagePlaceholder="Ví dụ: Hôm nay bé đã hoàn thành phần số học khá tốt, phụ huynh nhắc bé ôn lại hình học thêm 10 phút nhé."
        messageHelperText="Nội dung ngắn, rõ việc cần phối hợp sẽ giúp phụ huynh thực hiện dễ hơn."
      />
    </RequireAuth>
  )
}
