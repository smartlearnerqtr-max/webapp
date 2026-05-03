import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createAssignment, fetchAssignments, fetchClasses, fetchClassStudents, fetchLessons } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_LABELS: Record<string, string> = {
  nhe: 'Nhẹ',
  trung_binh: 'Trung bình',
  nang: 'Nặng',
}

const LEVEL_OPTIONS = [
  { value: 'nhe', label: 'Nhẹ' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nang', label: 'Nặng' },
] as const

type AssignmentLevel = (typeof LEVEL_OPTIONS)[number]['value']

const COMPLETION_PRESETS = [
  { value: '70', label: 'Dễ xong 70%' },
  { value: '80', label: 'Mức phổ biến' },
  { value: '100', label: 'Cần hoàn thành hết' },
]

function formatDueAtLabel(value: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

export function AssignmentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [activeAssignmentLevel, setActiveAssignmentLevel] = useState<AssignmentLevel>('nhe')
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

  const filteredLessons = useMemo(
    () => (lessonsQuery.data ?? []).filter((lesson) => lesson.primary_level === activeAssignmentLevel),
    [activeAssignmentLevel, lessonsQuery.data],
  )

  const resolvedClassId = classId || String(classesQuery.data?.[0]?.id ?? '')
  const resolvedLessonId = lessonId || String(filteredLessons[0]?.id ?? '')

  const classStudentsQuery = useQuery({
    queryKey: ['class-students', token, resolvedClassId],
    queryFn: () => fetchClassStudents(token!, Number(resolvedClassId)),
    enabled: Boolean(token && resolvedClassId),
  })

  const selectedLesson = useMemo(
    () => filteredLessons.find((lesson) => lesson.id === Number(resolvedLessonId)) ?? null,
    [filteredLessons, resolvedLessonId],
  )

  const selectedClass = useMemo(
    () => classesQuery.data?.find((item) => item.id === Number(resolvedClassId)) ?? null,
    [classesQuery.data, resolvedClassId],
  )

  const selectedLessonLevel = selectedLesson?.primary_level ?? ''
  const eligibleStudents = useMemo(
    () =>
      (classStudentsQuery.data ?? []).filter((item) =>
        selectedLessonLevel ? item.student?.disability_level === selectedLessonLevel : true,
      ),
    [classStudentsQuery.data, selectedLessonLevel],
  )
  const levelBreakdown = useMemo(() => {
    const counts = { nhe: 0, trung_binh: 0, nang: 0 }
    for (const item of classStudentsQuery.data ?? []) {
      const level = item.student?.disability_level
      if (level === 'nhe' || level === 'trung_binh' || level === 'nang') {
        counts[level] += 1
      }
    }
    return counts
  }, [classStudentsQuery.data])

  const visibleAssignments = useMemo(
    () => (assignmentsQuery.data ?? []).filter((assignment) => assignment.lesson?.primary_level === activeAssignmentLevel),
    [activeAssignmentLevel, assignmentsQuery.data],
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
  const eligibleStudentCount = eligibleStudents.length
  const activityCount = selectedLesson?.activity_count ?? 0
  const canCreateAssignment = Boolean(resolvedClassId && resolvedLessonId && eligibleStudentCount > 0)
  const eligibleStudentNames = useMemo(
    () => eligibleStudents.map((item) => item.student?.full_name ?? `Học sinh #${item.student_id}`),
    [eligibleStudents],
  )
  const dueAtLabel = dueAt ? formatDueAtLabel(dueAt) : 'Không đặt hạn nộp'

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow">Giao bài</p>
            <h2>Chọn mức, chọn lớp, giao bài</h2>
            <p>Lớp chỉ là nơi chứa học sinh. Khi giáo viên chọn mức, hệ thống chỉ giao cho học sinh đúng mức trong lớp đó.</p>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>{classesQuery.isLoading ? '...' : (classesQuery.data?.length ?? 0)} lớp</span>
            <span>{filteredLessons.length} bài</span>
            <span>{visibleAssignments.length} lượt giao</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          <article className="mini-card teacher-clean-metric teacher-clean-metric-blue">
            <span>Trong lớp</span>
            <strong>{classesQuery.isLoading ? '...' : studentCount}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-coral">
            <span>Đúng mức ({LEVEL_LABELS[activeAssignmentLevel]})</span>
            <strong>{classesQuery.isLoading ? '...' : eligibleStudentCount}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-green">
            <span>Hoạt động</span>
            <strong>{lessonsQuery.isLoading ? '...' : activityCount}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-gold">
            <span>Tổng bài học</span>
            <strong>{lessonsQuery.isLoading ? '...' : (lessonsQuery.data?.length ?? 0)}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-ink">
            <span>Hạn nộp</span>
            <strong>{dueAt ? 'Đã đặt' : 'Chưa đặt'}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-blue">
            <span>Đã giao</span>
            <strong>{assignmentsQuery.isLoading ? '...' : (assignmentsQuery.data?.length ?? 0)}</strong>
          </article>
        </section>

        <section className="teacher-flow-summary">
          <article className="teacher-step-card teacher-step-card-active">
            <span>Bước 1</span>
            <strong>Chọn mức</strong>
            <p>{`Đang làm mức ${LEVEL_LABELS[activeAssignmentLevel]}.`}</p>
          </article>
          <article className={resolvedClassId ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 2</span>
            <strong>Chọn lớp</strong>
            <p>{selectedClass?.name ?? 'Chưa chọn lớp.'}</p>
          </article>
          <article className={resolvedLessonId ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 3</span>
            <strong>Chọn bài</strong>
            <p>{selectedLesson?.title ?? 'Chưa chọn bài học.'}</p>
          </article>
          <article className={canCreateAssignment ? 'teacher-step-card teacher-step-card-active' : 'teacher-step-card'}>
            <span>Bước 4</span>
            <strong>Giao cho đúng mức</strong>
            <p>{`${eligibleStudentCount} học sinh sẽ nhận bài.`}</p>
          </article>
        </section>

        <section className="auth-layout teacher-assignment-layout">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Thiết lập</p>
                <h3>Tạo lượt giao bài</h3>
              </div>
            </div>
            <div className="form-stack">
              <div className="teacher-inline-note">
                Giáo viên chỉ cần chọn đúng mức trước. Cùng một lớp vẫn có thể có học sinh nhẹ, trung bình và nặng.
              </div>

              <div className="config-card detail-stack">
                <strong>Bước 1. Chọn mức độ</strong>
                <div className="tag-wrap">
                  {LEVEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={activeAssignmentLevel === option.value ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                      onClick={() => {
                        setActiveAssignmentLevel(option.value)
                        setLessonId('')
                      }}
                    >
                      {`${option.label} (${(lessonsQuery.data ?? []).filter((lesson) => lesson.primary_level === option.value).length})`}
                    </button>
                  ))}
                </div>
                <p className="helper-text">Sau khi chọn mức, hệ thống chỉ hiện bài học thuộc mức đó để giao.</p>
              </div>

              <div className="config-card detail-stack">
                <label>
                  Bước 2. Lớp học
                  <select value={resolvedClassId} onChange={(event) => setClassId(event.target.value)}>
                    <option value="">Chọn lớp học</option>
                    {classesQuery.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="helper-text">Hệ thống sẽ nhìn vào học sinh trong lớp này rồi tự lọc theo mức đã chọn ở trên.</p>
              </div>

              <div className="config-card detail-stack">
                <label>
                  Bước 3. Bài học
                  <select value={resolvedLessonId} onChange={(event) => setLessonId(event.target.value)}>
                    <option value="">Chọn bài học</option>
                    {filteredLessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {`${lesson.title} (${LEVEL_LABELS[lesson.primary_level] ?? lesson.primary_level})`}
                      </option>
                    ))}
                  </select>
                </label>
                {!filteredLessons.length && !lessonsQuery.isLoading ? <p className="helper-text">Mức này chưa có bài học để giao.</p> : null}
              </div>

              <div className="config-card detail-stack">
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
                <label>
                  Hạn hoàn thành
                  <input type="datetime-local" step="60" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </label>
                <p className="helper-text">Có thể bỏ trống nếu muốn học sinh vào học ngay, không cần hạn nộp.</p>
              </div>

              <button
                className="action-button"
                type="button"
                disabled={!canCreateAssignment || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Đang giao bài...' : 'Giao bài cho học sinh đúng mức'}
              </button>
              {!eligibleStudentCount && resolvedClassId && resolvedLessonId ? (
                <p className="error-text">Lớp này chưa có học sinh thuộc mức {LEVEL_LABELS[selectedLessonLevel] ?? selectedLessonLevel}.</p>
              ) : null}
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Xem trước</p>
                <h3>Ai sẽ nhận bài</h3>
              </div>
            </div>
            <div className="detail-stack">
              <div className="teacher-selection-grid">
                <div className="teacher-selection-card">
                  <span>Lớp đang chọn</span>
                  <strong>{selectedClass?.name ?? 'Chưa chọn lớp'}</strong>
                  <p>{`${studentCount} học sinh trong lớp.`}</p>
                </div>
                <div className="teacher-selection-card">
                  <span>Bài đang chọn</span>
                  <strong>{selectedLesson?.title ?? 'Chưa chọn bài học'}</strong>
                  <p>{`${selectedLesson?.subject?.name ?? 'Chưa có môn học'} / ${LEVEL_LABELS[selectedLesson?.primary_level ?? ''] ?? selectedLesson?.primary_level ?? 'Chưa rõ mức'} / ${activityCount} hoạt động`}</p>
                </div>
                <div className="teacher-selection-card">
                  <span>Hạn hoàn thành</span>
                  <strong>{dueAtLabel}</strong>
                  <p>{`Mức cần đạt ${requiredCompletionPercent}%.`}</p>
                </div>
              </div>

              <div className="student-row">
                <strong>{selectedClass?.name ?? 'Chưa chọn lớp'}</strong>
                <span>{`${eligibleStudentCount}/${studentCount} học sinh sẽ nhận bài`}</span>
              </div>
              <p>{`Phân bố trong lớp: Nhẹ ${levelBreakdown.nhe}, Trung bình ${levelBreakdown.trung_binh}, Nặng ${levelBreakdown.nang}.`}</p>
              {selectedLessonLevel ? <p>{`Bài này chỉ giao cho học sinh mức ${LEVEL_LABELS[selectedLessonLevel] ?? selectedLessonLevel}.`}</p> : null}
              <p>Mức cần đạt: {requiredCompletionPercent}%.</p>
              <p>{dueAt ? `Hạn nộp: ${dueAtLabel}.` : 'Không đặt hạn nộp, học sinh có thể học ngay khi nhận bài.'}</p>
              {eligibleStudentNames.length ? (
                <div className="detail-stack">
                  <strong>Học sinh sẽ nhận bài</strong>
                  <div className="teacher-chip-list">
                    {eligibleStudentNames.map((name) => (
                      <span key={name} className="teacher-chip">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="helper-text">Sau khi giao xong, trang Tiến độ sẽ tự hiển thị dữ liệu theo từng học sinh.</p>
              {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Bạn cần tạo lớp trước khi giao bài.</p> : null}
              {!filteredLessons.length && !lessonsQuery.isLoading ? <p>{`Bạn cần tạo bài học cho mức ${LEVEL_LABELS[activeAssignmentLevel]} trước khi giao bài.`}</p> : null}
            </div>
          </article>
        </section>

        <section className="roadmap-panel">
          <div className="teacher-clean-section-head">
            <div>
              <p className="eyebrow">Lịch sử</p>
              <h3>Bài đã giao</h3>
            </div>
            <span className="subject-pill muted-pill">{visibleAssignments.length}</span>
          </div>
          <div className="student-list compact-list">
            {visibleAssignments.map((assignment) => (
              <div key={assignment.id} className="student-row">
                <strong>{assignment.lesson?.title ?? `Bài tập #${assignment.id}`}</strong>
                <span>{`${assignment.classroom?.name ?? 'Không rõ lớp'} / ${LEVEL_LABELS[assignment.lesson?.primary_level ?? ''] ?? assignment.lesson?.primary_level ?? 'Chưa rõ mức'} / ${assignment.student_ids.length} học sinh`}</span>
                <p>Mức cần đạt: {assignment.required_completion_percent}% {assignment.due_at ? `| Hạn nộp: ${assignment.due_at}` : ''}</p>
              </div>
            ))}
            {!visibleAssignments.length && !assignmentsQuery.isLoading ? <p>{`Chưa có bài tập nào được giao ở mức ${LEVEL_LABELS[activeAssignmentLevel]}.`}</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
