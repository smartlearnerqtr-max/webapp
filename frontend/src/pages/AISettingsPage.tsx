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
  const [message, setMessage] = useState('Hay giai thich ngan gon cach hoc bai nay cho hoc sinh bang cau ngan de hieu.')
  const [lessonTitle, setLessonTitle] = useState('Bai hoc demo')
  const [subjectName, setSubjectName] = useState('Toan')
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
    <RequireAuth>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Task 23 + 24</p>
          <h2>Cai dat Gemini va hoi dap AI co ban</h2>
          <p>Key duoc gui ve backend Flask, ma hoa truoc khi luu. M?i request Gemini di qua server de tranh lo key ra frontend va co log de debug.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Luu cau hinh AI</h3>
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
                  {saveMutation.isPending ? 'Dang luu...' : 'Luu cau hinh'}
                </button>
                <button className="ghost-button" type="button" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  {testMutation.isPending ? 'Dang test...' : 'Test key that'}
                </button>
              </div>
              {saveMutation.error ? <p className="error-text">{(saveMutation.error as Error).message}</p> : null}
              {testMutation.error ? <p className="error-text">{(testMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Trang thai hien tai</h3>
            <div className="settings-grid">
              <div><span>Provider</span><strong>{settingsQuery.data?.provider ?? 'gemini'}</strong></div>
              <div><span>Model</span><strong>{settingsQuery.data?.model_name ?? 'gemini-2.5-flash'}</strong></div>
              <div><span>API key</span><strong>{settingsQuery.data?.api_key_masked ?? 'Chua luu'}</strong></div>
              <div><span>Status</span><strong>{settingsQuery.data?.status ?? 'chua_cau_hinh'}</strong></div>
              <div><span>Last error</span><strong>{settingsQuery.data?.last_error_message ?? 'Khong co'}</strong></div>
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Test hoi dap AI</h3>
            <form className="form-stack" onSubmit={handleChatSubmit}>
              <label>
                Mon hoc
                <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Toan" />
              </label>
              <label>
                Bai hoc
                <input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="Nhan biet hinh tron" />
              </label>
              <label>
                Loai hoat dong
                <input value={activityType} onChange={(event) => setActivityType(event.target.value)} placeholder="multiple_choice" />
              </label>
              <label>
                Prompt
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} />
              </label>
              <button className="action-button" type="submit" disabled={chatMutation.isPending || !settingsQuery.data}>
                {chatMutation.isPending ? 'Dang goi Gemini...' : 'Gui prompt'}
              </button>
              {chatMutation.error ? <p className="error-text">{(chatMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Phan hoi AI</h3>
            <div className="response-box">
              {aiReply ? <p>{aiReply}</p> : <p>Chua co phan hoi nao. Hay test key hoac gui prompt de kiem tra luong Gemini.</p>}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
