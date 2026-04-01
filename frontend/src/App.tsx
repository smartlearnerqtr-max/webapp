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
    { to: '/giao-vien', label: 'Trang giao vien' },
    { to: '/hoc-sinh', label: 'Hoc sinh' },
    { to: '/lop-hoc', label: 'Lop hoc' },
    { to: '/bai-hoc', label: 'Bai hoc' },
    { to: '/giao-bai', label: 'Giao bai' },
    { to: '/tien-do', label: 'Tien do' },
    { to: '/cai-dat-ai', label: 'Cai dat AI' },
  ],
  student: [
    { to: '/hoc-tap', label: 'Trang hoc sinh' },
  ],
  parent: [
    { to: '/phu-huynh', label: 'Trang phu huynh' },
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
      return [{ to: '/', label: 'Dang nhap / dang ky' }]
    }

    return navItemsByRole[user.role] ?? [{ to: getDefaultRouteForRole(user.role), label: 'Trang cua toi' }]
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
          <p className="eyebrow">Ban hoc thong minh</p>
          <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem' }}>He thong ho tro hoc tap</h2>
          <p className="sidebar-copy">
            {user?.role === 'admin' && 'Khong gian admin: chi dung de cap tai khoan giao vien.'}
            {user?.role === 'teacher' && 'Khong gian dieu phoi danh cho giao vien: quan ly hoc sinh, bai hoc va assignment.'}
            {user?.role === 'student' && 'Khong gian hoc sinh: xem bai duoc giao va theo doi tien do hoc tap cua minh.'}
            {user?.role === 'parent' && 'Khong gian phu huynh: theo doi tien do hoc tap va tinh hinh hoc cua con.'}
            {!user && 'Hoc sinh va phu huynh co the tu dang ky. Giao vien duoc admin cap tai khoan rieng.'}
          </p>
        </div>

        <nav className="nav-list" aria-label="Dieu huong chinh">
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
          <span className="sidebar-card-label">Trang thai</span>
          <strong>{user ? `${user.email ?? user.phone} (${user.role})` : 'Chua dang nhap'}</strong>
          {user ? (
            <button className="ghost-button" type="button" onClick={handleLogout} style={{ marginTop: '0.75rem', width: '100%' }}>
              Dang xuat
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
