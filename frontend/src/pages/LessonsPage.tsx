import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createLesson, createLessonActivity, fetchLesson, fetchLessons, fetchSubjects } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

const LEVEL_OPTIONS = [
  { value: 'nang', label: 'Nang' },
  { value: 'trung_binh', label: 'Trung binh' },
  { value: 'nhe', label: 'Nhe' },
]

const ACTIVITY_TYPES = [
  { value: 'multiple_choice', label: 'Chon dap an' },
  { value: 'matching', label: 'Noi cap' },
  { value: 'drag_drop', label: 'Keo tha' },
  { value: 'listen_choose', label: 'Nghe va chon' },
  { value: 'watch_answer', label: 'Xem video va tra loi' },
  { value: 'step_by_step', label: 'Tung buoc' },
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
          <p className="eyebrow">Task 12 + 13 + 14</p>
          <h2>Bai hoc va hoat dong ben trong bai hoc</h2>
          <p>Moi bai hoc gan voi mon hoc, muc do khuyet tat chinh va chua nhieu activity nhu chon dap an, keo tha, video hoac voice.</p>
        </section>

        <section className="auth-layout">
          <article className="roadmap-panel">
            <h3>Tao bai hoc</h3>
            <form className="form-stack" onSubmit={handleLessonSubmit}>
              <label>
                Tieu de bai hoc
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhan biet hinh tron" />
              </label>
              <label>
                Mon hoc
                <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Chon mon hoc</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Muc do chinh
                <select value={primaryLevel} onChange={(event) => setPrimaryLevel(event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Mo ta ngan
                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Bai hoc co ho tro voice" />
              </label>
              <label>
                So phut du kien
                <input value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} inputMode="numeric" />
              </label>
              <button className="action-button" type="submit" disabled={createLessonMutation.isPending}>
                {createLessonMutation.isPending ? 'Dang tao...' : 'Tao bai hoc'}
              </button>
              {createLessonMutation.error ? <p className="error-text">{(createLessonMutation.error as Error).message}</p> : null}
            </form>
          </article>

          <article className="roadmap-panel">
            <h3>Chon bai hoc dang chinh</h3>
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
            {!lessonsQuery.data?.length && !lessonsQuery.isLoading ? <p>Chua co bai hoc nao, hay tao bai hoc dau tien.</p> : null}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <h3>Them hoat dong vao bai hoc</h3>
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
                  {!lessonDetailQuery.data?.activities?.length && !lessonDetailQuery.isLoading ? <p>Bai hoc nay chua co hoat dong nao.</p> : null}
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
