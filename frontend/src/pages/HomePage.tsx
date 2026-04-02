import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { PWAInstallButton } from '../components/PWAInstallButton'
import { login, registerAccount } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { getDefaultRouteForRole } from '../utils/roleRoutes'

type AuthMode = 'login' | 'register'
type RegisterRole = 'student' | 'parent'

const homeStats = [
  { label: 'Bài học trực quan', value: '24+' },
  { label: 'Vai trò phối hợp', value: '4' },
  { label: 'Theo dõi mỗi ngày', value: '100%' },
]

const learningTags = ['Toán dễ hiểu', 'Ngôn ngữ', 'Kỹ năng sống', 'Theo dõi tiến độ']

const roleGuides = [
  {
    title: 'Học sinh / phụ huynh',
    description: 'Tự tạo tài khoản và bắt đầu học ngay từ điện thoại hoặc máy tính bảng.',
  },
  {
    title: 'Giáo viên',
    description: 'Đăng nhập bằng tài khoản được cấp để quản lý lớp, bài học và báo cáo.',
  },
  {
    title: 'Quản trị viên',
    description: 'Thiết lập tài khoản giáo viên và giữ luồng vận hành gọn, dễ kiểm soát.',
  },
]

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
      navigate(getDefaultRouteForRole(payload.user.role), { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Đăng ký thất bại')
    } finally {
      setSubmitState('idle')
    }
  }

  return (
    <div className="page-stack home-page">
      <section className="auth-layout auth-layout-home">
        <article className="roadmap-panel auth-hero">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">Bạn học thông minh</p>
            <h1 className="hero-title">Ứng dụng hỗ trợ học tập cho học sinh, phụ huynh và giáo viên.</h1>
          </div>

          <div className="home-stats">
            {homeStats.map((item) => (
              <div key={item.label} className="home-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="phone-stage">
            <div className="phone-frame">
              <div className="phone-topbar">
                <span className="phone-dot"></span>
                <span className="phone-dot"></span>
                <span className="phone-dot"></span>
              </div>
              <div className="phone-hero-area">
                <div className="hero-bubble hero-bubble-large"></div>
                <div className="hero-bubble hero-bubble-small"></div>
                <div className="hero-character hero-character-left"></div>
                <div className="hero-character hero-character-right"></div>
                <div className="hero-book"></div>
              </div>
              <div className="phone-course-list">
                <div className="phone-course-card phone-course-card-blue">
                  <span>Lộ trình cá nhân</span>
                  <strong>Bài hôm nay</strong>
                </div>
                <div className="phone-course-card phone-course-card-yellow">
                  <span>Tiến độ</span>
                  <strong>Đang ổn định</strong>
                </div>
                <div className="phone-course-card phone-course-card-coral">
                  <span>Gắn kết phụ huynh</span>
                  <strong>Nhắc việc rõ ràng</strong>
                </div>
              </div>
            </div>
            <div className="floating-note note-top">Lớp học trực quan</div>
            <div className="floating-note note-bottom">Theo dõi dễ hiểu</div>
          </div>

          <div className="hero-pill-row">
            {learningTags.map((tag) => (
              <span key={tag} className="hero-pill">{tag}</span>
            ))}
          </div>
        </article>

        <article className="roadmap-panel auth-card">
          <div className="form-card-header">
            <p className="eyebrow form-eyebrow">Bắt đầu</p>
            <h3>Đăng nhập và đăng ký</h3>
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

          <PWAInstallButton />
          {error ? <p className="error-text">{error}</p> : null}
        </article>
      </section>

      <section className="roadmap-panel role-guide-panel">
        <p className="eyebrow form-eyebrow">Luồng sử dụng</p>
        <h3>Thiết kế cho đúng người, đúng việc</h3>
        <div className="home-role-grid">
          {roleGuides.map((item) => (
            <div key={item.title} className="role-card">
              <span className="role-card-label">Vai trò</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
