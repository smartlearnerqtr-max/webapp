import './App.css'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'

import { RealtimeBridge } from './components/RealtimeBridge'
import { useAuthStore } from './store/authStore'
import { prefetchRouteData } from './utils/routePrefetch'
import { getDefaultRouteForRole } from './utils/roleRoutes'

const loadHomePage = () => import('./pages/HomePage')
const loadAdminPage = () => import('./pages/AdminPage')
const loadTeacherHomePage = () => import('./pages/TeacherHomePage')
const loadStudentHomePage = () => import('./pages/StudentHomePage')
const loadStudentsPage = () => import('./pages/StudentsPage')
const loadClassesPage = () => import('./pages/ClassesPage')
const loadLessonsPage = () => import('./pages/LessonsPage')
const loadProgressPage = () => import('./pages/ProgressPage')
const loadParentPage = () => import('./pages/ParentPage')
const loadAISettingsPage = () => import('./pages/AISettingsPage')

const HomePage = lazy(() => loadHomePage().then((module) => ({ default: module.HomePage })))
const AdminPage = lazy(() => loadAdminPage().then((module) => ({ default: module.AdminPage })))
const TeacherHomePage = lazy(() => loadTeacherHomePage().then((module) => ({ default: module.TeacherHomePage })))
const StudentHomePage = lazy(() => loadStudentHomePage().then((module) => ({ default: module.StudentHomePage })))
const StudentsPage = lazy(() => loadStudentsPage().then((module) => ({ default: module.StudentsPage })))
const ClassesPage = lazy(() => loadClassesPage().then((module) => ({ default: module.ClassesPage })))
const LessonsPage = lazy(() => loadLessonsPage().then((module) => ({ default: module.LessonsPage })))
const ProgressPage = lazy(() => loadProgressPage().then((module) => ({ default: module.ProgressPage })))
const ParentPage = lazy(() => loadParentPage().then((module) => ({ default: module.ParentPage })))
const AISettingsPage = lazy(() => loadAISettingsPage().then((module) => ({ default: module.AISettingsPage })))

const routeChunkPreloadMap: Record<string, () => Promise<unknown>> = {
  '/': loadHomePage,
  '/admin': loadAdminPage,
  '/giao-vien': loadTeacherHomePage,
  '/hoc-tap': loadStudentHomePage,
  '/hoc-sinh': loadStudentsPage,
  '/lop-hoc': loadClassesPage,
  '/bai-hoc': loadLessonsPage,
  '/tien-do': loadProgressPage,
  '/phu-huynh': loadParentPage,
  '/cai-dat-ai': loadAISettingsPage,
}

const navItemsByRole: Record<string, Array<{ to: string; label: string; matchTab?: string }>> = {
  admin: [
    { to: '/admin', label: 'Admin' },
    { to: '/cai-dat-ai', label: 'AI' },
  ],
  teacher: [
    { to: '/giao-vien', label: 'Nhà' },
    { to: '/hoc-sinh', label: 'HS' },
    { to: '/lop-hoc', label: 'Lớp' },
    { to: '/bai-hoc', label: 'Bài' },
    { to: '/tien-do', label: 'Tiến độ' },
  ],
  student: [
    { to: '/hoc-tap', label: 'Học tập', matchTab: '' },
    { to: '/hoc-tap?tab=ai', label: 'Bạn học AI', matchTab: 'ai' },
    { to: '/hoc-tap?tab=communication', label: 'Giao tiếp', matchTab: 'communication' },
    { to: '/hoc-tap?tab=settings', label: 'Cài đặt', matchTab: 'settings' },
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
  const location = useLocation()
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
  const isTeacherRole = user?.role === 'teacher'

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
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith('student-entry-gate:')) {
        window.sessionStorage.removeItem(key)
      }
    }

    clearSession()
    setIsMenuOpen(false)
    navigate('/', { replace: true })
  }

  function handleNavPrefetch(targetRoute: string) {
    const [routePath] = targetRoute.split('?')
    const preloadChunk = routeChunkPreloadMap[routePath]
    if (preloadChunk) {
      void preloadChunk()
    }
    if (!user || !accessToken || routePath === location.pathname) return
    void prefetchRouteData(queryClient, routePath, accessToken)
  }

  function isNavItemActive(targetRoute: string, matchTab?: string) {
    const [pathname] = targetRoute.split('?')
    if (location.pathname !== pathname) return false
    if (matchTab === undefined) return true
    const currentTab = new URLSearchParams(location.search).get('tab') ?? ''
    return currentTab === matchTab
  }

  const routeFallback = <div className="helper-text">Đang tải trang...</div>

  return (
    <div className={`app-shell ${isTeacherRole ? 'app-shell-teacher' : ''}`}>
      {isLoading && <div className="global-loading-bar" />}

      <button
        className={`menu-toggle-fixed ${isTeacherRole ? 'menu-toggle-fixed-teacher' : ''}`}
        onClick={() => setIsMenuOpen((current) => !current)}
        aria-label="Mở điều hướng"
        aria-expanded={isMenuOpen}
      >
        {user && unreadNotificationCount > 0 ? <span className="menu-toggle-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span> : null}
        <span className="menu-toggle-line"></span>
        <span className="menu-toggle-line"></span>
        <span className="menu-toggle-line"></span>
      </button>

      {isMenuOpen ? <div className="backdrop" onClick={() => setIsMenuOpen(false)}></div> : null}

      <aside className={`sidebar ${isMenuOpen ? 'sidebar-open' : ''} ${isTeacherRole ? 'sidebar-teacher' : ''}`}>
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
              className={isNavItemActive(item.to, item.matchTab) ? 'nav-item nav-item-active' : 'nav-item'}
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

      <main className={`content ${isTeacherRole ? 'content-teacher' : ''}`}>
        <RealtimeBridge isNotificationPanelOpen={isMenuOpen} onUnreadCountChange={setUnreadNotificationCount} />
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route path="/" element={user ? <Navigate to={getDefaultRouteForRole(user.role)} replace /> : <HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/giao-vien" element={<TeacherHomePage />} />
            <Route path="/hoc-tap" element={<StudentHomePage />} />
            <Route path="/hoc-sinh" element={<StudentsPage />} />
            <Route path="/lop-hoc" element={<ClassesPage />} />
            <Route path="/bai-hoc" element={<LessonsPage />} />
            <Route path="/tien-do" element={<ProgressPage />} />
            <Route path="/phu-huynh" element={<ParentPage />} />
            <Route path="/cai-dat-ai" element={<AISettingsPage />} />
            <Route path="*" element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/'} replace />} />
          </Routes>
        </Suspense>
      </main>

      <div className="ocean-waves-container" aria-hidden="true">
        <svg className="ocean-waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
          <defs>
            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
          </defs>
          <g className="ocean-wave-parallax">
            <use xlinkHref="#gentle-wave" x="48" y="0" fill="hsla(205, 80%, 35%, 0.1)" />
            <use xlinkHref="#gentle-wave" x="48" y="3" fill="hsla(205, 80%, 35%, 0.15)" />
            <use xlinkHref="#gentle-wave" x="48" y="5" fill="hsla(205, 80%, 35%, 0.05)" />
            <use xlinkHref="#gentle-wave" x="48" y="7" fill="hsla(200, 60%, 97%, 0.5)" />
          </g>
        </svg>
      </div>
    </div>
  )
}

export default App
