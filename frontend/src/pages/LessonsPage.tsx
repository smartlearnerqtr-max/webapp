import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createLesson, createLessonActivity, fetchSubjects, uploadLessonMedia, type SubjectItem } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { RequireAuth } from '../components/RequireAuth'
import styles from './LessonCreationWizard.module.css'
import { SUBJECT_TEMPLATES, type LessonLevel, type ActivityType, type InteractionType, type StepItem } from '../data/lessonTemplates'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface EnhancedStepItem extends StepItem {
  media_file?: File | null
  media_url?: string
  media_kind?: 'image' | 'audio' | 'video' | 'animation' | '3d' | 'ai_camera'
  options?: string[] // For quiz/selection
  correct_option?: number
}

interface ActivityDraft {
  title: string
  activity_type: ActivityType
  interaction_type?: InteractionType | 'ai_camera' | '3d_interaction' | 'voice_ai'
  objective: string
  steps: EnhancedStepItem[]
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

const STEP_CONTENT_TYPES = [
  { value: 'display', label: '📺 Hiển thị (Ảnh/Video)' },
  { value: 'audio', label: '🔊 Âm thanh (Lời giảng/Câu hỏi)' },
  { value: 'interaction', label: '🖱️ Tương tác (Kéo thả/Chạm)' },
  { value: 'ai_camera', label: '🤖 AI Camera (Vận động)' },
  { value: '3d', label: '🧊 Vật thể 3D (Xoay/Chạm)' },
  { value: 'voice', label: '🎙️ Nhận diện giọng nói' },
  { value: 'feedback', label: '🎉 Phản hồi (Khen ngợi/Nhắc nhở)' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LessonsPage() {
  const { accessToken } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [lessonDraft, setLessonDraft] = useState<LessonDraft>({
    title: '',
    theme: '',
    description: '',
    difficulty_level: undefined,
    subject_id: undefined,
    activities: [],
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => fetchSubjects(),
  })

  // Merge API subjects with template subjects — deduplicate by name, enrich with icons
  const mergedSubjects = useMemo(() => {
    const apiSubjects: Array<{ id: number; name: string; icon?: string }> = (subjectsQuery.data || []).map((s: SubjectItem) => ({ id: s.id, name: s.name }))
    const level = lessonDraft.difficulty_level
    const templates = level ? SUBJECT_TEMPLATES[level] : []

    // Build a lookup from template by subject_name
    const templateByName = new Map(templates.map(t => [t.subject_name, t]))

    // Start with API subjects, enrich with icon
    const seen = new Set<string>()
    const result: Array<{ id: number; name: string; icon: string }> = []

    for (const s of apiSubjects) {
      const tpl = templateByName.get(s.name)
      result.push({ id: s.id, name: s.name, icon: tpl?.icon ?? '📘' })
      seen.add(s.name)
    }

    // Add template-only subjects that don't exist in API
    for (const t of templates) {
      if (!seen.has(t.subject_name)) {
        result.push({ id: t.subject_id, name: t.subject_name, icon: t.icon })
        seen.add(t.subject_name)
      }
    }

    return result
  }, [subjectsQuery.data, lessonDraft.difficulty_level])

  // Auto-fill logic
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
            { ...template.h1, is_mandatory: true, steps: template.h1.steps.map(s => ({ ...s, media_kind: s.content_type as any })) },
            { ...template.h2, is_mandatory: false, steps: template.h2.steps.map(s => ({ ...s, media_kind: s.content_type as any })) }
          ]
        }))
        setIsAutoFilled(true)
      }
    }
  }, [lessonDraft.difficulty_level, lessonDraft.subject_id, isAutoFilled])

  // Handlers
  const handleLevelSelect = (level: LessonLevel) => {
    setLessonDraft(prev => ({
      ...prev,
      difficulty_level: level,
      // Reset auto-fill when level changes so new template can be loaded
      subject_id: undefined,
      subject_name: undefined,
      title: '',
      theme: '',
      description: '',
      activities: [],
    }))
    setIsAutoFilled(false)
  }

  const handleSubjectSelect = (id: number, name: string) => {
    setLessonDraft(prev => ({
      ...prev,
      subject_id: id,
      subject_name: name,
      // Reset auto-fill so new template can be loaded
      title: '',
      theme: '',
      description: '',
      activities: [],
    }))
    setIsAutoFilled(false)
  }

  const handleInfoChange = (field: string, value: string) => {
    setLessonDraft(prev => ({ ...prev, [field]: value }))
  }

  const handleActivityChange = (idx: number, field: string, value: any) => {
    setLessonDraft(prev => {
      const acts = [...prev.activities]
      acts[idx] = { ...acts[idx], [field]: value }
      return { ...prev, activities: acts }
    })
  }

  const handleStepChange = (actIdx: number, stepIdx: number, field: string, value: any) => {
    setLessonDraft(prev => {
      const acts = [...prev.activities]
      const steps = [...acts[actIdx].steps]
      steps[stepIdx] = { ...steps[stepIdx], [field]: value }
      acts[actIdx] = { ...acts[actIdx], steps }
      return { ...prev, activities: acts }
    })
  }

  const handleFileUpload = async (actIdx: number, stepIdx: number, file: File) => {
    if (!accessToken) return
    setIsUploading(true)
    try {
      const result = await uploadLessonMedia(accessToken, file)
      handleStepChange(actIdx, stepIdx, 'media_url', result.url)
      handleStepChange(actIdx, stepIdx, 'media_kind', file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'audio')
    } catch (e) {
      alert('Lỗi upload file: ' + (e as any).message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!accessToken) return
    try {
      const lesson = await createLesson(accessToken, {
        title: lessonDraft.title,
        subject_id: lessonDraft.subject_id!,
        primary_level: lessonDraft.difficulty_level!,
        description: lessonDraft.description,
      })

      for (const act of lessonDraft.activities) {
        await createLessonActivity(accessToken, lesson.id, {
          title: act.title,
          activity_type: act.activity_type,
          instruction_text: act.objective,
          is_required: act.is_mandatory,
          config_json: JSON.stringify({
            interaction_type: act.interaction_type,
            steps: act.steps.map(s => ({
              step_number: s.step_number,
              title: s.title,
              type: s.content_type,
              description: s.description,
              media_url: s.media_url,
              media_kind: s.media_kind,
              options: s.options,
              correct_option: s.correct_option
            }))
          })
        })
      }
      alert('🎉 Lưu bài học thành công!')
      window.location.href = '/bai-hoc'
    } catch (e) {
      alert('Lỗi lưu bài học: ' + (e as any).message)
    }
  }

  return (
    <RequireAuth>
      <div className={styles.wizardContainer}>
        {/* Progress Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1>🛠️ Xây Dựng Bài Học Thông Minh</h1>
            <div className={styles.autoFillBadge}>
              {isAutoFilled ? '✨ Đã nạp mẫu từ Bosung.md' : '💡 Chọn môn để nạp mẫu'}
            </div>
          </div>
          <div className={styles.stepIndicator}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={styles.stepWrapper}>
                <div className={`${styles.step} ${currentStep === s ? styles.active : ''} ${currentStep > s ? styles.completed : ''}`}>
                  <span>{currentStep > s ? '✓' : s}</span>
                  <p>{s === 1 ? 'Thiết lập' : s === 2 ? 'Bước H1' : s === 3 ? 'Bước H2' : 'Xác nhận'}</p>
                </div>
                {s < 4 && <div className={`${styles.line} ${currentStep > s ? styles.lineCompleted : ''}`}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className={styles.content}>
          <div className={styles.scrollArea}>
            {currentStep === 1 && (
              <StepOne 
                draft={lessonDraft} 
                subjects={mergedSubjects} 
                onLevelSelect={handleLevelSelect} 
                onSubSelect={handleSubjectSelect}
                onInfoChange={handleInfoChange}
              />
            )}
            {(currentStep === 2 || currentStep === 3) && (
              <StepBuilder 
                activity={lessonDraft.activities[currentStep - 2]} 
                onActChange={(f: any, v: any) => handleActivityChange(currentStep - 2, f, v)}
                onStepChange={(si: any, f: any, v: any) => handleStepChange(currentStep - 2, si, f, v)}
                onUpload={(si: any, file: any) => handleFileUpload(currentStep - 2, si, file)}
                isH1={currentStep === 2}
              />
            )}
            {currentStep === 4 && <StepReview draft={lessonDraft} />}
          </div>
        </div>

        {/* Footer Nav */}
        <div className={styles.footer}>
          <button type="button" className={styles.btnSecondary} onClick={() => setCurrentStep(prev => prev - 1)} disabled={currentStep === 1}>← Quay lại</button>
          <div className={styles.spacer}></div>
          {currentStep < 4 ? (
            <button type="button" className={styles.btnPrimary} onClick={() => setCurrentStep(prev => prev + 1)} disabled={!lessonDraft.subject_id}>Tiếp theo →</button>
          ) : (
            <button type="button" className={styles.btnSuccess} onClick={handleSave} disabled={isUploading}>
              {isUploading ? '⌛ Đang tải file...' : '🚀 Hoàn thành & Lưu bài học'}
            </button>
          )}
        </div>
      </div>
    </RequireAuth>
  )
}

function StepOne({ draft, subjects, onLevelSelect, onSubSelect, onInfoChange }: any) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <h2>🎯 Thiết lập cơ bản</h2>
        <p>Chọn Mức độ và Môn học để hệ thống tự động cấu hình các bước theo Bosung.md.</p>
      </div>

      {/* Mức độ nhận thức - full width */}
      <div className={styles.formSection}>
        <label className={styles.label}>Mức độ nhận thức</label>
        <div className={styles.levelSelector}>
          {DIFFICULTY_LEVELS.map(l => (
            <button 
              key={l.value} 
              type="button"
              className={`${styles.levelCard} ${draft.difficulty_level === l.value ? styles.selected : ''}`} 
              onClick={() => onLevelSelect(l.value)} 
              style={{'--accent-color': l.color} as any}
            >
              <span className={styles.levelIcon}>{l.icon}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Môn học mục tiêu - full width */}
      <div className={styles.formSection}>
        <label className={styles.label}>Môn học mục tiêu {!draft.difficulty_level && <span style={{color:'#9ca3af', fontWeight:500}}> — Chọn mức độ trước</span>}</label>
        <div className={styles.subjectGrid}>
          {subjects && subjects.length > 0 ? subjects.map((s: any) => (
            <button 
              key={`${s.id}-${s.name}`} 
              type="button"
              className={`${styles.subjectCard} ${draft.subject_id === s.id ? styles.selected : ''}`} 
              onClick={() => onSubSelect(s.id, s.name)}
            >
              <span className={styles.subjectIcon}>{s.icon || '📘'}</span>
              <span>{s.name}</span>
            </button>
          )) : <p>Đang tải danh sách môn học...</p>}
        </div>
      </div>

      {/* Tiêu đề + Chủ đề + Mô tả */}
      <div className={styles.formGrid}>
        <div className={styles.formSection}>
          <label className={styles.label}>Tiêu đề bài học</label>
          <input 
            className={styles.input} 
            value={draft.title} 
            onChange={e => onInfoChange('title', e.target.value)} 
            placeholder="Ví dụ: Nhận diện nhân vật..." 
          />
        </div>
        <div className={styles.formSection}>
          <label className={styles.label}>Chủ đề</label>
          <input 
            className={styles.input} 
            value={draft.theme} 
            onChange={e => onInfoChange('theme', e.target.value)} 
            placeholder="Ví dụ: Truyện cổ tích, Màu sắc..." 
          />
        </div>
      </div>
      <div className={styles.formSection}>
        <label className={styles.label}>Mô tả bài học</label>
        <textarea 
          className={styles.input}
          value={draft.description} 
          onChange={e => onInfoChange('description', e.target.value)} 
          placeholder="Mô tả ngắn về mục tiêu và nội dung bài học..." 
          rows={3}
          style={{resize: 'none', minHeight: '80px'}}
        />
      </div>
    </div>
  )
}

function StepBuilder({ activity, onActChange, onStepChange, onUpload, isH1 }: any) {
  if (!activity) return <div className={styles.loading}>Đang nạp dữ liệu môn học...</div>

  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <span className={isH1 ? styles.badge : styles.badgeSecondary}>{isH1 ? 'H1 - BÀI TẬP' : 'H2 - HOẠT ĐỘNG'}</span>
        <h2>{isH1 ? '🎯 Dựng các bước bài tập' : '✨ Dựng các bước trải nghiệm'}</h2>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formSection}>
          <label className={styles.label}>Tên hoạt động</label>
          <input className={styles.input} value={activity.title} onChange={e => onActChange('title', e.target.value)} />
        </div>
        <div className={styles.formSection}>
          <label className={styles.label}>Kiểu tương tác chính</label>
          <select className={styles.select} value={activity.interaction_type} onChange={e => onActChange('interaction_type', e.target.value)}>
            <option value="selection">Trắc nghiệm / Chọn ảnh</option>
            <option value="drag">Kéo thả</option>
            <option value="voice_ai">AI Nhận diện giọng nói</option>
            <option value="ai_camera">AI Camera (Theo dõi vận động)</option>
            <option value="3d_interaction">Tương tác vật thể 3D</option>
            <option value="touch">Chạm nhanh</option>
          </select>
        </div>
      </div>

      <div className={styles.stepsGrid}>
        {activity.steps.map((s: any, idx: number) => (
          <div key={idx} className={styles.stepBuilderCard}>
            <div className={styles.stepNum}>{s.step_number}</div>
            <div className={styles.stepMain}>
              <div className={styles.stepRow}>
                <input className={styles.stepTitleInput} value={s.title} onChange={e => onStepChange(idx, 'title', e.target.value)} />
                <select className={styles.stepTypeSelect} value={s.content_type} onChange={e => onStepChange(idx, 'content_type', e.target.value)}>
                  {STEP_CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <textarea className={styles.stepDesc} value={s.description} onChange={e => onStepChange(idx, 'description', e.target.value)} rows={2} placeholder="Mô tả chi tiết bước này..." />
              
              <div className={styles.mediaZone}>
                {s.media_url ? (
                  <div className={styles.mediaPreview}>
                    {s.media_kind === 'image' && <img src={s.media_url} alt="preview" />}
                    {s.media_kind === 'video' && <video src={s.media_url} />}
                    {s.media_kind === 'audio' && <div className={styles.audioIcon}>🎵</div>}
                    <button className={styles.btnDeleteMedia} onClick={() => onStepChange(idx, 'media_url', '')}>Xóa</button>
                  </div>
                ) : (
                  <label className={styles.uploadBtn}>
                    <span>📤 Tải lên Ảnh/Âm thanh/Video</span>
                    <input type="file" hidden onChange={e => e.target.files?.[0] && onUpload(idx, e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepReview({ draft }: any) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <h2>🏁 Xác nhận cấu hình</h2>
        <p>Vui lòng kiểm tra lại cấu hình các bước của H1 và H2.</p>
      </div>
      <div className={styles.reviewLayout}>
        <div className={styles.reviewMain}>
          <h3>{draft.title}</h3>
          <div className={styles.reviewMeta}>
            <span>📍 {draft.subject_name}</span>
            <span>📊 Mức: {draft.difficulty_level}</span>
          </div>
        </div>
        <div className={styles.reviewGrid}>
          <div className={styles.reviewBox}>
            <h4>Hoạt động H1</h4>
            <p><strong>{draft.activities[0]?.title}</strong></p>
            <p>{draft.activities[0]?.steps.length} bước đã sẵn sàng.</p>
          </div>
          <div className={styles.reviewBox}>
            <h4>Hoạt động H2</h4>
            <p><strong>{draft.activities[1]?.title}</strong></p>
            <p>{draft.activities[1]?.steps.length} bước đã sẵn sàng.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
