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
          <p className="eyebrow">Khong gian admin</p>
          <h2>Cap tai khoan giao vien va xem lien ket</h2>
          <p>
            Admin van chi tao tai khoan giao vien, nhung gio da co them mot dashboard tong quan de kiem tra xem du lieu
            hoc sinh dang duoc lien ket voi bao nhieu giao vien va co bao nhieu hoc sinh dang hoc da giao vien.
          </p>
        </section>

        <section className="metrics-grid">
          <article className="mini-card">
            <span>Tong giao vien</span>
            <strong>{relationshipsQuery.data?.summary.teacher_count ?? 0}</strong>
          </article>
          <article className="mini-card">
            <span>Lien ket GV-HS</span>
            <strong>{relationshipsQuery.data?.summary.teacher_student_link_count ?? 0}</strong>
          </article>
          <article className="mini-card">
            <span>Nhom phu huynh</span>
            <strong>{relationshipsQuery.data?.summary.teacher_parent_group_count ?? 0}</strong>
          </article>
          <article className="mini-card">
            <span>Hoc sinh hoc da GV</span>
            <strong>{relationshipsQuery.data?.summary.shared_student_count ?? 0}</strong>
          </article>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tao tai khoan giao vien</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Ho ten giao vien
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyen Van Giao Vien" />
              </label>
              <label>
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@school.edu" />
              </label>
              <label>
                So dien thoai
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0901234567" />
              </label>
              <label>
                Mat khau tam thoi
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhap mat khau cap cho giao vien" />
              </label>
              <label>
                Truong hoc
                <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Truong Tieu hoc ABC" />
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Dang tao...' : 'Cap tai khoan giao vien'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Danh sach giao vien da cap</h3>
            <div className="student-list compact-list">
              {teachersQuery.data?.map((item) => (
                <div key={item.user.id} className="student-row">
                  <strong>{item.profile?.full_name ?? item.user.email ?? `Teacher #${item.user.id}`}</strong>
                  <span>{item.user.email ?? item.user.phone ?? 'Khong co dinh danh'} / {item.profile?.school_name ?? 'Chua co truong hoc'}</span>
                </div>
              ))}
              {!teachersQuery.data?.length && !teachersQuery.isLoading ? <p>Chua co giao vien nao duoc cap tai khoan.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Tong quan lien ket theo giao vien</h3>
            <div className="student-list compact-list">
              {relationshipsQuery.data?.teachers.map((item) => (
                <div key={item.teacher.user.id} className="student-row">
                  <strong>{item.teacher.profile?.full_name ?? item.teacher.user.email ?? `Teacher #${item.teacher.user.id}`}</strong>
                  <span>{item.teacher.profile?.school_name ?? 'Chua co truong hoc'}</span>
                  <p>Hoc sinh dang lien ket: {item.student_count}</p>
                  <p>Nhom phu huynh: {item.parent_group_count}</p>
                  <p>Hoc sinh dang hoc cung giao vien khac: {item.shared_student_count}</p>
                </div>
              ))}
              {!relationshipsQuery.data?.teachers.length && !relationshipsQuery.isLoading ? <p>Chua co du lieu lien ket nao.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Hoc sinh dang hoc voi nhieu giao vien</h3>
            <div className="student-list compact-list">
              {relationshipsQuery.data?.shared_students.map((item) => (
                <div key={item.student.id} className="student-row">
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level}</span>
                  <p>Dang hoc voi: {item.teachers.map((teacher) => teacher.full_name).join(', ')}</p>
                </div>
              ))}
              {!relationshipsQuery.data?.shared_students.length && !relationshipsQuery.isLoading ? <p>Chua co hoc sinh nao dang hoc voi nhieu giao vien.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
