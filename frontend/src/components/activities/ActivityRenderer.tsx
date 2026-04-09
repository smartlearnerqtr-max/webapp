import React from 'react'
import type { LessonActivityItem } from '../../services/api'

type ActivityType =
  | 'multiple_choice'
  | 'image_choice'
  | 'matching'
  | 'drag_drop'
  | 'listen_choose'
  | 'watch_answer'
  | 'step_by_step'
  | 'aac'
  | 'career_simulation'
  | 'ai_chat'

type ActivityPair = {
  left: string
  right: string
}

const activityTypeLabelMap: Record<string, string> = {
  multiple_choice: 'Chọn đáp án',
  image_choice: 'Nhìn ảnh chọn đáp án',
  matching: 'Nối cặp',
  drag_drop: 'Kéo thả',
  listen_choose: 'Nghe và chọn',
  watch_answer: 'Xem và trả lời',
  step_by_step: 'Từng bước',
  aac: 'Thẻ giao tiếp',
  career_simulation: 'Mô phỏng nghề nghiệp',
  ai_chat: 'Trao đổi với AI',
}

function activityLabel(activityType: string) {
  return activityTypeLabelMap[activityType] ?? activityType
}

function parseActivityConfig(configJson: string | null) {
  if (!configJson) return null
  try {
    return JSON.parse(configJson) as Record<string, unknown>
  } catch {
    return null
  }
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toPairArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      return {
        left: toText((item as { left?: unknown }).left),
        right: toText((item as { right?: unknown }).right),
      }
    })
    .filter((item): item is ActivityPair => Boolean(item?.left && item.right))
}

function normalizeYouTubeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (host.includes('youtu.be')) {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }
    if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) return rawUrl
      const videoId = url.searchParams.get('v')
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }
  } catch {
    return null
  }
  return null
}

function normalizeGoogleDriveEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    if (!url.hostname.toLowerCase().includes('drive.google.com')) return null
    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
    if (fileMatch?.[1]) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
    const fileId = url.searchParams.get('id')
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null
  } catch {
    return null
  }
}

function inferMediaKind(mediaUrl: string, mediaKind: string | null) {
  if (mediaKind === 'image' || mediaKind === 'video') return mediaKind
  const normalizedUrl = mediaUrl.trim().toLowerCase()
  if (/\.(png|jpe?g|gif|webp)(\?.*)?$/.test(normalizedUrl)) return 'image'
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/.test(normalizedUrl)) return 'video'
  if (normalizeYouTubeEmbedUrl(mediaUrl) || normalizeGoogleDriveEmbedUrl(mediaUrl)) return 'embed'
  return 'external'
}

function renderEmbeddedMedia(mediaUrl: string, mediaKind: string | null) {
  const resolvedKind = inferMediaKind(mediaUrl, mediaKind)
  const sharedStyle = { width: '100%', maxHeight: '360px', border: 'none', borderRadius: '1rem', background: '#f4f7fb' } as const
  const youtubeEmbedUrl = normalizeYouTubeEmbedUrl(mediaUrl)
  const driveEmbedUrl = normalizeGoogleDriveEmbedUrl(mediaUrl)

  if (resolvedKind === 'image') {
    return <img src={mediaUrl} alt="Noi dung bai hoc" style={{ ...sharedStyle, objectFit: 'contain' }} />
  }

  if (resolvedKind === 'video') {
    return (
      <video controls preload="metadata" style={sharedStyle}>
        <source src={mediaUrl} />
        Trinh duyet khong ho tro video nay.
      </video>
    )
  }

  if (youtubeEmbedUrl || driveEmbedUrl) {
    return (
      <iframe
        src={youtubeEmbedUrl ?? driveEmbedUrl ?? mediaUrl}
        title="Media bai hoc"
        style={sharedStyle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <div className="detail-stack">
      <iframe src={mediaUrl} title="Media bai hoc" style={sharedStyle} />
      <a className="subject-pill" href={mediaUrl} target="_blank" rel="noreferrer">Mo nguon goc neu media khong hien thi dung</a>
    </div>
  )
}

interface ActivityComponentProps {
  activity: LessonActivityItem
  answers: any
  setAnswers: (fn: (prev: any) => any) => void
}

export const MultipleChoiceActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || toText(config.audio_text) || activity.instruction_text || 'Hãy chọn đáp án đúng.'
  const choices = toStringArray(config.choices)
  const correct = toText(config.correct)
  const mediaUrl = toText(config.media_url)
  const mediaKind = toText(config.media_kind)
  const selectedChoice = answers[activity.id] ?? ''
  const isCorrect = Boolean(selectedChoice) && selectedChoice === correct

  return (
    <div className="activity-playground">
      {mediaUrl ? renderEmbeddedMedia(mediaUrl, mediaKind) : null}
      <p className="activity-prompt">{prompt}</p>
      <div className="activity-option-grid">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={selectedChoice === choice ? 'interactive-option interactive-option-active' : 'interactive-option'}
            onClick={() => setAnswers((current: any) => ({ ...current, [activity.id]: choice }))}
          >
            {choice}
          </button>
        ))}
      </div>
      {selectedChoice ? (
        <p className={isCorrect ? 'feedback-note feedback-note-success' : 'feedback-note feedback-note-warning'}>
          {isCorrect ? 'Em đã chọn đúng.' : `Em đang chọn ${selectedChoice}. Đáp án đúng là ${correct}.`}
        </p>
      ) : null}
    </div>
  )
})

export const MatchingActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy nối các cặp phù hợp.'
  const pairs = toPairArray(config.pairs)
  const options = pairs.map((pair) => pair.right)
  const currentAnswers = answers[activity.id] ?? Array.from({ length: pairs.length }, () => '')
  const correctCount = currentAnswers.filter((answer: string, index: number) => answer === pairs[index]?.right).length

  return (
    <>
      <p>{prompt}</p>
      <div className="activity-playground activity-list-grid">
        {pairs.map((pair, index) => (
          <label key={`${activity.id}-${pair.left}-${index}`} className="activity-inline-field">
            <span>{pair.left}</span>
            <select
              value={currentAnswers[index] ?? ''}
              onChange={(event) => {
                const nextAnswers = [...currentAnswers]
                nextAnswers[index] = event.target.value
                setAnswers((current: any) => ({ ...current, [activity.id]: nextAnswers }))
              }}
            >
              <option value="">Chọn cặp đúng</option>
              {options.map((option) => (
                <option key={`${pair.left}-${option}`} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <p className="feedback-note">Đúng {correctCount}/{pairs.length} cặp.</p>
      </div>
    </>
  )
})

export const DragDropActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy kéo từng mục vào đúng vị trí.'
  const items = toStringArray(config.items)
  const targets = toStringArray(config.targets)
  const currentAnswers = answers[activity.id] ?? Array.from({ length: items.length }, () => '')
  const completedCount = currentAnswers.filter(Boolean).length

  return (
    <>
      <p>{prompt}</p>
      <div className="activity-playground activity-list-grid">
        {items.map((item, index) => (
          <label key={`${activity.id}-${item}-${index}`} className="activity-inline-field">
            <span>{item}</span>
            <select
              value={currentAnswers[index] ?? ''}
              onChange={(event) => {
                const nextAnswers = [...currentAnswers]
                nextAnswers[index] = event.target.value
                setAnswers((current: any) => ({ ...current, [activity.id]: nextAnswers }))
              }}
            >
              <option value="">Chọn vị trí đích</option>
              {targets.map((target) => (
                <option key={`${item}-${target}`} value={target}>{target}</option>
              ))}
            </select>
          </label>
        ))}
        <p className="feedback-note">Đã gắn {completedCount}/{items.length} mục.</p>
      </div>
    </>
  )
})

export const WatchAnswerActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const mediaUrl = toText(config.media_url)
  const mediaKind = toText(config.media_kind)
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy xem rồi trả lời câu hỏi.'
  const answer = answers[activity.id] ?? ''

  return (
    <div className="activity-playground">
      {mediaUrl ? renderEmbeddedMedia(mediaUrl, mediaKind) : null}
      <p className="activity-prompt">{prompt}</p>
      <textarea
        value={answer}
        onChange={(event) => setAnswers((current: any) => ({ ...current, [activity.id]: event.target.value }))}
        rows={4}
        placeholder="Em trả lời ở đây"
      />
    </div>
  )
})

export const StepByStepActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy làm theo từng bước.'
  const steps = toStringArray(config.steps)
  const currentAnswers = answers[activity.id] ?? Array.from({ length: steps.length }, () => false)
  const doneCount = currentAnswers.filter(Boolean).length

  return (
    <>
      <p>{prompt}</p>
      <div className="activity-playground activity-list-grid">
        {steps.map((step, index) => (
          <label key={`${activity.id}-${index}`} className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(currentAnswers[index])}
              onChange={(event) => {
                const nextAnswers = [...currentAnswers]
                nextAnswers[index] = event.target.checked
                setAnswers((current: any) => ({ ...current, [activity.id]: nextAnswers }))
              }}
            />
            <span>{step}</span>
          </label>
        ))}
        <p className="feedback-note">Hoàn thành {doneCount}/{steps.length} bước.</p>
      </div>
    </>
  )
})

export const AACActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy chọn thẻ phù hợp.'
  const cards = toStringArray(config.cards)
  const selectedCard = answers[activity.id] ?? ''

  return (
    <div className="activity-playground">
      <p>{prompt}</p>
      <div className="activity-option-grid">
        {cards.map((card) => (
          <button
            key={card}
            type="button"
            className={selectedCard === card ? 'interactive-option interactive-option-active' : 'interactive-option'}
            onClick={() => setAnswers((current: any) => ({ ...current, [activity.id]: card }))}
          >
            {card}
          </button>
        ))}
      </div>
      {selectedCard ? <p className="feedback-note feedback-note-success">Em đang chọn: {selectedCard}</p> : null}
    </div>
  )
})

export const CareerSimulationActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const scenario = toText(config.scenario) || 'Chưa có tình huống mô phỏng.'
  const successCriteria = toText(config.success_criteria)
  const answer = answers[activity.id] ?? ''

  return (
    <div className="activity-playground">
      <p className="activity-prompt">{scenario}</p>
      {successCriteria ? <p className="helper-text">Tiêu chí hoàn thành: {successCriteria}</p> : null}
      <textarea
        value={answer}
        onChange={(event) => setAnswers((current: any) => ({ ...current, [activity.id]: event.target.value }))}
        rows={4}
        placeholder="Em sẽ làm gì trong tình huống này?"
      />
    </div>
  )
})

export const AIChatActivity = React.memo(({ activity, answers, setAnswers }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const starterPrompt = toText(config.starter_prompt) || 'Hãy bắt đầu trao đổi ngắn với trợ lý.'
  const goals = toStringArray(config.goals)
  const answer = answers[activity.id] ?? ''

  return (
    <div className="activity-playground">
      <p className="activity-prompt">{starterPrompt}</p>
      {goals.length ? (
        <div className="tag-wrap">
          {goals.map((goal) => (
            <span key={`${activity.id}-${goal}`} className="subject-pill">{goal}</span>
          ))}
        </div>
      ) : null}
      <textarea
        value={answer}
        onChange={(event) => setAnswers((current: any) => ({ ...current, [activity.id]: event.target.value }))}
        rows={4}
        placeholder="Em nhập câu trả lời thử ở đây"
      />
    </div>
  )
})

export const ActivityCard = React.memo(({ activity, answers, setAnswers }: { activity: LessonActivityItem, answers: any, setAnswers: any }) => {
  const activityType = activity.activity_type as ActivityType

  return (
    <div className="activity-card">
      <div className="student-row">
        <strong>{activity.sort_order}. {activity.title}</strong>
        <span>{activityLabel(activity.activity_type)} {activity.voice_answer_enabled ? '/ voice' : ''}</span>
      </div>
      <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
      {activityType === 'multiple_choice' || activityType === 'image_choice' || activityType === 'listen_choose' ? (
        <MultipleChoiceActivity activity={activity} answers={answers.choiceAnswers} setAnswers={setAnswers.setChoiceAnswers} />
      ) : activityType === 'matching' ? (
        <MatchingActivity activity={activity} answers={answers.matchingAnswers} setAnswers={setAnswers.setMatchingAnswers} />
      ) : activityType === 'drag_drop' ? (
        <DragDropActivity activity={activity} answers={answers.dragAnswers} setAnswers={setAnswers.setDragAnswers} />
      ) : activityType === 'watch_answer' ? (
        <WatchAnswerActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} />
      ) : activityType === 'step_by_step' ? (
        <StepByStepActivity activity={activity} answers={answers.stepAnswers} setAnswers={setAnswers.setStepAnswers} />
      ) : activityType === 'aac' ? (
        <AACActivity activity={activity} answers={answers.aacSelections} setAnswers={setAnswers.setAacSelections} />
      ) : activityType === 'career_simulation' ? (
        <CareerSimulationActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} />
      ) : activityType === 'ai_chat' ? (
        <AIChatActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} />
      ) : (
        <p className="helper-text">Hoạt động này chưa có cấu hình chi tiết nên đang hiển thị ở chế độ mô tả.</p>
      )}
    </div>
  )
})
