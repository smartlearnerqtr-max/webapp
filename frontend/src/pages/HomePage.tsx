import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchHealth, login } from '../services/api'
import { useAuthStore } from '../store/authStore'

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
