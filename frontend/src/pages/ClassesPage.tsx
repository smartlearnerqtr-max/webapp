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
          <h2>Quản lý lớp học</h2>
          <p>
            Khi giáo viên tạo lớp, hệ thống sinh sẵn <strong>ID lớp</strong> và <strong>mật khẩu vào lớp</strong>.
            Học sinh có thể tự đăng nhập vào lớp bằng hai thông tin này, còn giáo viên vẫn có thể thêm học sinh thủ công nếu cần.
          </p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo lớp mới</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Tên lớp
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lớp 6A hỗ trợ" />
              </label>
              <label>
                Khối lớp
                <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="6" />
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo lớp'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chọn lớp để quản lý</h3>
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
            {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Chưa có lớp nào. Tạo lớp đầu tiên để bắt đầu.</p> : null}
          </article>
        </section>

        {selectedClass ? (
          <section className="dashboard-grid">
            <article className="roadmap-panel">
              <h3>Thông tin vào lớp cho học sinh</h3>
              <div className="metrics-grid">
                <div className="mini-card">
                  <span>ID lớp</span>
                  <strong>{selectedClass.id}</strong>
                </div>
                <div className="mini-card">
                  <span>Mật khẩu vào lớp</span>
                  <strong>{selectedClass.join_credential?.class_password ?? 'Đang cập nhật'}</strong>
                </div>
                <div className="mini-card">
                  <span>Giáo viên</span>
                  <strong>{selectedClass.teacher_id}</strong>
                </div>
              </div>
              <p>Gửi ID lớp và mật khẩu này cho học sinh để các em tự vào lớp từ trang học sinh.</p>
            </article>

            <article className="roadmap-panel">
              <h3>Tổng quan lớp đang chọn</h3>
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedClass.name}</strong>
                  <span>{selectedClass.grade_label ? `Khối ${selectedClass.grade_label}` : 'Chưa gắn khối'}</span>
                </div>
                <p>Trạng thái: {selectedClass.status}</p>
                <p>{selectedClass.student_count} học sinh, {selectedClass.subject_count} môn học.</p>
              </div>
            </article>
          </section>
        ) : null}

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thêm học sinh vào lớp</h3>
            <div className="form-stack">
              <label>
                Học sinh chưa nằm trong lớp
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={!resolvedSelectedClassId}>
                  <option value="">Chọn học sinh</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name} - {student.disability_level}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!resolvedSelectedClassId || !selectedStudentId || addStudentMutation.isPending} onClick={() => addStudentMutation.mutate()}>
                {addStudentMutation.isPending ? 'Đang thêm...' : 'Thêm vào lớp'}
              </button>
              {addStudentMutation.error ? <p className="error-text">{(addStudentMutation.error as Error).message}</p> : null}
            </div>

            <div className="student-list compact-list">
              {classStudentsQuery.data?.map((item) => (
                <div key={item.id} className="student-row">
                  <strong>{item.student?.full_name ?? `Học sinh #${item.student_id}`}</strong>
                  <span>{item.student?.preferred_input ?? 'touch'} / {item.student?.disability_level ?? 'không rõ'}</span>
                </div>
              ))}
              {resolvedSelectedClassId && !classStudentsQuery.data?.length && !classStudentsQuery.isLoading ? <p>Lớp này chưa có học sinh nào.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Gắn môn học cho lớp</h3>
            <div className="form-stack">
              <label>
                Môn học chưa gắn
                <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={!resolvedSelectedClassId}>
                  <option value="">Chọn môn học</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="button" disabled={!resolvedSelectedClassId || !selectedSubjectId || addSubjectMutation.isPending} onClick={() => addSubjectMutation.mutate()}>
                {addSubjectMutation.isPending ? 'Đang gắn...' : 'Gắn môn học'}
              </button>
              {addSubjectMutation.error ? <p className="error-text">{(addSubjectMutation.error as Error).message}</p> : null}
            </div>

            <div className="tag-wrap">
              {classSubjectsQuery.data?.map((item) => (
                <span key={item.id} className="subject-pill">{item.subject?.name ?? `Môn #${item.subject_id}`}</span>
              ))}
              {resolvedSelectedClassId && !classSubjectsQuery.data?.length && !classSubjectsQuery.isLoading ? <p>Lớp này chưa có môn học nào.</p> : null}
            </div>
          </article>
        </section>

        <section className="card-grid classes-grid">
          {classesQuery.data?.map((classItem) => (
            <article key={classItem.id} className="info-card">
              <span>{classItem.grade_label ? `Khối ${classItem.grade_label}` : 'Lớp học'}</span>
              <strong>{classItem.name}</strong>
              <p>ID {classItem.id} | mật khẩu {classItem.join_credential?.class_password ?? 'đang cập nhật'}</p>
              <p>{classItem.student_count} học sinh, {classItem.subject_count} môn học</p>
            </article>
          ))}
        </section>
      </div>
    </RequireAuth>
  )
}
