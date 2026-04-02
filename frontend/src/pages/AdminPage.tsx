import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createTeacherByAdmin, fetchAdminRelationshipOverview, fetchAdminTeachers } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

export function AdminPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [schoolName, setSchoolName] = useState('')

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
      ])
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim() || !password.trim() || (!email.trim() && !phone.trim())) return
    createMutation.mutate()
  }

  return (
    <RequireAuth allowedRoles={['admin']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Không gian admin</p>
          <h2>Cấp tài khoản giáo viên và xem liên kết</h2>
          <p>
            Admin vẫn chỉ tạo tài khoản giáo viên, nhưng giờ đã có thêm một dashboard tổng quan để kiểm tra xem dữ liệu
            học sinh đang được liên kết với bao nhiêu giáo viên và có bao nhiêu học sinh đang học đa giáo viên.
          </p>
        </section>

        <section className="metrics-grid">
          <article className="mini-card">
            <span>Tổng giáo viên</span>
            <strong>{relationshipsQuery.data?.summary.teacher_count ?? 0}</strong>
          </article>
          <article className="mini-card">
            <span>Liên kết GV-HS</span>
            <strong>{relationshipsQuery.data?.summary.teacher_student_link_count ?? 0}</strong>
          </article>
          <article className="mini-card">
            <span>Nhóm phụ huynh</span>
            <strong>{relationshipsQuery.data?.summary.teacher_parent_group_count ?? 0}</strong>
          </article>
          <article className="mini-card">
            <span>Học sinh học đa GV</span>
            <strong>{relationshipsQuery.data?.summary.shared_student_count ?? 0}</strong>
          </article>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo tài khoản giáo viên</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
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
                Mật khẩu tạm thời
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu cấp cho giáo viên" />
              </label>
              <label>
                Trường học
                <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Trường Tiểu học ABC" />
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Cấp tài khoản giáo viên'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Danh sách giáo viên đã cấp</h3>
            <div className="student-list compact-list">
              {teachersQuery.data?.map((item) => (
                <div key={item.user.id} className="student-row">
                  <strong>{item.profile?.full_name ?? item.user.email ?? `Teacher #${item.user.id}`}</strong>
                  <span>{item.user.email ?? item.user.phone ?? 'Không có định danh'} / {item.profile?.school_name ?? 'Chưa có trường học'}</span>
                </div>
              ))}
              {!teachersQuery.data?.length && !teachersQuery.isLoading ? <p>Chưa có giáo viên nào được cấp tài khoản.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Tổng quan liên kết theo giáo viên</h3>
            <div className="student-list compact-list">
              {relationshipsQuery.data?.teachers.map((item) => (
                <div key={item.teacher.user.id} className="student-row">
                  <strong>{item.teacher.profile?.full_name ?? item.teacher.user.email ?? `Teacher #${item.teacher.user.id}`}</strong>
                  <span>{item.teacher.profile?.school_name ?? 'Chưa có trường học'}</span>
                  <p>Học sinh đang liên kết: {item.student_count}</p>
                  <p>Nhóm phụ huynh: {item.parent_group_count}</p>
                  <p>Học sinh đang học cùng giáo viên khác: {item.shared_student_count}</p>
                </div>
              ))}
              {!relationshipsQuery.data?.teachers.length && !relationshipsQuery.isLoading ? <p>Chưa có dữ liệu liên kết nào.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Học sinh đang học với nhiều giáo viên</h3>
            <div className="student-list compact-list">
              {relationshipsQuery.data?.shared_students.map((item) => (
                <div key={item.student.id} className="student-row">
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level}</span>
                  <p>Đang học với: {item.teachers.map((teacher) => teacher.full_name).join(', ')}</p>
                </div>
              ))}
              {!relationshipsQuery.data?.shared_students.length && !relationshipsQuery.isLoading ? <p>Chưa có học sinh nào đang học với nhiều giáo viên.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
