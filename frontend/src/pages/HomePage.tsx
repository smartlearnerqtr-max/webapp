import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { fetchHealth, login, registerAccount } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { getDefaultRouteForRole } from '../utils/roleRoutes'
import { PWAInstallButton } from '../components/PWAInstallButton'

type AuthMode = 'login' | 'register'
type RegisterRole = 'student' | 'parent'

export function HomePage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const user = useAuthStore((state) => state.user)

  const [mode, setMode] = useState<AuthMode>('login')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [registerRole, setRegisterRole] = useState<RegisterRole>('student')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerDisabilityLevel, setRegisterDisabilityLevel] = useState('trung_binh')
  const [relationshipLabel, setRelationshipLabel] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  })

  useEffect(() => {
    if (user) {
      navigate(getDefaultRouteForRole(user.role), { replace: true })
    }
  }, [navigate, user])

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
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
      navigate(getDefaultRouteForRole(payload.user.role), { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Dang nhap that bai')
    } finally {
      setSubmitState('idle')
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitState('submitting')
    setError(null)
    try {
      const payload = await registerAccount({
        role: registerRole,
        full_name: registerName,
        email: registerEmail || undefined,
        phone: registerPhone || undefined,
        password: registerPassword,
        disability_level: registerRole === 'student' ? registerDisabilityLevel : undefined,
        relationship_label: registerRole === 'parent' ? relationshipLabel || undefined : undefined,
      })
      setSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: payload.user,
        profile: payload.profile,
      })
      navigate(getDefaultRouteForRole(payload.user.role), { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Dang ky that bai')
    } finally {
      setSubmitState('idle')
    }
  }

  return (
    <div className="page-stack">
      <section className="auth-layout">
        <article className="roadmap-panel">
          <p className="eyebrow">Tai khoan</p>
          <h3>Dang nhap va dang ky</h3>
          <p>Hoc sinh va phu huynh co the tu tao tai khoan. Giao vien chi dang nhap bang tai khoan do admin cap. Admin dung tai khoan bootstrap de cap giao vien moi.</p>

          <div className="button-row">
            <button className={mode === 'login' ? 'action-button' : 'ghost-button'} type="button" onClick={() => setMode('login')}>
              Dang nhap
            </button>
            <button className={mode === 'register' ? 'action-button' : 'ghost-button'} type="button" onClick={() => setMode('register')}>
              Dang ky
            </button>
          </div>

          {mode === 'login' ? (
            <form className="form-stack" onSubmit={handleLoginSubmit} style={{ marginTop: '1rem' }}>
              <label>
                Email hoac so dien thoai
                <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Nhap email hoac so dien thoai" />
              </label>
              <label>
                Mat khau
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhap mat khau" />
              </label>
              <div className="button-row">
                <button className="action-button" type="submit" disabled={submitState === 'submitting'}>
                  {submitState === 'submitting' ? 'Dang xu ly...' : 'Dang nhap'}
                </button>
                {user ? (
                  <button className="ghost-button" type="button" onClick={clearSession}>
                    Dang xuat
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleRegisterSubmit} style={{ marginTop: '1rem' }}>
              <label>
                Vai tro tu dang ky
                <select value={registerRole} onChange={(event) => setRegisterRole(event.target.value as RegisterRole)}>
                  <option value="student">Hoc sinh</option>
                  <option value="parent">Phu huynh</option>
                </select>
              </label>
              <label>
                Ho ten
                <input value={registerName} onChange={(event) => setRegisterName(event.target.value)} placeholder="Nhap ho ten" />
              </label>
              <label>
                Email
                <input value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="co the de trong neu dung so dien thoai" />
              </label>
              <label>
                So dien thoai
                <input value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} placeholder="co the de trong neu dung email" />
              </label>
              <label>
                Mat khau
                <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="Tu dat mat khau" />
              </label>
              {registerRole === 'student' ? (
                <label>
                  Muc do khuyet tat
                  <select value={registerDisabilityLevel} onChange={(event) => setRegisterDisabilityLevel(event.target.value)}>
                    <option value="nhe">Nhe</option>
                    <option value="trung_binh">Trung binh</option>
                    <option value="nang">Nang</option>
                  </select>
                </label>
              ) : null}
              {registerRole === 'parent' ? (
                <label>
                  Moi quan he
                  <input value={relationshipLabel} onChange={(event) => setRelationshipLabel(event.target.value)} placeholder="Me, Ba, Nguoi giam ho..." />
                </label>
              ) : null}
              <button className="action-button" type="submit" disabled={submitState === 'submitting'}>
                {submitState === 'submitting' ? 'Dang tao tai khoan...' : 'Dang ky va vao he thong'}
              </button>
            </form>
          )}

          <PWAInstallButton />
          {error ? <p className="error-text">{error}</p> : null}
        </article>

        <article className="roadmap-panel">
          <p className="eyebrow">Trang thai</p>
          <h3>Backend</h3>
          <div>
            {isLoading && <p>Dang kiem tra...</p>}
            {isError && <p style={{ color: '#d32f2f' }}>Chua ket noi</p>}
            {data?.status === 'ok' && <p style={{ color: '#388e3c' }}>Dang hoat dong</p>}
            {data?.app_name && <p>{data.app_name}</p>}
          </div>
          <div className="detail-stack" style={{ marginTop: '1rem' }}>
            <div className="student-row">
              <strong>Hoc sinh / phu huynh</strong>
              <span>Tu dang ky tai khoan ngay tai man hinh nay</span>
            </div>
            <div className="student-row">
              <strong>Giao vien</strong>
              <span>Chi dang nhap sau khi duoc admin cap tai khoan</span>
            </div>
            <div className="student-row">
              <strong>Admin</strong>
              <span>Chi dung de tao va cap tai khoan giao vien</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
