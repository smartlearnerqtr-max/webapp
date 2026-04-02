import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { AdminPage } from './pages/AdminPage'
import { AISettingsPage } from './pages/AISettingsPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { ClassesPage } from './pages/ClassesPage'
import { HomePage } from './pages/HomePage'
import { LessonsPage } from './pages/LessonsPage'
import { ParentPage } from './pages/ParentPage'
import { ProgressPage } from './pages/ProgressPage'
import { StudentHomePage } from './pages/StudentHomePage'
import { StudentsPage } from './pages/StudentsPage'
import { TeacherHomePage } from './pages/TeacherHomePage'
import { useAuthStore } from './store/authStore'
import { getDefaultRouteForRole } from './utils/roleRoutes'

const navItemsByRole: Record<string, Array<{ to: string; label: string }>> = {
  admin: [
    { to: '/admin', label: 'Trang admin' },
  ],
  teacher: [
    { to: '/giao-vien', label: 'Trang giáo viên' },
    { to: '/hoc-sinh', label: 'Học sinh' },
    { to: '/lop-hoc', label: 'Lớp học' },
    { to: '/bai-hoc', label: 'Bài học' },
    { to: '/giao-bai', label: 'Giao bài' },
    { to: '/tien-do', label: 'Tiến độ' },
    { to: '/cai-dat-ai', label: 'Cài đặt AI' },
  ],
  student: [
    { to: '/hoc-tap', label: 'Trang học sinh' },
  ],
  parent: [
    { to: '/phu-huynh', label: 'Trang phụ huynh' },
  ],
}

function App() {
  const navigate = useNavigate()
  const hydrate = useAuthStore((state) => state.hydrate)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const navItems = useMemo(() => {
    if (!user) {
      return [{ to: '/', label: 'Đăng nhập / đăng ký' }]
    }

    return navItemsByRole[user.role] ?? [{ to: getDefaultRouteForRole(user.role), label: 'Trang của tôi' }]
  }, [user])

  function handleLogout() {
    clearSession()
    setIsMenuOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <button
        className="menu-toggle-fixed"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle navigation"
        aria-expanded={isMenuOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {isMenuOpen && <div className="backdrop" onClick={() => setIsMenuOpen(false)}></div>}

      <aside className={`sidebar ${isMenuOpen ? 'sidebar-open' : ''}`}>
        <div>
          <p className="eyebrow">Bạn học thông minh</p>
          <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem' }}>Hệ thống hỗ trợ học tập</h2>
          <p className="sidebar-copy">
            {user?.role === 'admin' && 'Không gian admin: chỉ dùng để cấp tài khoản giáo viên.'}
            {user?.role === 'teacher' && 'Không gian điều phối dành cho giáo viên: quản lý học sinh, bài học và assignment.'}
            {user?.role === 'student' && 'Không gian học sinh: xem bài được giao và theo dõi tiến độ học tập của mình.'}
            {user?.role === 'parent' && 'Không gian phụ huynh: theo dõi tiến độ học tập và tình hình học của con.'}
            {!user && 'Học sinh và phụ huynh có thể tự đăng ký. Giáo viên được admin cấp tài khoản riêng.'}
          </p>
        </div>

        <nav className="nav-list" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="sidebar-card-label">Trạng thái</span>
          <strong>{user ? `${user.email ?? user.phone} (${user.role})` : 'Chưa đăng nhập'}</strong>
          {user ? (
            <button className="ghost-button" type="button" onClick={handleLogout} style={{ marginTop: '0.75rem', width: '100%' }}>
              Đăng xuất
            </button>
          ) : null}
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={user ? <Navigate to={getDefaultRouteForRole(user.role)} replace /> : <HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/giao-vien" element={<TeacherHomePage />} />
          <Route path="/hoc-tap" element={<StudentHomePage />} />
          <Route path="/hoc-sinh" element={<StudentsPage />} />
          <Route path="/lop-hoc" element={<ClassesPage />} />
          <Route path="/bai-hoc" element={<LessonsPage />} />
          <Route path="/giao-bai" element={<AssignmentsPage />} />
          <Route path="/tien-do" element={<ProgressPage />} />
          <Route path="/phu-huynh" element={<ParentPage />} />
          <Route path="/cai-dat-ai" element={<AISettingsPage />} />
          <Route path="*" element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/'} replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
