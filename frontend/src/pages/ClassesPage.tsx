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

const visualThemeOptions = [
  {
    value: 'garden',
    title: '🌿 Vườn dịu mắt',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  },
  {
    value: 'ocean',
    title: '🌊 Mặt hồ êm',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
  },
  {
    value: 'cosmos',
    title: '🌌 Vũ trụ',
    imageUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80',
  },
] as const

const visualThemeLabelMap: Record<(typeof visualThemeOptions)[number]['value'], string> = {
  garden: 'Vườn dịu mắt',
  ocean: 'Mặt hồ êm',
  cosmos: 'Vũ trụ',
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert(`Đã sao chép: ${text}`)
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow teacher-clean-title-label">Quản lý lớp</p>
            <h2>Trung tâm điều phối lớp học</h2>
            <p className="helper-text">Tạo không gian học tập, quản lý danh sách học sinh và phân bổ môn học cho từng lớp.</p>
          </div>
          <div className="teacher-clean-hero-badges">
             <span>{classesQuery.data?.length || 0} Lớp đang dạy</span>
             <span>ID Lớp & Mật khẩu để học sinh tự tham gia</span>
          </div>
        </section>

        <section className="auth-layout" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Thao tác</p>
                <h3>Tạo lớp học mới</h3>
              </div>
            </div>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Tên lớp (ví dụ: Lớp 6A - Sáng)
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nhập tên lớp..." />
              </label>

              <label>
                Khối lớp (ví dụ: 6)
                <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Nhập khối..." />
              </label>

              <div className="detail-stack">
                <label className="label">Chủ đề thị giác (Theme)</label>
                <div className="builder-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
                  {visualThemeOptions.map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      className={visualTheme === theme.value ? 'builder-type-card builder-type-card-active' : 'builder-type-card'}
                      onClick={() => {
                        setVisualTheme(theme.value)
                        setBackgroundImageUrl(theme.imageUrl)
                      }}
                      style={{ padding: '0.8rem', textAlign: 'center' }}
                    >
                      <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '0.3rem' }}>
                        {theme.value === 'garden' ? '🌿' : theme.value === 'ocean' ? '🌊' : '🌌'}
                      </span>
                      <strong style={{ fontSize: '0.8rem' }}>{theme.title.split(' ')[1] || theme.title}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <button className="action-button" type="submit" disabled={createMutation.isPending} style={{ marginTop: '1rem' }}>
                {createMutation.isPending ? 'Đang tạo...' : '✨ Tạo lớp học'}
              </button>
            </form>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Hệ thống</p>
                <h3>Danh sách lớp của bạn</h3>
              </div>
            </div>
            <div className="teacher-clean-list-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
              {classesQuery.data?.map((classItem) => (
                <button
                  key={classItem.id}
                  type="button"
                  className={resolvedSelectedClassId === classItem.id ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                  onClick={() => setSelectedClassId(classItem.id)}
                  style={{ 
                    flexDirection: 'column', 
                    alignItems: 'flex-start', 
                    textAlign: 'left', 
                    padding: '1.2rem',
                    border: resolvedSelectedClassId === classItem.id ? '2px solid #335dc4' : '1px solid #f3f4f6'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
                    <strong>{classItem.name}</strong>
                    <span className="subject-pill muted-pill" style={{ fontSize: '0.7rem' }}>Khối {classItem.grade_label || '---'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#636e72' }}>
                    👥 {classItem.student_count} học sinh • 📘 {classItem.subject_count} môn
                  </div>
                  <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', background: '#f8f9fa', padding: '0.4rem 0.6rem', borderRadius: '8px', width: '100%' }}>
                     Mật khẩu: <code style={{ color: '#335dc4', fontWeight: 700 }}>{classItem.join_credential?.class_password || '---'}</code>
                  </div>
                </button>
              ))}
              {!classesQuery.data?.length && !classesQuery.isLoading ? <p>Bạn chưa có lớp học nào.</p> : null}
            </div>
          </article>
        </section>

        {selectedClass && (
          <section className="roadmap-panel" style={{ border: '2px solid #e0e7ff', background: 'linear-gradient(135deg, #ffffff 0%, #f9faff 100%)' }}>
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Thông tin chi tiết</p>
                <h3 style={{ fontSize: '1.8rem', color: '#1a1a1a' }}>Lớp: {selectedClass.name}</h3>
              </div>
              <div className="teacher-clean-hero-badges" style={{ margin: 0 }}>
                 <span className="teacher-clean-metric-blue" onClick={() => copyToClipboard(String(selectedClass.id))} style={{ cursor: 'pointer' }}>🆔 ID: {selectedClass.id} 📋</span>
                 <span className="teacher-clean-metric-gold" onClick={() => copyToClipboard(selectedClass.join_credential?.class_password || '')} style={{ cursor: 'pointer' }}>🔑 Pass: {selectedClass.join_credential?.class_password} 📋</span>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
              <div className="form-stack">
                 <strong>Dành cho học sinh</strong>
                 <p className="helper-text">Gửi ID và Mật khẩu trên cho học sinh. Học sinh tự đăng ký và nhập thông tin này để vào lớp.</p>
                 <div className="config-card" style={{ background: '#fff', border: '1px dashed #335dc4' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      "Chào các em, để tham gia lớp <strong>{selectedClass.name}</strong>, các em hãy nhập ID: <strong>{selectedClass.id}</strong> và Mật khẩu: <strong>{selectedClass.join_credential?.class_password}</strong> nhé!"
                    </p>
                 </div>
              </div>

              <div className="teacher-clean-metrics" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="mini-card" style={{ background: '#fff' }}>
                   <span>Mức độ hiển thị</span>
                   <strong>{visualThemeLabelMap[selectedClass.visual_theme] || 'Mặc định'}</strong>
                </div>
                <div className="mini-card" style={{ background: '#fff' }}>
                   <span>Trạng thái</span>
                   <strong style={{ color: '#2a8f80' }}>Đang hoạt động</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Thành viên</p>
                <h3>Học sinh trong lớp ({classStudentsQuery.data?.length || 0})</h3>
              </div>
            </div>
            <div className="student-list compact-list" style={{ marginTop: '1rem' }}>
              {classStudentsQuery.data?.map((item) => (
                <div key={item.id} className="student-row" style={{ padding: '0.8rem 0' }}>
                  <div>
                    <strong>{item.student?.full_name || 'Học sinh'}</strong>
                    <p style={{ fontSize: '0.8rem', color: '#636e72', margin: 0 }}>
                      Mức: {item.student?.disability_level === 'nhe' ? 'Nhẹ' : item.student?.disability_level === 'trung_binh' ? 'Trung bình' : 'Nặng'}
                    </p>
                  </div>
                  <span className="subject-pill muted-pill">{item.student?.preferred_input || 'Cảm ứng'}</span>
                </div>
              ))}
              {!classStudentsQuery.data?.length && !classStudentsQuery.isLoading && <p className="helper-text">Lớp chưa có học sinh.</p>}
            </div>

            <details className="config-card" style={{ marginTop: '1.5rem', border: 'none', background: '#f8f9fa' }}>
              <summary className="simple-summary" style={{ fontWeight: 600, color: '#335dc4' }}>Thêm học sinh thủ công</summary>
              <div className="form-stack" style={{ marginTop: '1rem' }}>
                <select className="teacher-clean-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                  <option value="">Chọn học sinh từ danh sách...</option>
                  {availableStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <button className="action-button" onClick={() => addStudentMutation.mutate()} disabled={!selectedStudentId || addStudentMutation.isPending}>
                   Thêm ngay
                </button>
              </div>
            </details>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Nội dung</p>
                <h3>Môn học được phép ({classSubjectsQuery.data?.length || 0})</h3>
              </div>
            </div>
            <div className="tag-wrap" style={{ marginTop: '1.5rem', gap: '0.8rem' }}>
              {classSubjectsQuery.data?.map((item) => (
                <span key={item.id} className="subject-pill" style={{ padding: '0.6rem 1rem', fontSize: '0.95rem' }}>
                  📘 {item.subject?.name}
                </span>
              ))}
              {!classSubjectsQuery.data?.length && !classSubjectsQuery.isLoading && <p className="helper-text">Chưa gắn môn học.</p>}
            </div>

            <details className="config-card" style={{ marginTop: '2rem', border: 'none', background: '#f8f9fa' }}>
              <summary className="simple-summary" style={{ fontWeight: 600, color: '#335dc4' }}>Gắn thêm môn học</summary>
              <div className="form-stack" style={{ marginTop: '1rem' }}>
                <select className="teacher-clean-select" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
                  <option value="">Chọn môn học...</option>
                  {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="action-button" onClick={() => addSubjectMutation.mutate()} disabled={!selectedSubjectId || addSubjectMutation.isPending}>
                   Gắn môn
                </button>
              </div>
            </details>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
