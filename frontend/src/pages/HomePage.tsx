import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchHealth, login } from '../services/api'
import { useAuthStore } from '../store/authStore'

const deliveryCards = [
  { title: 'Backend', value: 'Flask', detail: 'Auth, lop hoc, bai hoc, assignment, progress va AI settings dang chay.' },
  { title: 'PWA', value: 'San sang', detail: 'Manifest + service worker cho desktop va Android.' },
  { title: 'Demo teacher', value: 'teacher@example.com', detail: 'Mat khau demo: 123456' },
  { title: 'Demo student', value: 'student@example.com', detail: 'Mat khau demo: 123456' },
  { title: 'Demo parent', value: 'parent@example.com', detail: 'Mat khau demo: 123456' },
  { title: 'Gemini', value: '2.5 Flash', detail: 'API key do nguoi dung tu nhap trong cai dat va duoc ma hoa o backend.' },
]

export function HomePage() {
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const [identity, setIdentity] = useState('teacher@example.com')
  const [password, setPassword] = useState('123456')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  })

  const loginHint = useMemo(() => {
    if (user) {
      return `${profile?.full_name ?? 'Da dang nhap'} (${user.role})`
    }
    return 'Dang nhap de di tu lop hoc sang bai hoc, assignment va tien do.'
  }, [profile, user])

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
      setError(submissionError instanceof Error ? submissionError.message : 'Dang nhap that bai')
    } finally {
      setSubmitState('idle')
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Khoi dong MVP</p>
          <h2>App da chuyen sang luong quan ly hoc tap that.</h2>
          <p className="hero-copy">
            Frontend da noi voi Flask backend cho chuoi nghiep vu: tao hoc sinh, tao lop, gan mon hoc,
            tao bai hoc, them activity, giao bai va xem readiness de giao vien can nhac nang do kho.
          </p>
        </div>
        <div className="status-board">
          <span className="status-label">Backend health</span>
          <strong>
            {isLoading && 'Dang kiem tra...'}
            {isError && 'Chua ket noi'}
            {data?.status === 'ok' && 'Dang hoat dong'}
          </strong>
          <p>{data?.app_name ?? 'Hay chay backend Flask o cong 5000.'}</p>
        </div>
      </section>

      <section className="card-grid triple-grid">
        {deliveryCards.map((card) => (
          <article key={card.title} className="info-card">
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="auth-layout">
        <article className="roadmap-panel">
          <p className="eyebrow">Dang nhap</p>
          <h3>{loginHint}</h3>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              Identity
              <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="teacher@example.com" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="123456" />
            </label>
            <div className="button-row">
              <button className="action-button" type="submit" disabled={submitState === 'submitting'}>
                {submitState === 'submitting' ? 'Dang xu ly...' : 'Dang nhap'}
              </button>
              {user ? (
                <button className="ghost-button" type="button" onClick={clearSession}>
                  Dang xuat local
                </button>
              ) : null}
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </form>
        </article>

        <article className="roadmap-panel">
          <p className="eyebrow">Tien do hien tai</p>
          <h3>Backend va frontend da co xuong song cot loi</h3>
          <ul>
            <li>Dang nhap theo role teacher, student, parent</li>
            <li>Tao va gan hoc sinh vao lop, mot hoc sinh co the o nhieu lop</li>
            <li>Tao bai hoc voi nhieu activity ben trong</li>
            <li>Giao bai theo lop va xem readiness de quyet dinh tang do kho</li>
          </ul>
        </article>
      </section>
    </div>
  )
}
