import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { RealtimeBridge } from './components/RealtimeBridge'
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
    { to: '/admin', label: 'Quản trị' },
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

const roleDescriptions: Record<string, string> = {
  admin: 'Quản lý tài khoản và hệ thống.',
  teacher: 'Quản lý lớp học, bài học và phụ huynh.',
  student: 'Xem bài được giao và theo dõi tiến độ học tập.',
  parent: 'Theo dõi tình hình học tập của con.',
}

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  student: 'Học sinh',
  parent: 'Phụ huynh',
}

function App() {
  const navigate = useNavigate()
  const hydrate = useAuthStore((state) => state.hydrate)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const navItems = useMemo(() => {
    if (!user) {
      return [{ to: '/', label: 'Đăng nhập / đăng ký' }]
    }

    return navItemsByRole[user.role] ?? [{ to: getDefaultRouteForRole(user.role), label: 'Trang của tôi' }]
  }, [user])

  const activeDescription = user ? roleDescriptions[user.role] ?? 'Không gian học tập của bạn đã sẵn sàng.' : 'Đăng nhập để sử dụng hệ thống.'

  function handleLogout() {
    clearSession()
    setIsMenuOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <button
        className="menu-toggle-fixed"
        onClick={() => setIsMenuOpen((current) => !current)}
        aria-label="Mở điều hướng"
        aria-expanded={isMenuOpen}
      >
        {user && unreadNotificationCount > 0 ? <span className="menu-toggle-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span> : null}
        <span className="menu-toggle-line"></span>
        <span className="menu-toggle-line"></span>
        <span className="menu-toggle-line"></span>
      </button>

      {isMenuOpen && <div className="backdrop" onClick={() => setIsMenuOpen(false)}></div>}

      <aside className={`sidebar ${isMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand-block">
            <p className="eyebrow">Bạn học thông minh</p>
            <h2 className="sidebar-title">Bạn học thông minh</h2>
            <p className="sidebar-copy">{activeDescription}</p>
          </div>

          <div className="sidebar-preview">
            <div className="preview-tile">
              <span className="preview-caption">Lộ trình học</span>
              <strong className="preview-metric">Ngắn gọn</strong>
            </div>
            <div className="preview-tile">
              <span className="preview-caption">Theo dõi</span>
              <strong className="preview-metric">Rõ tiến độ</strong>
            </div>
            <div className="preview-tile">
              <span className="preview-caption">Phối hợp</span>
              <strong className="preview-metric">GV · PH</strong>
            </div>
          </div>
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
          <span className="sidebar-card-label">Phiên hiện tại</span>
          <strong>{user ? `${user.email ?? user.phone}` : 'Chưa đăng nhập'}</strong>
          <p>{user ? `Vai trò: ${roleLabels[user.role] ?? user.role}` : 'Đăng nhập để mở màn hình học tập riêng của bạn.'}</p>
          {user ? (
            <p className="sidebar-notification-copy">
              Thông báo mới: <span className="sidebar-notification-badge">{unreadNotificationCount}</span>
            </p>
          ) : null}
          {user ? (
            <button className="ghost-button" type="button" onClick={handleLogout} style={{ marginTop: '0.9rem', width: '100%' }}>
              Đăng xuất
            </button>
          ) : null}
        </div>
      </aside>

      <main className="content">
        <RealtimeBridge isNotificationPanelOpen={isMenuOpen} onUnreadCountChange={setUnreadNotificationCount} />
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
