import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { RequireAuth } from '../components/RequireAuth'
import { fetchAISettings, sendAIChat, testAISettings } from '../services/api'
import { useAuthStore } from '../store/authStore'

export function AISettingsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('Hãy giải thích ngắn gọn cách học bài này cho học sinh bằng câu ngắn dễ hiểu.')
  const [lessonTitle, setLessonTitle] = useState('Bài học demo')
  const [subjectName, setSubjectName] = useState('Toán')
  const [activityType, setActivityType] = useState('multiple_choice')
  const [aiReply, setAiReply] = useState('')

  const settingsQuery = useQuery({
    queryKey: ['ai-settings', token],
    queryFn: () => fetchAISettings(token!),
    enabled: Boolean(token),
  })

  const testMutation = useMutation({
    mutationFn: () => testAISettings(token!),
    onSuccess: (data) => {
      setAiReply(data.sample_response)
      void queryClient.invalidateQueries({ queryKey: ['ai-settings', token] })
    },
  })

  const chatMutation = useMutation({
    mutationFn: () => sendAIChat(token!, {
      message,
      context: {
        target_role: user?.role,
        disability_level: typeof profile?.disability_level === 'string' ? String(profile.disability_level) : 'trung_binh',
        lesson_title: lessonTitle,
        subject_name: subjectName,
        activity_type: activityType,
      },
    }),
    onSuccess: (data) => {
      setAiReply(data.text)
      void queryClient.invalidateQueries({ queryKey: ['ai-settings', token] })
    },
  })

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return
    chatMutation.mutate()
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Cấu hình Gemini và hỏi đáp AI</h2>
          <p>API key được quản lý tập trung ở server `.env`, giao diện này chỉ dùng để xem trạng thái và test AI.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Trạng thái hiện tại</h3>
            <div className="settings-grid">
              <div><span>Nhà cung cấp</span><strong>{settingsQuery.data?.provider ?? 'Gemini'}</strong></div>
              <div><span>Tên model</span><strong>{settingsQuery.data?.model_name ?? 'gemini-2.5-flash'}</strong></div>
              <div><span>Nguồn cấu hình</span><strong>{settingsQuery.data?.configured_source === 'server_env' ? 'Server .env' : 'Không rõ'}</strong></div>
              <div><span>Số API key</span><strong>{settingsQuery.data?.key_count ?? 0}</strong></div>
              <div><span>Xoay vòng</span><strong>{settingsQuery.data?.rotation_enabled ? 'Đang bật' : 'Tắt'}</strong></div>
              <div><span>Trạng thái</span><strong>{settingsQuery.data?.status === 'configured' ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong></div>
              <div><span>Hiển thị key</span><strong>{settingsQuery.data?.api_key_masked ?? 'Chưa cấu hình'}</strong></div>
              <div><span>Lỗi gần nhất</span><strong>{settingsQuery.data?.last_error_message ?? 'Không có'}</strong></div>
            </div>
            <div className="button-row">
              <button className="action-button" type="button" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || settingsQuery.data?.status !== 'configured'}>
                {testMutation.isPending ? 'Đang test...' : 'Kiểm tra kết nối Gemini'}
              </button>
            </div>
            {testMutation.error ? <p className="error-text">{(testMutation.error as Error).message}</p> : null}
          </article>

          <article className="roadmap-panel">
            <h3>Cách cấu hình mới</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>Bỏ nhập key ở giao diện</strong>
                <span>Mọi API key Gemini được đọc trực tiếp từ file `.env` của backend.</span>
              </div>
              <div className="student-row">
                <strong>Tự động xoay vòng</strong>
                <span>Khi một key bị rate limit hoặc quota, hệ thống sẽ tự chuyển sang key tiếp theo.</span>
              </div>
              <div className="student-row">
                <strong>Quản lý tập trung</strong>
                <span>Giáo viên không còn phải tự lưu key riêng trong tài khoản nữa.</span>
              </div>
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Test hỏi đáp AI</h3>
            <form className="form-stack" onSubmit={handleChatSubmit}>
              <label>
                Môn học
                <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Toán học" />
              </label>
              <label>
                Bài học
                <input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="Nhận biết hình vuông" />
              </label>
              <label>
                Loại hoạt động
                <input value={activityType} onChange={(event) => setActivityType(event.target.value)} placeholder="multiple_choice" />
              </label>
              <label>
                Nội dung yêu cầu (Prompt)
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} />
              </label>
              <button className="action-button" type="submit" disabled={chatMutation.isPending || settingsQuery.data?.status !== 'configured'}>
                {chatMutation.isPending ? 'Đang gọi Gemini...' : 'Gửi yêu cầu'}
              </button>
              {chatMutation.error ? <p className="error-text">{(chatMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Phản hồi từ AI</h3>
            <div className="response-box">
              {aiReply ? <p>{aiReply}</p> : <p>Chưa có phản hồi từ hệ thống.</p>}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
