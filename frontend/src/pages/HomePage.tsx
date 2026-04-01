import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchHealth, login } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { PWAInstallButton } from '../components/PWAInstallButton'

export function HomePage() {
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const user = useAuthStore((state) => state.user)
  const [identity, setIdentity] = useState('teacher@example.com')
  const [password, setPassword] = useState('123456')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitState('submitting')
    setError(null)
    try {
      const payload = await login(identity, password)
      setSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: payload.user,
        profile: payload.profile,
      })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Đăng nhập thất bại')
    } finally {
      setSubmitState('idle')
    }
  }

  return (
    <div className="page-stack">
      {user ? (
        <>
          <section className="roadmap-panel" style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a78bfa 50%, #818cf8 100%)', color: '#ffffff', padding: '2rem' }}>
            <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.9)' }}>Chào mừng quay trở lại</p>
            <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', fontWeight: 800 }}>Học tập thông minh</h2>
            <p style={{ marginTop: '0.5rem', fontSize: '1rem', color: 'rgba(255,255,255,0.85)' }}>Nâng cao kỹ năng của bạn với sự hỗ trợ của AI và các hoạt động tương tác</p>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            <div className="mini-card">
              <span>Giờ học</span>
              <strong>1.5</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Hoàn thành</p>
            </div>
            <div className="mini-card">
              <span>Bài học</span>
              <strong>10</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Trong khóa</p>
            </div>
            <div className="mini-card">
              <span>Điểm thành tích</span>
              <strong>850</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Tổng cộng</p>
            </div>
            <div className="mini-card">
              <span>Chuỗi học</span>
              <strong>7</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Ngày liên tiếp</p>
            </div>
          </section>
        </>
      ) : null}
      <section className="auth-layout">
        <article className="roadmap-panel">
          <p className="eyebrow">Đăng nhập</p>
          <h3>Bạn học thông minh</h3>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              Email hoặc số điện thoại
              <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="teacher@example.com" />
            </label>
            <label>
              Mật khẩu
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="123456" />
            </label>
            <div className="button-row">
              <button className="action-button" type="submit" disabled={submitState === 'submitting'}>
                {submitState === 'submitting' ? 'Đang xử lý...' : 'Đăng nhập'}
              </button>
              {user ? (
                <button className="ghost-button" type="button" onClick={clearSession}>
                  Đăng xuất
                </button>
              ) : null}
            </div>
            <PWAInstallButton />
            {error ? <p className="error-text">{error}</p> : null}
          </form>
        </article>

        <article className="roadmap-panel">
          <p className="eyebrow">Trạng thái</p>
          <h3>Backend</h3>
          <div>
            {isLoading && <p>Đang kiểm tra...</p>}
            {isError && <p style={{ color: '#d32f2f' }}>Chưa kết nối</p>}
            {data?.status === 'ok' && <p style={{ color: '#388e3c' }}>✓ Đang hoạt động</p>}
            {data?.app_name && <p>{data.app_name}</p>}
          </div>
        </article>
      </section>
    </div>
  )
}
