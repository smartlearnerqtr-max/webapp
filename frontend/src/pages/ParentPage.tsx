import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { BarChartCard } from '../components/BarChartCard'
import { ChatDock } from '../components/ChatDock'
import { RequireAuth } from '../components/RequireAuth'
import {
  fetchParentChildren,
  fetchParentMessages,
  fetchParentReports,
  fetchTeacherByIdForParent,
  markParentMessagesRead,
  sendParentMessage,
} from '../services/api'
import type { ParentReportItem, ParentTeacherConversationItem } from '../services/api'
import { useAuthStore } from '../store/authStore'

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ thêm',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng nâng độ khó',
}

export function ParentPage() {
  const token = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [teacherIdInput, setTeacherIdInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedConversationKey, setSelectedConversationKey] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [selectedChatStudentId, setSelectedChatStudentId] = useState('')
  const [conversationSearchTerm, setConversationSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(conversationSearchTerm)

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

  const conversationsQuery = useQuery({
    queryKey: ['parent-messages', token],
    queryFn: () => fetchParentMessages(token!),
    enabled: Boolean(token),
  })

  const teacherLookupMutation = useMutation({
    mutationFn: () => fetchTeacherByIdForParent(token!, Number(teacherIdInput)),
  })

  const sendMessageMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) => sendParentMessage(token!, {
      teacher_id: conversation.teacher?.id ?? 0,
      student_id: conversation.student?.id ?? 0,
      message: messageDraft.trim(),
    }),
    onSuccess: async () => {
      setMessageDraft('')
      await queryClient.invalidateQueries({ queryKey: ['parent-messages', token] })
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) => markParentMessagesRead(token!, {
      teacher_id: conversation.teacher?.id ?? 0,
      student_id: conversation.student?.id ?? 0,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parent-messages', token] })
    },
  })

  const reportsByStudent = useMemo(() => {
    const grouped = new Map<number, ParentReportItem[]>()
    for (const report of reportsQuery.data ?? []) {
      const current = grouped.get(report.student_id) ?? []
      grouped.set(report.student_id, [...current, report])
    }
    return grouped
  }, [reportsQuery.data])

  const familyProgressChartItems = useMemo(() => {
    const summary = (childrenQuery.data ?? []).reduce(
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
      { label: 'Số con theo dõi', value: childrenQuery.data?.length ?? 0, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
      { label: 'Tổng bài tập', value: summary.totalAssignments, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
      { label: 'Đã hoàn thành', value: summary.completedCount, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
      { label: 'Chưa bắt đầu', value: remainingCount, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
    ]
  }, [childrenQuery.data])

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
        conversation.teacher?.full_name,
        conversation.teacher?.school_name,
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

  useEffect(() => {
    if (!isChatOpen || !selectedConversation || selectedConversation.unread_count <= 0 || markReadMutation.isPending) return
    markReadMutation.mutate(selectedConversation)
  }, [isChatOpen, markReadMutation, selectedConversation])

  const parentId = typeof profile?.id === 'number' ? profile.id : null
  const parentName = typeof profile?.full_name === 'string' ? String(profile.full_name) : 'Phụ huynh'

  return (
    <RequireAuth allowedRoles={['parent']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Phụ huynh</p>
          <h2>Theo dõi việc học của con thật gọn và dễ hiểu</h2>
          <p>Xem tiến độ, nhận báo cáo và nhắn giáo viên bằng một nút chat nổi thay vì nhét khung chat vào giữa trang.</p>
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
                <span>Tin nhắn chưa đọc</span>
                <strong>{unreadConversationCount}</strong>
              </div>
            </div>
            <BarChartCard
              title="Biểu đồ tổng quan gia đình"
              description="Nhìn nhanh khối lượng bài học của cả gia đình trên ứng dụng."
              items={familyProgressChartItems}
              emptyMessage="Chưa có dữ liệu học sinh để hiển thị."
            />
            <p>Gửi parent ID này cho giáo viên nếu cần liên kết đúng phụ huynh vào hồ sơ học sinh.</p>
          </article>

          <article className="roadmap-panel">
            <h3>Tra cứu giáo viên bằng teacher ID</h3>
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
          {(childrenQuery.data ?? []).map((item) => {
            const studentReports = reportsByStudent.get(item.student.id) ?? []
            const remainingAssignments = Math.max(
              item.progress_summary.total_assignments - item.progress_summary.completed_count - item.progress_summary.in_progress_count,
              0,
            )

            const childProgressChartItems = [
              { label: 'Tổng bài', value: item.progress_summary.total_assignments, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
              { label: 'Đã xong', value: item.progress_summary.completed_count, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
              { label: 'Đang học', value: item.progress_summary.in_progress_count, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
              { label: 'Chưa bắt đầu', value: remainingAssignments, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
            ]

            return (
              <article key={item.student.id} className="roadmap-panel">
                <div className="student-row">
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level} / {item.student.preferred_input}</span>
                </div>
                <div className="metrics-grid">
                  <div className="mini-card">
                    <span>Tổng bài tập</span>
                    <strong>{item.progress_summary.total_assignments}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Đã xong</span>
                    <strong>{item.progress_summary.completed_count}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Đang học</span>
                    <strong>{item.progress_summary.in_progress_count}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Tiến độ gần nhất</span>
                    <strong>{item.progress_summary.last_progress_percent}%</strong>
                  </div>
                </div>
                <BarChartCard
                  title="Biểu đồ tiến độ của con"
                  description="Nhìn nhanh phần đã xong, đang học và phần còn lại."
                  items={childProgressChartItems}
                />
                <p className="helper-text">Bài học gần nhất: {item.progress_summary.last_assignment_title ?? 'Chưa có bài tập nào'}.</p>
                <p>Mức độ sẵn sàng: {readinessLabelMap[item.progress_summary.readiness_status] ?? item.progress_summary.readiness_status}</p>
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
              <p>Giáo viên cần liên kết phụ huynh với học sinh trước khi dashboard có dữ liệu theo dõi.</p>
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

      <ChatDock
        viewerRole="parent"
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((current) => !current)}
        title="Chat với giáo viên"
        subtitle="Bấm để mở khung trao đổi nhanh"
        unreadCount={unreadConversationCount}
        conversations={filteredConversations}
        selectedConversationKey={selectedConversationKey}
        onSelectConversation={setSelectedConversationKey}
        studentOptions={conversationStudentOptions}
        selectedStudentId={selectedChatStudentId}
        onStudentFilterChange={setSelectedChatStudentId}
        searchTerm={conversationSearchTerm}
        onSearchTermChange={setConversationSearchTerm}
        searchPlaceholder="Nhập tên giáo viên, học sinh hoặc nội dung gần nhất"
        selectedConversation={selectedConversation}
        renderConversationLabel={(conversation) => `${conversation.teacher?.full_name ?? 'Giáo viên'} • ${conversation.student?.full_name ?? 'Học sinh'}`}
        renderConversationMeta={(conversation) => conversation.teacher?.school_name ?? 'Giáo viên đang theo dõi con'}
        emptyListTitle="Chưa có cuộc trò chuyện nào"
        emptyListDescription="Giáo viên cần liên kết phụ huynh với học sinh trước, sau đó khung chat sẽ xuất hiện tại đây."
        emptySearchTitle="Không tìm thấy cuộc trò chuyện phù hợp"
        emptySearchDescription="Thử đổi học sinh hoặc xóa từ khóa tìm kiếm để hiện lại toàn bộ đoạn chat."
        emptyChatTitle="Chưa có tin nhắn nào"
        emptyChatDescription="Bạn có thể nhắn trước để trao đổi nhanh với giáo viên về tiến độ học của con."
        counterpartName={(conversation) => conversation.teacher?.full_name ?? 'Giáo viên'}
        chatContextLabel={(conversation) => `Trao đổi về ${conversation.student?.full_name ?? 'học sinh'}`}
        messageDraft={messageDraft}
        onMessageDraftChange={setMessageDraft}
        onSend={() => { if (selectedConversation) sendMessageMutation.mutate(selectedConversation) }}
        sendPending={sendMessageMutation.isPending}
        sendError={sendMessageMutation.error ? (sendMessageMutation.error as Error).message : null}
        messagePlaceholder="Ví dụ: Hôm nay bé làm bài ở nhà khá ổn, cô xem giúp em phần hình học nhé."
        messageHelperText="Nội dung ngắn gọn, đi thẳng vào điều cần trao đổi sẽ dễ theo dõi hơn."
      />
    </RequireAuth>
  )
}
