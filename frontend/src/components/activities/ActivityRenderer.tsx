import React from 'react'

import { gradeAIAnswer, type AIGradeAnswerResponse, type LessonActivityItem } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

type ActivityType =
  | 'multiple_choice'
  | 'image_choice'
  | 'image_puzzle'
  | 'matching'
  | 'drag_drop'
  | 'listen_choose'
  | 'watch_answer'
  | 'hidden_image_guess'
  | 'step_by_step'
  | 'aac'
  | 'memory_match'
  | 'quick_tap'
  | 'size_order'
  | 'habitat_match'
  | 'career_simulation'
  | 'ai_chat'

type ActivityPair = {
  left: string
  right: string
}

type ImageChoiceCard = {
  id: string
  label: string
  mediaUrl: string
  mediaKind: string | null
}

type QuickTapVisibleCard = ImageChoiceCard & {
  isTarget: boolean
  slotKey: string
}

type QuickTapFallingCard = QuickTapVisibleCard & {
  xPercent: number
  durationSeconds: number
  tiltDeg: number
  delayMs: number
}

type OrderedImageItem = ImageChoiceCard & {
  rank: number
}

type HabitatMatchItem = ImageChoiceCard & {
  habitat: string
  habitatId: string
}

type HabitatOption = {
  id: string
  label: string
  mediaUrl: string
  mediaKind: string | null
}

type WatchAnswerMode = 'text' | 'voice_ai_grade'

type BrowserSpeechRecognitionResultItem = {
  transcript: string
}

type BrowserSpeechRecognitionResult = {
  isFinal: boolean
  0: BrowserSpeechRecognitionResultItem
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<BrowserSpeechRecognitionResult>
}

type BrowserSpeechRecognitionErrorEvent = {
  error: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type ActivityPresentationMode = 'standard' | 'immersive_square'

const activityTypeLabelMap: Record<string, string> = {
  memory_match: 'Lật thẻ ghi nhớ',
  quick_tap: 'Chạm đúng nhanh',
  size_order: 'Sắp xếp lớn nhỏ',
  habitat_match: 'Ghép nơi sống',
  multiple_choice: 'Chọn đáp án',
  image_choice: 'Nhìn ảnh chọn đáp án',
  image_puzzle: 'Ghép mảnh ảnh',
  matching: 'Nối cặp',
  drag_drop: 'Kéo thả',
  listen_choose: 'Nghe và chọn',
  watch_answer: 'Xem và trả lời',
  hidden_image_guess: 'Mở ô đoán hình',
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

function toImageChoiceCardArray(value: unknown) {
  if (!Array.isArray(value)) return []
  const cards: Array<ImageChoiceCard | null> = value.map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const rawItem = item as {
        id?: unknown
        label?: unknown
        media_url?: unknown
        media_kind?: unknown
      }
      const mediaUrl = toText(rawItem.media_url)
      if (!mediaUrl) return null
      const label = toText(rawItem.label) || `Ảnh ${index + 1}`
      return {
        id: toText(rawItem.id) || `image-card-${index + 1}`,
        label,
        mediaUrl,
        mediaKind: toText(rawItem.media_kind) || inferMediaKind(mediaUrl, null),
      }
  })
  return cards.filter((item): item is ImageChoiceCard => item !== null)
}

function toOrderedImageItemArray(value: unknown) {
  if (!Array.isArray(value)) return []
  const items: Array<OrderedImageItem | null> = value.map((item, index) => {
    if (!item || typeof item !== 'object') return null
    const rawItem = item as {
      id?: unknown
      label?: unknown
      media_url?: unknown
      media_kind?: unknown
      rank?: unknown
    }
    const mediaUrl = toText(rawItem.media_url)
    if (!mediaUrl) return null
    return {
      id: toText(rawItem.id) || `size-item-${index + 1}`,
      label: toText(rawItem.label) || `Vật ${index + 1}`,
      mediaUrl,
      mediaKind: toText(rawItem.media_kind) || inferMediaKind(mediaUrl, null),
      rank: Number(rawItem.rank ?? index + 1) || index + 1,
    }
  })
  return items.filter((item): item is OrderedImageItem => item !== null)
}

function toHabitatMatchItemArray(value: unknown) {
  if (!Array.isArray(value)) return []
  const items: Array<HabitatMatchItem | null> = value.map((item, index) => {
    if (!item || typeof item !== 'object') return null
    const rawItem = item as {
      id?: unknown
      label?: unknown
      media_url?: unknown
      media_kind?: unknown
      habitat?: unknown
      habitat_id?: unknown
    }
    const mediaUrl = toText(rawItem.media_url)
    const habitat = toText(rawItem.habitat)
    const habitatId = toText(rawItem.habitat_id) || habitat
    if (!mediaUrl || !habitatId) return null
    return {
      id: toText(rawItem.id) || `habitat-item-${index + 1}`,
      label: toText(rawItem.label) || `Vật ${index + 1}`,
      mediaUrl,
      mediaKind: toText(rawItem.media_kind) || inferMediaKind(mediaUrl, null),
      habitat: habitat || habitatId,
      habitatId,
    }
  })
  return items.filter((item): item is HabitatMatchItem => item !== null)
}

function toHabitatOptionArray(habitatCardsValue: unknown, habitatsValue: unknown) {
  if (Array.isArray(habitatCardsValue)) {
    const options: Array<HabitatOption | null> = habitatCardsValue.map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const rawItem = item as {
        id?: unknown
        label?: unknown
        media_url?: unknown
        media_kind?: unknown
      }
      const label = toText(rawItem.label)
      const id = toText(rawItem.id) || label
      if (!id) return null
      const mediaUrl = toText(rawItem.media_url)
      return {
        id,
        label: label || `Nơi sống ${index + 1}`,
        mediaUrl,
        mediaKind: mediaUrl ? toText(rawItem.media_kind) || inferMediaKind(mediaUrl, null) : null,
      }
    })
    const resolvedOptions = options.filter((item): item is HabitatOption => item !== null)
    if (resolvedOptions.length) return resolvedOptions
  }

  return toStringArray(habitatsValue).map((habitat, index) => ({
    id: habitat,
    label: habitat || `Nơi sống ${index + 1}`,
    mediaUrl: '',
    mediaKind: null,
  }))
}

function stableHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003
  }
  return hash
}

function speechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
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

function normalizeTikTokEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    if (!url.hostname.toLowerCase().includes('tiktok.com')) return null
    const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1]
    return videoId ? `https://www.tiktok.com/player/v1/${videoId}?controls=1&description=0&music_info=0` : null
  } catch {
    return null
  }
}

function inferMediaKind(mediaUrl: string, mediaKind: string | null) {
  if (mediaKind === 'image' || mediaKind === 'video') return mediaKind
  const normalizedUrl = mediaUrl.trim().toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(normalizedUrl)) return 'image'
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/.test(normalizedUrl)) return 'video'
  if (/\.(html)(\?.*)?$/.test(normalizedUrl)) return 'embed'
  if (normalizeYouTubeEmbedUrl(mediaUrl) || normalizeGoogleDriveEmbedUrl(mediaUrl) || normalizeTikTokEmbedUrl(mediaUrl)) return 'embed'
  return 'external'
}

function renderEmbeddedMedia(mediaUrl: string, mediaKind: string | null, presentationMode: ActivityPresentationMode = 'standard') {
  const resolvedKind = inferMediaKind(mediaUrl, mediaKind)
  const youtubeEmbedUrl = normalizeYouTubeEmbedUrl(mediaUrl)
  const driveEmbedUrl = normalizeGoogleDriveEmbedUrl(mediaUrl)
  const tikTokEmbedUrl = normalizeTikTokEmbedUrl(mediaUrl)
  const mediaClassName = presentationMode === 'immersive_square' ? 'embedded-media embedded-media-immersive-square' : 'embedded-media'

  if (resolvedKind === 'image') {
    return (
      <div className={mediaClassName}>
        <img src={mediaUrl} alt="Nội dung bài học" />
      </div>
    )
  }

  if (resolvedKind === 'video') {
    return (
      <div className={mediaClassName}>
        <video
          controls={presentationMode !== 'immersive_square'}
          autoPlay={presentationMode === 'immersive_square'}
          muted={presentationMode === 'immersive_square'}
          loop={presentationMode === 'immersive_square'}
          playsInline
          preload="metadata"
        >
          <source src={mediaUrl} />
          Trình duyệt không hỗ trợ video này.
        </video>
      </div>
    )
  }

  if (youtubeEmbedUrl || driveEmbedUrl || tikTokEmbedUrl) {
    return (
      <div className={mediaClassName}>
        <iframe
          src={youtubeEmbedUrl ?? driveEmbedUrl ?? tikTokEmbedUrl ?? mediaUrl}
          title="Media bài học"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }

  if (resolvedKind === 'embed') {
    return (
      <div className={mediaClassName}>
        <iframe src={mediaUrl} title="Media bài học" />
      </div>
    )
  }

  return (
    <div className="detail-stack">
      <div className={mediaClassName}>
        <iframe src={mediaUrl} title="Media bài học" />
      </div>
      <a className="subject-pill" href={mediaUrl} target="_blank" rel="noreferrer">Mở nguồn gốc nếu media không hiển thị đúng</a>
    </div>
  )
}

interface ActivityComponentProps {
  activity: LessonActivityItem
  answers: any
  setAnswers: (fn: (prev: any) => any) => void
  presentationMode?: ActivityPresentationMode
  onAutoAdvance?: (activityId: number) => void
}

function scheduleAutoAdvance(onAutoAdvance: ((activityId: number) => void) | undefined, activityId: number) {
  if (!onAutoAdvance) return
  window.setTimeout(() => onAutoAdvance(activityId), 220)
}

function CarouselImageChoiceActivity({
  activity,
  prompt,
  cards,
  correct,
  selectedChoice,
  setAnswers,
  presentationMode = 'standard',
  onAutoAdvance,
}: {
  activity: LessonActivityItem
  prompt: string
  cards: ImageChoiceCard[]
  correct: string
  selectedChoice: string
  setAnswers: (fn: (prev: any) => any) => void
  presentationMode?: ActivityPresentationMode
  onAutoAdvance?: (activityId: number) => void
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const isCorrect = Boolean(selectedChoice) && selectedChoice === correct

  function scrollToIndex(nextIndex: number) {
    const boundedIndex = Math.max(0, Math.min(nextIndex, cards.length - 1))
    const track = trackRef.current
    if (!track) return
    const nextChild = track.children.item(boundedIndex) as HTMLElement | null
    nextChild?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    setActiveIndex(boundedIndex)
  }

  function handleTrackScroll() {
    const track = trackRef.current
    if (!track || !track.clientWidth) return
    const nextIndex = Math.round(track.scrollLeft / track.clientWidth)
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex)
    }
  }

  const activeCard = cards[activeIndex] ?? cards[0]

  return (
    <div className="activity-playground image-carousel-shell">
      <p className="activity-prompt">{prompt}</p>

      <div className="image-carousel-header">
        <span className="image-carousel-chip">Ảnh {Math.min(activeIndex + 1, cards.length)}/{cards.length}</span>
        <span className="image-carousel-chip">{activeCard?.label ?? 'Lựa chọn'}</span>
      </div>

      <div className="image-carousel-track" ref={trackRef} onScroll={handleTrackScroll}>
        {cards.map((card) => (
          <article key={card.id} className="image-carousel-slide">
            <div className="image-carousel-media">
              {renderEmbeddedMedia(card.mediaUrl, card.mediaKind, presentationMode)}
            </div>
            <div className="image-carousel-slide-footer">
              <strong>{card.label}</strong>
              <button
                type="button"
                className={selectedChoice === card.id ? 'interactive-option interactive-option-active image-carousel-select' : 'interactive-option image-carousel-select'}
                aria-pressed={selectedChoice === card.id}
                onClick={() => {
                  setAnswers((current: any) => ({ ...current, [activity.id]: card.id }))
                  scheduleAutoAdvance(onAutoAdvance, activity.id)
                }}
              >
                {selectedChoice === card.id ? 'Đã chọn' : 'Chọn'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="image-carousel-controls">
        <button type="button" className="ghost-button image-carousel-nav" onClick={() => scrollToIndex(activeIndex - 1)} disabled={activeIndex <= 0} aria-label="Ảnh trước">
          {'\u2190'}
        </button>
        <div className="image-carousel-dots">
          {cards.map((card, index) => (
            <button
              key={`${activity.id}-${card.id}`}
              type="button"
              className={index === activeIndex ? 'image-carousel-dot image-carousel-dot-active' : 'image-carousel-dot'}
              onClick={() => scrollToIndex(index)}
              aria-label={`Xem ảnh ${index + 1}`}
            />
          ))}
        </div>
        <button type="button" className="ghost-button image-carousel-nav" onClick={() => scrollToIndex(activeIndex + 1)} disabled={activeIndex >= cards.length - 1} aria-label="Ảnh sau">
          {'\u2192'}
        </button>
      </div>

      {selectedChoice ? (
        <p className={isCorrect ? 'feedback-note feedback-note-success' : 'feedback-note feedback-note-warning'}>
          {isCorrect ? 'Đúng rồi, em đã tìm thấy ảnh phù hợp.' : 'Ảnh em chọn chưa đúng. Thử vuốt tiếp sang trái hoặc phải nhé.'}
        </p>
      ) : null}
    </div>
  )
}

function VoiceAiAnswerBox({
  activity,
  prompt,
  mediaUrl,
  expectedAnswer,
  acceptedAnswers,
  answers,
  setAnswers,
}: {
  activity: LessonActivityItem
  prompt: string
  mediaUrl: string
  expectedAnswer: string
  acceptedAnswers: string[]
  answers: any
  setAnswers: (fn: (prev: any) => any) => void
}) {
  const token = useAuthStore((state) => state.accessToken)
  const answer = answers[activity.id] ?? ''
  const recognitionRef = React.useRef<BrowserSpeechRecognition | null>(null)
  const transcriptRef = React.useRef(answer)
  const [isListening, setIsListening] = React.useState(false)
  const [isGrading, setIsGrading] = React.useState(false)
  const [voiceError, setVoiceError] = React.useState<string | null>(null)
  const [gradeResult, setGradeResult] = React.useState<AIGradeAnswerResponse | null>(null)
  const supportsSpeechRecognition = Boolean(speechRecognitionConstructor())

  React.useEffect(() => {
    transcriptRef.current = answer
  }, [answer])

  React.useEffect(() => () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  function handleAnswerChange(nextValue: string) {
    transcriptRef.current = nextValue
    setAnswers((current: any) => ({ ...current, [activity.id]: nextValue }))
    setVoiceError(null)
    setGradeResult(null)
  }

  async function submitVoiceAnswer(nextTranscript: string) {
    const trimmedTranscript = nextTranscript.trim()
    if (!trimmedTranscript || !token || !expectedAnswer) return

    setIsGrading(true)
    setVoiceError(null)
    try {
      const result = await gradeAIAnswer(token, {
        transcript: trimmedTranscript,
        expected_answer: expectedAnswer,
        accepted_answers: acceptedAnswers,
        question: prompt,
        activity_type: activity.activity_type,
        media_url: mediaUrl,
      })
      setGradeResult(result)
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Không thể chấm câu trả lời lúc này.')
      setGradeResult(null)
    } finally {
      setIsGrading(false)
    }
  }

  function handleToggleListening() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const RecognitionConstructor = speechRecognitionConstructor()
    if (!RecognitionConstructor) {
      setVoiceError('Trình duyệt này chưa hỗ trợ nhận giọng nói. Em có thể nhập câu trả lời bằng tay.')
      return
    }

    try {
      const recognition = new RecognitionConstructor()
      transcriptRef.current = answer
      recognition.lang = 'vi-VN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onstart = () => {
        setIsListening(true)
        setVoiceError(null)
      }
      recognition.onresult = (event) => {
        let nextTranscript = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (result?.isFinal && result[0]?.transcript) {
            nextTranscript = `${nextTranscript} ${result[0].transcript}`.trim()
          }
        }
        if (nextTranscript) {
          handleAnswerChange(nextTranscript)
        }
      }
      recognition.onerror = (event) => {
        setVoiceError(event.error === 'not-allowed' ? 'Em cần cho phép sử dụng micro để trả lời bằng giọng nói.' : 'Micro chưa nghe rõ. Em thử nói lại một lần nữa nhé.')
      }
      recognition.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
        if (transcriptRef.current.trim()) {
          void submitVoiceAnswer(transcriptRef.current)
        }
      }
      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setIsListening(false)
      setVoiceError('Không thể bật micro trên trình duyệt này.')
    }
  }

  return (
    <div className="voice-answer-stack">
      <div className="voice-answer-panel">
        <div className="voice-answer-toolbar">
          <button
            type="button"
            className={isListening ? 'action-button voice-answer-button voice-answer-button-listening' : 'action-button voice-answer-button'}
            onClick={handleToggleListening}
            aria-label={isListening ? 'Dừng ghi âm' : 'Bật micro'}
          >
            <span aria-hidden="true">{isListening ? '⏹' : '🎙️'}</span>
          </button>
          <button
            type="button"
            className="ghost-button voice-answer-button"
            onClick={() => void submitVoiceAnswer(answer)}
            disabled={!answer.trim() || isGrading || !token || !expectedAnswer}
          >
            {isGrading ? 'Đang chấm...' : 'AI'}
          </button>
        </div>

        <div className="voice-answer-status-row">
          <span className={isListening ? 'voice-answer-chip voice-answer-chip-live' : 'voice-answer-chip'}>
            {isListening ? 'Đang nghe' : supportsSpeechRecognition ? 'Sẵn sàng' : 'Không có mic'}
          </span>
          {gradeResult ? (
            <span className={gradeResult.is_correct ? 'voice-answer-chip voice-answer-chip-success' : 'voice-answer-chip voice-answer-chip-warning'}>
              {gradeResult.is_correct ? 'Đúng rồi' : gradeResult.grade === 'close' ? 'Gần đúng rồi' : 'Chưa đúng'}
            </span>
          ) : null}
        </div>
      </div>

      <textarea
        value={answer}
        onChange={(event) => handleAnswerChange(event.target.value)}
        rows={4}
        placeholder="Đoạn văn bản nhận từ giọng nói sẽ hiện ở đây"
      />

      {voiceError ? <p className="feedback-note feedback-note-warning">{voiceError}</p> : null}
      {gradeResult ? (
        <div className={gradeResult.is_correct ? 'voice-answer-result voice-answer-result-success' : 'voice-answer-result voice-answer-result-warning'}>
          <strong>{gradeResult.is_correct ? 'AI nói: Em trả lời đúng rồi.' : 'AI nói: Mình thử lại một chút nhé.'}</strong>
          <p>{gradeResult.feedback}</p>
          <p className="helper-text">
            Văn bản nhận diện: <strong>{gradeResult.transcript}</strong>
          </p>
        </div>
      ) : null}
    </div>
  )
}

function createInitialPuzzleOrder(pieceCount: number) {
  const pieces = Array.from({ length: pieceCount }, (_, index) => `piece-${index}`)
  if (pieceCount <= 1) return pieces
  const pivot = Math.max(1, Math.floor(pieceCount / 2))
  const shifted = [...pieces.slice(pivot), ...pieces.slice(0, pivot)]
  if (shifted.every((pieceId, index) => pieceId === pieces[index])) {
    ;[shifted[0], shifted[1]] = [shifted[1], shifted[0]]
  }
  return shifted
}

function renderPuzzlePiece({
  pieceId,
  imageUrl,
  rows,
  cols,
}: {
  pieceId: string
  imageUrl: string
  rows: number
  cols: number
}) {
  const pieceIndex = Number(pieceId.replace('piece-', ''))
  const rowIndex = Math.floor(pieceIndex / cols)
  const colIndex = pieceIndex % cols
  return (
    <div
      className="image-puzzle-piece"
      style={{
        backgroundImage: `url("${imageUrl}")`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${(colIndex / Math.max(cols - 1, 1)) * 100}% ${(rowIndex / Math.max(rows - 1, 1)) * 100}%`,
      }}
    />
  )
}

function ImagePuzzleActivity({ activity, answers, setAnswers }: ActivityComponentProps) {
  const config = React.useMemo(() => parseActivityConfig(activity.config_json), [activity.config_json])
  if (!config) return null
  const imageUrl = toText(config.image_url)
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy ghép lại thành bức tranh hoàn chỉnh.'
  const rows = Math.max(1, Number(config.rows ?? 2) || 2)
  const cols = Math.max(1, Number(config.cols ?? 3) || 3)
  const pieceCount = Math.max(2, Number(config.piece_count ?? rows * cols) || rows * cols)
  const initialOrder = React.useMemo(() => createInitialPuzzleOrder(pieceCount), [pieceCount])
  const currentSlots = Array.isArray(answers[activity.id]) && answers[activity.id].length === pieceCount ? answers[activity.id] : initialOrder
  const [draggingPieceId, setDraggingPieceId] = React.useState<string | null>(null)
  const isSolved = currentSlots.every((pieceId: string, index: number) => pieceId === `piece-${index}`)

  React.useEffect(() => {
    setAnswers((current: any) => {
      const existingSlots = current[activity.id]
      if (Array.isArray(existingSlots) && existingSlots.length === pieceCount) {
        return current
      }
      return { ...current, [activity.id]: initialOrder }
    })
  }, [activity.id, initialOrder, pieceCount, setAnswers])

  function movePiece(pieceId: string, targetIndex: number) {
    const sourceIndex = currentSlots.indexOf(pieceId)
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= currentSlots.length || sourceIndex === targetIndex) return
    const nextSlots = [...currentSlots]
    ;[nextSlots[sourceIndex], nextSlots[targetIndex]] = [nextSlots[targetIndex], nextSlots[sourceIndex]]
    setAnswers((current: any) => ({ ...current, [activity.id]: nextSlots }))
  }

  if (!imageUrl) {
    return <p className="helper-text">Hoạt động ghép ảnh chưa có ảnh nguồn.</p>
  }

  return (
    <div className="activity-playground image-puzzle-shell">
      <p className="activity-prompt">{prompt}</p>
      <div className="image-puzzle-frame">
        <div className="image-puzzle-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {currentSlots.map((pieceId: string, slotIndex: number) => (
            <button
              key={`${activity.id}-${slotIndex}`}
              type="button"
              className={isSolved ? 'image-puzzle-slot image-puzzle-slot-solved' : 'image-puzzle-slot'}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const droppedPieceId = event.dataTransfer.getData('text/plain') || draggingPieceId
                if (droppedPieceId) {
                  movePiece(droppedPieceId, slotIndex)
                }
                setDraggingPieceId(null)
              }}
            >
              <div
                draggable={!isSolved}
                className="image-puzzle-piece-shell"
                onDragStart={(event) => {
                  setDraggingPieceId(pieceId)
                  event.dataTransfer.setData('text/plain', pieceId)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => setDraggingPieceId(null)}
              >
                {renderPuzzlePiece({ pieceId, imageUrl, rows, cols })}
              </div>
            </button>
          ))}
        </div>
      </div>
      <p className={isSolved ? 'feedback-note feedback-note-success' : 'feedback-note'}>
        {isSolved ? 'Em đã ghép xong bức tranh rồi.' : 'Hãy kéo từng mảnh ảnh vào đúng vị trí để hoàn thành.'}
      </p>
    </div>
  )
}

function HiddenImageGuessActivity({ activity, answers, setAnswers }: ActivityComponentProps) {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const imageUrl = toText(config.image_url)
  const prompt = toText(config.prompt) || activity.instruction_text || 'Trong ảnh này có gì?'
  const overlayRows = Math.max(2, Number(config.overlay_rows ?? 3) || 3)
  const overlayCols = Math.max(2, Number(config.overlay_cols ?? 4) || 4)
  const expectedAnswer = toText(config.expected_answer)
  const acceptedAnswers = toStringArray(config.accepted_answers)
  const totalCells = overlayRows * overlayCols
  const [revealedCells, setRevealedCells] = React.useState<boolean[]>(() => Array.from({ length: totalCells }, () => false))

  React.useEffect(() => {
    setRevealedCells(Array.from({ length: totalCells }, () => false))
  }, [imageUrl, totalCells])

  function revealCell(cellIndex: number) {
    setRevealedCells((current) => current.map((opened, index) => (index === cellIndex ? true : opened)))
  }

  const openedCount = revealedCells.filter(Boolean).length

  if (!imageUrl) {
    return <p className="helper-text">Hoạt động mở ô đoán hình chưa có ảnh nguồn.</p>
  }

  return (
    <div className="activity-playground hidden-guess-shell">
      <p className="activity-prompt">{prompt}</p>
      <div className="hidden-guess-stage">
        <img src={imageUrl} alt="Ảnh cần đoán" className="hidden-guess-image" />
        <div className="hidden-guess-grid" style={{ gridTemplateColumns: `repeat(${overlayCols}, minmax(0, 1fr))` }}>
          {revealedCells.map((isOpen, index) => (
            <button
              key={`${activity.id}-cell-${index}`}
              type="button"
              className={isOpen ? 'hidden-guess-cell hidden-guess-cell-open' : 'hidden-guess-cell'}
              onClick={() => revealCell(index)}
              aria-label={`Mở ô ${index + 1}`}
            />
          ))}
        </div>
      </div>
      <p className="feedback-note">Đã mở {openedCount}/{totalCells} ô. Mở thêm nếu em cần gợi ý.</p>
      <VoiceAiAnswerBox
        activity={activity}
        prompt={prompt}
        mediaUrl={imageUrl}
        expectedAnswer={expectedAnswer}
        acceptedAnswers={acceptedAnswers}
        answers={answers}
        setAnswers={setAnswers}
      />
    </div>
  )
}

export const MultipleChoiceActivity = React.memo(({
  activity,
  answers,
  setAnswers,
  presentationMode = 'standard',
  onAutoAdvance,
}: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || toText(config.audio_text) || activity.instruction_text || 'Hãy chọn đáp án đúng.'
  const choices = toStringArray(config.choices)
  const correct = toText(config.correct)
  const mediaUrl = toText(config.media_url)
  const mediaKind = toText(config.media_kind)
  const imageSelectionMode = toText(config.image_selection_mode)
  const imageCards = toImageChoiceCardArray(config.image_cards)
  const selectedChoice = answers[activity.id] ?? ''
  const isCorrect = Boolean(selectedChoice) && selectedChoice === correct
  const optionGridClassName =
    presentationMode === 'immersive_square' && choices.length <= 2
      ? 'activity-option-grid activity-option-grid-two-choice'
      : 'activity-option-grid'

  if (imageSelectionMode === 'carousel_find' && imageCards.length > 0) {
    return (
      <CarouselImageChoiceActivity
        activity={activity}
        prompt={prompt}
        cards={imageCards}
        correct={correct}
        selectedChoice={selectedChoice}
        setAnswers={setAnswers}
        presentationMode={presentationMode}
        onAutoAdvance={onAutoAdvance}
      />
    )
  }

  return (
    <div className="activity-playground">
      {mediaUrl ? renderEmbeddedMedia(mediaUrl, mediaKind, presentationMode) : null}
      <p className="activity-prompt">{prompt}</p>
      <div className={optionGridClassName}>
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={selectedChoice === choice ? 'interactive-option interactive-option-active' : 'interactive-option'}
            aria-pressed={selectedChoice === choice}
            onClick={() => {
              setAnswers((current: any) => ({ ...current, [activity.id]: choice }))
              scheduleAutoAdvance(onAutoAdvance, activity.id)
            }}
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

export const WatchAnswerActivity = React.memo(({ activity, answers, setAnswers, presentationMode = 'standard' }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const mediaUrl = toText(config.media_url)
  const mediaKind = toText(config.media_kind)
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy xem rồi trả lời câu hỏi.'
  const answerMode = (toText(config.answer_mode) || 'text') as WatchAnswerMode
  const expectedAnswer = toText(config.expected_answer)
  const acceptedAnswers = toStringArray(config.accepted_answers)
  const answer = answers[activity.id] ?? ''

  return (
    <div className="activity-playground watch-answer-shell">
      {mediaUrl ? renderEmbeddedMedia(mediaUrl, mediaKind, presentationMode) : null}
      <p className="activity-prompt">{prompt}</p>

      {answerMode === 'voice_ai_grade' ? (
        <VoiceAiAnswerBox
          activity={activity}
          prompt={prompt}
          mediaUrl={mediaUrl}
          expectedAnswer={expectedAnswer}
          acceptedAnswers={acceptedAnswers}
          answers={answers}
          setAnswers={setAnswers}
        />
      ) : null}

      {answerMode !== 'voice_ai_grade' ? (
        <textarea
          value={answer}
          onChange={(event) => setAnswers((current: any) => ({ ...current, [activity.id]: event.target.value }))}
          rows={4}
          placeholder="Em trả lời ở đây"
        />
      ) : null}
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

export const MemoryMatchActivity = React.memo(({ activity, answers, setAnswers, onAutoAdvance }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Lật 2 thẻ giống nhau để ghi điểm.'
  const requestedPairCount = Math.max(1, Number(config.pair_count ?? 5) || 5)
  const cards = toImageChoiceCardArray(config.image_cards).slice(0, requestedPairCount)
  const deckKey = cards.map((card) => `${card.id}:${card.mediaUrl}`).join('|')
  const deck = React.useMemo(
    () =>
      cards
        .flatMap((card) => [
          { ...card, deckId: `${card.id}-a`, pairId: card.id },
          { ...card, deckId: `${card.id}-b`, pairId: card.id },
        ])
        .sort((left, right) => stableHash(`${activity.id}:${left.deckId}`) - stableHash(`${activity.id}:${right.deckId}`)),
    [activity.id, deckKey],
  )
  const matchedIds = Array.isArray(answers[activity.id]) ? answers[activity.id] : []
  const [openDeckIds, setOpenDeckIds] = React.useState<string[]>([])
  const [isChecking, setIsChecking] = React.useState(false)

  function handleCardClick(deckCard: (typeof deck)[number]) {
    if (isChecking || matchedIds.includes(deckCard.pairId) || openDeckIds.includes(deckCard.deckId)) return
    if (openDeckIds.length === 0) {
      setOpenDeckIds([deckCard.deckId])
      return
    }

    const firstDeckCard = deck.find((card) => card.deckId === openDeckIds[0])
    if (!firstDeckCard) {
      setOpenDeckIds([deckCard.deckId])
      return
    }

    setOpenDeckIds([firstDeckCard.deckId, deckCard.deckId])

    if (firstDeckCard.pairId === deckCard.pairId) {
      const nextMatchedIds = matchedIds.includes(deckCard.pairId) ? matchedIds : [...matchedIds, deckCard.pairId]
      setAnswers((current: any) => ({ ...current, [activity.id]: nextMatchedIds }))
      window.setTimeout(() => setOpenDeckIds([]), 250)
      if (nextMatchedIds.length >= cards.length) {
        scheduleAutoAdvance(onAutoAdvance, activity.id)
      }
      return
    }

    setIsChecking(true)
    window.setTimeout(() => {
      setOpenDeckIds([])
      setIsChecking(false)
    }, 850)
  }

  if (!cards.length) {
    return <p className="helper-text">Hoạt động lật thẻ chưa có ảnh.</p>
  }

  return (
    <div className="activity-playground memory-match-shell">
      <p className="activity-prompt">{prompt}</p>
      <div className="memory-match-grid" aria-label="Lưới lật thẻ ghi nhớ">
        {deck.map((deckCard) => {
          const isMatched = matchedIds.includes(deckCard.pairId)
          const isOpen = isMatched || openDeckIds.includes(deckCard.deckId)
          return (
            <button
              key={deckCard.deckId}
              type="button"
              className={isOpen ? 'memory-card memory-card-open' : 'memory-card'}
              onClick={() => handleCardClick(deckCard)}
              aria-pressed={isOpen}
              aria-label={isOpen ? deckCard.label : 'Thẻ đang úp'}
            >
              <span className="memory-card-inner">
                <span className="memory-card-face memory-card-back">?</span>
                <span className="memory-card-face memory-card-front">
                  <img src={deckCard.mediaUrl} alt={deckCard.label} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className={matchedIds.length >= cards.length ? 'feedback-note feedback-note-success' : 'feedback-note'}>
        Đã ghép {matchedIds.length}/{cards.length} cặp.
      </p>
    </div>
  )
})

export const QuickTapActivity = React.memo(({ activity, answers, setAnswers, onAutoAdvance }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Chạm nhanh vào các thẻ con vật trước khi hết giờ.'
  const cards = toImageChoiceCardArray(config.image_cards)
  const distractorCards = toImageChoiceCardArray(config.distractor_cards)
  const durationSeconds = Math.max(5, Number(config.duration_seconds ?? 10) || 10)
  const targetHits = Math.max(1, Number(config.target_hits ?? 6) || 6)
  const simultaneousCards = Math.max(1, Number(config.simultaneous_cards ?? 4) || 4)
  const spawnIntervalMs = Math.max(1000, Number(config.spawn_interval_ms ?? 1600) || 1600)
  const fallSpeedPercent = Math.max(1, Number(config.fall_speed_percent ?? 4) || 4)
  const fallDurationSeconds = Math.max(4.2, Number(config.fall_duration_seconds ?? (5.2 + Math.max(0, 6 - fallSpeedPercent) * 0.08)) || 5.2)
  const storedAnswer = toText(answers[activity.id])
  const completedHits = storedAnswer.startsWith('completed:') ? Number(storedAnswer.split(':')[1]) || 0 : 0
  const [isRunning, setIsRunning] = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState(durationSeconds)
  const [hits, setHits] = React.useState(completedHits)
  const [fallingCards, setFallingCards] = React.useState<QuickTapFallingCard[]>([])
  const hitsRef = React.useRef(hits)
  const spawnSeedRef = React.useRef(0)
  const cardInstanceRef = React.useRef(0)
  const removalTimeoutsRef = React.useRef<Record<string, number>>({})

  const clearFallingCards = React.useCallback(() => {
    Object.values(removalTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current = {}
    setFallingCards([])
  }, [])

  const spawnWave = React.useCallback(() => {
    if (!cards.length) return
    const seed = spawnSeedRef.current + 1
    spawnSeedRef.current = seed
    const nextCards: QuickTapVisibleCard[] = []
    const distractorVisibleCount = distractorCards.length ? Math.max(1, Math.floor(simultaneousCards / 3)) : 0
    const targetVisibleCount = Math.max(1, simultaneousCards - distractorVisibleCount)

    for (let index = 0; index < targetVisibleCount; index += 1) {
      const targetCard = cards[(seed + index) % cards.length]
      if (!targetCard) continue
      nextCards.push({
        ...targetCard,
        isTarget: true,
        slotKey: `target-${seed}-${targetCard.id}-${index}`,
      })
    }

    for (let index = 0; index < distractorVisibleCount; index += 1) {
      const distractorCard = distractorCards[(seed + index) % distractorCards.length]
      if (!distractorCard) continue
      nextCards.push({
        ...distractorCard,
        isTarget: false,
        slotKey: `distractor-${seed}-${distractorCard.id}-${index}`,
      })
    }

    const waveCards = nextCards
      .slice(0, simultaneousCards)
      .sort((left, right) => stableHash(left.slotKey) - stableHash(right.slotKey))
      .map((card, index) => {
        const slotKey = `${card.slotKey}-${cardInstanceRef.current + index}`
        return {
          ...card,
          slotKey,
          xPercent: 10 + (((index + seed * 3) * 17) % 78),
          durationSeconds: fallDurationSeconds + index * 0.12,
          tiltDeg: (((seed + index) % 7) - 3) * 4,
          delayMs: index * 180,
        }
      })

    cardInstanceRef.current += waveCards.length
    setFallingCards((currentCards) => [...currentCards, ...waveCards])
    waveCards.forEach((card) => {
      removalTimeoutsRef.current[card.slotKey] = window.setTimeout(() => {
        setFallingCards((currentCards) => currentCards.filter((currentCard) => currentCard.slotKey !== card.slotKey))
        delete removalTimeoutsRef.current[card.slotKey]
      }, card.durationSeconds * 1000 + card.delayMs + 180)
    })
  }, [cards, distractorCards, fallDurationSeconds, simultaneousCards])

  React.useEffect(() => {
    hitsRef.current = hits
  }, [hits])

  React.useEffect(() => {
    if (!isRunning) return undefined
    const intervalId = window.setInterval(() => {
      setTimeLeft((currentTimeLeft) => {
        if (currentTimeLeft <= 1) {
          window.clearInterval(intervalId)
          setIsRunning(false)
          clearFallingCards()
          setAnswers((current: any) => ({ ...current, [activity.id]: `completed:${hitsRef.current}` }))
          scheduleAutoAdvance(onAutoAdvance, activity.id)
          return 0
        }
        return currentTimeLeft - 1
      })
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [activity.id, clearFallingCards, isRunning, onAutoAdvance, setAnswers])

  React.useEffect(() => {
    if (!isRunning) return undefined
    const intervalId = window.setInterval(() => {
      spawnWave()
    }, spawnIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [isRunning, spawnIntervalMs, spawnWave])

  React.useEffect(() => () => {
    Object.values(removalTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
  }, [])

  function startRound() {
    setHits(0)
    hitsRef.current = 0
    setTimeLeft(durationSeconds)
    clearFallingCards()
    spawnSeedRef.current = 0
    setIsRunning(true)
    spawnWave()
    setAnswers((current: any) => {
      const nextAnswers = { ...current }
      delete nextAnswers[activity.id]
      return nextAnswers
    })
  }

  function finishRound(nextHits: number) {
    setIsRunning(false)
    clearFallingCards()
    setAnswers((current: any) => ({ ...current, [activity.id]: `completed:${nextHits}` }))
    scheduleAutoAdvance(onAutoAdvance, activity.id)
  }

  function handleTap(card: QuickTapFallingCard) {
    const timeoutId = removalTimeoutsRef.current[card.slotKey]
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      delete removalTimeoutsRef.current[card.slotKey]
    }
    setFallingCards((currentCards) => currentCards.filter((currentCard) => currentCard.slotKey !== card.slotKey))

    const isTarget = card.isTarget
    if (!isTarget) {
      return
    }

    if (!isRunning) {
      const firstHit = 1
      hitsRef.current = firstHit
      setHits(firstHit)
      setTimeLeft(durationSeconds)
      clearFallingCards()
      spawnSeedRef.current = 0
      setIsRunning(true)
      spawnWave()
      setAnswers((current: any) => {
        const nextAnswers = { ...current }
        delete nextAnswers[activity.id]
        return nextAnswers
      })
      if (firstHit >= targetHits) {
        finishRound(firstHit)
      }
      return
    }

    const nextHits = hitsRef.current + 1
    hitsRef.current = nextHits
    setHits(nextHits)
    if (nextHits >= targetHits) {
      finishRound(nextHits)
    }
  }

  if (!cards.length) {
    return <p className="helper-text">Hoạt động chạm nhanh chưa có ảnh.</p>
  }

  return (
    <div className="activity-playground quick-tap-shell">
      <p className="activity-prompt">{prompt}</p>
      <div className="quick-tap-score-row">
        <span>{timeLeft}s</span>
        <span>{hits}/{targetHits}</span>
      </div>
      <div className={isRunning ? 'quick-tap-stage quick-tap-stage-live' : 'quick-tap-stage'}>
        {fallingCards.map((card) => (
          <button
            key={card.slotKey}
            type="button"
            className={card.isTarget ? 'quick-tap-card' : 'quick-tap-card quick-tap-card-distractor'}
            style={{
              ['--quick-x' as string]: `${card.xPercent}%`,
              ['--quick-duration' as string]: `${card.durationSeconds}s`,
              ['--quick-tilt' as string]: `${card.tiltDeg}deg`,
              animationDelay: `${card.delayMs}ms`,
            }}
            onClick={() => handleTap(card)}
            aria-label={`Chạm ${card.label}`}
          >
            <img src={card.mediaUrl} alt={card.label} />
          </button>
        ))}
      </div>
      <button type="button" className="action-button quick-tap-start" onClick={startRound} disabled={isRunning}>
        {isRunning ? 'Đang chơi' : completedHits ? 'Chơi lại' : 'Bắt đầu'}
      </button>
      {storedAnswer.startsWith('completed:') ? (
        <p className={completedHits >= targetHits ? 'feedback-note feedback-note-success' : 'feedback-note feedback-note-warning'}>
          Lượt này em chạm được {completedHits}/{targetHits} thẻ.
        </p>
      ) : null}
    </div>
  )
})

export const SizeOrderActivity = React.memo(({ activity, answers, setAnswers, onAutoAdvance }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Sắp xếp các con vật từ bé đến lớn.'
  const items = toOrderedImageItemArray(config.items)
  const correctOrder: string[] = [...items].sort((left, right) => left.rank - right.rank).map((item) => item.id)
  const currentOrder: string[] = Array.isArray(answers[activity.id]) ? answers[activity.id].filter((item: unknown): item is string => typeof item === 'string') : []
  const [draggingItemId, setDraggingItemId] = React.useState<string | null>(null)
  const availableItems = items.filter((item) => !currentOrder.includes(item.id))
  const isCorrect = currentOrder.length === correctOrder.length && currentOrder.every((itemId, index) => itemId === correctOrder[index])

  function updateOrder(nextOrder: string[]) {
    setAnswers((current: any) => ({ ...current, [activity.id]: nextOrder }))
    if (nextOrder.length === correctOrder.length && nextOrder.every((itemId, index) => itemId === correctOrder[index])) {
      scheduleAutoAdvance(onAutoAdvance, activity.id)
    }
  }

  function placeItemAtIndex(itemId: string, index: number) {
    const sanitizedIndex = Math.max(0, Math.min(index, items.length - 1))
    const nextOrder = [...currentOrder]
    const existingIndex = nextOrder.indexOf(itemId)
    if (existingIndex >= 0) {
      nextOrder.splice(existingIndex, 1)
    }
    const replacedItemId = nextOrder[sanitizedIndex]
    nextOrder[sanitizedIndex] = itemId
    const compactOrder = nextOrder.filter(Boolean)
    if (replacedItemId && replacedItemId !== itemId && !compactOrder.includes(replacedItemId)) {
      compactOrder.push(replacedItemId)
    }
    updateOrder(compactOrder.slice(0, items.length))
  }

  if (!items.length) {
    return <p className="helper-text">Hoạt động sắp xếp chưa có ảnh.</p>
  }

  return (
    <div className="activity-playground size-order-shell">
      <p className="activity-prompt">{prompt}</p>
      <div className="size-order-pool" aria-label="Các con vật chưa xếp">
        {availableItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="size-order-animal-card"
            draggable
            onDragStart={(event) => {
              setDraggingItemId(item.id)
              event.dataTransfer.setData('text/plain', item.id)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => setDraggingItemId(null)}
            onClick={() => updateOrder([...currentOrder, item.id])}
          >
            <img src={item.mediaUrl} alt={item.label} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="size-order-slots" aria-label="Thứ tự từ bé đến lớn">
        {items.map((_, index) => {
          const item = items.find((candidate) => candidate.id === currentOrder[index])
          return (
            <button
              key={`${activity.id}-slot-${index}`}
              type="button"
              className={item ? 'size-order-slot size-order-slot-filled' : 'size-order-slot'}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const droppedItemId = event.dataTransfer.getData('text/plain') || draggingItemId
                if (droppedItemId) {
                  placeItemAtIndex(droppedItemId, index)
                }
                setDraggingItemId(null)
              }}
              onClick={() => updateOrder(currentOrder.filter((__, itemIndex) => itemIndex !== index))}
            >
              <span className="size-order-slot-label">{index === 0 ? 'Bé nhất' : index === items.length - 1 ? 'Lớn nhất' : `Vị trí ${index + 1}`}</span>
              {item ? (
                <>
                  <img
                    src={item.mediaUrl}
                    alt={item.label}
                    draggable
                    onDragStart={(event) => {
                      setDraggingItemId(item.id)
                      event.dataTransfer.setData('text/plain', item.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => setDraggingItemId(null)}
                  />
                  <strong>{item.label}</strong>
                </>
              ) : (
                <span>Chạm ảnh để xếp</span>
              )}
            </button>
          )
        })}
      </div>
      <p className={isCorrect ? 'feedback-note feedback-note-success' : currentOrder.length === items.length ? 'feedback-note feedback-note-warning' : 'feedback-note'}>
        {isCorrect ? 'Đúng thứ tự rồi.' : currentOrder.length === items.length ? 'Thứ tự chưa đúng, chạm vào ô để xếp lại nhé.' : `Đã xếp ${currentOrder.length}/${items.length} con vật.`}
      </p>
    </div>
  )
})

export const HabitatMatchActivity = React.memo(({ activity, answers, setAnswers, onAutoAdvance }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Nối con vật với nơi sống phù hợp.'
  const items = React.useMemo(() => toHabitatMatchItemArray(config.items), [config])
  const habitatOptions = React.useMemo(() => toHabitatOptionArray(config.habitat_cards, config.habitats), [config])
  const storedAnswers = Array.isArray(answers[activity.id]) ? answers[activity.id] : []
  const currentAnswers = items.map((__, index) => toText(storedAnswers[index]))
  const [activeItemIndex, setActiveItemIndex] = React.useState<number | null>(null)
  const [draggingItemIndex, setDraggingItemIndex] = React.useState<number | null>(null)
  const correctCount = currentAnswers.filter((answer: string, index: number) => answer === items[index]?.habitatId).length
  const isComplete = items.length > 0 && correctCount === items.length
  function updateMatch(index: number, habitatId: string) {
    const nextAnswers = [...currentAnswers]
    nextAnswers[index] = habitatId
    setAnswers((current: any) => ({ ...current, [activity.id]: nextAnswers }))
    if (nextAnswers.length >= items.length && nextAnswers.every((answer, answerIndex) => answer === items[answerIndex]?.habitatId)) {
      scheduleAutoAdvance(onAutoAdvance, activity.id)
    }
  }

  function connectActiveItem(habitatId: string) {
    if (activeItemIndex === null) return
    updateMatch(activeItemIndex, habitatId)
    setActiveItemIndex(null)
  }

  void draggingItemIndex
  void setDraggingItemIndex
  void connectActiveItem

  if (!items.length) {
    return <p className="helper-text">Hoạt động ghép nơi sống chưa có ảnh.</p>
  }

  return (
    <div className="activity-playground habitat-match-shell">
      <p className="activity-prompt">{prompt}</p>
      <div className="habitat-connect-board">
        {items.map((item, index) => (
          <label key={item.id} className="habitat-match-row">
            <span className="habitat-match-animal">
              <img src={item.mediaUrl} alt={item.label} />
              <strong>{item.label}</strong>
            </span>
            <select value={currentAnswers[index] ?? ''} onChange={(event) => updateMatch(index, event.target.value)}>
              <option value="">Chọn nơi sống</option>
              {habitatOptions.map((habitat) => (
                <option key={`${item.id}-${habitat.id}`} value={habitat.id}>{habitat.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className={isComplete ? 'feedback-note feedback-note-success' : 'feedback-note'}>
        Đúng {correctCount}/{items.length} con vật.
      </p>
    </div>
  )
})

export const HabitatConnectActivity = React.memo(({ activity, answers, setAnswers, onAutoAdvance }: ActivityComponentProps) => {
  const config = React.useMemo(() => parseActivityConfig(activity.config_json), [activity.config_json])
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Ná»‘i con váº­t vá»›i nÆ¡i sá»‘ng phÃ¹ há»£p.'
  const items = React.useMemo(() => toHabitatMatchItemArray(config.items), [config])
  const habitatOptions = React.useMemo(() => toHabitatOptionArray(config.habitat_cards, config.habitats), [config])
  const storedAnswers = Array.isArray(answers[activity.id]) ? answers[activity.id] : []
  const currentAnswers = items.map((__, index) => toText(storedAnswers[index]))
  const [activeItemIndex, setActiveItemIndex] = React.useState<number | null>(null)
  const [draggingItemIndex, setDraggingItemIndex] = React.useState<number | null>(null)
  const correctCount = currentAnswers.filter((answer: string, index: number) => answer === items[index]?.habitatId).length
  const isComplete = items.length > 0 && correctCount === items.length
  const boardRef = React.useRef<HTMLDivElement | null>(null)
  const animalRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const habitatRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const answerKey = currentAnswers.join('|')
  const [connectorLines, setConnectorLines] = React.useState<Array<{
    key: string
    x1: number
    y1: number
    x2: number
    y2: number
    isCorrect: boolean
  }>>([])

  React.useLayoutEffect(() => {
    function refreshLines() {
      const boardElement = boardRef.current
      if (!boardElement) return
      const boardRect = boardElement.getBoundingClientRect()
      const nextLines = items.flatMap((item, index) => {
        const habitatId = currentAnswers[index]
        if (!habitatId) return []
        const animalElement = animalRefs.current[index]
        const habitatElement = habitatRefs.current[habitatId]
        if (!animalElement || !habitatElement) return []
        const animalRect = animalElement.getBoundingClientRect()
        const habitatRect = habitatElement.getBoundingClientRect()
        return [{
          key: `${item.id}-${habitatId}`,
          x1: animalRect.right - boardRect.left + 8,
          y1: animalRect.top - boardRect.top + animalRect.height / 2,
          x2: habitatRect.left - boardRect.left - 8,
          y2: habitatRect.top - boardRect.top + habitatRect.height / 2,
          isCorrect: habitatId === item.habitatId,
        }]
      })
      setConnectorLines((currentLines) => {
        const isSame =
          currentLines.length === nextLines.length &&
          currentLines.every((line, index) => {
            const nextLine = nextLines[index]
            return (
              nextLine &&
              line.key === nextLine.key &&
              Math.abs(line.x1 - nextLine.x1) < 0.5 &&
              Math.abs(line.y1 - nextLine.y1) < 0.5 &&
              Math.abs(line.x2 - nextLine.x2) < 0.5 &&
              Math.abs(line.y2 - nextLine.y2) < 0.5 &&
              line.isCorrect === nextLine.isCorrect
            )
          })
        return isSame ? currentLines : nextLines
      })
    }

    refreshLines()
    const animationFrame = window.requestAnimationFrame(refreshLines)
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshLines) : null
    if (boardRef.current) {
      resizeObserver?.observe(boardRef.current)
    }
    window.addEventListener('resize', refreshLines)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', refreshLines)
    }
  }, [answerKey, habitatOptions.length, items])

  function updateMatch(index: number, habitatId: string) {
    const nextAnswers = [...currentAnswers]
    nextAnswers[index] = habitatId
    setAnswers((current: any) => ({ ...current, [activity.id]: nextAnswers }))
    if (nextAnswers.length >= items.length && nextAnswers.every((answer, answerIndex) => answer === items[answerIndex]?.habitatId)) {
      scheduleAutoAdvance(onAutoAdvance, activity.id)
    }
  }

  function connectActiveItem(habitatId: string) {
    if (activeItemIndex === null) return
    updateMatch(activeItemIndex, habitatId)
    setActiveItemIndex(null)
  }

  if (!items.length) {
    return <p className="helper-text">Hoáº¡t Ä‘á»™ng ghÃ©p nÆ¡i sá»‘ng chÆ°a cÃ³ áº£nh.</p>
  }

  return (
    <div className="activity-playground habitat-match-shell">
      <p className="activity-prompt">{prompt}</p>
      <div ref={boardRef} className="habitat-connect-board">
        <svg className="habitat-connect-svg" aria-hidden="true">
          <defs>
            <marker
              id={`habitat-arrow-${activity.id}`}
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L12,6 L0,12 z" fill="currentColor" />
            </marker>
          </defs>
          {connectorLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={line.isCorrect ? 'habitat-connect-svg-line habitat-connect-svg-line-correct' : 'habitat-connect-svg-line'}
              markerEnd={`url(#habitat-arrow-${activity.id})`}
            />
          ))}
        </svg>
        <div className="habitat-connect-column">
          <div className="habitat-connect-column-head">Cột A: Con vật</div>
          {items.map((item, index) => {
            const selectedHabitat = habitatOptions.find((option) => option.id === currentAnswers[index])
            return (
              <button
                ref={(element) => {
                  animalRefs.current[index] = element
                }}
                key={item.id}
                type="button"
                className={activeItemIndex === index ? 'habitat-connect-card habitat-connect-card-active' : 'habitat-connect-card'}
                draggable
                onDragStart={(event) => {
                  setDraggingItemIndex(index)
                  setActiveItemIndex(index)
                  event.dataTransfer.setData('text/plain', String(index))
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => setDraggingItemIndex(null)}
                onClick={() => setActiveItemIndex(index)}
              >
                <span className="habitat-connect-media">
                  <img src={item.mediaUrl} alt={item.label} />
                </span>
                <strong>{item.label}</strong>
                <span className="habitat-connect-arrow-hint">
                  {selectedHabitat ? `Da noi: ${selectedHabitat.label}` : 'Keo hoac cham de noi'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="habitat-connect-divider" aria-hidden="true" />

        <div className="habitat-connect-column">
          <div className="habitat-connect-column-head">Cột B: Nơi sống</div>
          {habitatOptions.map((habitat) => (
            <button
              ref={(element) => {
                habitatRefs.current[habitat.id] = element
              }}
              key={habitat.id}
              type="button"
              className="habitat-connect-card habitat-connect-card-habitat"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const rawDroppedIndex = event.dataTransfer.getData('text/plain')
                const droppedIndex = rawDroppedIndex ? Number(rawDroppedIndex) : NaN
                const resolvedIndex = Number.isInteger(droppedIndex) ? droppedIndex : draggingItemIndex
                if (resolvedIndex !== null && resolvedIndex >= 0) {
                  updateMatch(resolvedIndex, habitat.id)
                }
                setActiveItemIndex(null)
                setDraggingItemIndex(null)
              }}
              onClick={() => connectActiveItem(habitat.id)}
            >
              <span className="habitat-connect-media">
                {habitat.mediaUrl ? <img src={habitat.mediaUrl} alt={habitat.label} /> : <span className="habitat-connect-placeholder">{habitat.label}</span>}
              </span>
              <strong>{habitat.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <p className={isComplete ? 'feedback-note feedback-note-success' : 'feedback-note'}>
        ÄÃºng {correctCount}/{items.length} con váº­t.
      </p>
    </div>
  )
})

export const AACActivity = React.memo(({ activity, answers, setAnswers, onAutoAdvance }: ActivityComponentProps) => {
  const config = parseActivityConfig(activity.config_json)
  if (!config) return null
  const prompt = toText(config.prompt) || activity.instruction_text || 'Hãy chọn thẻ phù hợp.'
  const cards = toStringArray(config.cards)
  const imageCards = toImageChoiceCardArray(config.image_cards).slice(0, 4)
  const selectedCard = answers[activity.id] ?? ''
  const selectedImageCard = imageCards.find((card) => card.id === selectedCard) ?? null

  if (imageCards.length > 0) {
    return (
      <div className="activity-playground">
        <p>{prompt}</p>
        <div className="activity-option-grid aac-image-grid">
          {imageCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={selectedCard === card.id ? 'interactive-option aac-image-option interactive-option-active' : 'interactive-option aac-image-option'}
              aria-pressed={selectedCard === card.id}
              aria-label={card.label}
              onClick={() => {
                setAnswers((current: any) => ({ ...current, [activity.id]: card.id }))
                scheduleAutoAdvance(onAutoAdvance, activity.id)
              }}
            >
              <span className="aac-image-media">
                <img src={card.mediaUrl} alt={card.label} />
              </span>
            </button>
          ))}
        </div>
        {selectedImageCard ? <p className="feedback-note feedback-note-success">Em đang chọn: {selectedImageCard.label}</p> : null}
      </div>
    )
  }

  return (
    <div className="activity-playground">
      <p>{prompt}</p>
      <div className="activity-option-grid">
        {cards.map((card) => (
          <button
            key={card}
            type="button"
            className={selectedCard === card ? 'interactive-option interactive-option-active' : 'interactive-option'}
            aria-pressed={selectedCard === card}
            onClick={() => {
              setAnswers((current: any) => ({ ...current, [activity.id]: card }))
              scheduleAutoAdvance(onAutoAdvance, activity.id)
            }}
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

export const ActivityCard = React.memo(({
  activity,
  answers,
  setAnswers,
  presentationMode = 'standard',
  onAutoAdvance,
}: {
  activity: LessonActivityItem
  answers: any
  setAnswers: any
  presentationMode?: ActivityPresentationMode
  onAutoAdvance?: (activityId: number) => void
}) => {
  const activityType = activity.activity_type as ActivityType

  return (
    <div className="activity-card">
      <div className="student-row">
        <strong>{activity.sort_order}. {activity.title}</strong>
        <span>{activityLabel(activity.activity_type)}</span>
      </div>
      {activityType === 'multiple_choice' || activityType === 'image_choice' || activityType === 'listen_choose' ? (
        <MultipleChoiceActivity
          activity={activity}
          answers={answers.choiceAnswers}
          setAnswers={setAnswers.setChoiceAnswers}
          presentationMode={presentationMode}
          onAutoAdvance={onAutoAdvance}
        />
      ) : activityType === 'image_puzzle' ? (
        <ImagePuzzleActivity activity={activity} answers={answers.dragAnswers} setAnswers={setAnswers.setDragAnswers} presentationMode={presentationMode} />
      ) : activityType === 'memory_match' ? (
        <MemoryMatchActivity activity={activity} answers={answers.dragAnswers} setAnswers={setAnswers.setDragAnswers} onAutoAdvance={onAutoAdvance} />
      ) : activityType === 'quick_tap' ? (
        <QuickTapActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} onAutoAdvance={onAutoAdvance} />
      ) : activityType === 'size_order' ? (
        <SizeOrderActivity activity={activity} answers={answers.dragAnswers} setAnswers={setAnswers.setDragAnswers} onAutoAdvance={onAutoAdvance} />
      ) : activityType === 'habitat_match' ? (
        <HabitatConnectActivity activity={activity} answers={answers.matchingAnswers} setAnswers={setAnswers.setMatchingAnswers} onAutoAdvance={onAutoAdvance} />
      ) : activityType === 'matching' ? (
        <MatchingActivity activity={activity} answers={answers.matchingAnswers} setAnswers={setAnswers.setMatchingAnswers} />
      ) : activityType === 'drag_drop' ? (
        <DragDropActivity activity={activity} answers={answers.dragAnswers} setAnswers={setAnswers.setDragAnswers} />
      ) : activityType === 'watch_answer' ? (
        <WatchAnswerActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} presentationMode={presentationMode} />
      ) : activityType === 'hidden_image_guess' ? (
        <HiddenImageGuessActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} presentationMode={presentationMode} />
      ) : activityType === 'step_by_step' ? (
        <StepByStepActivity activity={activity} answers={answers.stepAnswers} setAnswers={setAnswers.setStepAnswers} />
      ) : activityType === 'aac' ? (
        <AACActivity
          activity={activity}
          answers={answers.aacSelections}
          setAnswers={setAnswers.setAacSelections}
          onAutoAdvance={onAutoAdvance}
        />
      ) : activityType === 'career_simulation' ? (
        <CareerSimulationActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} />
      ) : activityType === 'ai_chat' ? (
        <AIChatActivity activity={activity} answers={answers.textAnswers} setAnswers={setAnswers.setTextAnswers} />
      ) : (
        <p className="helper-text">Chưa có cấu hình.</p>
      )}
    </div>
  )
})
