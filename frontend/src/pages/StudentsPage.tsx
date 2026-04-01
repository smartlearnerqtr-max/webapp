import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createStudent, fetchStudents, fetchStudentTeachers } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nang' },
  { value: 'trung_binh', label: 'Trung binh' },
  { value: 'nhe', label: 'Nhe' },
]

export function StudentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [disabilityLevel, setDisabilityLevel] = useState('trung_binh')
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const resolvedSelectedStudentId = selectedStudentId ?? studentsQuery.data?.[0]?.id ?? null

  const studentTeachersQuery = useQuery({
    queryKey: ['student-teachers', token, resolvedSelectedStudentId],
    queryFn: () => fetchStudentTeachers(token!, resolvedSelectedStudentId!),
    enabled: Boolean(token && resolvedSelectedStudentId),
  })

  const createMutation = useMutation({
    mutationFn: () => createStudent(token!, { full_name: fullName, disability_level: disabilityLevel }),
    onSuccess: async () => {
      setFullName('')
      setDisabilityLevel('trung_binh')
      await queryClient.invalidateQueries({ queryKey: ['students', token] })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim()) return
    createMutation.mutate()
  }

  const selectedStudent = studentsQuery.data?.find((student) => student.id === resolvedSelectedStudentId) ?? null

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Quan ly ho so hoc sinh</h2>
          <p>
            Giao vien co the tao hoc sinh moi cho minh, va voi mo hinh moi, mot hoc sinh co the hoc voi nhieu giao vien.
            Man nay giup xem nhanh mot hoc sinh hien dang duoc ket noi voi nhung giao vien nao.
          </p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tao hoc sinh moi</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Ho ten hoc sinh
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyen Van A" />
              </label>
              <label>
                Muc do khuyet tat
                <select value={disabilityLevel} onChange={(event) => setDisabilityLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Dang tao...' : 'Tao hoc sinh'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Danh sach hoc sinh</h3>
            <div className="student-list compact-list">
              {studentsQuery.data?.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={resolvedSelectedStudentId === student.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  {student.full_name} - {student.disability_level}
                </button>
              ))}
              {!studentsQuery.data?.length && !studentsQuery.isLoading ? <p>Chua co hoc sinh nao.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thong tin hoc sinh dang chon</h3>
            {selectedStudent ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedStudent.full_name}</strong>
                  <span>{selectedStudent.disability_level} / {selectedStudent.preferred_input}</span>
                </div>
                <p>Ghi chu ho tro: {selectedStudent.support_note ?? 'Chua co ghi chu.'}</p>
                <p>So giao vien dang lien ket: {studentTeachersQuery.data?.length ?? 0}</p>
              </div>
            ) : (
              <p>Hay chon mot hoc sinh de xem chi tiet.</p>
            )}
          </article>

          <article className="roadmap-panel">
            <h3>Giao vien dang day hoc sinh nay</h3>
            <div className="student-list compact-list">
              {(studentTeachersQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.teacher.full_name}</strong>
                  <span>Teacher ID {item.teacher.id} / {item.teacher.school_name ?? 'Chua cap nhat truong'}</span>
                  <p>Email: {item.teacher.email ?? 'Chua cap nhat'} | So dien thoai: {item.teacher.phone ?? 'Chua cap nhat'}</p>
                  <p>So lop dang day hoc sinh nay: {item.active_class_count}</p>
                </div>
              ))}
              {!studentTeachersQuery.data?.length && resolvedSelectedStudentId && !studentTeachersQuery.isLoading ? <p>Hoc sinh nay hien chi co giao vien dang xem ho so hoac chua vao lop nao.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
