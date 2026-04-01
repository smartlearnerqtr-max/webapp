import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createStudent, fetchStudents } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nặng' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nhe', label: 'Nhẹ' },
]

export function StudentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [disabilityLevel, setDisabilityLevel] = useState('trung_binh')

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const createMutation = useMutation({
    mutationFn: () => createStudent(token!, { full_name: fullName, disability_level: disabilityLevel }),
    onSuccess: () => {
      setFullName('')
      setDisabilityLevel('trung_binh')
      void queryClient.invalidateQueries({ queryKey: ['students', token] })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim()) return
    createMutation.mutate()
  }

  return (
    <RequireAuth>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Quản lý hồ sơ học sinh</h2>
          <p>Tạo học sinh và gán mức độ khuyết tật để backend có dữ liệu cho lớp học và readiness.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo học sinh mới</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Họ tên học sinh
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" />
              </label>
              <label>
                Mức độ khuyết tật
                <select value={disabilityLevel} onChange={(event) => setDisabilityLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo học sinh'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Danh sách học sinh</h3>
            <div className="student-list">
              {studentsQuery.data?.map((student) => (
                <div key={student.id} className="student-row">
                  <strong>{student.full_name}</strong>
                  <span>{student.disability_level}</span>
                </div>
              ))}
              {!studentsQuery.data?.length && !studentsQuery.isLoading ? <p>Chưa có học sinh nào.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
