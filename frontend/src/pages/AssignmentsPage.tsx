import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createAssignment, fetchAssignments, fetchClasses, fetchClassStudents, fetchLessons } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const COMPLETION_PRESETS = [
  { value: '70', label: 'Dễ xong 70%' },
  { value: '80', label: 'Mức phổ biến' },
  { value: '100', label: 'Cần hoàn thành hết' },
]

export function AssignmentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [requiredCompletionPercent, setRequiredCompletionPercent] = useState('80')
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
    mutationFn: () =>
      createAssignment(token!, {
        lesson_id: Number(resolvedLessonId),
        class_id: Number(resolvedClassId),
        subject_id: selectedLesson?.subject_id,
        target_type: 'class',
        due_at: dueAt || undefined,
        required_completion_percent: Number(requiredCompletionPercent),
      }),
    onSuccess: async () => {
      setDueAt('')
      setRequiredCompletionPercent('80')
      await queryClient.invalidateQueries({ queryKey: ['assignments', token] })
    },
  })

  const studentCount = classStudentsQuery.data?.length ?? 0
  const activityCount = selectedLesson?.activity_count ?? 0
  const canCreateAssignment = Boolean(resolvedClassId && resolvedLessonId)

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow">Giao bài</p>
            <h2>Chọn lớp, chọn bài, giao ngay</h2>
            <p>Tiến độ học sinh vẫn được hệ thống tự cập nhật sau khi giao.</p>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>{classesQuery.data?.length ?? 0} lớp</span>
            <span>{lessonsQuery.data?.length ?? 0} bài</span>
            <span>{assignmentsQuery.data?.length ?? 0} lượt giao</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          <article className="mini-card teacher-clean-metric teacher-clean-metric-blue">
            <span>Lớp nhận</span>
            <strong>{studentCount}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-green">
            <span>Hoạt động</span>
            <strong>{activityCount}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-gold">
            <span>Mức đạt</span>
            <strong>{requiredCompletionPercent}%</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-coral">
            <span>Hạn</span>
            <strong>{dueAt ? 'Có' : 'Không'}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-ink">
            <span>Đã giao</span>
            <strong>{assignmentsQuery.data?.length ?? 0}</strong>
          </article>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Tạo mới</p>
                <h3>Giao bài nhanh</h3>
              </div>
            </div>
            <div className="form-stack">
              <label>
                Lớp học
                <select value={resolvedClassId} onChange={(event) => setClassId(event.target.value)}>
                  <option value="">Chọn lớp học</option>
                  {classesQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Bài học
                <select value={resolvedLessonId} onChange={(event) => setLessonId(event.target.value)}>
                  <option value="">Chọn bài học</option>
                  {lessonsQuery.data?.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="detail-stack">
                <strong>Mức hoàn thành cần đạt</strong>
                <div className="tag-wrap">
                  {COMPLETION_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={requiredCompletionPercent === preset.value ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                      onClick={() => setRequiredCompletionPercent(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <details className="config-card">
                <summary className="simple-summary">Tùy chọn thêm</summary>
                <label>
                  Hạn hoàn thành
                  <input value={dueAt} onChange={(event) => setDueAt(event.target.value)} placeholder="Ví dụ: 2026-04-10T20:00:00+07:00" />
                </label>
              </details>

              <button className="action-button" type="button" disabled={!canCreateAssignment || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Đang giao bài...' : 'Giao bài cho lớp này'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Xem trước</p>
                <h3>Trước khi giao</h3>
              </div>
            </div>
            <div className="detail-stack">
              <div className="student-row">
                <strong>{selectedClass?.name ?? 'Chưa chọn lớp'}</strong>
                <span>{studentCount} học sinh sẽ nhận bài</span>
              </div>
              <div className="student-row">
                <strong>{selectedLesson?.title ?? 'Chưa chọn bài học'}</strong>
                <span>{selectedLesson?.subject?.name ?? 'Chưa có môn học'} / {activityCount} hoạt động</span>
              </div>
              <p>Mức cần đạt: {requiredCompletionPercent}%.</p>
              <p>{dueAt ? `Hạn nộp: ${dueAt}` : 'Không đặt hạn nộp, học sinh có thể học ngay khi nhận bài.'}</p>
              <p className="helper-text">Sau khi giao xong, trang Tiến độ sẽ tự hiển thị dữ liệu theo từng học sinh.</p>
              {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Bạn cần tạo lớp trước khi giao bài.</p> : null}
              {!lessonsQuery.data?.length && !lessonsQuery.isLoading ? <p>Bạn cần tạo bài học trước khi giao bài.</p> : null}
            </div>
          </article>
        </section>

        <section className="roadmap-panel">
          <div className="teacher-clean-section-head">
            <div>
              <p className="eyebrow">Lịch sử</p>
              <h3>Bài đã giao</h3>
            </div>
            <span className="subject-pill muted-pill">{assignmentsQuery.data?.length ?? 0}</span>
          </div>
          <div className="student-list compact-list">
            {assignmentsQuery.data?.map((assignment) => (
              <div key={assignment.id} className="student-row">
                <strong>{assignment.lesson?.title ?? `Bài tập #${assignment.id}`}</strong>
                <span>{assignment.classroom?.name ?? 'Không rõ lớp'} / {assignment.student_ids.length} học sinh</span>
                <p>Mức cần đạt: {assignment.required_completion_percent}% {assignment.due_at ? `| Hạn nộp: ${assignment.due_at}` : ''}</p>
              </div>
            ))}
            {!assignmentsQuery.data?.length && !assignmentsQuery.isLoading ? <p>Chưa có bài tập nào được giao.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
