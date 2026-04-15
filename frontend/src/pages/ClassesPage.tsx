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

const classUiVariantLabelMap: Record<string, string> = {
  standard: 'Chuẩn',
  visual_support: 'Trực quan',
}

const visualThemeOptions = [
  {
    value: 'garden',
    title: 'Vườn dịu mắt',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  },
  {
    value: 'ocean',
    title: 'Mặt hồ êm',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
  },
  {
    value: 'cosmos',
    title: 'Phiêu lưu vũ trụ',
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
        ui_variant: 'visual_support',
        visual_theme: visualTheme,
        background_image_url: backgroundImageUrl.trim() || undefined,
      }),
    onSuccess: async (createdClass) => {
      setName('')
      setGrade('')
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
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow">Lớp học</p>
            <h2>Mã lớp, học sinh, môn</h2>
            <p>Giữ phần vào lớp cho học sinh thật rõ, phần thêm tay chỉ để hỗ trợ khi cần.</p>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>{classesQuery.data?.length ?? 0} lớp</span>
            <span>{selectedClass?.id ?? '---'} ID lớp</span>
            <span>{selectedClass?.join_credential?.class_password ?? '---'} mật khẩu</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          <article className="mini-card teacher-clean-metric teacher-clean-metric-blue">
            <span>Lớp</span>
            <strong>{classesQuery.data?.length ?? 0}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-green">
            <span>Học sinh trong lớp</span>
            <strong>{classStudentsQuery.data?.length ?? 0}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-gold">
            <span>Môn trong lớp</span>
            <strong>{classSubjectsQuery.data?.length ?? 0}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-coral">
            <span>Mật khẩu</span>
            <strong>{selectedClass?.join_credential?.class_password ?? '---'}</strong>
          </article>
          <article className="mini-card teacher-clean-metric teacher-clean-metric-ink">
            <span>Theme</span>
            <strong>{selectedClass ? visualThemeLabelMap[selectedClass.visual_theme] ?? selectedClass.visual_theme : '---'}</strong>
          </article>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Tạo mới</p>
                <h3>Tạo lớp</h3>
              </div>
            </div>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Tên lớp
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Lớp 6A buổi chiều" />
              </label>

              <label>
                Khối lớp
                <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Ví dụ: 6" />
              </label>

              <div className="detail-stack">
                <strong>Theme</strong>
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
                    </button>
                  ))}
                </div>
              </div>

              <details className="config-card">
                <summary className="simple-summary">Ảnh nền riêng</summary>
                <label>
                  URL ảnh nền
                  <input
                    value={backgroundImageUrl}
                    onChange={(event) => setBackgroundImageUrl(event.target.value)}
                    placeholder="Dán URL ảnh nền nếu muốn thay theme mặc định"
                  />
                </label>
              </details>

              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo lớp'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Danh sách</p>
                <h3>Chọn lớp</h3>
              </div>
            </div>
            <div className="student-list compact-list">
              {classesQuery.data?.map((classItem) => (
                <button
                  key={classItem.id}
                  type="button"
                  className={resolvedSelectedClassId === classItem.id ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                  onClick={() => setSelectedClassId(classItem.id)}
                >
                  <strong>{classItem.name}</strong>
                  <span>{classItem.grade_label ? `Khối ${classItem.grade_label}` : 'Chưa gắn khối'} / {classItem.student_count} học sinh</span>
                  <p>Mật khẩu: {classItem.join_credential?.class_password ?? 'Chưa cập nhật'}</p>
                </button>
              ))}
            </div>
            {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Chưa có lớp nào. Tạo lớp đầu tiên để bắt đầu.</p> : null}
          </article>
        </section>

        {selectedClass ? (
          <section className="dashboard-grid">
            <article className="roadmap-panel">
              <div className="teacher-clean-section-head">
                <div>
                  <p className="eyebrow">Đang chọn</p>
                  <h3>{selectedClass.name}</h3>
                </div>
              </div>
              <div className="student-row">
                <strong>{selectedClass.name}</strong>
                <span>{selectedClass.grade_label ? `Khối ${selectedClass.grade_label}` : 'Chưa gắn khối lớp'}</span>
                <p>Học sinh dùng `ID lớp + mật khẩu lớp` để tự vào lớp này.</p>
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
              <div className="teacher-clean-section-head">
                <div>
                  <p className="eyebrow">Vào lớp</p>
                  <h3>Thông tin gửi học sinh</h3>
                </div>
              </div>
              <div className="detail-stack">
                <div className="metrics-grid">
                  <div className="mini-card">
                    <span>ID lớp</span>
                    <strong>{selectedClass.id}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Mật khẩu</span>
                    <strong>{selectedClass.join_credential?.class_password ?? 'Chưa cập nhật'}</strong>
                  </div>
                </div>
                <div className="tag-wrap">
                  <span className="subject-pill">{selectedClass.status === 'active' ? 'Đang hoạt động' : selectedClass.status}</span>
                  {selectedClass.grade_label ? <span className="subject-pill muted-pill">{`Khối ${selectedClass.grade_label}`}</span> : null}
                </div>
                {selectedClass.ui_variant === 'visual_support' && selectedClass.background_image_url ? (
                  <p>Ảnh nền: {selectedClass.background_image_url}</p>
                ) : null}
                <p>Luồng chính: học sinh tự đăng ký tài khoản rồi nhập `ID lớp` và `mật khẩu` để tham gia.</p>
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
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Học sinh</p>
                <h3>Trong lớp</h3>
              </div>
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

            <details className="config-card">
              <summary className="simple-summary">Thêm thủ công</summary>
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
            </details>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Môn học</p>
                <h3>Trong lớp</h3>
              </div>
            </div>
            <div className="tag-wrap">
              {classSubjectsQuery.data?.map((item) => (
                <span key={item.id} className="subject-pill">{item.subject?.name ?? `Môn #${item.subject_id}`}</span>
              ))}
              {resolvedSelectedClassId && !classSubjectsQuery.data?.length && !classSubjectsQuery.isLoading ? <p>Lớp này chưa có môn học nào.</p> : null}
            </div>

            <details className="config-card">
              <summary className="simple-summary">Gắn môn</summary>
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
            </details>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
