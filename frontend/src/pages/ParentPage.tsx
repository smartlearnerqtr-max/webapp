import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { BarChartCard } from '../components/BarChartCard'
import { ChatDock } from '../components/ChatDock'
import { RequireAuth } from '../components/RequireAuth'
import {
  fetchParentChildren,
  fetchParentMessages,
  fetchParentReports,
  markParentMessagesRead,
  sendParentMessage,
} from '../services/api'
import type { ParentChildAssignmentItem, ParentChildDashboardItem, ParentReportItem, ParentTeacherConversationItem } from '../services/api'
import { useAuthStore } from '../store/authStore'

const LEVEL_LABELS: Record<string, string> = {
  nhe: 'Nhẹ',
  trung_binh: 'Trung bình',
  nang: 'Nặng',
}

const INPUT_LABELS: Record<string, string> = {
  touch: 'Chạm',
  keyboard: 'Bàn phím',
  voice: 'Giọng nói',
}

const READINESS_LABELS: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ thêm',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng tăng độ khó',
}

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang học',
  completed: 'Đã hoàn thành',
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa có'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(parsed)
}

function levelLabel(value: string | null | undefined) {
  if (!value) return 'Chưa rõ mức'
  return LEVEL_LABELS[value] ?? value
}

function inputLabel(value: string | null | undefined) {
  if (!value) return 'Chưa chọn cách nhập'
  return INPUT_LABELS[value] ?? value
}

function assignmentStatusLabel(value: string | null | undefined) {
  if (!value) return 'Chưa rõ'
  return ASSIGNMENT_STATUS_LABELS[value] ?? value
}

function readinessLabel(value: string | null | undefined) {
  if (!value) return 'Đang theo dõi'
  return READINESS_LABELS[value] ?? value
}

function summarizeChildAssignments(child: ParentChildDashboardItem) {
  const assignments = child.assignments ?? []
  const matchingCount = assignments.filter((item) => item.level_match).length
  const mismatchedCount = assignments.length - matchingCount
  const activeCount = assignments.filter((item) => item.status !== 'completed').length
  return { matchingCount, mismatchedCount, activeCount }
}

function renderAssignmentMeta(item: ParentChildAssignmentItem) {
  const lesson = item.assignment?.lesson
  const classroom = item.assignment?.classroom
  const teacherName = item.teacher?.full_name ?? 'Giáo viên đang theo dõi'
  const subjectName = lesson?.subject?.name ?? item.assignment?.subject?.name ?? 'Chưa có môn'
  const className = classroom?.name ?? 'Chưa có lớp'
  return `${subjectName} / ${className} / ${teacherName}`
}

export function ParentPage() {
  const token = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()

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

  const sendMessageMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) =>
      sendParentMessage(token!, {
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
    mutationFn: (conversation: ParentTeacherConversationItem) =>
      markParentMessagesRead(token!, {
        teacher_id: conversation.teacher?.id ?? 0,
        student_id: conversation.student?.id ?? 0,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parent-messages', token] })
    },
  })

  const children = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data])

  const reportsByStudent = useMemo(() => {
    const grouped = new Map<number, ParentReportItem[]>()
    for (const report of reportsQuery.data ?? []) {
      const current = grouped.get(report.student_id) ?? []
      grouped.set(report.student_id, [...current, report])
    }
    return grouped
  }, [reportsQuery.data])

  const familyAssignmentMismatchCount = useMemo(
    () => children.reduce((sum, child) => sum + summarizeChildAssignments(child).mismatchedCount, 0),
    [children],
  )

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data])
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
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [conversations, deferredSearchTerm, selectedChatStudentId])

  const selectedConversation = useMemo(
    () => filteredConversations.find((item) => item.conversation_key === selectedConversationKey) ?? filteredConversations[0] ?? null,
    [filteredConversations, selectedConversationKey],
  )
  const effectiveSelectedConversationKey = selectedConversation?.conversation_key ?? ''

  useEffect(() => {
    if (!isChatOpen || !selectedConversation || selectedConversation.unread_count <= 0 || markReadMutation.isPending) return
    markReadMutation.mutate(selectedConversation)
  }, [isChatOpen, markReadMutation, selectedConversation])

  const parentId = typeof profile?.id === 'number' ? profile.id : null
  const parentName = typeof profile?.full_name === 'string' ? String(profile.full_name) : 'Phụ huynh'
  const isParentSetupPending = !childrenQuery.isLoading && !children.length

  return (
    <RequireAuth allowedRoles={['parent']}>
      <div className="parent-dashboard-container">
        <section className="parent-hero">
          <div className="parent-hero-decor parent-hero-decor-1">👨‍👩‍👧</div>
          <div className="parent-hero-decor parent-hero-decor-2">📈</div>
          <h2>Đồng hành cùng con</h2>
          <p>
            Theo dõi tiến độ học tập, kiểm tra báo cáo và giữ liên lạc với giáo viên. Cùng nhau giúp con đạt kết quả tốt nhất.
          </p>
        </section>

        <section className="parent-metrics-row">
          <article className="parent-stat-card">
            <span>Mã Phụ Huynh (ID)</span>
            <strong>{parentId ?? '---'}</strong>
          </article>
          <article className="parent-stat-card">
            <span>Họ Tên</span>
            <strong>{parentName}</strong>
          </article>
          <article className="parent-stat-card">
            <span>Tin Nhắn Mới</span>
            <strong>{unreadConversationCount}</strong>
          </article>
          <article className="parent-stat-card">
            <span>Số Bài Lệch Mức</span>
            <strong>{familyAssignmentMismatchCount}</strong>
          </article>
        </section>

        {isParentSetupPending ? (
          <section className="parent-content-grid">
            <article className="parent-panel-card">
              <div className="parent-panel-header">
                <h3>Bắt đầu kết nối</h3>
              </div>
              <div className="parent-panel-body">
                <p>
                  Tài khoản phụ huynh đã tạo xong. Bước tiếp theo là gửi Parent ID hoặc email này cho giáo viên để họ gắn đúng
                  vào hồ sơ học sinh.
                </p>
                <p>Sau khi liên kết xong, trang này sẽ hiện con, bài học, báo cáo và khung chat với giáo viên.</p>
              </div>
            </article>
          </section>
        ) : null}

        {!children.length && !childrenQuery.isLoading && !isParentSetupPending ? (
          <section className="parent-content-grid">
            <article className="parent-panel-card">
              <div className="parent-panel-header">
                <h3>Chưa có liên kết nào</h3>
              </div>
              <div className="parent-panel-body">
                <p>Giáo viên cần liên kết phụ huynh với học sinh trước khi bảng theo dõi có dữ liệu.</p>
              </div>
            </article>
          </section>
        ) : null}

        <section className="parent-content-grid two-cols">
          {children.map((item) => {
            const studentReports = reportsByStudent.get(item.student.id) ?? []
            const remainingAssignments = Math.max(
              item.progress_summary.total_assignments - item.progress_summary.completed_count - item.progress_summary.in_progress_count,
              0,
            )
            const assignmentSummary = summarizeChildAssignments(item)

            const childProgressChartItems = [
              { label: 'Tổng bài', value: item.progress_summary.total_assignments, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
              { label: 'Đã xong', value: item.progress_summary.completed_count, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
              { label: 'Đang học', value: item.progress_summary.in_progress_count, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
              { label: 'Chưa bắt đầu', value: remainingAssignments, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
            ]

            return (
              <article key={item.student.id} className="parent-panel-card">
                <div className="parent-panel-header">
                  <div>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{item.student.full_name}</h3>
                    <p className="helper-text" style={{ margin: 0 }}>
                      {`Mức ${levelLabel(item.student.disability_level)} / ${inputLabel(item.student.preferred_input)}`}
                    </p>
                  </div>
                  <span className="subject-pill">{levelLabel(item.student.disability_level)}</span>
                </div>

                <div className="parent-panel-body">
                  <div className="metrics-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="mini-card" style={{ padding: '1rem' }}>
                      <span>Khớp mức</span>
                      <strong>{assignmentSummary.matchingCount}</strong>
                    </div>
                    <div className="mini-card" style={{ padding: '1rem' }}>
                      <span>Lệch mức</span>
                      <strong>{assignmentSummary.mismatchedCount}</strong>
                    </div>
                    <div className="mini-card" style={{ padding: '1rem' }}>
                      <span>Tiến độ gần nhất</span>
                      <strong>{item.progress_summary.last_progress_percent}%</strong>
                    </div>
                    <div className="mini-card" style={{ padding: '1rem' }}>
                      <span>Mức độ sẵn sàng</span>
                      <strong style={{ fontSize: '1.2rem', marginTop: 'auto' }}>{readinessLabel(item.progress_summary.readiness_status)}</strong>
                    </div>
                  </div>

                  {assignmentSummary.mismatchedCount > 0 ? (
                    <p className="error-text" style={{ margin: 0 }}>
                      {`Có ${assignmentSummary.mismatchedCount} bài không khớp mức hiện tại của con. Phụ huynh nên trao đổi lại với giáo viên.`}
                    </p>
                  ) : null}

                  <BarChartCard
                    title="Biểu đồ tiến độ của con"
                    description="Phần đã xong, đang học và phần còn lại."
                    items={childProgressChartItems}
                  />

                  <div className="detail-stack">
                    <strong>Bài giáo viên đã giao</strong>
                    <div className="parent-scrollable-list" style={{ padding: 0, border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)' }}>
                      {item.assignments.map((assignmentItem) => {
                        const lesson = assignmentItem.assignment?.lesson
                        const lessonLevel = lesson?.primary_level ?? ''
                        return (
                          <div
                            key={assignmentItem.progress_id}
                            className={assignmentItem.level_match ? 'admin-list-item' : 'admin-list-item parent-assignment-row-warning'}
                            style={{ padding: '1rem', background: assignmentItem.level_match ? 'white' : 'inherit' }}
                          >
                            <strong>{lesson?.title ?? `Bài học #${assignmentItem.assignment?.lesson_id ?? assignmentItem.progress_id}`}</strong>
                            <span>{renderAssignmentMeta(assignmentItem)}</span>
                            <p>
                              {`Mức: ${levelLabel(lessonLevel)} / ${assignmentStatusLabel(assignmentItem.status)} / ${assignmentItem.progress_percent}%`}
                            </p>
                            {!assignmentItem.level_match ? (
                              <span style={{ color: 'var(--error)', marginTop: '0.5rem', display: 'block', fontSize: '0.85rem' }}>
                                {`⚠ Bài mức ${levelLabel(lessonLevel)} trong khi con ở mức ${levelLabel(item.student.disability_level)}.`}
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                      {!item.assignments.length ? <p style={{ padding: '1rem' }}>Chưa có bài nào được giao.</p> : null}
                    </div>
                  </div>

                  <div className="detail-stack">
                    <strong>Báo cáo gần đây</strong>
                    <div className="parent-scrollable-list" style={{ padding: 0, border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)' }}>
                      {studentReports.slice(0, 3).map((report) => (
                        <div key={report.id} className="admin-list-item" style={{ padding: '1rem', background: 'white' }}>
                          <strong>{report.title}</strong>
                          <span>{formatDate(report.report_date)}</span>
                          <span style={{ color: 'var(--text)' }}>{report.summary_text}</span>
                        </div>
                      ))}
                      {!studentReports.length ? <p style={{ padding: '1rem' }}>Chưa có báo cáo nào.</p> : null}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <section className="parent-content-grid">
          <article className="parent-panel-card">
            <div className="parent-panel-header">
              <h3>Tất cả báo cáo đã nhận</h3>
              <span className="subject-pill muted-pill">{reportsQuery.data?.length ?? 0}</span>
            </div>
            <div className="parent-panel-body no-padding">
              <div className="parent-scrollable-list">
                {(reportsQuery.data ?? []).map((report) => (
                  <div key={report.id} className="admin-list-item">
                    <strong>{report.student?.full_name ?? `Học sinh #${report.student_id}`}</strong>
                    <span>{`${report.title} / ${formatDate(report.report_date)}`}</span>
                    <span style={{ color: 'var(--text)' }}>{report.summary_text}</span>
                    {report.recommendation ? <span style={{ color: 'var(--text-muted)' }}>Khuyến nghị: {report.recommendation}</span> : null}
                  </div>
                ))}
                {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p style={{ padding: '1rem' }}>Chưa có báo cáo nào được gửi tới tài khoản này.</p> : null}
              </div>
            </div>
          </article>
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
        selectedConversationKey={effectiveSelectedConversationKey}
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
        onSend={() => {
          if (selectedConversation) sendMessageMutation.mutate(selectedConversation)
        }}
        sendPending={sendMessageMutation.isPending}
        sendError={sendMessageMutation.error ? (sendMessageMutation.error as Error).message : null}
        messagePlaceholder="Ví dụ: Hôm nay bé làm bài ở nhà khá ổn, cô xem giúp em phần hình học nhé."
        messageHelperText="Nội dung ngắn gọn, đi thẳng vào điều cần trao đổi sẽ dễ theo dõi hơn."
      />
    </RequireAuth>
  )
}
