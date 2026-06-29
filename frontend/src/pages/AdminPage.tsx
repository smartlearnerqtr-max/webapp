import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { RequireAuth } from '../components/RequireAuth'
import {
  createTeacherByAdmin,
  fetchAdminRecoverableAccounts,
  fetchAdminRelationshipOverview,
  fetchAdminTeachers,
  recoverAdminAccount,
} from '../services/api'
import type { AdminRecoverAccountResponse } from '../services/api'
import { useAuthStore } from '../store/authStore'

type AdminSection = 'overview' | 'create-teacher' | 'teachers' | 'relationships' | 'recovery'

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Giáo viên',
  student: 'Học sinh',
}

const SECTION_ITEMS: Array<{ key: AdminSection; label: string }> = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'create-teacher', label: 'Tạo giáo viên' },
  { key: 'teachers', label: 'Danh sách giáo viên' },
  { key: 'relationships', label: 'Liên kết' },
  { key: 'recovery', label: 'Khôi phục tài khoản' },
]

function getSectionTitle(section: AdminSection) {
  return SECTION_ITEMS.find((item) => item.key === section)?.label ?? 'Admin'
}

function readableStatus(status: string | null | undefined) {
  if (status === 'active') return 'Đang hoạt động'
  if (status === 'inactive') return 'Tạm khóa'
  if (status === 'archived') return 'Lưu trữ'
  return status || 'Chưa rõ'
}

export function AdminPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState<AdminSection>('overview')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [recoverySearch, setRecoverySearch] = useState('')
  const [recoveryRole, setRecoveryRole] = useState<'all' | 'teacher' | 'student'>('all')
  const [temporaryPassword, setTemporaryPassword] = useState('Demo123456')
  const [recoveredAccount, setRecoveredAccount] = useState<AdminRecoverAccountResponse | null>(null)

  const teachersQuery = useQuery({
    queryKey: ['admin-teachers', token],
    queryFn: () => fetchAdminTeachers(token!),
    enabled: Boolean(token),
  })

  const relationshipsQuery = useQuery({
    queryKey: ['admin-relationships-overview', token],
    queryFn: () => fetchAdminRelationshipOverview(token!),
    enabled: Boolean(token),
  })

  const recoveryAccountsQuery = useQuery({
    queryKey: ['admin-account-recovery', token],
    queryFn: () => fetchAdminRecoverableAccounts(token!),
    enabled: Boolean(token),
  })

  const filteredRecoveryAccounts = useMemo(() => {
    const needle = recoverySearch.trim().toLowerCase()
    return (recoveryAccountsQuery.data ?? []).filter((account) => {
      const matchesRole = recoveryRole === 'all' || account.user.role === recoveryRole
      const searchableText = [
        account.full_name,
        account.username,
        account.user.email,
        account.user.phone,
        account.user.status,
        ROLE_LABELS[account.user.role] ?? account.user.role,
      ].filter(Boolean).join(' ').toLowerCase()
      return matchesRole && (!needle || searchableText.includes(needle))
    })
  }, [recoveryAccountsQuery.data, recoveryRole, recoverySearch])

  const createMutation = useMutation({
    mutationFn: () => createTeacherByAdmin(token!, {
      full_name: fullName,
      email: email || undefined,
      phone: phone || undefined,
      password,
      school_name: schoolName || undefined,
    }),
    onSuccess: async () => {
      setFullName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setSchoolName('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-teachers', token] }),
        queryClient.invalidateQueries({ queryKey: ['admin-relationships-overview', token] }),
        queryClient.invalidateQueries({ queryKey: ['admin-account-recovery', token] }),
      ])
      setActiveSection('teachers')
    },
  })

  const recoverMutation = useMutation({
    mutationFn: (userId: number) => recoverAdminAccount(token!, userId, {
      temporary_password: temporaryPassword.trim() || undefined,
    }),
    onSuccess: async (payload) => {
      setRecoveredAccount(payload)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-account-recovery', token] }),
        queryClient.invalidateQueries({ queryKey: ['admin-teachers', token] }),
        queryClient.invalidateQueries({ queryKey: ['admin-relationships-overview', token] }),
      ])
    },
  })

  const summary = relationshipsQuery.data?.summary
  const teacherCount = summary?.teacher_count ?? teachersQuery.data?.length ?? 0
  const accountCount = recoveryAccountsQuery.data?.length ?? 0
  const loadingCurrentSection =
    (activeSection === 'teachers' && teachersQuery.isLoading) ||
    (activeSection === 'relationships' && relationshipsQuery.isLoading) ||
    (activeSection === 'recovery' && recoveryAccountsQuery.isLoading)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim() || !password.trim() || (!email.trim() && !phone.trim())) return
    createMutation.mutate()
  }

  return (
    <RequireAuth allowedRoles={['admin']}>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-mark">A</span>
            <div>
              <strong>Admin</strong>
              <span>Bàn học thông minh</span>
            </div>
          </div>

          <nav className="admin-menu" aria-label="Admin menu">
            {SECTION_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeSection === item.key ? 'admin-menu-item active' : 'admin-menu-item'}
                onClick={() => setActiveSection(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          <header className="admin-page-header">
            <div>
              <span className="admin-kicker">Quản trị hệ thống</span>
              <h1>{getSectionTitle(activeSection)}</h1>
            </div>
            <span className={loadingCurrentSection ? 'admin-status-dot loading' : 'admin-status-dot'}>
              {loadingCurrentSection ? 'Đang tải' : 'Sẵn sàng'}
            </span>
          </header>

          {activeSection === 'overview' ? (
            <section className="admin-section">
              <div className="admin-metrics-row">
                <article className="admin-stat-card">
                  <span>Tổng giáo viên</span>
                  <strong>{teacherCount}</strong>
                </article>
                <article className="admin-stat-card">
                  <span>Liên kết GV-HS</span>
                  <strong>{summary?.teacher_student_link_count ?? 0}</strong>
                </article>
                <article className="admin-stat-card">
                  <span>Nhóm phụ huynh</span>
                  <strong>{summary?.teacher_parent_group_count ?? 0}</strong>
                </article>
                <article className="admin-stat-card">
                  <span>Tài khoản khôi phục</span>
                  <strong>{accountCount}</strong>
                </article>
              </div>

              <article className="admin-panel-card">
                <div className="admin-panel-header">
                  <h2>Tình trạng vận hành</h2>
                </div>
                <div className="admin-overview-grid">
                  <button type="button" className="admin-overview-action" onClick={() => setActiveSection('create-teacher')}>
                    <strong>Tạo tài khoản giáo viên</strong>
                    <span>Cấp tài khoản mới cho giáo viên phụ trách lớp.</span>
                  </button>
                  <button type="button" className="admin-overview-action" onClick={() => setActiveSection('recovery')}>
                    <strong>Khôi phục tài khoản</strong>
                    <span>Đặt lại mật khẩu cho giáo viên hoặc học sinh.</span>
                  </button>
                  <button type="button" className="admin-overview-action" onClick={() => setActiveSection('relationships')}>
                    <strong>Kiểm tra liên kết</strong>
                    <span>Xem học sinh, phụ huynh và giáo viên đang liên kết.</span>
                  </button>
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'create-teacher' ? (
            <section className="admin-section">
              <article className="admin-panel-card admin-form-panel">
                <div className="admin-panel-header">
                  <h2>Tạo tài khoản giáo viên</h2>
                </div>
                <div className="admin-panel-body">
                  <form className="admin-form-grid" onSubmit={handleSubmit}>
                    <label>
                      Họ tên giáo viên
                      <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn Giáo Viên" />
                    </label>
                    <label>
                      Email
                      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@school.edu" />
                    </label>
                    <label>
                      Số điện thoại
                      <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0901234567" />
                    </label>
                    <label>
                      Trường học
                      <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Trường học" />
                    </label>
                    <label className="admin-form-wide">
                      Mật khẩu tạm thời
                      <div className="admin-password-field">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Nhập mật khẩu cấp cho giáo viên"
                        />
                        <button type="button" onClick={() => setShowPassword((value) => !value)}>
                          {showPassword ? 'Ẩn' : 'Hiện'}
                        </button>
                      </div>
                    </label>
                    <div className="admin-form-actions admin-form-wide">
                      <button className="action-button" type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Đang tạo...' : 'Cấp tài khoản'}
                      </button>
                      {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
                    </div>
                  </form>
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'teachers' ? (
            <section className="admin-section">
              <article className="admin-panel-card">
                <div className="admin-panel-header">
                  <h2>Danh sách giáo viên đã cấp</h2>
                  <span>{teachersQuery.data?.length ?? 0} tài khoản</span>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Giáo viên</th>
                        <th>Email / SĐT</th>
                        <th>Trường</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachersQuery.data?.map((item) => (
                        <tr key={item.user.id}>
                          <td>
                            <strong>{item.profile?.full_name ?? `Teacher #${item.user.id}`}</strong>
                          </td>
                          <td>{item.user.email ?? item.user.phone ?? 'Chưa có định danh'}</td>
                          <td>{item.profile?.school_name ?? 'Chưa có trường học'}</td>
                          <td><span className="admin-badge">{readableStatus(item.user.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!teachersQuery.data?.length && !teachersQuery.isLoading ? <p className="admin-empty-state">Chưa có giáo viên nào được cấp tài khoản.</p> : null}
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'relationships' ? (
            <section className="admin-section">
              <article className="admin-panel-card">
                <div className="admin-panel-header">
                  <h2>Tổng quan liên kết theo giáo viên</h2>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Giáo viên</th>
                        <th>Trường</th>
                        <th>Học sinh</th>
                        <th>Nhóm phụ huynh</th>
                        <th>Học sinh học đa GV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relationshipsQuery.data?.teachers.map((item) => (
                        <tr key={item.teacher.user.id}>
                          <td><strong>{item.teacher.profile?.full_name ?? item.teacher.user.email ?? `Teacher #${item.teacher.user.id}`}</strong></td>
                          <td>{item.teacher.profile?.school_name ?? 'Chưa có trường học'}</td>
                          <td>{item.student_count}</td>
                          <td>{item.parent_group_count}</td>
                          <td>{item.shared_student_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!relationshipsQuery.data?.teachers.length && !relationshipsQuery.isLoading ? <p className="admin-empty-state">Chưa có dữ liệu liên kết nào.</p> : null}
                </div>
              </article>

              <article className="admin-panel-card">
                <div className="admin-panel-header">
                  <h2>Học sinh đang học với nhiều giáo viên</h2>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Học sinh</th>
                        <th>Mức hỗ trợ</th>
                        <th>Giáo viên</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relationshipsQuery.data?.shared_students.map((item) => (
                        <tr key={item.student.id}>
                          <td><strong>{item.student.full_name}</strong></td>
                          <td>{item.student.disability_level}</td>
                          <td>{item.teachers.map((teacher) => teacher.full_name).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!relationshipsQuery.data?.shared_students.length && !relationshipsQuery.isLoading ? <p className="admin-empty-state">Chưa có học sinh nào đang học với nhiều giáo viên.</p> : null}
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'recovery' ? (
            <section className="admin-section">
              <article className="admin-panel-card">
                <div className="admin-panel-header">
                  <h2>Khôi phục tài khoản</h2>
                  <span>{filteredRecoveryAccounts.length} tài khoản</span>
                </div>
                <div className="admin-panel-body">
                  <div className="admin-recovery-toolbar">
                    <label>
                      Tìm tài khoản
                      <input
                        value={recoverySearch}
                        onChange={(event) => setRecoverySearch(event.target.value)}
                        placeholder="Tên, email, số điện thoại..."
                      />
                    </label>
                    <label>
                      Vai trò
                      <select
                        value={recoveryRole}
                        onChange={(event) => setRecoveryRole(event.target.value as 'all' | 'teacher' | 'student')}
                      >
                        <option value="all">Tất cả</option>
                        <option value="teacher">Giáo viên</option>
                        <option value="student">Học sinh</option>
                      </select>
                    </label>
                    <label>
                      Mật khẩu tạm thời
                      <input
                        value={temporaryPassword}
                        onChange={(event) => setTemporaryPassword(event.target.value)}
                        placeholder="Demo123456"
                      />
                    </label>
                  </div>

                  {recoveredAccount ? (
                    <div className="feedback-note feedback-note-success">
                      Đã khôi phục: <strong>{recoveredAccount.username}</strong> / mật khẩu tạm: <strong>{recoveredAccount.temporary_password}</strong>
                    </div>
                  ) : null}
                  {recoverMutation.error ? <p className="error-text">{(recoverMutation.error as Error).message}</p> : null}
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-recovery-table">
                    <thead>
                      <tr>
                        <th>Tên tài khoản</th>
                        <th>Vai trò</th>
                        <th>Tên đăng nhập</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecoveryAccounts.map((account) => {
                        const isRecovering = recoverMutation.isPending && recoverMutation.variables === account.user.id
                        return (
                          <tr key={account.user.id}>
                            <td><strong>{account.full_name ?? `User #${account.user.id}`}</strong></td>
                            <td>{ROLE_LABELS[account.user.role] ?? account.user.role}</td>
                            <td>{account.username ?? 'Chưa có tên đăng nhập'}</td>
                            <td><span className="admin-badge">{readableStatus(account.user.status)}</span></td>
                            <td>
                              <button
                                type="button"
                                className="admin-table-action"
                                disabled={!account.can_login || isRecovering || !temporaryPassword.trim()}
                                onClick={() => recoverMutation.mutate(account.user.id)}
                              >
                                {isRecovering ? 'Đang khôi phục...' : 'Khôi phục mật khẩu'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!filteredRecoveryAccounts.length && !recoveryAccountsQuery.isLoading ? <p className="admin-empty-state">Không tìm thấy tài khoản giáo viên hoặc học sinh.</p> : null}
                </div>
              </article>
            </section>
          ) : null}
        </main>
      </div>
    </RequireAuth>
  )
}
