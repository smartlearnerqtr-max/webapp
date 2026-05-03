import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createLesson, createLessonActivity, fetchSubjects, type SubjectItem } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { RequireAuth } from '../components/RequireAuth'
import styles from './LessonCreationWizard.module.css'
import { SUBJECT_TEMPLATES, type LessonLevel, type ActivityType, type InteractionType, type StepItem } from '../data/lessonTemplates'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface ActivityDraft {
  title: string
  activity_type: ActivityType
  interaction_type?: InteractionType
  objective: string
  steps: StepItem[]
  is_mandatory?: boolean
}

interface LessonDraft {
  subject_id?: number
  subject_name?: string
  difficulty_level?: LessonLevel
  title: string
  theme: string
  description?: string
  activities: ActivityDraft[]
}

const DIFFICULTY_LEVELS: Array<{ value: LessonLevel; label: string; icon: string; color: string }> = [
  { value: 'nang', label: 'Nặng', icon: '🔴', color: '#e74c3c' },
  { value: 'trung_binh', label: 'Trung bình', icon: '🟡', color: '#f1c40f' },
  { value: 'nhe', label: 'Nhẹ', icon: '🟢', color: '#2ecc71' },
]

const INTERACTION_TYPES: Array<{ value: InteractionType; label: string }> = [
  { value: 'touch', label: 'Chạm (Tap)' },
  { value: 'drag', label: 'Kéo thả (Drag/Drop)' },
  { value: 'voice', label: 'Giọng nói (Voice)' },
  { value: 'scroll', label: 'Vuốt (Scroll)' },
  { value: 'selection', label: 'Chọn lựa (Selection)' },
  { value: 'drawing', label: 'Vẽ (Drawing)' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LessonCreationWizard() {
  const { accessToken } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isAutoFilled, setIsAutoFilled] = useState(false)

  // State
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>({
    title: '',
    theme: '',
    description: '',
    difficulty_level: undefined,
    subject_id: undefined,
    activities: [],
  })

  // Queries
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => fetchSubjects(),
  })

  const subjects = subjectsQuery.data || []

  // Mutations
  const createLessonMutation = useMutation({
    mutationFn: async (lessonData: any) => {
      if (!accessToken) throw new Error('No access token')
      return await createLesson(accessToken, lessonData)
    },
  })

  const createActivityMutation = useMutation({
    mutationFn: async ({
      lessonId,
      activityData,
    }: {
      lessonId: number
      activityData: any
    }) => {
      if (!accessToken) throw new Error('No access token')
      return await createLessonActivity(accessToken, lessonId, activityData)
    },
  })

  // Handlers
  const handleLevelSelect = (level: LessonLevel) => {
    setLessonDraft((prev) => ({ ...prev, difficulty_level: level }))
    setIsAutoFilled(false)
  }

  const handleSubjectSelect = (subjectId: number, subjectName: string) => {
    setLessonDraft((prev) => ({ ...prev, subject_id: subjectId, subject_name: subjectName }))
    setIsAutoFilled(false)
  }

  // Auto-fill logic when Level & Subject are selected
  useEffect(() => {
    if (lessonDraft.difficulty_level && lessonDraft.subject_id && !isAutoFilled) {
      const templates = SUBJECT_TEMPLATES[lessonDraft.difficulty_level]
      const template = templates.find(t => t.subject_id === lessonDraft.subject_id || t.subject_name === lessonDraft.subject_name)
      
      if (template) {
        setLessonDraft(prev => ({
          ...prev,
          title: template.title,
          theme: template.theme,
          description: template.description,
          activities: [
            { ...template.h1, is_mandatory: true },
            { ...template.h2, is_mandatory: false }
          ]
        }))
        setIsAutoFilled(true)
      }
    }
  }, [lessonDraft.difficulty_level, lessonDraft.subject_id, isAutoFilled])

  const handleLessonInfoChange = (
    field: 'title' | 'theme' | 'description',
    value: string,
  ) => {
    setLessonDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleActivityChange = (
    activityIndex: number,
    field: string,
    value: any,
  ) => {
    setLessonDraft((prev) => {
      const newActivities = [...prev.activities]
      newActivities[activityIndex] = {
        ...newActivities[activityIndex],
        [field]: value,
      }
      return { ...prev, activities: newActivities }
    })
  }

  const handleStepChange = (
    activityIndex: number,
    stepIndex: number,
    field: string,
    value: any,
  ) => {
    setLessonDraft((prev) => {
      const newActivities = [...prev.activities]
      const newSteps = [...newActivities[activityIndex].steps]
      newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value }
      newActivities[activityIndex] = {
        ...newActivities[activityIndex],
        steps: newSteps,
      }
      return { ...prev, activities: newActivities }
    })
  }

  const handleAddStep = (activityIndex: number) => {
    setLessonDraft((prev) => {
      const newActivities = [...prev.activities]
      const newSteps = [...newActivities[activityIndex].steps]
      newSteps.push({
        step_number: newSteps.length + 1,
        title: `Bước ${newSteps.length + 1}`,
        content_type: '',
        description: '',
      })
      newActivities[activityIndex] = {
        ...newActivities[activityIndex],
        steps: newSteps,
      }
      return { ...prev, activities: newActivities }
    })
  }

  const handleRemoveStep = (activityIndex: number, stepIndex: number) => {
    setLessonDraft((prev) => {
      const newActivities = [...prev.activities]
      const newSteps = newActivities[activityIndex].steps.filter(
        (_, idx) => idx !== stepIndex,
      )
      // Re-number steps
      const renumberedSteps = newSteps.map((s, i) => ({ ...s, step_number: i + 1 }))
      newActivities[activityIndex] = {
        ...newActivities[activityIndex],
        steps: renumberedSteps,
      }
      return { ...prev, activities: newActivities }
    })
  }

  const canProceedStep1 = () => {
    return (
      lessonDraft.difficulty_level &&
      lessonDraft.subject_id &&
      lessonDraft.title.trim().length >= 5 &&
      lessonDraft.theme.trim().length >= 3
    )
  }

  const canProceedStep2 = () => {
    const exercise = lessonDraft.activities[0]
    if (!exercise) return false
    return (
      exercise.title.trim().length > 0 &&
      exercise.interaction_type &&
      exercise.objective.trim().length > 0 &&
      exercise.steps.length >= 2
    )
  }

  const canProceedStep3 = () => {
    const activity = lessonDraft.activities[1]
    if (!activity) return false
    return (
      activity.title.trim().length > 0 &&
      activity.objective.trim().length > 0 &&
      activity.steps.length >= 2
    )
  }

  const handleSaveLesson = async () => {
    try {
      // Create lesson
      const lessonResult = await createLessonMutation.mutateAsync({
        title: lessonDraft.title,
        subject_id: lessonDraft.subject_id,
        primary_level: lessonDraft.difficulty_level,
        description: lessonDraft.description,
        is_published: false,
      })

      const lessonId = lessonResult.id

      // Create activities
      for (const activity of lessonDraft.activities) {
        await createActivityMutation.mutateAsync({
          lessonId,
          activityData: {
            title: activity.title,
            activity_type: activity.activity_type,
            instruction_text: activity.objective,
            is_required: activity.activity_type === 'exercise',
            sort_order: activity.activity_type === 'exercise' ? 1 : 2,
            config_json: JSON.stringify({
              interaction_type: activity.interaction_type,
              steps: activity.steps,
            }),
          },
        })
      }

      alert('✅ Bài học đã được tạo thành công!')
      window.location.href = '/bai-hoc'
    } catch (error) {
      console.error('Error creating lesson:', error)
      alert('❌ Lỗi tạo bài học: ' + (error as any).message)
    }
  }

  const handleNextStep = () => {
    if (currentStep === 1 && !canProceedStep1()) return
    if (currentStep === 2 && !canProceedStep2()) return
    if (currentStep === 3 && !canProceedStep3()) return
    setCurrentStep(currentStep + 1)
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <RequireAuth>
      <div className={styles.wizardContainer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1>📚 Tạo Bài Học Mới</h1>
            <button className={styles.btnClose} onClick={() => window.location.href = '/bai-hoc'}>✕</button>
          </div>
          
          <div className={styles.stepIndicator}>
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={styles.stepWrapper}>
                <div
                  className={`${styles.step} ${currentStep === step ? styles.active : ''} ${currentStep > step ? styles.completed : ''}`}
                >
                  <span>{currentStep > step ? '✓' : step}</span>
                  <p>{step === 1 ? 'Thông tin' : step === 2 ? 'Bài tập (H1)' : step === 3 ? 'Hoạt động (H2)' : 'Xem lại'}</p>
                </div>
                {step < 4 && <div className={`${styles.line} ${currentStep > step ? styles.lineCompleted : ''}`}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className={styles.content}>
          <div className={styles.scrollArea}>
            {currentStep === 1 && (
              <StepOne
                lessonDraft={lessonDraft}
                subjects={subjects}
                onLevelSelect={handleLevelSelect}
                onSubjectSelect={handleSubjectSelect}
                onInfoChange={handleLessonInfoChange}
              />
            )}

            {currentStep === 2 && (
              <StepTwo
                activity={lessonDraft.activities[0]}
                onActivityChange={(field, value) => handleActivityChange(0, field, value)}
                onStepChange={(stepIndex, field, value) => handleStepChange(0, stepIndex, field, value)}
                onAddStep={() => handleAddStep(0)}
                onRemoveStep={(stepIndex) => handleRemoveStep(0, stepIndex)}
              />
            )}

            {currentStep === 3 && (
              <StepThree
                activity={lessonDraft.activities[1]}
                onActivityChange={(field, value) => handleActivityChange(1, field, value)}
                onStepChange={(stepIndex, field, value) => handleStepChange(1, stepIndex, field, value)}
                onAddStep={() => handleAddStep(1)}
                onRemoveStep={(stepIndex) => handleRemoveStep(1, stepIndex)}
              />
            )}

            {currentStep === 4 && (
              <StepReview lessonDraft={lessonDraft} />
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className={styles.footer}>
          <button
            className={styles.btnSecondary}
            onClick={handlePrevStep}
            disabled={currentStep === 1}
          >
            ← Quay Lại
          </button>

          <div className={styles.spacer}></div>

          {currentStep < 4 ? (
            <button
              className={styles.btnPrimary}
              onClick={handleNextStep}
              disabled={
                (currentStep === 1 && !canProceedStep1()) ||
                (currentStep === 2 && !canProceedStep2()) ||
                (currentStep === 3 && !canProceedStep3())
              }
            >
              Tiếp Theo →
            </button>
          ) : (
            <button
              className={styles.btnSuccess}
              onClick={handleSaveLesson}
              disabled={createLessonMutation.isPending || createActivityMutation.isPending}
            >
              {createLessonMutation.isPending ? 'Đang lưu...' : '✓ Hoàn Thành & Lưu Bài Học'}
            </button>
          )}
        </div>
      </div>
    </RequireAuth>
  )
}

// ============================================================================
// STEP ONE: BASIC INFO
// ============================================================================

function StepOne({ lessonDraft, subjects, onLevelSelect, onSubjectSelect, onInfoChange }: any) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <h2>📋 Thông Tin Tổng Quan</h2>
        <p>Bắt đầu bằng việc chọn mức độ và môn học. Hệ thống sẽ tự gợi ý nội dung từ file bổ sung.</p>
      </div>

      <div className={styles.formGrid}>
        {/* Difficulty Level */}
        <div className={styles.formSection}>
          <label className={styles.label}>Mức độ nhận thức <span className={styles.required}>*</span></label>
          <div className={styles.levelSelector}>
            {DIFFICULTY_LEVELS.map((level) => (
              <button
                key={level.value}
                className={`${styles.levelCard} ${lessonDraft.difficulty_level === level.value ? styles.selected : ''}`}
                onClick={() => onLevelSelect(level.value)}
                style={{ '--accent-color': level.color } as any}
              >
                <span className={styles.levelIcon}>{level.icon}</span>
                <span className={styles.levelLabel}>{level.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Subject selection */}
        <div className={styles.formSection}>
          <label className={styles.label}>Môn học <span className={styles.required}>*</span></label>
          <div className={styles.subjectGrid}>
            {subjects.map((sub: SubjectItem) => (
              <button
                key={sub.id}
                className={`${styles.subjectCard} ${lessonDraft.subject_id === sub.id ? styles.selected : ''}`}
                onClick={() => onSubjectSelect(sub.id, sub.name)}
              >
                <span className={styles.subjectName}>{sub.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className={styles.divider} />

      <div className={styles.formSection}>
        <label className={styles.label}>Tên bài học <span className={styles.required}>*</span></label>
        <input
          type="text"
          className={styles.input}
          value={lessonDraft.title}
          onChange={(e) => onInfoChange('title', e.target.value)}
          placeholder="Ví dụ: Nhận biết nhân vật trong truyện Tấm Cám"
        />
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Chủ đề chính <span className={styles.required}>*</span></label>
        <input
          type="text"
          className={styles.input}
          value={lessonDraft.theme}
          onChange={(e) => onInfoChange('theme', e.target.value)}
          placeholder="Ví dụ: Truyện cổ tích Việt Nam"
        />
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Mô tả ngắn</label>
        <textarea
          className={styles.textarea}
          value={lessonDraft.description}
          onChange={(e) => onInfoChange('description', e.target.value)}
          placeholder="Giới thiệu sơ lược về mục đích của bài học..."
          rows={3}
        />
      </div>
    </div>
  )
}

// ============================================================================
// STEP TWO: ACTIVITY H1 (EXERCISE)
// ============================================================================

function StepTwo({ activity, onActivityChange, onStepChange, onAddStep, onRemoveStep }: any) {
  if (!activity) return null

  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <span className={styles.badge}>H1 - Bắt buộc</span>
        <h2>🎯 Bài Tập Củng Cố Kiến Thức</h2>
        <p>Phần này tập trung vào tương tác trực tiếp để học sinh nhận diện kiến thức cơ bản.</p>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Tên hoạt động bài tập</label>
        <input
          type="text"
          className={styles.input}
          value={activity.title}
          onChange={(e) => onActivityChange('title', e.target.value)}
        />
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formSection}>
          <label className={styles.label}>Loại tương tác chính</label>
          <select 
            className={styles.select}
            value={activity.interaction_type}
            onChange={(e) => onActivityChange('interaction_type', e.target.value)}
          >
            {INTERACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className={styles.formSection}>
          <label className={styles.label}>Mục tiêu / Năng lực</label>
          <input
            type="text"
            className={styles.input}
            value={activity.objective}
            onChange={(e) => onActivityChange('objective', e.target.value)}
            placeholder="Ví dụ: Năng lực nhận diện hình ảnh"
          />
        </div>
      </div>

      <div className={styles.stepsContainer}>
        <div className={styles.stepsHeader}>
          <h3>📋 Các bước thực hiện</h3>
          <button className={styles.btnAddSmall} onClick={onAddStep}>+ Thêm bước</button>
        </div>
        
        {activity.steps.map((step: StepItem, idx: number) => (
          <div key={idx} className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCircle}>{step.step_number}</span>
              <input 
                type="text" 
                className={styles.inputInvisible} 
                value={step.title} 
                onChange={(e) => onStepChange(idx, 'title', e.target.value)}
              />
              <button className={styles.btnRemove} onClick={() => onRemoveStep(idx)}>✕</button>
            </div>
            <div className={styles.stepCardBody}>
              <div className={styles.fieldGroup}>
                <label>Loại nội dung</label>
                <input 
                  type="text" 
                  value={step.content_type} 
                  onChange={(e) => onStepChange(idx, 'content_type', e.target.value)}
                  placeholder="display, audio, interaction..."
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Mô tả chi tiết</label>
                <textarea 
                  value={step.description} 
                  onChange={(e) => onStepChange(idx, 'description', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// STEP THREE: ACTIVITY H2 (ACTIVITY)
// ============================================================================

function StepThree({ activity, onActivityChange, onStepChange, onAddStep, onRemoveStep }: any) {
  if (!activity) return null

  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <span className={styles.badgeSecondary}>H2 - Mở rộng</span>
        <h2>✨ Hoạt Động Rèn Luyện Kỹ Năng</h2>
        <p>Phần này giúp học sinh vận dụng kiến thức qua các trò chơi, video hoặc tình huống mô phỏng.</p>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Tên hoạt động rèn luyện</label>
        <input
          type="text"
          className={styles.input}
          value={activity.title}
          onChange={(e) => onActivityChange('title', e.target.value)}
        />
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Mục tiêu / Phẩm chất</label>
        <input
          type="text"
          className={styles.input}
          value={activity.objective}
          onChange={(e) => onActivityChange('objective', e.target.value)}
          placeholder="Ví dụ: Phẩm chất chăm chỉ, Kỹ năng giao tiếp"
        />
      </div>

      <div className={styles.stepsContainer}>
        <div className={styles.stepsHeader}>
          <h3>📋 Các bước thực hiện</h3>
          <button className={styles.btnAddSmall} onClick={onAddStep}>+ Thêm bước</button>
        </div>
        
        {activity.steps.map((step: StepItem, idx: number) => (
          <div key={idx} className={styles.stepCard}>
            <div className={styles.stepCardHeader}>
              <span className={styles.stepCircleSecondary}>{step.step_number}</span>
              <input 
                type="text" 
                className={styles.inputInvisible} 
                value={step.title} 
                onChange={(e) => onStepChange(idx, 'title', e.target.value)}
              />
              <button className={styles.btnRemove} onClick={() => onRemoveStep(idx)}>✕</button>
            </div>
            <div className={styles.stepCardBody}>
              <div className={styles.fieldGroup}>
                <label>Loại nội dung</label>
                <input 
                  type="text" 
                  value={step.content_type} 
                  onChange={(e) => onStepChange(idx, 'content_type', e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label>Mô tả chi tiết</label>
                <textarea 
                  value={step.description} 
                  onChange={(e) => onStepChange(idx, 'description', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// STEP FOUR: REVIEW
// ============================================================================

function StepReview({ lessonDraft }: { lessonDraft: LessonDraft }) {
  const h1 = lessonDraft.activities[0]
  const h2 = lessonDraft.activities[1]

  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <h2>👀 Kiểm Tra Lại Bài Học</h2>
        <p>Vui lòng xem lại toàn bộ thông tin trước khi lưu chính thức.</p>
      </div>

      <div className={styles.reviewCard}>
        <div className={styles.reviewHeader}>
          <div className={styles.reviewMainInfo}>
            <h3>{lessonDraft.title}</h3>
            <div className={styles.reviewBadges}>
              <span className={styles.reviewLevelBadge}>
                {DIFFICULTY_LEVELS.find(l => l.value === lessonDraft.difficulty_level)?.icon} {DIFFICULTY_LEVELS.find(l => l.value === lessonDraft.difficulty_level)?.label}
              </span>
              <span className={styles.reviewSubjectBadge}>{lessonDraft.subject_name}</span>
            </div>
          </div>
        </div>
        
        <div className={styles.reviewBody}>
          <div className={styles.reviewSection}>
            <h4>Chủ đề:</h4>
            <p>{lessonDraft.theme}</p>
          </div>
          
          <div className={styles.reviewActivitiesGrid}>
            <div className={styles.reviewActivityBox}>
              <h5>Hoạt động 1 (H1): {h1?.title}</h5>
              <p><strong>Mục tiêu:</strong> {h1?.objective}</p>
              <p><strong>Tương tác:</strong> {INTERACTION_TYPES.find(i => i.value === h1?.interaction_type)?.label}</p>
              <div className={styles.reviewStepsCount}>{h1?.steps.length} bước thực hiện</div>
            </div>
            
            <div className={styles.reviewActivityBox}>
              <h5>Hoạt động 2 (H2): {h2?.title}</h5>
              <p><strong>Mục tiêu:</strong> {h2?.objective}</p>
              <div className={styles.reviewStepsCount}>{h2?.steps.length} bước thực hiện</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.infoAlert}>
        <span className={styles.infoIcon}>ℹ️</span>
        <p>Bài học sẽ được lưu ở trạng thái <strong>Bản nháp</strong>. Bạn có thể chỉnh sửa thêm sau này.</p>
      </div>
    </div>
  )
}
