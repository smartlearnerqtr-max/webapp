import { useEffect, useMemo, useRef } from 'react'

import type { ParentTeacherConversationItem } from '../services/api'

type ChatDockProps = {
  viewerRole: 'teacher' | 'parent'
  isOpen: boolean
  onToggle: () => void
  title: string
  subtitle: string
  unreadCount: number
  conversations: ParentTeacherConversationItem[]
  selectedConversationKey: string
  onSelectConversation: (key: string) => void
  studentOptions: Array<{ id: string; fullName: string }>
  selectedStudentId: string
  onStudentFilterChange: (value: string) => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  searchPlaceholder: string
  selectedConversation: ParentTeacherConversationItem | null
  renderConversationLabel: (conversation: ParentTeacherConversationItem) => string
  renderConversationMeta: (conversation: ParentTeacherConversationItem) => string
  emptyListTitle: string
  emptyListDescription: string
  emptySearchTitle: string
  emptySearchDescription: string
  emptyChatTitle: string
  emptyChatDescription: string
  counterpartName: (conversation: ParentTeacherConversationItem) => string
  chatContextLabel: (conversation: ParentTeacherConversationItem) => string
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onSend: () => void
  sendPending: boolean
  sendError: string | null
  messagePlaceholder: string
  messageHelperText: string
}

function formatMessageTime(value: string | null | undefined) {
  if (!value) return 'Vừa xong'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Vừa xong'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c4.97 0 9 3.58 9 8 0 1.9-.75 3.65-2 5.04V21l-4.08-2.44A10.7 10.7 0 0 1 12 19c-4.97 0-9-3.58-9-8s4.03-8 9-8Zm-4.5 7.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" />
    </svg>
  )
}

export function ChatDock({
  viewerRole,
  isOpen,
  onToggle,
  title,
  subtitle,
  unreadCount,
  conversations,
  selectedConversationKey,
  onSelectConversation,
  studentOptions,
  selectedStudentId,
  onStudentFilterChange,
  searchTerm,
  onSearchTermChange,
  searchPlaceholder,
  selectedConversation,
  renderConversationLabel,
  renderConversationMeta,
  emptyListTitle,
  emptyListDescription,
  emptySearchTitle,
  emptySearchDescription,
  emptyChatTitle,
  emptyChatDescription,
  counterpartName,
  chatContextLabel,
  messageDraft,
  onMessageDraftChange,
  onSend,
  sendPending,
  sendError,
  messagePlaceholder,
  messageHelperText,
}: ChatDockProps) {
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [isOpen, selectedConversation?.conversation_key, selectedConversation?.messages.length])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onToggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onToggle])

  const hasSearchResult = conversations.length > 0
  const selectedConversationUnreadLabel = useMemo(() => {
    if (!selectedConversation) return ''
    return selectedConversation.unread_count > 0 ? `${selectedConversation.unread_count} chưa đọc` : 'Đã đọc hết'
  }, [selectedConversation])

  return (
    <>
      {isOpen ? <button type="button" className="chat-modal-backdrop" aria-label="Đóng cửa sổ chat" onClick={onToggle} /> : null}

      <div className={isOpen ? 'chat-dock chat-dock-open' : 'chat-dock'}>
        <button type="button" className="chat-launcher" aria-label={title} onClick={onToggle}>
          <span className="chat-launcher-icon">
            <ChatIcon />
          </span>
          <span className="chat-launcher-copy">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
          {unreadCount > 0 ? <span className="chat-launcher-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
        </button>

        {isOpen ? (
          <section className="chat-modal" role="dialog" aria-modal="true" aria-label={title}>
            <header className="chat-modal-header">
              <div>
                <p className="chat-modal-eyebrow">Tin nhắn</p>
                <h3>{title}</h3>
                <p>{subtitle}</p>
              </div>
              <button type="button" className="chat-modal-close" onClick={onToggle}>
                Đóng
              </button>
            </header>

            <div className="chat-toolbar">
              <label>
                Lọc theo học sinh
                <select value={selectedStudentId} onChange={(event) => onStudentFilterChange(event.target.value)}>
                  <option value="">Tất cả học sinh</option>
                  {studentOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.fullName}</option>
                  ))}
                </select>
              </label>

              <label>
                Tìm nhanh cuộc trò chuyện
                <input value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} placeholder={searchPlaceholder} />
              </label>
            </div>

            <div className="chat-layout">
              <div className="chat-thread-list">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.conversation_key}
                    type="button"
                    className={selectedConversationKey === conversation.conversation_key ? 'chat-thread-item chat-thread-item-active' : 'chat-thread-item'}
                    onClick={() => onSelectConversation(conversation.conversation_key)}
                  >
                    <div className="chat-thread-head">
                      <strong>{renderConversationLabel(conversation)}</strong>
                      {conversation.unread_count > 0 ? <span className="chat-unread-badge">{conversation.unread_count}</span> : null}
                    </div>
                    <span>{renderConversationMeta(conversation)}</span>
                    <p>{conversation.latest_message?.message ?? 'Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện.'}</p>
                    <small>{formatMessageTime(conversation.latest_message?.created_at)}</small>
                  </button>
                ))}

                {!hasSearchResult && searchTerm.trim() ? (
                  <div className="chat-empty-state">
                    <strong>{emptySearchTitle}</strong>
                    <p>{emptySearchDescription}</p>
                  </div>
                ) : null}

                {!hasSearchResult && !searchTerm.trim() ? (
                  <div className="chat-empty-state">
                    <strong>{emptyListTitle}</strong>
                    <p>{emptyListDescription}</p>
                  </div>
                ) : null}
              </div>

              <div className="chat-panel">
                {selectedConversation ? (
                  <>
                    <div className="chat-panel-header">
                      <div>
                        <h4>{counterpartName(selectedConversation)}</h4>
                        <p>{chatContextLabel(selectedConversation)}</p>
                      </div>
                      <div className="chat-panel-meta">
                        <span>{selectedConversation.message_count} tin nhắn</span>
                        <span>{selectedConversationUnreadLabel}</span>
                      </div>
                    </div>

                    <div className="chat-message-list">
                      {selectedConversation.messages.map((message) => {
                        const ownSide = message.sender_role === viewerRole

                        return (
                          <div key={message.id} className={ownSide ? 'chat-message chat-message-own' : 'chat-message'}>
                            <span className="chat-message-author">{ownSide ? 'Bạn' : counterpartName(selectedConversation)}</span>
                            <p>{message.message}</p>
                            <small>{formatMessageTime(message.created_at)}</small>
                          </div>
                        )
                      })}
                      {!selectedConversation.messages.length ? (
                        <div className="chat-empty-state">
                          <strong>{emptyChatTitle}</strong>
                          <p>{emptyChatDescription}</p>
                        </div>
                      ) : null}
                      <div ref={messageEndRef} />
                    </div>

                    <div className="chat-composer">
                      <textarea rows={3} value={messageDraft} onChange={(event) => onMessageDraftChange(event.target.value)} placeholder={messagePlaceholder} />
                      <div className="chat-composer-actions">
                        <span className="helper-text">{messageHelperText}</span>
                        <button className="action-button" type="button" disabled={!messageDraft.trim() || sendPending} onClick={onSend}>
                          {sendPending ? 'Đang gửi...' : 'Gửi tin nhắn'}
                        </button>
                      </div>
                      {sendError ? <p className="error-text">{sendError}</p> : null}
                    </div>
                  </>
                ) : (
                  <div className="chat-empty-state chat-empty-state-large">
                    <strong>Chọn một cuộc trò chuyện</strong>
                    <p>Hãy chọn người cần trao đổi ở cột bên trái để bắt đầu nhắn tin.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
