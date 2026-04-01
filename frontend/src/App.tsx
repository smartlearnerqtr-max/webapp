import './App.css'
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'

import { AISettingsPage } from './pages/AISettingsPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { ClassesPage } from './pages/ClassesPage'
import { HomePage } from './pages/HomePage'
import { LessonsPage } from './pages/LessonsPage'
import { ParentPage } from './pages/ParentPage'
import { ProgressPage } from './pages/ProgressPage'
import { StudentsPage } from './pages/StudentsPage'
import { useAuthStore } from './store/authStore'

const navItems = [
  { to: '/', label: 'Tổng quan' },
  { to: '/hoc-sinh', label: 'Học sinh' },
  { to: '/lop-hoc', label: 'Lớp học' },
  { to: '/bai-hoc', label: 'Bài học' },
  { to: '/giao-bai', label: 'Giao bài' },
  { to: '/tien-do', label: 'Tiến độ' },
  { to: '/phu-huynh', label: 'Phụ huynh' },
  { to: '/cai-dat-ai', label: 'Cài đặt AI' },
]

function App() {
  const hydrate = useAuthStore((state) => state.hydrate)
  const user = useAuthStore((state) => state.user)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

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
            Nền tảng học tập dành cho học sinh khuyết tật với hỗ trợ AI và công nghệ tiên tiến.
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
          <p></p>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hoc-sinh" element={<StudentsPage />} />
          <Route path="/lop-hoc" element={<ClassesPage />} />
          <Route path="/bai-hoc" element={<LessonsPage />} />
          <Route path="/giao-bai" element={<AssignmentsPage />} />
          <Route path="/tien-do" element={<ProgressPage />} />
          <Route path="/phu-huynh" element={<ParentPage />} />
          <Route path="/cai-dat-ai" element={<AISettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
