import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createLesson, createLessonActivity, fetchLesson, fetchLessons, fetchSubjects } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nặng' },
  { value: 'trung_binh', label: 'Trung bình' },
  { value: 'nhe', label: 'Nhẹ' },
]

const ACTIVITY_TYPES = [
  { value: 'multiple_choice', label: 'Chọn đáp án' },
  { value: 'matching', label: 'Nối cặp' },
  { value: 'drag_drop', label: 'Kéo thả' },
  { value: 'listen_choose', label: 'Nghe và chọn' },
  { value: 'watch_answer', label: 'Xem video và trả lời' },
  { value: 'step_by_step', label: 'Từng bước' },
]

export function LessonsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [primaryLevel, setPrimaryLevel] = useState('trung_binh')
  const [estimatedMinutes, setEstimatedMinutes] = useState('15')
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null)
  const [activityTitle, setActivityTitle] = useState('')
  const [activityType, setActivityType] = useState('multiple_choice')
  const [instructionText, setInstructionText] = useState('')
  const [voiceAnswerEnabled, setVoiceAnswerEnabled] = useState(true)
  const [configJson, setConfigJson] = useState('{"choices": ["A", "B"], "correct": "A"}')
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false)

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  })

  const lessonsQuery = useQuery({
    queryKey: ['lessons', token],
    queryFn: () => fetchLessons(token!),
    enabled: Boolean(token),
  })

  const lessonDetailQuery = useQuery({
    queryKey: ['lesson-detail', token, selectedLessonId],
    queryFn: () => fetchLesson(token!, selectedLessonId!),
    enabled: Boolean(token && selectedLessonId),
  })

  useEffect(() => {
    if (!subjectId && subjectsQuery.data?.length) {
      setSubjectId(String(subjectsQuery.data[0].id))
    }
  }, [subjectId, subjectsQuery.data])

  useEffect(() => {
    if (!selectedLessonId && lessonsQuery.data?.length) {
      setSelectedLessonId(lessonsQuery.data[0].id)
    }
  }, [lessonsQuery.data, selectedLessonId])

  const selectedLesson = useMemo(
    () => lessonsQuery.data?.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessonsQuery.data, selectedLessonId],
  )

  const createLessonMutation = useMutation({
    mutationFn: () => createLesson(token!, {
      title,
      description,
      subject_id: Number(subjectId),
      primary_level: primaryLevel,
      estimated_minutes: Number(estimatedMinutes),
      difficulty_stage: 1,
      is_published: true,
    }),
    onSuccess: async (createdLesson) => {
      setTitle('')
      setDescription('')
      setEstimatedMinutes('15')
      await queryClient.invalidateQueries({ queryKey: ['lessons', token] })
      setSelectedLessonId(createdLesson.id)
    },
  })

  const createActivityMutation = useMutation({
    mutationFn: () => createLessonActivity(token!, selectedLessonId!, {
      title: activityTitle,
      activity_type: activityType,
      instruction_text: instructionText,
      voice_answer_enabled: voiceAnswerEnabled,
      is_required: true,
      sort_order: (lessonDetailQuery.data?.activities?.length ?? 0) + 1,
      difficulty_stage: 1,
      config_json: configJson,
    }),
    onSuccess: async () => {
      setActivityTitle('')
      setInstructionText('')
      setConfigJson('{"choices": ["A", "B"], "correct": "A"}')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lessons', token] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-detail', token, selectedLessonId] }),
      ])
    },
  })

  function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !subjectId) return
    createLessonMutation.mutate()
  }

  function handleActivitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activityTitle.trim() || !selectedLessonId) return
    createActivityMutation.mutate()
  }

  return (
    <RequireAuth>
      <div className="page-stack">
        <section className="roadmap-panel">
          <h2>Bài học và hoạt động bên trong bài học</h2>
          <p>Mỗi bài học gắn với môn học, mức độ khuyết tật chính và chứa nhiều activity như chọn đáp án, kéo thả, video hoặc voice.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tạo bài học</h3>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
              <label>
                Tiêu đề bài học
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhận biết hình tròn" />
              </label>
              <label>
                Môn học
                <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Chọn môn học</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Mức độ chính
                <select value={primaryLevel} onChange={(event) => setPrimaryLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Mô tả ngăn
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Bài học có hỗ trợ voice" />
              </label>
              <label>
                Số phút dự kiến
                <input value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} inputMode="numeric" />
              </label>
              <button className="action-button" type="submit" disabled={createLessonMutation.isPending}>
                {createLessonMutation.isPending ? 'Đang tạo...' : 'Tạo bài học'}
              </button>
              {createLessonMutation.error ? <p className="error-text">{(createLessonMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chọn bài học đang chỉnh</h3>
            <div className="tag-wrap">
              {lessonsQuery.data?.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={selectedLessonId === lesson.id ? 'subject-pill pill-button pill-button-active' : 'subject-pill pill-button'}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  {lesson.title}
                </button>
              ))}
            </div>
            {!lessonsQuery.data?.length && !lessonsQuery.isLoading ? <p>Chưa có bài học nào, hãy tạo bài học đầu tiên.</p> : null}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <button
              type="button"
              onClick={() => setIsActivityFormOpen(!isActivityFormOpen)}
              style={{
                width: '100%',
                padding: '1rem',
                marginBottom: '1rem',
                border: 'none',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #b794f6 0%, #a78bfa 100%)',
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(167, 139, 250, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(167, 139, 250, 0.3)'
              }}
            >
              <span>Thêm hoạt động vào bài học</span>
              <span style={{ fontSize: '1.3rem' }}>{isActivityFormOpen ? '−' : '+'}</span>
            </button>
            {isActivityFormOpen && (
            <form className="form-stack" onSubmit={handleActivitySubmit}>
              <label>
                Ten hoat dong
                <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Chon dap an bang giong noi" />
              </label>
              <label>
                Loai hoat dong
                <select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
                  {ACTIVITY_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Huong dan
                <input value={instructionText} onChange={(event) => setInstructionText(event.target.value)} placeholder="Hay doc dap an dung" />
              </label>
              <label>
                Config JSON
                <textarea value={configJson} onChange={(event) => setConfigJson(event.target.value)} rows={5} />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={voiceAnswerEnabled} onChange={(event) => setVoiceAnswerEnabled(event.target.checked)} />
                Bat voice answer cho hoat dong nay
              </label>
              <button className="action-button" type="submit" disabled={!selectedLessonId || createActivityMutation.isPending}>
                {createActivityMutation.isPending ? 'Dang them...' : 'Them hoat dong'}
              </button>
              {createActivityMutation.error ? <p className="error-text">{(createActivityMutation.error as Error).message}</p> : null}
            </form>
            )}
          </article>

          <article className="roadmap-panel">
            <h3>Chi tiet bai hoc</h3>
            {selectedLesson ? (
              <div className="detail-stack">
                <div className="student-row">
                  <strong>{selectedLesson.title}</strong>
                  <span>{selectedLesson.subject?.name ?? 'Chua co mon'} / {selectedLesson.primary_level}</span>
                </div>
                <p>{lessonDetailQuery.data?.description ?? selectedLesson.description ?? 'Chua co mo ta.'}</p>
                <div className="student-list compact-list">
                  {lessonDetailQuery.data?.activities?.map((activity) => (
                    <div key={activity.id} className="student-row">
                      <strong>{activity.sort_order}. {activity.title}</strong>
                      <span>{activity.activity_type} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
                    </div>
                  ))}
                  {!lessonDetailQuery.data?.activities?.length && !lessonDetailQuery.isLoading ? <p>Bài học này chưa có hoạt động nào.</p> : null}
                </div>
              </div>
            ) : (
              <p>Hay chon mot bai hoc de xem chi tiet.</p>
            )}
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
