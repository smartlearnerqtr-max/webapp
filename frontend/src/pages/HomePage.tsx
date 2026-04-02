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
      setError(submissionError instanceof Error ? submissionError.message : 'Đăng nhập thất bại')
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
      setError(submissionError instanceof Error ? submissionError.message : 'Đăng ký thất bại')
    } finally {
      setSubmitState('idle')
    }
  }

  return (
    <div className="page-stack">
      <section className="auth-layout">
        <article className="roadmap-panel">
          <p className="eyebrow">Tài khoản</p>
          <h3>Đăng nhập và đăng ký</h3>
          <p>Học sinh và phụ huynh có thể tự tạo tài khoản. Giáo viên chỉ đăng nhập bằng tài khoản do admin cấp. Admin dùng tài khoản bootstrap để cấp giáo viên mới.</p>

          <div className="button-row">
            <button className={mode === 'login' ? 'action-button' : 'ghost-button'} type="button" onClick={() => setMode('login')}>
              Đăng nhập
            </button>
            <button className={mode === 'register' ? 'action-button' : 'ghost-button'} type="button" onClick={() => setMode('register')}>
              Đăng ký
            </button>
          </div>

          {mode === 'login' ? (
            <form className="form-stack" onSubmit={handleLoginSubmit} style={{ marginTop: '1rem' }}>
              <label>
                Email hoặc số điện thoại
                <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Nhập email hoặc số điện thoại" />
              </label>
              <label>
                Mật khẩu
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" />
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
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleRegisterSubmit} style={{ marginTop: '1rem' }}>
              <label>
                Vai trò tự đăng ký
                <select value={registerRole} onChange={(event) => setRegisterRole(event.target.value as RegisterRole)}>
                  <option value="student">Học sinh</option>
                  <option value="parent">Phụ huynh</option>
                </select>
              </label>
              <label>
                Họ tên
                <input value={registerName} onChange={(event) => setRegisterName(event.target.value)} placeholder="Nhập họ tên" />
              </label>
              <label>
                Email
                <input value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="có thể để trống nếu dùng số điện thoại" />
              </label>
              <label>
                Số điện thoại
                <input value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} placeholder="có thể để trống nếu dùng email" />
              </label>
              <label>
                Mật khẩu
                <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="Tự đặt mật khẩu" />
              </label>
              {registerRole === 'student' ? (
                <label>
                  Mức độ khuyết tật
                  <select value={registerDisabilityLevel} onChange={(event) => setRegisterDisabilityLevel(event.target.value)}>
                    <option value="nhe">Nhẹ</option>
                    <option value="trung_binh">Trung bình</option>
                    <option value="nang">Nặng</option>
                  </select>
                </label>
              ) : null}
              {registerRole === 'parent' ? (
                <label>
                  Mối quan hệ
                  <input value={relationshipLabel} onChange={(event) => setRelationshipLabel(event.target.value)} placeholder="Mẹ, Ba, Người giám hộ..." />
                </label>
              ) : null}
              <button className="action-button" type="submit" disabled={submitState === 'submitting'}>
                {submitState === 'submitting' ? 'Đang tạo tài khoản...' : 'Đăng ký và vào hệ thống'}
              </button>
            </form>
          )}

          <PWAInstallButton />
          {error ? <p className="error-text">{error}</p> : null}
        </article>

        <article className="roadmap-panel">
          <p className="eyebrow">Trạng thái</p>
          <h3>Backend</h3>
          <div>
            {isLoading && <p>Đang kiểm tra...</p>}
            {isError && <p style={{ color: '#d32f2f' }}>Chưa kết nối</p>}
            {data?.status === 'ok' && <p style={{ color: '#388e3c' }}>Đang hoạt động</p>}
            {data?.app_name && <p>{data.app_name}</p>}
          </div>
          <div className="detail-stack" style={{ marginTop: '1rem' }}>
            <div className="student-row">
              <strong>Học sinh / phụ huynh</strong>
              <span>Tự đăng ký tài khoản ngay tại màn hình này</span>
            </div>
            <div className="student-row">
              <strong>Giáo viên</strong>
              <span>Chỉ đăng nhập sau khi được admin cấp tài khoản</span>
            </div>
            <div className="student-row">
              <strong>Admin</strong>
              <span>Chỉ dùng để tạo và cấp tài khoản giáo viên</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
