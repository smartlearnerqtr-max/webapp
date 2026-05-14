import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { login, registerAccount } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { getDefaultRouteForRole } from '../utils/roleRoutes'

type AuthMode = 'login' | 'register'
type RegisterRole = 'student' | 'parent'

function resolvePostRegisterRoute(role: RegisterRole) {
  if (role === 'student') return '/hoc-tap?tab=settings&setup=1'
  return '/phu-huynh?setup=1'
}

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
      navigate(resolvePostRegisterRoute(registerRole), { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Đăng ký thất bại')
    } finally {
      setSubmitState('idle')
    }
  }

  return (
    <div className="page-stack home-page">
      <section className="auth-layout auth-layout-home">
        <article className="sealife-hero">
          <div className="sealife-underwater-scene">
            <div className="sealife-creature sealife-jellyfish">🪼</div>
            <div className="sealife-creature sealife-turtle">🐢</div>
            <div className="sealife-creature sealife-octopus">🐙</div>
            <div className="sealife-creature sealife-crab">🦀</div>
            <div className="sealife-creature sealife-fish1">🐠</div>
            <div className="sealife-creature sealife-fish2">🐟</div>
            <div className="sealife-coral sealife-coral1">🪸</div>
            <div className="sealife-coral sealife-coral2">🌿</div>
            <div className="sealife-rock">🪨</div>
            <div className="sealife-bubbles">
              <span className="bubble"></span><span className="bubble"></span><span className="bubble"></span>
            </div>
          </div>
          <div className="sealife-wave-divider" aria-hidden="true">
            <svg viewBox="0 0 100 1000" preserveAspectRatio="none">
              <path className="wave-layer wave-layer-1" d="M0,0 C40,200 60,400 30,600 C0,800 50,900 100,1000 L100,0 Z" />
              <path className="wave-layer wave-layer-2" d="M20,0 C60,250 80,450 50,650 C20,850 70,950 100,1000 L100,0 Z" />
              <path className="wave-layer wave-layer-3" d="M40,0 C80,300 100,500 70,700 C40,900 90,980 100,1000 L100,0 Z" />
              <path className="wave-layer wave-layer-4" d="M70,0 C100,350 110,550 90,750 C70,950 100,1000 100,1000 L100,0 Z" />
            </svg>
          </div>
        </article>

        <article className="sealife-auth-card">
          <div className="sealife-auth-header">
            <h1 className="hero-title">BẠN HỌC THÔNG MINH</h1>
          </div>
          <div className="mode-switch" role="tablist" aria-label="Chọn chế độ tài khoản">
            <button className={mode === 'login' ? 'mode-switch-button mode-switch-button-active' : 'mode-switch-button'} type="button" onClick={() => setMode('login')}>
              Đăng nhập
            </button>
            <button className={mode === 'register' ? 'mode-switch-button mode-switch-button-active' : 'mode-switch-button'} type="button" onClick={() => setMode('register')}>
              Đăng ký
            </button>
          </div>

          {mode === 'login' ? (
            <form className="form-stack" onSubmit={handleLoginSubmit}>
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
                  {submitState === 'submitting' ? 'Đang xử lý...' : 'Vào ứng dụng'}
                </button>
                {user ? (
                  <button className="ghost-button" type="button" onClick={clearSession}>
                    Đăng xuất
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleRegisterSubmit}>
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
                <input value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="Có thể để trống nếu dùng số điện thoại" />
              </label>
              <label>
                Số điện thoại
                <input value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} placeholder="Có thể để trống nếu dùng email" />
              </label>
              <label>
                Mật khẩu
                <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="Tự đặt mật khẩu" />
              </label>
              {registerRole === 'student' ? (
                <label>
                  Mức độ hỗ trợ
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
                {submitState === 'submitting' ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
            </form>
          )}

          {error ? <p className="error-text">{error}</p> : null}
        </article>
      </section>
    </div>
  )
}
