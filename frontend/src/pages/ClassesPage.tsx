import { useMemo, useState } from 'react'
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

  const resolvedSelectedClassId = selectedClassId ?? classesQuery.data?.[0]?.id ?? null

  const classStudentsQuery = useQuery({
    queryKey: ['class-students', token, resolvedSelectedClassId],
    queryFn: () => fetchClassStudents(token!, resolvedSelectedClassId!),
    enabled: Boolean(token && resolvedSelectedClassId),
  })

  const classSubjectsQuery = useQuery({
    queryKey: ['class-subjects', token, resolvedSelectedClassId],
    queryFn: () => fetchClassSubjects(token!, resolvedSelectedClassId!),
    enabled: Boolean(token && resolvedSelectedClassId),
  })

  const selectedClass = useMemo(
    () => classesQuery.data?.find((item) => item.id === resolvedSelectedClassId) ?? null,
    [classesQuery.data, resolvedSelectedClassId],
  )

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
    mutationFn: () => addStudentsToClass(token!, resolvedSelectedClassId!, { student_ids: [Number(selectedStudentId)] }),
    onSuccess: async () => {
      setSelectedStudentId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classes', token] }),
        queryClient.invalidateQueries({ queryKey: ['class-students', token, resolvedSelectedClassId] }),
      ])
    },
  })

  const addSubjectMutation = useMutation({
    mutationFn: () => addSubjectToClass(token!, resolvedSelectedClassId!, { subject_id: Number(selectedSubjectId) }),
    onSuccess: async () => {
      setSelectedSubjectId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classes', token] }),
        queryClient.invalidateQueries({ queryKey: ['class-subjects', token, resolvedSelectedClassId] }),
      ])
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    createMutation.mutate()
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Quan ly lop hoc</h2>
          <p>
            Khi giao vien tao lop, he thong sinh san <strong>ID lop</strong> va <strong>mat khau vao lop</strong>.
            Hoc sinh co the tu dang nhap vao lop bang hai thong tin nay, con giao vien van co the them hoc sinh thu cong neu can.
          </p>
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
                Khoi lop
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
                  className={resolvedSelectedClassId === classItem.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedClassId(classItem.id)}
                >
                  {classItem.name}
                </button>
              ))}
            </div>
            {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Chua co lop nao. Tao lop dau tien de bat dau.</p> : null}
          </article>
        </section>

        {selectedClass ? (
          <section className="dashboard-grid">
            <article className="roadmap-panel">
              <h3>Thong tin vao lop cho hoc sinh</h3>
              <div className="metrics-grid">
                <div className="mini-card">
                  <span>ID lop</span>
                  <strong>{selectedClass.id}</strong>
                </div>
                <div className="mini-card">
                  <span>Mat khau vao lop</span>
                  <strong>{selectedClass.join_credential?.class_password ?? 'Dang cap nhat'}</strong>
                </div>
                <div className="mini-card">
                  <span>Giao vien</span>
                  <strong>{selectedClass.teacher_id}</strong>
                </div>
              </div>
              <p>Gui ID lop va mat khau nay cho hoc sinh de cac em tu vao lop tu trang hoc sinh.</p>
            </article>

            <article className="roadmap-panel">
              <h3>Tong quan lop dang chon</h3>
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedClass.name}</strong>
                  <span>{selectedClass.grade_label ? `Khoi ${selectedClass.grade_label}` : 'Chua gan khoi'}</span>
                </div>
                <p>Trang thai: {selectedClass.status}</p>
                <p>{selectedClass.student_count} hoc sinh, {selectedClass.subject_count} mon hoc.</p>
              </div>
            </article>
          </section>
        ) : null}

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Them hoc sinh vao lop</h3>
            <div className="form-stack">
              <label>
                Hoc sinh chua nam trong lop
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={!resolvedSelectedClassId}>
                  <option value="">Chon hoc sinh</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name} - {student.disability_level}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!resolvedSelectedClassId || !selectedStudentId || addStudentMutation.isPending} onClick={() => addStudentMutation.mutate()}>
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
              {resolvedSelectedClassId && !classStudentsQuery.data?.length && !classStudentsQuery.isLoading ? <p>Lop nay chua co hoc sinh nao.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Gan mon hoc cho lop</h3>
            <div className="form-stack">
              <label>
                Mon hoc chua gan
                <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={!resolvedSelectedClassId}>
                  <option value="">Chon mon hoc</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!resolvedSelectedClassId || !selectedSubjectId || addSubjectMutation.isPending} onClick={() => addSubjectMutation.mutate()}>
                {addSubjectMutation.isPending ? 'Dang gan...' : 'Gan mon hoc'}
              </button>
              {addSubjectMutation.error ? <p className="error-text">{(addSubjectMutation.error as Error).message}</p> : null}
            </div>

            <div className="tag-wrap">
              {classSubjectsQuery.data?.map((item) => (
                <span key={item.id} className="subject-pill">{item.subject?.name ?? `Mon #${item.subject_id}`}</span>
              ))}
              {resolvedSelectedClassId && !classSubjectsQuery.data?.length && !classSubjectsQuery.isLoading ? <p>Lop nay chua co mon hoc nao.</p> : null}
            </div>
          </article>
        </section>

        <section className="card-grid classes-grid">
          {classesQuery.data?.map((classItem) => (
            <article key={classItem.id} className="info-card">
              <span>{classItem.grade_label ? `Khoi ${classItem.grade_label}` : 'Lop hoc'}</span>
              <strong>{classItem.name}</strong>
              <p>ID {classItem.id} | mat khau {classItem.join_credential?.class_password ?? 'dang cap nhat'}</p>
              <p>{classItem.student_count} hoc sinh, {classItem.subject_count} mon hoc</p>
            </article>
          ))}
        </section>
      </div>
    </RequireAuth>
  )
}
