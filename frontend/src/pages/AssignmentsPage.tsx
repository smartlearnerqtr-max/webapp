import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createAssignment, fetchAssignments, fetchClasses, fetchClassStudents, fetchLessons } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

export function AssignmentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [requiredCompletionPercent, setRequiredCompletionPercent] = useState('100')
  const [dueAt, setDueAt] = useState('')

  const classesQuery = useQuery({
    queryKey: ['classes', token],
    queryFn: () => fetchClasses(token!),
    enabled: Boolean(token),
  })

  const lessonsQuery = useQuery({
    queryKey: ['lessons', token],
    queryFn: () => fetchLessons(token!),
    enabled: Boolean(token),
  })

  const assignmentsQuery = useQuery({
    queryKey: ['assignments', token],
    queryFn: () => fetchAssignments(token!),
    enabled: Boolean(token),
  })

  const resolvedClassId = classId || String(classesQuery.data?.[0]?.id ?? '')
  const resolvedLessonId = lessonId || String(lessonsQuery.data?.[0]?.id ?? '')

  const classStudentsQuery = useQuery({
    queryKey: ['class-students', token, resolvedClassId],
    queryFn: () => fetchClassStudents(token!, Number(resolvedClassId)),
    enabled: Boolean(token && resolvedClassId),
  })

  const selectedLesson = useMemo(
    () => lessonsQuery.data?.find((lesson) => lesson.id === Number(resolvedLessonId)) ?? null,
    [lessonsQuery.data, resolvedLessonId],
  )

  const selectedClass = useMemo(
    () => classesQuery.data?.find((item) => item.id === Number(resolvedClassId)) ?? null,
    [classesQuery.data, resolvedClassId],
  )

  const createMutation = useMutation({
    mutationFn: () => createAssignment(token!, {
      lesson_id: Number(resolvedLessonId),
      class_id: Number(resolvedClassId),
      subject_id: selectedLesson?.subject_id,
      target_type: 'class',
      due_at: dueAt || undefined,
      required_completion_percent: Number(requiredCompletionPercent),
    }),
    onSuccess: async () => {
      setDueAt('')
      setRequiredCompletionPercent('100')
      await queryClient.invalidateQueries({ queryKey: ['assignments', token] })
    },
  })

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Giao bài học theo lớp</h2>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo assignment</h3>
            <div className="form-stack">
              <label>
                Lớp học
                <select value={resolvedClassId} onChange={(event) => setClassId(event.target.value)}>
                  <option value="">Chọn lớp học</option>
                  {classesQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Bài học
                <select value={resolvedLessonId} onChange={(event) => setLessonId(event.target.value)}>
                  <option value="">Chọn bài học</option>
                  {lessonsQuery.data?.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                  ))}
                </select>
              </label>
              <label>
                Hạn hoàn thành
                <input value={dueAt} onChange={(event) => setDueAt(event.target.value)} placeholder="2026-04-10T20:00:00+07:00" />
              </label>
              <label>
                % cần hoàn thành
                <input value={requiredCompletionPercent} onChange={(event) => setRequiredCompletionPercent(event.target.value)} inputMode="numeric" />
              </label>
              <button className="action-button" type="button" disabled={!resolvedClassId || !resolvedLessonId || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Đang giao...' : 'Giao bài cho cả lớp'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Preview assignment</h3>
            <div className="detail-stack">
              <div className="student-row">
                <strong>{selectedClass?.name ?? 'Chưa chọn lớp'}</strong>
                <span>{classStudentsQuery.data?.length ?? 0} học sinh sẽ nhận bài</span>
              </div>
              <div className="student-row">
                <strong>{selectedLesson?.title ?? 'Chưa chọn bài học'}</strong>
                <span>{selectedLesson?.subject?.name ?? 'Chưa có môn học'} / {selectedLesson?.activity_count ?? 0} activity</span>
              </div>
            </div>
          </article>
        </section>

        <section className="roadmap-panel">
          <h3>Danh sách assignment đã tạo</h3>
          <div className="student-list compact-list">
            {assignmentsQuery.data?.map((assignment) => (
              <div key={assignment.id} className="student-row">
                <strong>{assignment.lesson?.title ?? `Assignment #${assignment.id}`}</strong>
                <span>{assignment.classroom?.name ?? 'Không rõ lớp'} / {assignment.student_ids.length} học sinh / {assignment.status}</span>
              </div>
            ))}
            {!assignmentsQuery.data?.length && !assignmentsQuery.isLoading ? <p>Chưa có assignment nào.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
