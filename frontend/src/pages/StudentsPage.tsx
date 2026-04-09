import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createStudent, fetchStudents, fetchStudentTeachers } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nặng' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nhe', label: 'Nhẹ' },
]

export function StudentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [disabilityLevel, setDisabilityLevel] = useState('trung_binh')
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const resolvedSelectedStudentId = selectedStudentId ?? studentsQuery.data?.[0]?.id ?? null

  const studentTeachersQuery = useQuery({
    queryKey: ['student-teachers', token, resolvedSelectedStudentId],
    queryFn: () => fetchStudentTeachers(token!, resolvedSelectedStudentId!),
    enabled: Boolean(token && resolvedSelectedStudentId),
  })

  const createMutation = useMutation({
    mutationFn: () => createStudent(token!, { full_name: fullName, disability_level: disabilityLevel }),
    onSuccess: async () => {
      setFullName('')
      setDisabilityLevel('trung_binh')
      await queryClient.invalidateQueries({ queryKey: ['students', token] })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim()) return
    createMutation.mutate()
  }

  const selectedStudent = studentsQuery.data?.find((student) => student.id === resolvedSelectedStudentId) ?? null

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Học sinh</p>
          <h2>Quản lý hồ sơ học sinh</h2>
          <p>Thêm hồ sơ nhanh, chọn học sinh để xem mức hỗ trợ và giáo viên đang phối hợp.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo học sinh mới</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Họ tên học sinh
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ví dụ: Nguyễn Văn A" />
              </label>

              <details className="config-card">
                <summary className="simple-summary">Tùy chọn thêm</summary>
                <label>
                  Mức độ khuyết tật
                  <select value={disabilityLevel} onChange={(event) => setDisabilityLevel(event.target.value)}>
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </details>

              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo học sinh'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Danh sách học sinh</h3>
            <p className="helper-text">Bấm vào một học sinh để xem hồ sơ chi tiết.</p>
            <div className="student-list compact-list">
              {studentsQuery.data?.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={resolvedSelectedStudentId === student.id ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  <strong>{student.full_name}</strong>
                  <span>{LEVEL_OPTIONS.find((option) => option.value === student.disability_level)?.label ?? student.disability_level}</span>
                </button>
              ))}
              {!studentsQuery.data?.length && !studentsQuery.isLoading ? <p>Chưa có học sinh nào.</p> : null}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Thông tin học sinh đang chọn</h3>
            {selectedStudent ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedStudent.full_name}</strong>
                  <span>
                    {LEVEL_OPTIONS.find((option) => option.value === selectedStudent.disability_level)?.label ?? selectedStudent.disability_level}
                    {' / '}
                    {selectedStudent.preferred_input === 'touch' ? 'Cảm ứng' : 'Bàn phím'}
                  </span>
                </div>
                <div className="metrics-grid">
                  <div className="mini-card">
                    <span>Giáo viên liên kết</span>
                    <strong>{studentTeachersQuery.data?.length ?? 0}</strong>
                  </div>
                  <div className="mini-card">
                    <span>Trạng thái hỗ trợ</span>
                    <strong>{selectedStudent.support_note ? 'Đã có ghi chú' : 'Chưa ghi chú'}</strong>
                  </div>
                </div>
                <p>Ghi chú hỗ trợ: {selectedStudent.support_note ?? 'Chưa có ghi chú.'}</p>
              </div>
            ) : (
              <p>Hãy chọn một học sinh để xem chi tiết.</p>
            )}
          </article>

          <article className="roadmap-panel">
            <h3>Giáo viên đang dạy học sinh này</h3>
            <div className="student-list compact-list">
              {(studentTeachersQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.teacher.full_name}</strong>
                  <span>Teacher ID {item.teacher.id} / {item.teacher.school_name ?? 'Chưa cập nhật trường'}</span>
                  <p>Email: {item.teacher.email ?? 'Chưa cập nhật'} | Số điện thoại: {item.teacher.phone ?? 'Chưa cập nhật'}</p>
                  <p>Số lớp đang dạy học sinh này: {item.active_class_count}</p>
                </div>
              ))}
              {!studentTeachersQuery.data?.length && resolvedSelectedStudentId && !studentTeachersQuery.isLoading ? (
                <p>Học sinh này hiện chỉ có giáo viên đang xem hồ sơ hoặc chưa vào lớp nào.</p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
