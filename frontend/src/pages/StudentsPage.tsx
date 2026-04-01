import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createStudent, fetchStudents } from '../services/api'
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
          <p className="eyebrow">Task 7</p>
          <h2>Quan ly ho so hoc sinh</h2>
          <p>Tao hoc sinh va gan muc do khuyet tat de backend co du lieu cho lop hoc va readiness.</p>
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
            <div className="student-list">
              {studentsQuery.data?.map((student) => (
                <div key={student.id} className="student-row">
                  <strong>{student.full_name}</strong>
                  <span>{student.disability_level}</span>
                </div>
              ))}
              {!studentsQuery.data?.length && !studentsQuery.isLoading ? <p>Chua co hoc sinh nao.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
