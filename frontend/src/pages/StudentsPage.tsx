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
          <h2>Quản lý hồ sơ học sinh</h2>
          <p>
            Giáo viên có thể tạo học sinh mới cho mình, và với mô hình mới, một học sinh có thể học với nhiều giáo viên.
            Màn này giúp xem nhanh một học sinh hiện đang được kết nối với những giáo viên nào.
          </p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo học sinh mới</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                Họ tên học sinh
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" />
              </label>
              <label>
                Mức độ khuyết tật
                <select value={disabilityLevel} onChange={(event) => setDisabilityLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button className="action-button" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo học sinh'}
              </button>
              {createMutation.error ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Danh sách học sinh</h3>
            <div className="student-list compact-list">
              {studentsQuery.data?.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={resolvedSelectedStudentId === student.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  {student.full_name} - {student.disability_level}
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
                  <span>{selectedStudent.disability_level} / {selectedStudent.preferred_input}</span>
                </div>
                <p>Ghi chú hỗ trợ: {selectedStudent.support_note ?? 'Chưa có ghi chú.'}</p>
                <p>Số giáo viên đang liên kết: {studentTeachersQuery.data?.length ?? 0}</p>
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
              {!studentTeachersQuery.data?.length && resolvedSelectedStudentId && !studentTeachersQuery.isLoading ? <p>Học sinh này hiện chỉ có giáo viên đang xem hồ sơ hoặc chưa vào lớp nào.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
