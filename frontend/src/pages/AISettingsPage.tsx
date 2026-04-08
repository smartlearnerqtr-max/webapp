import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchAISettings, saveAISettings, sendAIChat, testAISettings } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

export function AISettingsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('gemini-2.5-flash')
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

  const saveMutation = useMutation({
    mutationFn: () => saveAISettings(token!, { api_key: apiKey, model_name: modelName }),
    onSuccess: () => {
      setApiKey('')
      void queryClient.invalidateQueries({ queryKey: ['ai-settings', token] })
    },
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
        disability_level: typeof profile?.['disability_level'] === 'string' ? String(profile['disability_level']) : 'trung_binh',
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!apiKey.trim()) return
    saveMutation.mutate()
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return
    chatMutation.mutate()
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Cấu hình Gemini và hỏi đáp AI cơ bản</h2>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Lưu cấu hình AI</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Model
                <input value={modelName} onChange={(event) => setModelName(event.target.value)} />
              </label>
              <label>
                Gemini API key
                <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="AIza..." />
              </label>
              <div className="button-row">
                <button className="action-button" type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
                <button className="ghost-button" type="button" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  {testMutation.isPending ? 'Đang test...' : 'Test key thật'}
                </button>
              </div>
              {saveMutation.error ? <p className="error-text">{(saveMutation.error as Error).message}</p> : null}
              {testMutation.error ? <p className="error-text">{(testMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Trạng thái hiện tại</h3>
            <div className="settings-grid">
              <div><span>Nhà cung cấp</span><strong>{settingsQuery.data?.provider ?? 'Gemini'}</strong></div>
              <div><span>Tên Model</span><strong>{settingsQuery.data?.model_name ?? 'gemini-2.0-flash'}</strong></div>
              <div><span>API key</span><strong>{settingsQuery.data?.api_key_masked ?? 'Chưa lưu'}</strong></div>
              <div><span>Trạng thái</span><strong>{settingsQuery.data?.status === 'configured' ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong></div>
              <div><span>Lỗi gần nhất</span><strong>{settingsQuery.data?.last_error_message ?? 'Không có'}</strong></div>
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
              <button className="action-button" type="submit" disabled={chatMutation.isPending || !settingsQuery.data}>
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

