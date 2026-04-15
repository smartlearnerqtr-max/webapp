import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'

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
import { prefetchRouteData } from './utils/routePrefetch'
import { getDefaultRouteForRole } from './utils/roleRoutes'

const navItemsByRole: Record<string, Array<{ to: string; label: string }>> = {
  admin: [
    { to: '/admin', label: 'Admin' },
  ],
  teacher: [
    { to: '/giao-vien', label: 'Nhà' },
    { to: '/hoc-sinh', label: 'HS' },
    { to: '/lop-hoc', label: 'Lớp' },
    { to: '/bai-hoc', label: 'Bài' },
    { to: '/giao-bai', label: 'Giao' },
    { to: '/tien-do', label: 'Tiến độ' },
    { to: '/cai-dat-ai', label: 'AI' },
  ],
  student: [
    { to: '/hoc-tap', label: 'Học' },
  ],
  parent: [
    { to: '/phu-huynh', label: 'Con' },
  ],
}

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  student: 'Học sinh',
  parent: 'Phụ huynh',
}

function App() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hydrate = useAuthStore((state) => state.hydrate)
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const isLoading = isFetching > 0 || isMutating > 0

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!user || !accessToken) return
    void prefetchRouteData(queryClient, getDefaultRouteForRole(user.role), accessToken)
  }, [accessToken, queryClient, user])

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

  function handleNavPrefetch(targetRoute: string) {
    if (!user || !accessToken) return
    void prefetchRouteData(queryClient, targetRoute, accessToken)
  }

  return (
    <div className="app-shell">
      {isLoading && <div className="global-loading-bar" />}
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
            <h2 className="sidebar-title">Bạn học thông minh</h2>
            <span className="sidebar-card-label">{user ? roleLabels[user.role] ?? user.role : 'Đăng nhập'}</span>
          </div>

        </div>

        <nav className="nav-list" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
              onClick={() => setIsMenuOpen(false)}
              onMouseEnter={() => handleNavPrefetch(item.to)}
              onFocus={() => handleNavPrefetch(item.to)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="sidebar-card-label">Phiên</span>
          <strong>{user ? `${user.email ?? user.phone}` : 'Chưa đăng nhập'}</strong>
          <p>{user ? roleLabels[user.role] ?? user.role : 'Chưa vào'}</p>
          {user ? (
            <p className="sidebar-notification-copy">
              Nhắc <span className="sidebar-notification-badge">{unreadNotificationCount}</span>
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
