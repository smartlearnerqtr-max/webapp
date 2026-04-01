import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { addStudentsToClass, addSubjectToClass, createClass, fetchClasses, fetchClassStudents, fetchClassSubjects, fetchStudents, fetchSubjects } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { RequireAuth } from '../components/RequireAuth'

export function ClassesPage() {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')

  const classesQuery = useQuery({
    queryKey: ['classes', token],
    queryFn: () => fetchClasses(token!),
    enabled: Boolean(token),
  })

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  })

  const classStudentsQuery = useQuery({
    queryKey: ['class-students', token, selectedClassId],
    queryFn: () => fetchClassStudents(token!, selectedClassId!),
    enabled: Boolean(token && selectedClassId),
  })

  const classSubjectsQuery = useQuery({
    queryKey: ['class-subjects', token, selectedClassId],
    queryFn: () => fetchClassSubjects(token!, selectedClassId!),
    enabled: Boolean(token && selectedClassId),
  })

  useEffect(() => {
    if (!selectedClassId && classesQuery.data?.length) {
      setSelectedClassId(classesQuery.data[0].id)
    }
  }, [classesQuery.data, selectedClassId])

  const availableStudents = useMemo(() => {
    const linkedIds = new Set(classStudentsQuery.data?.map((item) => item.student_id) ?? [])
    return (studentsQuery.data ?? []).filter((student) => !linkedIds.has(student.id))
  }, [classStudentsQuery.data, studentsQuery.data])

  const availableSubjects = useMemo(() => {
    const linkedIds = new Set(classSubjectsQuery.data?.map((item) => item.subject_id) ?? [])
    return (subjectsQuery.data ?? []).filter((subject) => !linkedIds.has(subject.id))
  }, [classSubjectsQuery.data, subjectsQuery.data])

  const createMutation = useMutation({
    mutationFn: () => createClass(token!, { name, grade_label: grade }),
    onSuccess: async (createdClass) => {
      setName('')
      setGrade('')
      await queryClient.invalidateQueries({ queryKey: ['classes', token] })
      setSelectedClassId(createdClass.id)
    },
  })

  const addStudentMutation = useMutation({
    mutationFn: () => addStudentsToClass(token!, selectedClassId!, { student_ids: [Number(selectedStudentId)] }),
    onSuccess: async () => {
      setSelectedStudentId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classes', token] }),
        queryClient.invalidateQueries({ queryKey: ['class-students', token, selectedClassId] }),
      ])
    },
  })

  const addSubjectMutation = useMutation({
    mutationFn: () => addSubjectToClass(token!, selectedClassId!, { subject_id: Number(selectedSubjectId) }),
    onSuccess: async () => {
      setSelectedSubjectId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classes', token] }),
        queryClient.invalidateQueries({ queryKey: ['class-subjects', token, selectedClassId] }),
      ])
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    createMutation.mutate()
  }

  return (
    <RequireAuth>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Task 8 + 9 + 10</p>
          <h2>Quan ly lop hoc, hoc sinh va mon hoc</h2>
          <p>Tai man nay giao vien co the tao lop, dua hoc sinh vao lop va cau hinh mon hoc de chuan bi cho assignment.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tao lop moi</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Ten lop
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lop 6A ho tro" />
              </label>
              <label>
                Khoi/lop
                <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="6" />
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Dang tao...' : 'Tao lop'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chon lop de quan ly</h3>
            <div className="tag-wrap">
              {classesQuery.data?.map((classItem) => (
                <button
                  key={classItem.id}
                  type="button"
                  className={selectedClassId === classItem.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedClassId(classItem.id)}
                >
                  {classItem.name}
                </button>
              ))}
            </div>
            {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Chua co lop nao. Tao lop dau tien de bat dau.</p> : null}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Them hoc sinh vao lop</h3>
            <div className="form-stack">
              <label>
                Hoc sinh chua nam trong lop
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={!selectedClassId}>
                  <option value="">Chon hoc sinh</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name} - {student.disability_level}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!selectedClassId || !selectedStudentId || addStudentMutation.isPending} onClick={() => addStudentMutation.mutate()}>
                {addStudentMutation.isPending ? 'Dang them...' : 'Them vao lop'}
              </button>
              {addStudentMutation.error ? <p className="error-text">{(addStudentMutation.error as Error).message}</p> : null}
            </div>

            <div className="student-list compact-list">
              {classStudentsQuery.data?.map((item) => (
                <div key={item.id} className="student-row">
                  <strong>{item.student?.full_name ?? `Hoc sinh #${item.student_id}`}</strong>
                  <span>{item.student?.preferred_input ?? 'touch'} / {item.student?.disability_level ?? 'khong ro'}</span>
                </div>
              ))}
              {selectedClassId && !classStudentsQuery.data?.length && !classStudentsQuery.isLoading ? <p>Lop nay chua co hoc sinh nao.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Gan mon hoc cho lop</h3>
            <div className="form-stack">
              <label>
                Mon hoc chua gan
                <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={!selectedClassId}>
                  <option value="">Chon mon hoc</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!selectedClassId || !selectedSubjectId || addSubjectMutation.isPending} onClick={() => addSubjectMutation.mutate()}>
                {addSubjectMutation.isPending ? 'Dang gan...' : 'Gan mon hoc'}
              </button>
              {addSubjectMutation.error ? <p className="error-text">{(addSubjectMutation.error as Error).message}</p> : null}
            </div>

            <div className="tag-wrap">
              {classSubjectsQuery.data?.map((item) => (
                <span key={item.id} className="subject-pill">{item.subject?.name ?? `Mon #${item.subject_id}`}</span>
              ))}
              {selectedClassId && !classSubjectsQuery.data?.length && !classSubjectsQuery.isLoading ? <p>Lop nay chua co mon hoc nao.</p> : null}
            </div>
          </article>
        </section>

        <section className="card-grid classes-grid">
          {classesQuery.data?.map((classItem) => (
            <article key={classItem.id} className="info-card">
              <span>{classItem.grade_label ? `Khoi ${classItem.grade_label}` : 'Lop hoc'}</span>
              <strong>{classItem.name}</strong>
              <p>{classItem.student_count} hoc sinh, {classItem.subject_count} mon hoc</p>
            </article>
          ))}
        </section>
      </div>
    </RequireAuth>
  )
}
