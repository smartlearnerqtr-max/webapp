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
  { to: '/hoc-sinh', title: 'Học sinh', icon: 'HS', description: 'Hồ sơ' },
  { to: '/lop-hoc', title: 'Lớp', icon: 'LP', description: 'Mã vào' },
  { to: '/bai-hoc', title: 'Bài', icon: 'BH', description: 'Hoạt động' },
  { to: '/giao-bai', title: 'Giao', icon: 'GB', description: 'Chọn lớp' },
  { to: '/tien-do', title: 'Tiến độ', icon: '%', description: 'Theo dõi' },
  { to: '/cai-dat-ai', title: 'AI', icon: 'AI', description: 'Kết nối' },
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
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow teacher-clean-title-label">Giáo viên</p>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>ID {teacherId ?? '---'}</span>
            <span>{unreadConversationCount} chat</span>
            <span>{averageLatestProgress}% tiến độ</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          {[
            { label: 'Học sinh', value: studentCount, tone: 'blue' },
            { label: 'Phụ huynh', value: parentGroupCount, tone: 'green' },
            { label: 'Báo cáo', value: reportCount, tone: 'gold' },
            { label: 'Chưa đọc', value: unreadConversationCount, tone: 'coral' },
            { label: 'Phối hợp', value: sharedStudentCount, tone: 'ink' },
          ].map((item) => (
            <article key={item.label} className={`mini-card teacher-clean-metric teacher-clean-metric-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="teacher-clean-shortcuts">
          {quickLinks.map((item) => (
            <Link key={item.to} className="teacher-clean-shortcut" to={item.to}>
              <span className="teacher-clean-shortcut-icon">{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </Link>
          ))}
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Tổng quan</p>
                <h3>Hôm nay</h3>
              </div>
              <span className="subject-pill muted-pill">{studentCount} HS</span>
            </div>
            <BarChartCard
              title="Nhìn nhanh"
              description="Theo dõi chung"
              items={teacherOverviewChartItems}
            />
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Ưu tiên</p>
                <h3>Readiness</h3>
              </div>
              <span className="subject-pill muted-pill">{parentGroupCount} nhóm</span>
            </div>
            <BarChartCard
              title="Mức sẵn sàng"
              description="Ưu tiên hỗ trợ"
              items={readinessChartItems}
              emptyMessage="Chưa có dữ liệu readiness."
            />
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Liên kết</p>
                <h3>Gắn phụ huynh</h3>
              </div>
            </div>

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
                {linkMutation.isPending ? 'Đang gắn...' : 'Gắn phụ huynh'}
              </button>

              {selectedSharedStudent ? (
                <article className="teacher-clean-note-card">
                  <strong>{selectedSharedStudent.student.full_name}</strong>
                  <p>{selectedSharedStudent.teachers.length} giáo viên theo dõi</p>
                  <p>{selectedSharedStudent.peer_teachers.map((teacher) => teacher.full_name).join(', ') || 'Chưa có giáo viên phối hợp'}</p>
                </article>
              ) : null}

              {linkMutation.error ? <p className="error-text">{(linkMutation.error as Error).message}</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Báo cáo</p>
                <h3>Gửi nhanh</h3>
              </div>
            </div>

            <div className="form-stack">
              <label>
                Học sinh
                <select value={reportStudentId} onChange={(event) => setReportStudentId(event.target.value)}>
                  <option value="">Tất cả phụ huynh đã liên kết</option>
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
                  Tiêu đề
                  <input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} placeholder="Để trống nếu dùng mặc định" />
                </label>
                <label>
                  Ghi chú
                  <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} rows={4} placeholder="Viết ngắn gọn." />
                </label>
              </details>

              <div className="button-row">
                <button
                  className="action-button"
                  type="button"
                  disabled={reportMutation.isPending || !parentGroupCount}
                  onClick={() => reportMutation.mutate(reportStudentId ? Number(reportStudentId) : undefined)}
                >
                  {reportMutation.isPending ? 'Đang gửi...' : reportStudentId ? 'Gửi 1 học sinh' : 'Gửi tất cả'}
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
                  Gửi toàn bộ
                </button>
              </div>

              {reportMutation.error ? <p className="error-text">{(reportMutation.error as Error).message}</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Phụ huynh</p>
                <h3>Nhóm đang theo dõi</h3>
              </div>
              <span className="subject-pill muted-pill">{averageLatestProgress}% TB</span>
            </div>
            <BarChartCard
              title="Tiến độ nhóm"
              description="Tự cập nhật"
              items={parentGroupProgressChartItems}
              emptyMessage="Chưa có liên kết phụ huynh."
            />
            <div className="student-list compact-list">
              {(parentGroupsQuery.data ?? []).slice(0, 6).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.student?.full_name ?? 'Học sinh'}</strong>
                  <span>{item.parent?.full_name ?? 'Phụ huynh'}</span>
                  <p>{item.progress_summary.last_progress_percent}% • {readinessLabelMap[item.progress_summary.readiness_status] ?? item.progress_summary.readiness_status}</p>
                </div>
              ))}
              {!parentGroupsQuery.data?.length && !parentGroupsQuery.isLoading ? <p>Chưa có nhóm phụ huynh.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Phối hợp</p>
                <h3>Học sinh chung</h3>
              </div>
            </div>
            <div className="student-list compact-list">
              {(sharedStudentsQuery.data ?? []).slice(0, 8).map((item) => (
                <button
                  key={item.student.id}
                  type="button"
                  className={selectedStudentId === String(item.student.id) ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                  onClick={() => setSelectedStudentId(String(item.student.id))}
                >
                  <strong>{item.student.full_name}</strong>
                  <span>{item.parent_group_count} phụ huynh • {item.my_active_class_count} lớp</span>
                  <p>{item.peer_teachers.map((teacher) => teacher.full_name).join(', ') || 'Chưa có phối hợp'}</p>
                </button>
              ))}
              {!sharedStudentsQuery.data?.length && !sharedStudentsQuery.isLoading ? <p>Chưa có học sinh phối hợp.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Lịch sử</p>
                <h3>Báo cáo gần đây</h3>
              </div>
              <span className="subject-pill muted-pill">{reportCount}</span>
            </div>
            <div className="student-list compact-list">
              {(reportsQuery.data ?? []).slice(0, 6).map((report) => (
                <div key={report.id} className="student-row">
                  <strong>{report.student?.full_name ?? `Học sinh #${report.student_id}`}</strong>
                  <span>{report.report_date} • {report.parent?.full_name ?? `Phụ huynh #${report.parent_id}`}</span>
                  <p>{report.summary_text}</p>
                </div>
              ))}
              {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p>Chưa có báo cáo.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Phối hợp</p>
                <h3>Giáo viên liên quan</h3>
              </div>
            </div>

            {selectedSharedStudent ? (
              <div className="detail-stack">
                <article className="teacher-clean-note-card">
                  <strong>{selectedSharedStudent.student.full_name}</strong>
                  <p>{selectedSharedStudent.teachers.length} giáo viên cùng theo dõi</p>
                </article>
                {selectedSharedStudent.teachers.map((teacher) => (
                  <div key={teacher.id} className="student-row">
                    <strong>{teacher.full_name}</strong>
                    <span>{teacher.is_current_teacher ? 'Hiện tại' : 'Phối hợp'}</span>
                    <p>{teacher.school_name ?? 'Chưa cập nhật trường'} • {teacher.email ?? teacher.phone ?? 'Chưa có liên hệ'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="teacher-clean-empty">
                <strong>Chọn một học sinh ở khung bên trái.</strong>
                <p>Mình sẽ hiện giáo viên phối hợp và thông tin liên hệ tại đây.</p>
              </div>
            )}
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
