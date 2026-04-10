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

const activityInteractionHintMap: Record<string, string> = {
  multiple_choice: 'Cách làm: Đọc câu hỏi rồi chạm vào một đáp án em cho là đúng.',
  image_choice: 'Cách làm: Nhìn kỹ hình ảnh, vuốt nếu cần, rồi bấm chọn đúng ảnh phù hợp.',
  image_puzzle: 'Cách làm: Kéo thả từng mảnh ảnh vào vị trí đúng để ghép thành bức tranh hoàn chỉnh.',
  matching: 'Cách làm: Chọn từng ô để nối các cặp đúng với nhau.',
  drag_drop: 'Cách làm: Gắn mỗi mục vào vị trí phù hợp.',
  listen_choose: 'Cách làm: Nghe xong rồi chạm vào đáp án đúng.',
  watch_answer: 'Cách làm: Xem xong rồi nói hoặc viết câu trả lời theo hướng dẫn.',
  hidden_image_guess: 'Cách làm: Chạm mở từng ô đen, đoán vật trong ảnh, rồi bấm mic để nói đáp án.',
  step_by_step: 'Cách làm: Làm lần lượt từng bước và đánh dấu khi xong.',
  aac: 'Cách làm: Chạm vào thẻ giao tiếp phù hợp với điều em muốn nói.',
  career_simulation: 'Cách làm: Đọc tình huống rồi trả lời em sẽ làm gì.',
  ai_chat: 'Cách làm: Trả lời từng câu ngắn gọn để trợ lý tiếp tục hỏi đáp.',
}

function activityLabel(activityType: string) {
  return activityTypeLabelMap[activityType] ?? activityType
}

function activityInteractionHint(activity: LessonActivityItem, config: Record<string, unknown> | null) {
  if (activity.activity_type === 'image_choice' && toText(config?.image_selection_mode) === 'carousel_find') {
    return 'Cách làm: Bấm mũi tên trái phải hoặc vuốt ngang để xem từng ảnh, thấy đúng ảnh thì bấm chọn.'
  }
  if (activity.activity_type === 'watch_answer' && toText(config?.answer_mode) === 'voice_ai_grade') {
    return 'Cách làm: Xem video xong bấm mic, nói câu trả lời, rồi chờ AI chấm.'
  }
  return activityInteractionHintMap[activity.activity_type] ?? 'Cách làm: Làm theo hướng dẫn hiện trên thẻ bài học.'
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
}

function CarouselImageChoiceActivity({
  activity,
  prompt,
  cards,
  correct,
  selectedChoice,
  setAnswers,
  presentationMode = 'standard',
}: {
  activity: LessonActivityItem
  prompt: string
  cards: ImageChoiceCard[]
  correct: string
  selectedChoice: string
  setAnswers: (fn: (prev: any) => any) => void
  presentationMode?: ActivityPresentationMode
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
                onClick={() => setAnswers((current: any) => ({ ...current, [activity.id]: card.id }))}
              >
                {selectedChoice === card.id ? 'Đã chọn ảnh này' : 'Chọn ảnh này'}
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
          >
            {isListening ? 'Dừng ghi âm' : 'Trả lời bằng mic'}
          </button>
          <button
            type="button"
            className="ghost-button voice-answer-button"
            onClick={() => void submitVoiceAnswer(answer)}
            disabled={!answer.trim() || isGrading || !token || !expectedAnswer}
          >
            {isGrading ? 'AI đang chấm...' : 'Chấm lại bằng AI'}
          </button>
        </div>

        <div className="voice-answer-status-row">
          <span className={isListening ? 'voice-answer-chip voice-answer-chip-live' : 'voice-answer-chip'}>
            {isListening ? 'Đang nghe em nói...' : supportsSpeechRecognition ? 'Sẵn sàng nghe em nói' : 'Trình duyệt không hỗ trợ mic'}
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
  const config = parseActivityConfig(activity.config_json)
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

export const MultipleChoiceActivity = React.memo(({ activity, answers, setAnswers, presentationMode = 'standard' }: ActivityComponentProps) => {
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

export const ActivityCard = React.memo(({
  activity,
  answers,
  setAnswers,
  presentationMode = 'standard',
}: {
  activity: LessonActivityItem
  answers: any
  setAnswers: any
  presentationMode?: ActivityPresentationMode
}) => {
  const activityType = activity.activity_type as ActivityType
  const config = parseActivityConfig(activity.config_json)
  const interactionHint = activityInteractionHint(activity, config)

  return (
    <div className="activity-card">
      <div className="student-row">
        <strong>{activity.sort_order}. {activity.title}</strong>
        <span>{activityLabel(activity.activity_type)} {activity.voice_answer_enabled ? '/ giọng nói' : ''}</span>
      </div>
      <p>{activity.instruction_text ?? 'Chưa có hướng dẫn.'}</p>
      <p className="activity-guidance">{interactionHint}</p>
      {activityType === 'multiple_choice' || activityType === 'image_choice' || activityType === 'listen_choose' ? (
        <MultipleChoiceActivity activity={activity} answers={answers.choiceAnswers} setAnswers={setAnswers.setChoiceAnswers} presentationMode={presentationMode} />
      ) : activityType === 'image_puzzle' ? (
        <ImagePuzzleActivity activity={activity} answers={answers.dragAnswers} setAnswers={setAnswers.setDragAnswers} presentationMode={presentationMode} />
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
