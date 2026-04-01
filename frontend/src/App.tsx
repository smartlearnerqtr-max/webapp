import './App.css'
import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'

import { AISettingsPage } from './pages/AISettingsPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { ClassesPage } from './pages/ClassesPage'
import { HomePage } from './pages/HomePage'
import { LessonsPage } from './pages/LessonsPage'
import { LogsPage } from './pages/LogsPage'
import { ParentPage } from './pages/ParentPage'
import { ProgressPage } from './pages/ProgressPage'
import { StudentsPage } from './pages/StudentsPage'
import { useAuthStore } from './store/authStore'

const navItems = [
  { to: '/', label: 'Tong quan' },
  { to: '/hoc-sinh', label: 'Hoc sinh' },
  { to: '/lop-hoc', label: 'Lop hoc' },
  { to: '/bai-hoc', label: 'Bai hoc' },
  { to: '/giao-bai', label: 'Giao bai' },
  { to: '/tien-do', label: 'Tien do' },
  { to: '/phu-huynh', label: 'Phu huynh' },
  { to: '/cai-dat-ai', label: 'Cai dat AI' },
  { to: '/logs', label: 'Logs' },
]

function App() {
  const hydrate = useAuthStore((state) => state.hydrate)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Ban hoc thong minh</p>
          <h1>He thong hoc tap ho tro</h1>
          <p className="sidebar-copy">
            Luong cot loi da co auth, hoc sinh, lop hoc, bai hoc, giao bai, readiness, phu huynh va Gemini settings tren Flask + PWA.
          </p>
        </div>

        <nav className="nav-list" aria-label="Dieu huong chinh">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="sidebar-card-label">Trang thai session</span>
          <strong>{user ? `${user.email ?? user.phone} (${user.role})` : 'Chua dang nhap'}</strong>
          <p>PWA san sang cho Android, backend Flask dang duoc day tiep theo task MVP.</p>
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
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
