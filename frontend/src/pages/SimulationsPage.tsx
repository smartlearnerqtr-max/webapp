import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { RequireAuth } from '../components/RequireAuth'
import {
  createTeacherSimulationQuizQuestion,
  deleteTeacherSimulationQuizQuestion,
  fetchTeacherSimulationQuizQuestions,
  updateTeacherSimulationQuizQuestion,
  type SimulationQuizQuestionItem,
} from '../services/api'
import { useAuthStore } from '../store/authStore'

const LEARNING_CELL_SIMULATION_URL = '/simulations/learning-cell/index.html'

const KHTN_SIMULATION_MODELS = [
  { id: 'plant-cell', label: 'Tế bào thực vật', description: 'Cấu trúc tế bào nhân thực, thành tế bào, lục lạp, không bào.' },
  { id: 'animal-cell', label: 'Tế bào động vật', description: 'Cấu trúc tế bào nhân thực, nhân, ti thể và màng tế bào.' },
  { id: 'white-blood-cell', label: 'Bạch cầu', description: 'Mô phỏng tế bào miễn dịch và vai trò bảo vệ cơ thể.' },
  { id: 'neuron', label: 'Nơ-ron thần kinh', description: 'Quan sát thân tế bào, sợi trục và chức năng truyền tín hiệu.' },
  { id: 'dna', label: 'DNA xoắn kép', description: 'Mô hình phân tử di truyền dạng xoắn kép.' },
  { id: 'human-heart', label: 'Tim người', description: 'Quan sát cơ quan tuần hoàn và cấu trúc buồng tim.' },
  { id: 'human-lungs', label: 'Phổi người', description: 'Mô phỏng cơ quan hô hấp và trao đổi khí.' },
  { id: 'human-liver', label: 'Gan người', description: 'Mô phỏng cơ quan hóa chất quan trọng của cơ thể.' },
  { id: 'human-kidney', label: 'Thận người', description: 'Quan sát cơ quan bài tiết và lọc máu.' },
  { id: 'human-stomach', label: 'Dạ dày', description: 'Mô phỏng cơ quan tiêu hóa thức ăn.' },
] as const

type SimulationModelId = typeof KHTN_SIMULATION_MODELS[number]['id']
type CorrectOption = 'A' | 'B' | 'C' | 'D'

type QuizFormState = {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: CorrectOption
  explanation: string
  sortOrder: string
}

function createEmptyQuizForm(modelLabel: string): QuizFormState {
  return {
    questionText: `Quan sát mô phỏng 3D. Đây là mô hình nào?`,
    optionA: modelLabel,
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    explanation: '',
    sortOrder: '0',
  }
}

function buildSimulationUrl(modelId: string) {
  const params = new URLSearchParams({ model: modelId })
  return `${LEARNING_CELL_SIMULATION_URL}?${params.toString()}`
}

function buildSimulationQuizUrl(modelId: string, question?: SimulationQuizQuestionItem | null) {
  const params = new URLSearchParams({ mode: 'quiz', model: modelId })
  if (question) {
    params.set('q', question.question_text)
    params.set('a', question.option_a)
    params.set('b', question.option_b)
    params.set('c', question.option_c)
    params.set('d', question.option_d)
    params.set('correct', question.correct_option)
    if (question.explanation) params.set('explain', question.explanation)
  }
  return `${LEARNING_CELL_SIMULATION_URL}?${params.toString()}`
}

function buildFormFromQuestion(question: SimulationQuizQuestionItem): QuizFormState {
  return {
    questionText: question.question_text,
    optionA: question.option_a,
    optionB: question.option_b,
    optionC: question.option_c,
    optionD: question.option_d,
    correctOption: question.correct_option,
    explanation: question.explanation ?? '',
    sortOrder: String(question.sort_order ?? 0),
  }
}

function validateQuizForm(form: QuizFormState) {
  if (!form.questionText.trim()) return 'Cần nhập câu hỏi.'
  if (!form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) return 'Cần nhập đủ đáp án A/B/C/D.'
  if (!['A', 'B', 'C', 'D'].includes(form.correctOption)) return 'Cần chọn đáp án đúng.'
  return null
}

export function SimulationsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const [selectedModelId, setSelectedModelId] = useState<SimulationModelId>('plant-cell')
  const selectedModel = KHTN_SIMULATION_MODELS.find((model) => model.id === selectedModelId) ?? KHTN_SIMULATION_MODELS[0]
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [quizForm, setQuizForm] = useState<QuizFormState>(() => createEmptyQuizForm(selectedModel.label))
  const [formError, setFormError] = useState<string | null>(null)

  const questionsQuery = useQuery({
    queryKey: ['teacher-simulation-quiz-questions', token],
    queryFn: () => fetchTeacherSimulationQuizQuestions(token!),
    enabled: Boolean(token),
  })

  const questions = (questionsQuery.data ?? []).filter((question) => question.simulation_key === selectedModelId)
  const primaryQuestion = questions[0] ?? null
  const questionCountByModel = useMemo(() => {
    const counts = new Map<string, number>()
    for (const question of questionsQuery.data ?? []) {
      counts.set(question.simulation_key, (counts.get(question.simulation_key) ?? 0) + 1)
    }
    return counts
  }, [questionsQuery.data])

  const saveQuestionMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateQuizForm(quizForm)
      if (validationError) {
        setFormError(validationError)
        throw new Error(validationError)
      }

      const payload = {
        simulation_key: selectedModel.id,
        simulation_title: selectedModel.label,
        question_text: quizForm.questionText.trim(),
        option_a: quizForm.optionA.trim(),
        option_b: quizForm.optionB.trim(),
        option_c: quizForm.optionC.trim(),
        option_d: quizForm.optionD.trim(),
        correct_option: quizForm.correctOption,
        explanation: quizForm.explanation.trim() || undefined,
        sort_order: Number(quizForm.sortOrder) || 0,
      }

      if (editingQuestionId) {
        return updateTeacherSimulationQuizQuestion(token!, editingQuestionId, payload)
      }
      return createTeacherSimulationQuizQuestion(token!, payload)
    },
    onSuccess: async () => {
      setEditingQuestionId(null)
      setQuizForm(createEmptyQuizForm(selectedModel.label))
      setFormError(null)
      await queryClient.invalidateQueries({ queryKey: ['teacher-simulation-quiz-questions', token] })
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => deleteTeacherSimulationQuizQuestion(token!, questionId),
    onSuccess: async () => {
      if (editingQuestionId) {
        setEditingQuestionId(null)
        setQuizForm(createEmptyQuizForm(selectedModel.label))
      }
      await queryClient.invalidateQueries({ queryKey: ['teacher-simulation-quiz-questions', token] })
    },
  })

  function selectModel(modelId: SimulationModelId) {
    const nextModel = KHTN_SIMULATION_MODELS.find((model) => model.id === modelId) ?? KHTN_SIMULATION_MODELS[0]
    setSelectedModelId(nextModel.id)
    setEditingQuestionId(null)
    setQuizForm(createEmptyQuizForm(nextModel.label))
    setFormError(null)
  }

  function startEdit(question: SimulationQuizQuestionItem) {
    setEditingQuestionId(question.id)
    setQuizForm(buildFormFromQuestion(question))
    setFormError(null)
  }

  function resetForm() {
    setEditingQuestionId(null)
    setQuizForm(createEmptyQuizForm(selectedModel.label))
    setFormError(null)
  }

  function updateForm<K extends keyof QuizFormState>(field: K, value: QuizFormState[K]) {
    setFormError(null)
    setQuizForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        <section className="roadmap-panel teacher-clean-hero">
          <div>
            <p className="eyebrow">KHTN cố định</p>
            <h2>Mô phỏng trực quan 3D</h2>
            <p className="helper-text">Mục riêng cho mô phỏng KHTN. Giáo viên mở mô hình sang tab mới và nhập câu hỏi trắc nghiệm A/B/C/D cho từng mô hình.</p>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>{KHTN_SIMULATION_MODELS.length} mô hình</span>
            <span>{questions.length} câu của mô hình đang chọn</span>
            <span>KHTN</span>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Danh sách mô phỏng</p>
                <h3>Mô hình KHTN</h3>
              </div>
              <span className="subject-pill muted-pill">Cố định môn KHTN</span>
            </div>
            <div className="student-list compact-list">
              {KHTN_SIMULATION_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className="student-row student-row-button"
                  style={model.id === selectedModelId ? { borderColor: 'rgba(22, 124, 104, 0.36)', background: 'rgba(232, 250, 244, 0.9)' } : undefined}
                  onClick={() => selectModel(model.id)}
                >
                  <strong>{model.label}</strong>
                  <span>{questionCountByModel.get(model.id) ?? 0} câu hỏi</span>
                  <p>{model.description}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Mô phỏng đang chọn</p>
                <h3>{selectedModel.label}</h3>
              </div>
              <span className="subject-pill muted-pill">KHTN</span>
            </div>
            <p className="helper-text">{selectedModel.description}</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a className="action-button" href={buildSimulationUrl(selectedModel.id)} target="_blank" rel="noreferrer">
                Mở mô phỏng
              </a>
              <a className="ghost-button" href={buildSimulationQuizUrl(selectedModel.id, primaryQuestion)} target="_blank" rel="noreferrer">
                Mở chế độ trắc nghiệm
              </a>
            </div>
            {!primaryQuestion ? <p className="helper-text" style={{ marginTop: '1rem' }}>Chưa có câu hỏi nên chế độ trắc nghiệm chỉ ẩn tên mô hình.</p> : null}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Câu hỏi đã tạo</p>
                <h3>{selectedModel.label}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={resetForm}>
                Tạo câu mới
              </button>
            </div>
            <div className="student-list compact-list">
              {questions.map((question) => (
                <div key={question.id} className="student-row">
                  <strong>{question.question_text}</strong>
                  <span>Đáp án đúng: {question.correct_option} • Thứ tự {question.sort_order}</span>
                  <p>A. {question.option_a}</p>
                  <p>B. {question.option_b}</p>
                  <p>C. {question.option_c}</p>
                  <p>D. {question.option_d}</p>
                  {question.explanation ? <p>{question.explanation}</p> : null}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <button type="button" className="ghost-button" onClick={() => startEdit(question)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={deleteQuestionMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Ẩn câu hỏi mô phỏng này?')) {
                          deleteQuestionMutation.mutate(question.id)
                        }
                      }}
                    >
                      Ẩn
                    </button>
                  </div>
                </div>
              ))}
              {!questions.length && !questionsQuery.isLoading ? <p>Chưa có câu hỏi cho mô phỏng này.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Form trắc nghiệm</p>
                <h3>{editingQuestionId ? 'Cập nhật câu hỏi ABCD' : 'Tạo câu hỏi ABCD'}</h3>
              </div>
              {editingQuestionId ? <span className="subject-pill muted-pill">Đang sửa #{editingQuestionId}</span> : null}
            </div>
            <div className="form-stack">
              <label>
                Câu hỏi
                <textarea value={quizForm.questionText} rows={4} onChange={(event) => updateForm('questionText', event.target.value)} />
              </label>
              <label>
                Đáp án A
                <input value={quizForm.optionA} onChange={(event) => updateForm('optionA', event.target.value)} />
              </label>
              <label>
                Đáp án B
                <input value={quizForm.optionB} onChange={(event) => updateForm('optionB', event.target.value)} />
              </label>
              <label>
                Đáp án C
                <input value={quizForm.optionC} onChange={(event) => updateForm('optionC', event.target.value)} />
              </label>
              <label>
                Đáp án D
                <input value={quizForm.optionD} onChange={(event) => updateForm('optionD', event.target.value)} />
              </label>
              <label>
                Đáp án đúng
                <select value={quizForm.correctOption} onChange={(event) => updateForm('correctOption', event.target.value as CorrectOption)}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>
              <label>
                Giải thích sau khi làm
                <textarea value={quizForm.explanation} rows={3} onChange={(event) => updateForm('explanation', event.target.value)} />
              </label>
              <label>
                Thứ tự
                <input value={quizForm.sortOrder} inputMode="numeric" onChange={(event) => updateForm('sortOrder', event.target.value)} />
              </label>
              {formError ? <p className="error-text">{formError}</p> : null}
              {saveQuestionMutation.error ? <p className="error-text">{(saveQuestionMutation.error as Error).message}</p> : null}
              {deleteQuestionMutation.error ? <p className="error-text">{(deleteQuestionMutation.error as Error).message}</p> : null}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="action-button" disabled={saveQuestionMutation.isPending} onClick={() => saveQuestionMutation.mutate()}>
                  {saveQuestionMutation.isPending ? 'Đang lưu...' : editingQuestionId ? 'Cập nhật câu hỏi' : 'Tạo câu hỏi'}
                </button>
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Làm mới form
                </button>
              </div>
            </div>
          </article>
        </section>
      </div>
    </RequireAuth>
  )
}
