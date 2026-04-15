import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchStudentTeachers, fetchStudents, updateStudent } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_OPTIONS = [
  { value: 'nhe', label: 'Nhẹ', icon: 'N' },
  { value: 'trung_binh', label: 'Trung bình', icon: 'TB' },
  { value: 'nang', label: 'Nặng', icon: 'NG' },
]

const levelLabelMap = LEVEL_OPTIONS.reduce<Record<string, string>>((accumulator, option) => {
  accumulator[option.value] = option.label
  return accumulator
}, {})

export function StudentsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const groupedStudents = useMemo(() => {
    const groups = new Map(LEVEL_OPTIONS.map((level) => [level.value, [] as NonNullable<typeof studentsQuery.data>]))
    for (const student of studentsQuery.data ?? []) {
      const targetGroup = groups.get(student.disability_level) ?? groups.get('trung_binh')
      targetGroup?.push(student)
    }
    return groups
  }, [studentsQuery.data])

  const resolvedSelectedStudentId = selectedStudentId ?? studentsQuery.data?.[0]?.id ?? null
  const selectedStudent = studentsQuery.data?.find((student) => student.id === resolvedSelectedStudentId) ?? null

  const studentTeachersQuery = useQuery({
    queryKey: ['student-teachers', token, resolvedSelectedStudentId],
    queryFn: () => fetchStudentTeachers(token!, resolvedSelectedStudentId!),
    enabled: Boolean(token && resolvedSelectedStudentId),
  })

  const updateLevelMutation = useMutation({
    mutationFn: (nextLevel: string) => updateStudent(token!, resolvedSelectedStudentId!, { disability_level: nextLevel }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students', token] })
    },
  })

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow">Học sinh</p>
            <h2>Phân nhóm học sinh</h2>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>{studentsQuery.data?.length ?? 0} học sinh</span>
            <span>{groupedStudents.get('nhe')?.length ?? 0} nhẹ</span>
            <span>{groupedStudents.get('nang')?.length ?? 0} nặng</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          {LEVEL_OPTIONS.map((level, index) => (
            <article key={level.value} className={`mini-card teacher-clean-metric ${index === 0 ? 'teacher-clean-metric-green' : index === 1 ? 'teacher-clean-metric-blue' : 'teacher-clean-metric-coral'}`}>
              <span>{level.label}</span>
              <strong>{groupedStudents.get(level.value)?.length ?? 0}</strong>
            </article>
          ))}
        </section>

        <section className="student-group-grid">
          {LEVEL_OPTIONS.map((level) => {
            const students = groupedStudents.get(level.value) ?? []
            return (
              <article key={level.value} className="roadmap-panel student-group-panel">
                <div className="teacher-clean-section-head">
                  <div>
                    <p className="eyebrow">Nhóm</p>
                    <h3>{level.label}</h3>
                  </div>
                  <span className="subject-pill muted-pill">{students.length}</span>
                </div>

                <div className="student-list compact-list">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className={resolvedSelectedStudentId === student.id ? 'student-row student-row-button student-row-button-active' : 'student-row student-row-button'}
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <strong>{student.full_name}</strong>
                      <span>{student.preferred_input === 'touch' ? 'Cảm ứng' : 'Bàn phím'} / ID {student.id}</span>
                    </button>
                  ))}
                  {!students.length ? <p>Chưa có học sinh.</p> : null}
                </div>
              </article>
            )
          })}
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Phân loại</p>
                <h3>Học sinh đang chọn</h3>
              </div>
            </div>

            {selectedStudent ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedStudent.full_name}</strong>
                  <span>{levelLabelMap[selectedStudent.disability_level] ?? selectedStudent.disability_level}</span>
                  <p>{selectedStudent.support_note ?? 'Chưa có ghi chú hỗ trợ.'}</p>
                </div>

                <div className="student-level-actions">
                  {LEVEL_OPTIONS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      className={selectedStudent.disability_level === level.value ? 'builder-type-card builder-type-card-active' : 'builder-type-card'}
                      disabled={updateLevelMutation.isPending}
                      onClick={() => updateLevelMutation.mutate(level.value)}
                    >
                      <strong>{level.icon}</strong>
                      <span>{level.label}</span>
                    </button>
                  ))}
                </div>

                {updateLevelMutation.error ? <p className="error-text">{(updateLevelMutation.error as Error).message}</p> : null}
              </div>
            ) : (
              <p>Chọn một học sinh để phân loại.</p>
            )}
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Liên kết</p>
                <h3>Giáo viên đang dạy</h3>
              </div>
              <span className="subject-pill muted-pill">{studentTeachersQuery.data?.length ?? 0}</span>
            </div>

            <div className="student-list compact-list">
              {(studentTeachersQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.teacher.full_name}</strong>
                  <span>{item.teacher.school_name ?? 'Chưa cập nhật trường'}</span>
                  <p>{item.teacher.email ?? item.teacher.phone ?? 'Chưa có liên hệ'}</p>
                </div>
              ))}
              {!studentTeachersQuery.data?.length && resolvedSelectedStudentId && !studentTeachersQuery.isLoading ? (
                <p>Học sinh này chưa có liên kết giáo viên khác.</p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
