import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addStudentsToClass,
  addSubjectToClass,
  createClass,
  fetchClasses,
  fetchClassStudents,
  fetchClassSubjects,
  fetchStudents,
  fetchSubjects,
} from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const classUiVariants = [
  {
    value: 'standard',
    title: 'Lớp tiêu chuẩn',
    description: 'Giữ giao diện hiện tại cho nhóm học sinh bình thường, thao tác và bố cục quen thuộc.',
  },
  {
    value: 'visual_support',
    title: 'Lớp hỗ trợ trực quan',
    description: 'Dành cho nhóm cần giao diện cuộn dọc, card lớn, màu sinh động và ít phụ thuộc vào chữ.',
  },
] as const

const classUiVariantLabelMap: Record<(typeof classUiVariants)[number]['value'], string> = {
  standard: 'Giao diện tiêu chuẩn',
  visual_support: 'Giao diện trực quan',
}

const visualThemeOptions = [
  {
    value: 'garden',
    title: 'Vườn dịu mắt',
    description: 'Xanh lá, vàng kem, hợp cho học lâu và ít gây mỏi mắt.',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  },
  {
    value: 'ocean',
    title: 'Mặt hồ êm',
    description: 'Xanh ngọc sáng, cảm giác nhẹ và sạch, hợp thao tác chạm.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
  },
  {
    value: 'cosmos',
    title: 'Phiêu lưu vũ trụ',
    description: 'Tím xanh nổi bật hơn, hợp với nhóm thích cảm giác khám phá.',
    imageUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80',
  },
] as const

const visualThemeLabelMap: Record<(typeof visualThemeOptions)[number]['value'], string> = {
  garden: 'Vườn dịu mắt',
  ocean: 'Mặt hồ êm',
  cosmos: 'Phiêu lưu vũ trụ',
}

export function ClassesPage() {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [uiVariant, setUiVariant] = useState<(typeof classUiVariants)[number]['value']>('standard')
  const [visualTheme, setVisualTheme] = useState<(typeof visualThemeOptions)[number]['value']>('garden')
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>(visualThemeOptions[0].imageUrl)
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
    mutationFn: () =>
      createClass(token!, {
        name,
        grade_label: grade,
        ui_variant: uiVariant,
        visual_theme: visualTheme,
        background_image_url: backgroundImageUrl.trim() || undefined,
      }),
    onSuccess: async (createdClass) => {
      setName('')
      setGrade('')
      setUiVariant('standard')
      setVisualTheme('garden')
      setBackgroundImageUrl(visualThemeOptions[0].imageUrl)
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
          <p className="eyebrow">Lớp học</p>
          <h2>Quản lý lớp học</h2>
          <p>Tạo lớp nhanh, chọn lớp đang dạy và thêm học sinh hoặc môn học trong vài bước ngắn.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo lớp mới</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Tên lớp
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Lớp 6A buổi chiều" />
              </label>

              <div className="detail-stack">
                <strong>Kiểu giao diện của lớp</strong>
                <div className="builder-type-grid">
                  {classUiVariants.map((variant) => (
                    <button
                      key={variant.value}
                      type="button"
                      className={uiVariant === variant.value ? 'builder-type-card builder-type-card-active' : 'builder-type-card'}
                      onClick={() => setUiVariant(variant.value)}
                    >
                      <strong>{variant.title}</strong>
                      <span>{variant.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {uiVariant === 'visual_support' ? (
                <div className="detail-stack">
                  <strong>Theme cho lớp hỗ trợ</strong>
                  <div className="builder-type-grid">
                    {visualThemeOptions.map((theme) => (
                      <button
                        key={theme.value}
                        type="button"
                        className={visualTheme === theme.value ? 'builder-type-card builder-type-card-active' : 'builder-type-card'}
                        onClick={() => {
                          setVisualTheme(theme.value)
                          if (!backgroundImageUrl.trim() || backgroundImageUrl === visualThemeOptions.find((item) => item.value === visualTheme)?.imageUrl) {
                            setBackgroundImageUrl(theme.imageUrl)
                          }
                        }}
                      >
                        <strong>{theme.title}</strong>
                        <span>{theme.description}</span>
                      </button>
                    ))}
                  </div>
                  <label>
                    Ảnh nền từ bên ngoài
                    <input
                      value={backgroundImageUrl}
                      onChange={(event) => setBackgroundImageUrl(event.target.value)}
                      placeholder="Dán URL ảnh nền cho lớp hỗ trợ"
                    />
                  </label>
                  <p className="helper-text">Bạn có thể dùng ảnh ngoài. Hệ thống sẽ lấy ảnh này làm nền chính cho giao diện học sinh của lớp hỗ trợ.</p>
                </div>
              ) : null}

              <details className="config-card">
                <summary className="simple-summary">Tùy chọn thêm</summary>
                <label>
                  Khối lớp
                  <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Ví dụ: 6" />
                </label>
              </details>

              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo lớp'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chọn lớp để quản lý</h3>
            <p className="helper-text">Bấm vào một lớp để xem thông tin và thao tác nhanh.</p>
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
              <h3>Thông tin nhanh</h3>
              <div className="student-row">
                <strong>{selectedClass.name}</strong>
                <span>{selectedClass.grade_label ? `Khối ${selectedClass.grade_label}` : 'Chưa gắn khối lớp'}</span>
              </div>
              <div className="tag-wrap">
                <span className="subject-pill">{classUiVariantLabelMap[selectedClass.ui_variant] ?? selectedClass.ui_variant}</span>
                {selectedClass.ui_variant === 'visual_support' ? (
                  <span className="subject-pill muted-pill">{visualThemeLabelMap[selectedClass.visual_theme] ?? selectedClass.visual_theme}</span>
                ) : null}
              </div>
              <div className="metrics-grid">
                <div className="mini-card">
                  <span>ID lớp</span>
                  <strong>{selectedClass.id}</strong>
                </div>
                <div className="mini-card">
                  <span>Mật khẩu lớp</span>
                  <strong>{selectedClass.join_credential?.class_password ?? 'Chưa cập nhật'}</strong>
                </div>
                <div className="mini-card">
                  <span>Học sinh</span>
                  <strong>{selectedClass.student_count}</strong>
                </div>
                <div className="mini-card">
                  <span>Môn học</span>
                  <strong>{selectedClass.subject_count}</strong>
                </div>
              </div>
            </article>

            <article className="roadmap-panel">
              <h3>Trạng thái lớp</h3>
              <div className="detail-stack">
                <div className="tag-wrap">
                  <span className="subject-pill">{selectedClass.status === 'active' ? 'Đang hoạt động' : selectedClass.status}</span>
                  {selectedClass.grade_label ? <span className="subject-pill muted-pill">{`Khối ${selectedClass.grade_label}`}</span> : null}
                  <span className="subject-pill muted-pill">{classUiVariantLabelMap[selectedClass.ui_variant] ?? selectedClass.ui_variant}</span>
                  {selectedClass.ui_variant === 'visual_support' ? (
                    <span className="subject-pill muted-pill">{visualThemeLabelMap[selectedClass.visual_theme] ?? selectedClass.visual_theme}</span>
                  ) : null}
                </div>
                <p>
                  {selectedClass.ui_variant === 'visual_support'
                    ? 'Lớp này sẽ tự mở giao diện học sinh cuộn dọc, card lớn và nền sinh động cho các bài được giao từ lớp này.'
                    : 'Đây là lớp đang dùng giao diện tiêu chuẩn để thêm học sinh, gắn môn học và theo dõi danh sách hiện tại.'}
                </p>
                {selectedClass.ui_variant === 'visual_support' && selectedClass.background_image_url ? (
                  <p>Ảnh nền đang dùng: {selectedClass.background_image_url}</p>
                ) : null}
                <details className="config-card">
                  <summary className="simple-summary">Thông tin thêm</summary>
                  <div className="metrics-grid">
                    <div className="mini-card">
                      <span>ID giáo viên</span>
                      <strong>{selectedClass.teacher_id}</strong>
                    </div>
                    <div className="mini-card">
                      <span>Tên lớp</span>
                      <strong>{selectedClass.name}</strong>
                    </div>
                  </div>
                </details>
              </div>
            </article>
          </section>
        ) : (
          <section className="roadmap-panel">
            <h3>Chưa chọn lớp</h3>
            <p>Hãy tạo mới hoặc chọn một lớp ở trên để bắt đầu quản lý học sinh và môn học.</p>
          </section>
        )}

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thêm học sinh vào lớp</h3>
            <div className="form-stack">
              <label>
                Học sinh chưa vào lớp
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={!resolvedSelectedClassId}>
                  <option value="">Chọn học sinh</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name} - {student.disability_level}</option>
                  ))}
                </select>
              </label>
              <button
                className="action-button"
                type="button"
                disabled={!resolvedSelectedClassId || !selectedStudentId || addStudentMutation.isPending}
                onClick={() => addStudentMutation.mutate()}
              >
                {addStudentMutation.isPending ? 'Đang thêm...' : 'Thêm vào lớp'}
              </button>
              {addStudentMutation.error ? <p className="error-text">{(addStudentMutation.error as Error).message}</p> : null}
            </div>

            <div className="student-list compact-list">
              {classStudentsQuery.data?.map((item) => (
                <div key={item.id} className="student-row">
                  <strong>{item.student?.full_name ?? `Học sinh #${item.student_id}`}</strong>
                  <span>{item.student?.preferred_input ?? 'Bàn phím'} / {item.student?.disability_level ?? 'Mức độ nhẹ'}</span>
                </div>
              ))}
              {resolvedSelectedClassId && !classStudentsQuery.data?.length && !classStudentsQuery.isLoading ? <p>Lớp này chưa có học sinh nào.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <h3>Gắn môn học cho lớp</h3>
            <div className="form-stack">
              <label>
                Môn học có sẵn
                <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)} disabled={!resolvedSelectedClassId}>
                  <option value="">Chọn môn học</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <button
                className="action-button"
                type="button"
                disabled={!resolvedSelectedClassId || !selectedSubjectId || addSubjectMutation.isPending}
                onClick={() => addSubjectMutation.mutate()}
              >
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

        <section className="roadmap-panel">
          <h3>Danh sách lớp</h3>
          <div className="card-grid classes-grid">
            {classesQuery.data?.map((classItem) => (
              <article key={classItem.id} className="info-card">
                <span>{classItem.grade_label ? `Khối ${classItem.grade_label}` : 'Lớp học'}</span>
                <strong>{classItem.name}</strong>
                <p>{classItem.student_count} học sinh, {classItem.subject_count} môn học</p>
                <p>{classUiVariantLabelMap[classItem.ui_variant] ?? classItem.ui_variant}</p>
                {classItem.ui_variant === 'visual_support' ? <p>{visualThemeLabelMap[classItem.visual_theme] ?? classItem.visual_theme}</p> : null}
                <p>Mật khẩu: {classItem.join_credential?.class_password ?? 'Chưa cập nhật'}</p>
                <button
                  type="button"
                  className={resolvedSelectedClassId === classItem.id ? 'pill-button pill-button-active' : 'pill-button'}
                  onClick={() => setSelectedClassId(classItem.id)}
                >
                  {resolvedSelectedClassId === classItem.id ? 'Đang chọn' : 'Quản lý lớp này'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
