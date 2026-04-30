import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { BarChartCard } from '../components/BarChartCard'
import { ChatDock } from '../components/ChatDock'
import { RequireAuth } from '../components/RequireAuth'
import {
  fetchParents,
  fetchStudents,
  fetchTeacherMessages,
  fetchTeacherParentGroups,
  fetchTeacherReports,
  linkParentToStudent,
  markTeacherMessagesRead,
  sendDailyReports,
  sendTeacherMessage,
} from '../services/api'
import type { ParentTeacherConversationItem } from '../services/api'
import { useAuthStore } from '../store/authStore'

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng tăng mức',
}

export function TeacherHomePage() {
  const token = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedParentId, setSelectedParentId] = useState('')
  const [parentLookup, setParentLookup] = useState('')
  const [reportStudentId, setReportStudentId] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedConversationKey, setSelectedConversationKey] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [selectedChatStudentId, setSelectedChatStudentId] = useState('')
  const [conversationSearchTerm, setConversationSearchTerm] = useState('')

  const deferredSearchTerm = useDeferredValue(conversationSearchTerm)
  const deferredParentLookup = useDeferredValue(parentLookup)
  const hasParentLookup = deferredParentLookup.trim().length > 0

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const parentsQuery = useQuery({
    queryKey: ['parents', token, deferredParentLookup.trim()],
    queryFn: () => fetchParents(token!, deferredParentLookup),
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
    if (!selectedStudentId) return []
    return (parentsQuery.data ?? []).filter((parent) => !linkedPairKeys.has(`${selectedStudentId}-${parent.id}`))
  }, [linkedPairKeys, parentsQuery.data, selectedStudentId])

  useEffect(() => {
    setSelectedParentId('')
  }, [selectedStudentId, deferredParentLookup])

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
  const effectiveSelectedConversationKey = selectedConversation?.conversation_key ?? ''

  const linkMutation = useMutation({
    mutationFn: () => linkParentToStudent(token!, Number(selectedStudentId), { parent_id: Number(selectedParentId) }),
    onSuccess: async () => {
      setSelectedParentId('')
      setParentLookup('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-parent-groups', token] }),
        queryClient.invalidateQueries({ queryKey: ['parents', token] }),
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
  const latestParentGroups = (parentGroupsQuery.data ?? []).slice(0, 6)
  const latestReports = (reportsQuery.data ?? []).slice(0, 5)
  const recentConversations = conversations.slice(0, 5)
  const showTeacherParentOnboarding = !parentGroupCount && !parentGroupsQuery.isLoading

  const averageLatestProgress = useMemo(() => {
    const groups = parentGroupsQuery.data ?? []
    if (!groups.length) return 0
    const total = groups.reduce((sum, item) => sum + item.progress_summary.last_progress_percent, 0)
    return Math.round(total / groups.length)
  }, [parentGroupsQuery.data])

  const teacherOverviewChartItems = [
    { label: 'Học sinh', value: studentCount, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
    { label: 'Phụ huynh', value: parentGroupCount, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
    { label: 'Tiến độ TB', value: averageLatestProgress, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
    { label: 'Chat chưa đọc', value: unreadConversationCount, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
  ]

  function openConversation(conversation: ParentTeacherConversationItem) {
    setSelectedConversationKey(conversation.conversation_key)
    setIsChatOpen(true)
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow teacher-clean-title-label">Giáo viên</p>
            <h2>Bảng điều khiển</h2>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>ID {teacherId ?? '---'}</span>
            <span>{averageLatestProgress}% tiến độ TB</span>
            <span>{unreadConversationCount} chat</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          {[
            { label: 'Học sinh', value: studentCount, tone: 'blue' },
            { label: 'Phụ huynh', value: parentGroupCount, tone: 'green' },
            { label: 'Báo cáo', value: reportCount, tone: 'gold' },
            { label: 'Chat mới', value: unreadConversationCount, tone: 'coral' },
          ].map((item) => (
            <article key={item.label} className={`mini-card teacher-clean-metric teacher-clean-metric-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
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
              description="Các số chính giáo viên cần theo dõi"
              items={teacherOverviewChartItems}
            />
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Theo dõi</p>
                <h3>Nhóm phụ huynh</h3>
              </div>
              <span className="subject-pill muted-pill">{averageLatestProgress}% TB</span>
            </div>
            <div className="student-list compact-list">
              {latestParentGroups.map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.student?.full_name ?? 'Học sinh'}</strong>
                  <span>{item.parent?.full_name ?? 'Phụ huynh'}</span>
                  <p>{item.progress_summary.last_progress_percent}% • {readinessLabelMap[item.progress_summary.readiness_status] ?? item.progress_summary.readiness_status}</p>
                </div>
              ))}
              {!latestParentGroups.length && !parentGroupsQuery.isLoading ? <p>Chưa có nhóm phụ huynh.</p> : null}
            </div>
          </article>
        </section>

        {showTeacherParentOnboarding ? (
          <section className="dashboard-grid">
            <article className="roadmap-panel">
              <h3>Bắt đầu gắn phụ huynh</h3>
              <p>1. Phụ huynh tự đăng ký tài khoản.</p>
              <p>2. Phụ huynh gửi Parent ID hoặc email cho giáo viên.</p>
              <p>3. Giáo viên chọn học sinh, tìm đúng phụ huynh rồi bấm gắn.</p>
            </article>
          </section>
        ) : null}

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Thiết lập</p>
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
                Tìm phụ huynh
                <input
                  value={parentLookup}
                  onChange={(event) => setParentLookup(event.target.value)}
                  placeholder="Nhập Parent ID hoặc email"
                  disabled={!selectedStudentId}
                />
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

              {linkMutation.error ? <p className="error-text">{(linkMutation.error as Error).message}</p> : null}
              {!selectedStudentId ? <p>Chọn học sinh trước.</p> : null}
              {selectedStudentId && !hasParentLookup ? <p>Phụ huynh mới cần gửi Parent ID hoặc email để giáo viên tìm và gắn đúng tài khoản.</p> : null}
              {selectedStudentId && hasParentLookup && !availableParents.length && !parentsQuery.isLoading ? <p>Không tìm thấy phụ huynh khớp với Parent ID hoặc email này.</p> : null}
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

              <label>
                Tiêu đề
                <input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} placeholder="Để trống nếu dùng mặc định" />
              </label>

              <label>
                Ghi chú
                <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} rows={3} placeholder="Viết ngắn gọn." />
              </label>

              <button
                className="action-button"
                type="button"
                disabled={reportMutation.isPending || !parentGroupCount}
                onClick={() => reportMutation.mutate(reportStudentId ? Number(reportStudentId) : undefined)}
              >
                {reportMutation.isPending ? 'Đang gửi...' : reportStudentId ? 'Gửi cho học sinh này' : 'Gửi tất cả'}
              </button>

              {reportMutation.error ? <p className="error-text">{(reportMutation.error as Error).message}</p> : null}
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
              {latestReports.map((report) => (
                <div key={report.id} className="student-row">
                  <strong>{report.student?.full_name ?? `Học sinh #${report.student_id}`}</strong>
                  <span>{report.report_date} • {report.parent?.full_name ?? `Phụ huynh #${report.parent_id}`}</span>
                  <p>{report.summary_text}</p>
                </div>
              ))}
              {!latestReports.length && !reportsQuery.isLoading ? <p>Chưa có báo cáo.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Trao đổi</p>
                <h3>Chat phụ huynh</h3>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsChatOpen(true)}>
                Mở chat
              </button>
            </div>
            <div className="student-list compact-list">
              {recentConversations.map((conversation) => (
                <button
                  key={conversation.conversation_key}
                  type="button"
                  className="student-row student-row-button"
                  onClick={() => openConversation(conversation)}
                >
                  <strong>{conversation.student?.full_name ?? 'Học sinh'} • {conversation.parent?.full_name ?? 'Phụ huynh'}</strong>
                  <span>{conversation.unread_count ? `${conversation.unread_count} tin mới` : 'Đã đọc'}</span>
                  <p>{conversation.latest_message?.message ?? 'Chưa có tin nhắn.'}</p>
                </button>
              ))}
              {!recentConversations.length && !conversationsQuery.isLoading ? <p>Chưa có đoạn chat nào.</p> : null}
            </div>
          </article>
        </section>
      </div>

      <ChatDock
        viewerRole="teacher"
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((current) => !current)}
        title="Chat với phụ huynh"
        subtitle="Trao đổi nhanh khi cần phối hợp"
        unreadCount={unreadConversationCount}
        conversations={filteredConversations}
        selectedConversationKey={effectiveSelectedConversationKey}
        onSelectConversation={setSelectedConversationKey}
        studentOptions={conversationStudentOptions}
        selectedStudentId={selectedChatStudentId}
        onStudentFilterChange={setSelectedChatStudentId}
        searchTerm={conversationSearchTerm}
        onSearchTermChange={setConversationSearchTerm}
        searchPlaceholder="Tìm phụ huynh, học sinh hoặc nội dung"
        selectedConversation={selectedConversation}
        renderConversationLabel={(conversation) => `${conversation.student?.full_name ?? 'Học sinh'} • ${conversation.parent?.full_name ?? 'Phụ huynh'}`}
        renderConversationMeta={(conversation) => conversation.parent?.relationship_label ?? 'Phụ huynh đang theo dõi'}
        emptyListTitle="Chưa có đoạn chat nào"
        emptyListDescription="Sau khi gắn phụ huynh vào học sinh, hộp chat sẽ xuất hiện tại đây."
        emptySearchTitle="Không tìm thấy đoạn chat phù hợp"
        emptySearchDescription="Thử đổi học sinh hoặc xóa từ khóa tìm kiếm."
        emptyChatTitle="Chưa có tin nhắn nào"
        emptyChatDescription="Bạn có thể mở đầu bằng một lời nhắn ngắn để phụ huynh biết cách phối hợp."
        counterpartName={(conversation) => conversation.parent?.full_name ?? 'Phụ huynh'}
        chatContextLabel={(conversation) => `Trao đổi về ${conversation.student?.full_name ?? 'học sinh'}`}
        messageDraft={messageDraft}
        onMessageDraftChange={setMessageDraft}
        onSend={() => { if (selectedConversation) sendMessageMutation.mutate(selectedConversation) }}
        sendPending={sendMessageMutation.isPending}
        sendError={sendMessageMutation.error ? (sendMessageMutation.error as Error).message : null}
        messagePlaceholder="Ví dụ: Hôm nay bé làm tốt phần bài học, phụ huynh nhắc bé ôn thêm 10 phút nhé."
        messageHelperText="Nội dung ngắn, rõ việc cần phối hợp sẽ giúp phụ huynh thực hiện dễ hơn."
      />
    </RequireAuth>
  )
}
