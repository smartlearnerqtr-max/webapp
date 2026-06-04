import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAssignment,
  createLesson,
  createLessonActivity,
  deleteLesson,
  fetchClasses,
  fetchLesson,
  fetchLessons,
  fetchSubjects,
  generateLessonQuestionDraft,
  updateLesson,
  updateLessonActivity,
  type ClassItem,
  type LessonActivityItem,
  type LessonItem,
  type LessonQuestionDraftSuggestion,
  type SubjectItem,
  uploadLessonMedia,
} from '../services/api'
import { ActivityCard } from '../components/activities/ActivityRenderer'
import { useAuthStore } from '../store/authStore'
import { RequireAuth } from '../components/RequireAuth'
import styles from './LessonCreationWizard.module.css'
import {
  SUBJECT_TEMPLATES,
  type ActivityTemplate as TemplateActivityTemplate,
  type InteractionType,
  type LessonLevel,
  type StepItem,
} from '../data/lessonTemplates'

type ActivityMediaKind = 'image' | 'video'
type UploadableMediaKind = ActivityMediaKind | 'audio'
type TeacherActivityType =
  | 'multiple_choice'
  | 'image_choice'
  | 'image_puzzle'
  | 'listen_choose'
  | 'matching'
  | 'drag_drop'
  | 'watch_answer'
  | 'step_by_step'
  | 'aac'

type AnswerMode = 'text' | 'voice_ai_grade' | 'none'

interface EnhancedStepItem extends StepItem {
  media_file?: File | null
  media_url?: string
  media_kind?: 'image' | 'audio' | 'video' | 'animation' | '3d' | 'ai_camera'
  options?: string[]
  correct_option?: number
}

interface ChoiceCardDraft {
  id: string
  label: string
  media_url: string
  media_kind: ActivityMediaKind | ''
}

interface MatchingPairDraft {
  left: string
  right: string
}

interface ActivityDraft {
  id?: number
  title: string
  activity_type: TeacherActivityType | 'exercise' | 'activity'
  interaction_type?: InteractionType | 'ai_camera' | '3d_interaction' | 'voice_ai'
  objective: string
  steps: EnhancedStepItem[]
  is_mandatory?: boolean
  prompt: string
  audio_text: string
  audio_url: string
  audio_lang: string
  media_url: string
  media_kind: ActivityMediaKind | ''
  puzzle_rows: number
  puzzle_cols: number
  text_choices: string[]
  correct_choice: string
  choice_cards: ChoiceCardDraft[]
  matching_pairs: MatchingPairDraft[]
  drag_items: string[]
  drag_targets: string[]
  visual_style: string
  step_items: string[]
  answer_mode: AnswerMode
  expected_answer: string
  accepted_answers: string[]
  aac_cards: string[]
  aac_image_cards: ChoiceCardDraft[]
  suggested_steps: EnhancedStepItem[]
  is_approved?: boolean
}

interface LessonDraft {
  subject_id?: number
  subject_name?: string
  class_id?: number
  class_name?: string
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

function isLessonLevel(value: string): value is LessonLevel {
  return value === 'nang' || value === 'trung_binh' || value === 'nhe'
}

const STEP_CONTENT_TYPES = [
  { value: 'display', label: '📺 Hiển thị (Ảnh/Video)' },
  { value: 'audio', label: '🔊 Âm thanh (Lời giảng/Câu hỏi)' },
  { value: 'interaction', label: '🖱️ Tương tác (Kéo thả/Chạm)' },
  { value: 'ai_camera', label: '🤖 AI Camera (Vận động)' },
  { value: '3d', label: '🧊 Vật thể 3D (Xoay/Chạm)' },
  { value: 'voice', label: '🎙️ Nhận diện giọng nói' },
  { value: 'feedback', label: '🎉 Phản hồi (Khen ngợi/Nhắc nhở)' },
]

const TEACHER_ACTIVITY_TYPE_OPTIONS: Array<{ value: TeacherActivityType; label: string; hint: string }> = [
  { value: 'image_choice', label: 'Nhìn ảnh chọn đúng', hint: 'Phù hợp chọn hình, trắc nghiệm bằng ảnh.' },
  { value: 'image_puzzle', label: 'Ghép ảnh', hint: 'Ghép các mảnh ảnh để hoàn thành một hình đơn giản.' },
  { value: 'listen_choose', label: 'Nghe và chọn', hint: 'Có câu hỏi audio hoặc TTS rồi chọn đáp án.' },
  { value: 'multiple_choice', label: 'Trắc nghiệm / Đúng sai', hint: 'Chọn đáp án bằng chữ hoặc đúng sai.' },
  { value: 'drag_drop', label: 'Kéo thả phân loại', hint: 'Kéo mục vào nhóm hoặc vị trí phù hợp.' },
  { value: 'matching', label: 'Nối cặp', hint: 'Ghép trái - phải theo cặp đúng.' },
  { value: 'step_by_step', label: 'Từng bước / Quy trình', hint: 'Liệt kê các bước và học sinh làm lần lượt.' },
  { value: 'watch_answer', label: 'Video tương tác', hint: 'Xem media rồi trả lời hoặc xác nhận đã xong.' },
  { value: 'aac', label: 'Thẻ giao tiếp', hint: 'Chọn thẻ chữ hoặc thẻ hình để phản hồi.' },
]

const TEACHER_ACTIVITY_TYPE_LABEL_MAP = Object.fromEntries(
  TEACHER_ACTIVITY_TYPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<TeacherActivityType, string>

const SUPPORTED_TEACHER_ACTIVITY_TYPES = new Set<TeacherActivityType>(TEACHER_ACTIVITY_TYPE_OPTIONS.map((item) => item.value))

function makeDraftId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function createChoiceCardDraft(label = ''): ChoiceCardDraft {
  return {
    id: makeDraftId('card'),
    label,
    media_url: '',
    media_kind: '',
  }
}

function createMatchingPairDraft(): MatchingPairDraft {
  return { left: '', right: '' }
}

function createPresetChoiceCard(id: string, label: string, mediaUrl: string, mediaKind: ActivityMediaKind = 'image'): ChoiceCardDraft {
  return {
    id,
    label,
    media_url: mediaUrl,
    media_kind: mediaKind,
  }
}

function cleanAIString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanAIStringList(value: unknown, fallback: string[] = ['']) {
  if (!Array.isArray(value)) return fallback
  const items = value.map((item) => cleanAIString(item)).filter(Boolean)
  return items.length ? items : fallback
}

function slugChoiceId(value: string, fallback: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function normalizeAIChoiceCards(value: unknown, prefix: string): ChoiceCardDraft[] {
  if (!Array.isArray(value)) return [createChoiceCardDraft('Lua chon 1'), createChoiceCardDraft('Lua chon 2')]
  const cards = value
    .map((item, index): ChoiceCardDraft | null => {
      if (!item || typeof item !== 'object') return null
      const rawItem = item as { id?: unknown; label?: unknown; media_url?: unknown; media_kind?: unknown }
      const label = cleanAIString(rawItem.label) || `Lua chon ${index + 1}`
      const id = slugChoiceId(cleanAIString(rawItem.id) || label, `${prefix}-${index + 1}`)
      const mediaKind = cleanAIString(rawItem.media_kind)
      return {
        id,
        label,
        media_url: cleanAIString(rawItem.media_url),
        media_kind: mediaKind === 'image' || mediaKind === 'video' ? mediaKind : 'image',
      } satisfies ChoiceCardDraft
    })
    .filter((item): item is ChoiceCardDraft => item !== null)
  return cards.length ? cards : [createChoiceCardDraft('Lua chon 1'), createChoiceCardDraft('Lua chon 2')]
}

function mergeAIChoiceCards(existingCards: ChoiceCardDraft[], suggestionValue: unknown, prefix: string): ChoiceCardDraft[] {
  const suggestedCards = normalizeAIChoiceCards(suggestionValue, prefix)
  if (!existingCards.some((card) => card.media_url.trim())) return suggestedCards

  return existingCards.map((card, index) => {
    const suggestion = suggestedCards[index]
    return {
      ...card,
      label: suggestion?.label?.trim() || card.label,
    }
  })
}

function normalizeAIMatchingPairs(value: unknown) {
  if (!Array.isArray(value)) return [createMatchingPairDraft(), createMatchingPairDraft()]
  const pairs = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const rawItem = item as { left?: unknown; right?: unknown }
      const left = cleanAIString(rawItem.left)
      const right = cleanAIString(rawItem.right)
      return left || right ? { left, right } : null
    })
    .filter((item): item is MatchingPairDraft => item !== null)
  return pairs.length ? pairs : [createMatchingPairDraft(), createMatchingPairDraft()]
}

function resolveAICorrectChoiceForCards(rawCorrectChoice: string, cards: ChoiceCardDraft[]) {
  if (!cards.length) return ''
  const normalizedCorrect = rawCorrectChoice.trim().toLowerCase()
  const matchedCard = cards.find((card) => (
    card.id.toLowerCase() === normalizedCorrect || card.label.trim().toLowerCase() === normalizedCorrect
  ))
  return matchedCard?.id ?? cards[0].id
}

function getAISuggestionCards(suggestion: LessonQuestionDraftSuggestion) {
  const cards = Array.isArray(suggestion.choice_cards) ? suggestion.choice_cards : []
  return cards
    .map((card, index) => ({
      id: cleanAIString(card.id) || `card-${index + 1}`,
      label: cleanAIString(card.label) || `Lựa chọn ${index + 1}`,
      media_url: cleanAIString(card.media_url),
      media_kind: cleanAIString(card.media_kind),
    }))
    .filter((card) => card.label || card.media_url)
}

function getAISuggestionAnswerText(suggestion: LessonQuestionDraftSuggestion) {
  const correctChoice = cleanAIString(suggestion.correct_choice)
  if (!correctChoice) return ''
  const matchedCard = getAISuggestionCards(suggestion).find((card) => card.id === correctChoice || card.label === correctChoice)
  return matchedCard?.label || correctChoice
}

function isStructuredLessonLevel(level?: LessonLevel) {
  return level === 'nhe' || level === 'trung_binh' || level === 'nang'
}

function shouldApplyAISuggestionMedia(activity: ActivityDraft, suggestionMediaUrl: string) {
  if (!suggestionMediaUrl) return false
  const currentMediaUrl = activity.media_url.trim()
  if (!currentMediaUrl) return activity.activity_type === 'image_puzzle'
  return !currentMediaUrl.startsWith('/lesson-media/')
}

function isLightMathStepLabUrl(mediaUrl: string) {
  return mediaUrl.includes('/lesson-media/nhe/light-lab.html') && mediaUrl.includes('activity=toan-step')
}

function isLightMathShapeLabUrl(mediaUrl: string) {
  return (
    (mediaUrl.includes('/lesson-media/nhe/light-lab.html') && mediaUrl.includes('activity=toan-prism'))
    || mediaUrl.includes('/lesson-media/nhe/shape-prism-3d.html')
  )
}

function getAISuggestionMathNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : null
}

function getAISuggestionMathOperation(value: unknown) {
  const operation = cleanAIString(value)
  return operation === '+' || operation === '-' || operation === 'x' || operation === ':' ? operation : ''
}

function buildMathStepLabUrl(activity: ActivityDraft, suggestion: LessonQuestionDraftSuggestion) {
  const currentMediaUrl = activity.media_url.trim()
  if (!isLightMathStepLabUrl(currentMediaUrl)) return ''

  const left = getAISuggestionMathNumber(suggestion.math_left)
  const right = getAISuggestionMathNumber(suggestion.math_right)
  const operation = getAISuggestionMathOperation(suggestion.math_operation)
  const groupLabel = cleanAIString(suggestion.math_group_label)
  const itemLabel = cleanAIString(suggestion.math_item_label)
  if (!left && !right && !operation && !groupLabel && !itemLabel) return ''

  try {
    const url = new URL(currentMediaUrl, window.location.origin)
    if (left) url.searchParams.set('left', String(left))
    if (right) url.searchParams.set('right', String(right))
    if (operation) url.searchParams.set('operation', operation)
    if (groupLabel) url.searchParams.set('groupLabel', groupLabel)
    if (itemLabel) url.searchParams.set('itemLabel', itemLabel)
    return `${url.pathname}?${url.searchParams.toString()}`
  } catch {
    const params = new URLSearchParams()
    params.set('activity', 'toan-step')
    if (left) params.set('left', String(left))
    if (right) params.set('right', String(right))
    if (operation) params.set('operation', operation)
    if (groupLabel) params.set('groupLabel', groupLabel)
    if (itemLabel) params.set('itemLabel', itemLabel)
    return `/lesson-media/nhe/light-lab.html?${params.toString()}`
  }
}

function getAISuggestionShapeModel(value: unknown) {
  const model = cleanAIString(value)
  return model === 'cube' || model === 'prism' ? model : ''
}

function getAISuggestionShapeFocus(value: unknown) {
  const focus = cleanAIString(value)
  return focus === 'vertices' || focus === 'edges' || focus === 'faces' ? focus : ''
}

function buildMathShapeLabUrl(activity: ActivityDraft, suggestion: LessonQuestionDraftSuggestion) {
  const currentMediaUrl = activity.media_url.trim()
  if (!isLightMathShapeLabUrl(currentMediaUrl)) return ''

  const shapeModel = getAISuggestionShapeModel(suggestion.shape_model)
  const shapeFocus = getAISuggestionShapeFocus(suggestion.shape_focus)
  const title = cleanAIString(suggestion.title)
  const prompt = cleanAIString(suggestion.prompt)
  if (!shapeModel && !shapeFocus && !title && !prompt) return ''

  const params = new URLSearchParams()
  params.set('shape', shapeModel || (currentMediaUrl.includes('shape=cube') ? 'cube' : 'prism'))
  if (shapeFocus) params.set('focus', shapeFocus)
  if (title) params.set('title', title)
  if (prompt) params.set('prompt', prompt)
  return `/lesson-media/nhe/shape-prism-3d.html?${params.toString()}`
}

function buildDynamicLocalLabUrl(activity: ActivityDraft, suggestion: LessonQuestionDraftSuggestion) {
  const currentMediaUrl = activity.media_url.trim()
  if (!currentMediaUrl.startsWith('/lesson-media/') || !currentMediaUrl.includes('.html')) return ''

  const title = cleanAIString(suggestion.title)
  const prompt = cleanAIString(suggestion.prompt)
  const example = cleanAIString(suggestion.example)
  if (!title && !prompt && !example) return ''

  try {
    const url = new URL(currentMediaUrl, window.location.origin)
    if (title) url.searchParams.set('title', title)
    if (prompt) url.searchParams.set('prompt', prompt)
    if (example) url.searchParams.set('example', example)
    url.searchParams.set('variant', String(Date.now()))
    return `${url.pathname}?${url.searchParams.toString()}`
  } catch {
    return currentMediaUrl
  }
}

function applyLessonQuestionSuggestion(activity: ActivityDraft, suggestion: LessonQuestionDraftSuggestion): ActivityDraft {
  const nextType = isTeacherActivityType(activity.activity_type) ? activity.activity_type : 'multiple_choice'
  const textChoices = cleanAIStringList(suggestion.text_choices, activity.text_choices.length ? activity.text_choices : ['', ''])
  const choiceCards = mergeAIChoiceCards(activity.choice_cards, suggestion.choice_cards, 'choice')
  const aacImageCards = mergeAIChoiceCards(activity.aac_image_cards, suggestion.aac_image_cards, 'aac')
  const suggestionMediaUrl = cleanAIString(suggestion.media_url)
  const suggestionMediaKind = cleanAIString(suggestion.media_kind)
  const shouldApplyMedia = shouldApplyAISuggestionMedia(activity, suggestionMediaUrl)
  const mathStepLabUrl = buildMathStepLabUrl(activity, suggestion)
  const mathShapeLabUrl = buildMathShapeLabUrl(activity, suggestion)
  const dynamicLocalLabUrl = buildDynamicLocalLabUrl(activity, suggestion)
  const answerMode = cleanAIString(suggestion.answer_mode)

  let correctChoice = cleanAIString(suggestion.correct_choice) || activity.correct_choice
  if (nextType === 'multiple_choice') {
    if (choiceCards.some((card) => card.media_url.trim())) {
      correctChoice = resolveAICorrectChoiceForCards(correctChoice, choiceCards)
    } else {
      correctChoice = textChoices.includes(correctChoice) ? correctChoice : textChoices[0] || ''
    }
  }
  if (nextType === 'image_choice' || nextType === 'listen_choose') {
    correctChoice = resolveAICorrectChoiceForCards(correctChoice, choiceCards)
  }

  return {
    ...activity,
    activity_type: nextType,
    title: cleanAIString(suggestion.title) || activity.title,
    objective: cleanAIString(suggestion.objective) || activity.objective,
    prompt: cleanAIString(suggestion.prompt) || activity.prompt,
    audio_text: cleanAIString(suggestion.audio_text) || activity.audio_text,
    audio_url: cleanAIString(suggestion.audio_url) || activity.audio_url,
    audio_lang: cleanAIString(suggestion.audio_lang) || activity.audio_lang || 'vi-VN',
    media_url: mathStepLabUrl || mathShapeLabUrl || dynamicLocalLabUrl || (shouldApplyMedia ? suggestionMediaUrl : activity.media_url),
    media_kind: mathStepLabUrl || mathShapeLabUrl || dynamicLocalLabUrl ? '' : shouldApplyMedia && (suggestionMediaKind === 'image' || suggestionMediaKind === 'video') ? suggestionMediaKind : activity.media_kind,
    puzzle_rows: Number(suggestion.puzzle_rows) || activity.puzzle_rows || 1,
    puzzle_cols: Number(suggestion.puzzle_cols) || activity.puzzle_cols || 2,
    text_choices: textChoices,
    correct_choice: correctChoice,
    choice_cards: choiceCards,
    matching_pairs: normalizeAIMatchingPairs(suggestion.matching_pairs),
    drag_items: cleanAIStringList(suggestion.drag_items, activity.drag_items.length ? activity.drag_items : ['']),
    drag_targets: cleanAIStringList(suggestion.drag_targets, activity.drag_targets.length ? activity.drag_targets : ['']),
    visual_style: cleanAIString(suggestion.visual_style) || activity.visual_style,
    step_items: cleanAIStringList(suggestion.step_items, activity.step_items.length ? activity.step_items : ['']),
    answer_mode: answerMode === 'text' || answerMode === 'voice_ai_grade' || answerMode === 'none' ? answerMode : activity.answer_mode,
    expected_answer: cleanAIString(suggestion.expected_answer) || activity.expected_answer,
    accepted_answers: cleanAIStringList(suggestion.accepted_answers, activity.accepted_answers.length ? activity.accepted_answers : ['']),
    aac_cards: cleanAIStringList(suggestion.aac_cards, activity.aac_cards.length ? activity.aac_cards : ['']),
    aac_image_cards: aacImageCards,
    is_approved: false,
  }
}

function normalizeSubjectLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const SUBJECT_LOOKUP_CANONICAL_MAP: Record<string, string> = {
  'nghe thuat am nhac': 'am nhac',
  'am nhac': 'am nhac',
  'nghe thuat mi thuat': 'my thuat',
  'nghe thuat mi thuat)': 'my thuat',
  'my thuat': 'my thuat',
  'giao duc dia phuong': 'giao duc dia phuong',
  'giao duc dia phuong)': 'giao duc dia phuong',
  'hd trai nghiem huong nghiep': 'hoat dong trai nghiem',
  'hoat dong trai nghiem': 'hoat dong trai nghiem',
  'lich su dia li': 'lich su dia ly',
  'lich su dia ly': 'lich su dia ly',
}

function canonicalSubjectLookup(value: string) {
  const lookup = normalizeSubjectLookup(value)
  return SUBJECT_LOOKUP_CANONICAL_MAP[lookup] ?? lookup
}

function findSubjectTemplate<T extends { subject_id: number; subject_name: string }>(
  templates: T[],
  subjectId?: number,
  subjectName?: string,
) {
  const selectedLookup = canonicalSubjectLookup(subjectName ?? '')
  if (selectedLookup) {
    const exactNameMatch = templates.find((template) => canonicalSubjectLookup(template.subject_name) === selectedLookup)
    if (exactNameMatch) return exactNameMatch

    return templates.find((template) => {
      const templateLookup = canonicalSubjectLookup(template.subject_name)
      return templateLookup.includes(selectedLookup) || selectedLookup.includes(templateLookup)
    })
  }

  return subjectId ? templates.find((template) => template.subject_id === subjectId) : undefined
}

function createCommonActivityDraft() {
  return {
    prompt: '',
    audio_text: '',
    audio_url: '',
    audio_lang: 'vi-VN',
    media_url: '',
    media_kind: '' as ActivityMediaKind | '',
    puzzle_rows: 1,
    puzzle_cols: 2,
    text_choices: ['', ''],
    correct_choice: '',
    choice_cards: [createChoiceCardDraft('Lựa chọn 1'), createChoiceCardDraft('Lựa chọn 2')],
    matching_pairs: [createMatchingPairDraft(), createMatchingPairDraft()],
    drag_items: ['', ''],
    drag_targets: ['', ''],
    visual_style: '',
    step_items: ['', ''],
    answer_mode: 'text' as AnswerMode,
    expected_answer: '',
    accepted_answers: [],
    aac_cards: ['', ''],
    aac_image_cards: [createChoiceCardDraft('Thẻ 1'), createChoiceCardDraft('Thẻ 2')],
    suggested_steps: [] as EnhancedStepItem[],
  }
}

function extractQuotedText(value: string) {
  const straightMatch = value.match(/"([^"]+)"/)
  if (straightMatch?.[1]) return straightMatch[1]
  const curlyMatch = value.match(/“([^”]+)”/)
  return curlyMatch?.[1] ?? ''
}

function extractPromptFromTemplate(templateActivity: TemplateActivityTemplate) {
  const audioStep = templateActivity.steps.find((step) => step.content_type === 'audio')
  const directQuestion = audioStep?.description ? extractQuotedText(audioStep.description) : ''
  if (directQuestion) return directQuestion

  const interactionStep = templateActivity.steps.find((step) => step.content_type === 'interaction')
  const interactionQuestion = interactionStep?.description ? extractQuotedText(interactionStep.description) : ''
  if (interactionQuestion) return interactionQuestion

  return templateActivity.title
}

function detectStructuredActivityType(templateActivity: TemplateActivityTemplate, subjectName: string, isMandatory: boolean): TeacherActivityType {
  const lookup = `${subjectName} ${templateActivity.title} ${templateActivity.objective} ${templateActivity.steps.map((step) => step.description).join(' ')}`.toLowerCase()

  if (lookup.includes('video') || lookup.includes('clip')) return 'watch_answer'
  if (lookup.includes('sơ đồ') || lookup.includes('quy trình') || lookup.includes('thứ tự')) return 'step_by_step'
  if (lookup.includes('nối') || lookup.includes('ghép cặp')) return 'matching'
  if (lookup.includes('ghép 2 mảnh') || lookup.includes('ghép 2 manh') || lookup.includes('mảnh') || lookup.includes('manh')) return 'image_puzzle'
  if (lookup.includes('thẻ') && lookup.includes('giao tiếp')) return 'aac'
  if (templateActivity.interaction_type === 'drag') return 'drag_drop'
  if (subjectName.toLowerCase().includes('tiếng anh') || lookup.includes('listen') || lookup.includes('nghe')) return 'listen_choose'
  if (lookup.includes('đúng/sai') || lookup.includes('đúng hay sai')) return 'multiple_choice'
  if (!isMandatory) return 'step_by_step'
  return 'image_choice'
}

function buildStructuredDraftFromTemplate(templateActivity: TemplateActivityTemplate, subjectName: string, isMandatory: boolean): ActivityDraft {
  const detectedType = detectStructuredActivityType(templateActivity, subjectName, isMandatory)
  const prompt = extractPromptFromTemplate(templateActivity)
  const common = createCommonActivityDraft()
  const audioText = templateActivity.steps.find((step) => step.content_type === 'audio')?.description ?? ''
  const suggestedSteps = templateActivity.steps.map((step) => ({ ...step, media_kind: step.content_type as EnhancedStepItem['media_kind'] }))

  const draft: ActivityDraft = {
    title: templateActivity.title,
    activity_type: detectedType,
    interaction_type: templateActivity.interaction_type,
    objective: templateActivity.objective,
    steps: suggestedSteps,
    is_mandatory: isMandatory,
    ...common,
    prompt,
    audio_text: audioText.includes('"') ? extractQuotedText(audioText) : '',
    suggested_steps: suggestedSteps,
  }

  if (detectedType === 'multiple_choice' && prompt.toLowerCase().includes('đúng')) {
    draft.text_choices = ['Đúng', 'Sai']
    draft.correct_choice = 'Đúng'
  }

  if (detectedType === 'step_by_step') {
    draft.step_items = templateActivity.steps.map((step) => step.description)
  }

  if (detectedType === 'watch_answer') {
    draft.answer_mode = 'none'
    draft.step_items = templateActivity.steps.map((step) => step.description)
  }

  if (detectedType === 'drag_drop' && (subjectName.toLowerCase().includes('toán') || subjectName.toLowerCase().includes('toan'))) {
    draft.visual_style = 'shape_3d'
  }

  return draft
}

function buildMediumActivityDrafts(template: {
  subject_name: string
  h1: TemplateActivityTemplate
  h2: TemplateActivityTemplate
}): ActivityDraft[] {
  const firstDraft = buildStructuredDraftFromTemplate(template.h1, template.subject_name, true)
  const secondDraft = buildStructuredDraftFromTemplate(template.h2, template.subject_name, false)
  const subjectKey = canonicalSubjectLookup(template.subject_name)

  switch (subjectKey) {
    case 'ngu van':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Ai đang ngồi ở đáy giếng?',
          choice_cards: [
            createPresetChoiceCard('frog', 'Con ếch', '/lesson-media/trung-binh/frog-card.svg'),
            createPresetChoiceCard('turtle', 'Con rùa', '/lesson-media/trung-binh/turtle-card.svg'),
          ],
          correct_choice: 'frog',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Kéo các ý chính vào sơ đồ để hoàn thành cốt truyện.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=ngu-van-mindmap',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'toan hoc':
      return [
        {
          ...firstDraft,
          activity_type: 'drag_drop',
          prompt: 'Kéo từng đồ vật vào đúng nhóm hình học của nó.',
          drag_items: ['Kim tự tháp', 'Cái lều', 'Tủ lạnh', 'Hộp sữa'],
          drag_targets: ['Hình chóp', 'Hình lăng trụ'],
          visual_style: 'shape_3d',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Đưa đủ 4 xu vào máy tính tiền để mua 2 cái kẹo.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=toan-coins',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'tieng anh':
      return [
        {
          ...firstDraft,
          activity_type: 'listen_choose',
          prompt: 'Nghe thật kỹ rồi chọn đúng phương tiện.',
          choice_cards: [
            createPresetChoiceCard('bus', 'Bus', '/lesson-media/trung-binh/bus-card.svg'),
            createPresetChoiceCard('bicycle', 'Bicycle', '/lesson-media/trung-binh/bicycle-card.svg'),
          ],
          correct_choice: 'bus',
          audio_text: 'Bus',
          audio_lang: 'en-US',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Xem thẻ Festival rồi đọc lại từ mới.',
          media_url: '/lesson-media/nhe/photos/festival-viet-nam.jpg',
          media_kind: 'image',
          answer_mode: 'none',
        },
      ]
    case 'khoa hoc tu nhien':
      return [
        {
          ...firstDraft,
          activity_type: 'multiple_choice',
          prompt: 'Nam châm có hút sắt không?',
          text_choices: ['Đúng', 'Sai'],
          correct_choice: 'Đúng',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=khtn-magnet',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Đưa nam châm lại gần từng vật để quan sát vật nào bị hút.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=khtn-magnet',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'lich su dia ly':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Chạm vào Châu Mỹ trên quả địa cầu mô phỏng.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=lsdl-globe',
          media_kind: '',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Nối đường đi từ Châu Âu sang Châu Á cho con thuyền chạy qua.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=lsdl-route',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'cong nghe':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Vật nào dùng để đào đất?',
          choice_cards: [
            createPresetChoiceCard('hoe', 'Cái cuốc', '/lesson-media/trung-binh/hoe-card.svg'),
            createPresetChoiceCard('shovel', 'Cái xẻng', '/lesson-media/trung-binh/shovel-card.svg'),
            createPresetChoiceCard('knife', 'Con dao', '/lesson-media/trung-binh/knife-card.svg'),
            createPresetChoiceCard('bowl', 'Cái chén', '/lesson-media/trung-binh/bowl-card.svg'),
          ],
          correct_choice: 'shovel',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Kéo các bước vào đúng thứ tự để cây lớn lên.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=congnghe-grow',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'giao duc cong dan':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Làm theo nhịp thở để bình tĩnh lại trước khi học tiếp.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=gdcd-calm',
          media_kind: '',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'multiple_choice',
          prompt: 'Nếu thấy bạn bị bắt nạt, em nên làm gì?',
          text_choices: ['Báo cô giáo', 'Đánh lại', 'Đứng xem'],
          correct_choice: 'Báo cô giáo',
          media_url: 'https://www.youtube.com/embed/plU2JksBYV0?rel=0&playsinline=1',
        },
      ]
    case 'tin hoc':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Thiết bị nào dùng để gõ chữ?',
          choice_cards: [
            createPresetChoiceCard('keyboard', 'Bàn phím', '/lesson-media/trung-binh/keyboard-card.svg'),
            createPresetChoiceCard('monitor', 'Màn hình', '/lesson-media/trung-binh/monitor-card.svg'),
          ],
          correct_choice: 'keyboard',
        },
        {
          ...secondDraft,
          activity_type: 'multiple_choice',
          prompt: 'Nếu có người xin mật khẩu, em nên làm gì?',
          text_choices: ['Không cho', 'Báo người lớn', 'Gửi ngay mật khẩu'],
          correct_choice: 'Không cho',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=tinhoc-safe',
        },
      ]
    case 'giao duc the chat':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Hình nào là tư thế chạy đúng?',
          choice_cards: [
            createPresetChoiceCard('running-correct', 'Chạy đúng tư thế', '/lesson-media/nhe/running-correct.svg'),
            createPresetChoiceCard('running-wrong', 'Chạy sai tư thế', '/lesson-media/nhe/running-wrong.svg'),
          ],
          correct_choice: 'running-correct',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Chạm lần lượt vào các vòng sáng theo nhịp 1 2 3 4.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=gdtc-ar',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'am nhac':
      return [
        {
          ...firstDraft,
          activity_type: 'listen_choose',
          prompt: 'Nghe âm thanh rồi chọn đúng nhạc cụ.',
          choice_cards: [
            createPresetChoiceCard('drum', 'Trống', '/lesson-media/trung-binh/drum-card.svg'),
            createPresetChoiceCard('flute', 'Sáo', '/lesson-media/nhe/photos/bamboo-flute.jpg'),
          ],
          correct_choice: 'flute',
          audio_url: '/lesson-media/nhe/audio/flute.ogg',
          audio_text: '',
          audio_lang: 'vi-VN',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Canh đúng nhịp rồi chạm vào mặt trống khi nốt nhạc chạm đích.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=amnhac-drum',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'my thuat':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Chọn màu rồi tô kín quả cam cho nổi bật.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=mythuat-fill',
          media_kind: '',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Nắn khối đất sét ảo để tạo thành chiếc bình đơn giản.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=mythuat-pottery',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'giao duc dia phuong':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Đâu là hình Bưởi Tân Triều?',
          choice_cards: [
            createPresetChoiceCard('buoi', 'Bưởi Tân Triều', '/lesson-media/nhe/photos/buoi.jpg'),
            createPresetChoiceCard('vai', 'Vải thiều', '/lesson-media/trung-binh/vai-card.svg'),
            createPresetChoiceCard('nhan', 'Nhãn', '/lesson-media/trung-binh/nhan-card.svg'),
          ],
          correct_choice: 'buoi',
        },
        {
          ...secondDraft,
          activity_type: 'multiple_choice',
          prompt: 'Sau khi xem clip, em chọn đúng đặc sản đang được giới thiệu.',
          text_choices: ['Bưởi Tân Triều', 'Vải thiều', 'Nhãn'],
          correct_choice: 'Bưởi Tân Triều',
          media_url: 'https://www.youtube.com/embed/DQhT-cBk7Vo?rel=0&playsinline=1',
        },
      ]
    case 'hoat dong trai nghiem':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Soạn đúng sách đi học và để đồ chơi ở ngoài balo.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=hdtn-bag',
          media_kind: '',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Tập ưu tiên bỏ tiền tiết kiệm trước rồi mới chọn món muốn mua.',
          media_url: '/lesson-media/trung-binh/medium-lab.html?activity=hdtn-budget',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    default:
      return [firstDraft, secondDraft]
  }
}

function buildLightActivityDrafts(template: {
  subject_name: string
  h1: TemplateActivityTemplate
  h2: TemplateActivityTemplate
}): ActivityDraft[] {
  const firstDraft = buildStructuredDraftFromTemplate(template.h1, template.subject_name, true)
  const secondDraft = buildStructuredDraftFromTemplate(template.h2, template.subject_name, false)
  const subjectKey = canonicalSubjectLookup(template.subject_name)
  const lightLabUrl = (activity: string) => `/lesson-media/nhe/light-lab.html?activity=${activity}`
  const makeLabActivity = (
    draft: ActivityDraft,
    activity: string,
    prompt: string,
    patch: Partial<ActivityDraft> = {},
  ): ActivityDraft => ({
    ...draft,
    activity_type: 'watch_answer',
    prompt,
    media_url: lightLabUrl(activity),
    media_kind: '',
    answer_mode: 'none',
    ...patch,
  })

  switch (subjectKey) {
    case 'ngu van':
      return [
        makeLabActivity(firstDraft, 'ngu-van-mindmap', 'Kéo các từ khóa vào đúng nhánh sơ đồ tư duy.'),
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Bấm micro và kể lại bài học rút ra từ câu chuyện.',
          media_url: '',
          media_kind: '',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'Kiên trì sẽ thành công',
          accepted_answers: ['Kiên trì', 'Cố gắng sẽ thành công', 'Không bỏ cuộc'],
        },
      ]
    case 'toan hoc':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          title: template.h1.title,
          prompt: 'Làm bài toán theo từng bước: đọc đề, chọn phép tính, rồi điền kết quả.',
          media_url: lightLabUrl('toan-step'),
          media_kind: '',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          title: template.h2.title,
          prompt: 'Xoay mô hình 3D, chạm vào đỉnh/cạnh/mặt để quan sát hình khối.',
          media_url: '/lesson-media/nhe/shape-prism-3d.html?shape=prism&focus=vertices',
          media_kind: '',
          answer_mode: 'none',
        },
      ]
    case 'tieng anh':
      return [
        {
          ...firstDraft,
          activity_type: 'listen_choose',
          prompt: 'Listen and choose the Festival picture.',
          audio_text: 'Festival',
          audio_lang: 'en-US',
          choice_cards: [
            createPresetChoiceCard('festival', 'Festival', '/lesson-media/nhe/photos/festival-viet-nam.jpg'),
            createPresetChoiceCard('hospital', 'Hospital', '/lesson-media/nhe/photos/hospital-building.jpg'),
            createPresetChoiceCard('traffic', 'Traffic', '/lesson-media/nhe/photos/traffic-viet-nam.jpg'),
          ],
          correct_choice: 'festival',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'AI hỏi: How are you? Em bấm micro và trả lời.',
          media_url: '',
          media_kind: '',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'I am fine',
          accepted_answers: ['I am fine', 'Fine', 'I am good', 'I am OK'],
        },
      ]
    case 'khoa hoc tu nhien':
      return [
        makeLabActivity(firstDraft, 'khtn-magnet', 'Kéo nam châm lại gần vật và quan sát vật nào bị hút.'),
        makeLabActivity(secondDraft, 'khtn-atom', 'Chạm từng electron để xếp vào đúng vòng nguyên tử.'),
      ]
    case 'lich su dia ly':
      return [
        makeLabActivity(firstDraft, 'lsdl-globe', 'Xoay bản đồ và chạm vào Châu Mỹ.'),
        makeLabActivity(secondDraft, 'lsdl-timeline', 'Sắp xếp các mốc phát kiến địa lí theo dòng thời gian.'),
      ]
    case 'cong nghe':
      return [
        makeLabActivity(firstDraft, 'congnghe-steps', 'Sắp xếp đúng quy trình trồng trọt.'),
        makeLabActivity(secondDraft, 'congnghe-animals', 'Phân loại vật nuôi vào đúng nhóm nông nghiệp.'),
      ]
    case 'giao duc cong dan':
      return [
        {
          ...firstDraft,
          activity_type: 'multiple_choice',
          prompt: 'Nếu thấy bạn bị bắt nạt, em nên làm gì?',
          text_choices: ['Báo cô giáo', 'Đứng xem'],
          correct_choice: 'Báo cô giáo',
          media_url: lightLabUrl('gdcd-bullying'),
          media_kind: '',
        },
        makeLabActivity(secondDraft, 'gdcd-budget', 'Phân bổ tiền vào tiết kiệm và mua sắm sao cho hợp lí.'),
      ]
    case 'tin hoc':
      return [
        makeLabActivity(firstDraft, 'tinhoc-excel', 'Kéo hàm SUM vào bảng tính để tính tổng tiền.'),
        makeLabActivity(secondDraft, 'tinhoc-slide', 'Chọn template và hoàn thiện một slide nhanh.'),
      ]
    case 'giao duc the chat':
      return [
        {
          ...firstDraft,
          activity_type: 'multiple_choice',
          prompt: 'Đâu là tư thế chạy giúp em không bị đau lưng?',
          audio_text: 'Đâu là tư thế chạy giúp em không bị đau lưng?',
          text_choices: ['run-correct-card', 'run-wrong-card'],
          choice_cards: [
            createPresetChoiceCard('run-correct-card', 'Chạy đúng tư thế', lightLabUrl('run-correct-card'), 'video'),
            createPresetChoiceCard('run-wrong-card', 'Chạy sai tư thế', lightLabUrl('run-wrong-card'), 'video'),
          ],
          correct_choice: 'run-correct-card',
        },
        makeLabActivity(secondDraft, 'gdtc-ar', 'Chạm hoặc vung tay để làm vỡ các vòng tròn ảo theo nhịp.'),
      ]
    case 'am nhac':
      return [
        {
          ...firstDraft,
          activity_type: 'listen_choose',
          prompt: 'Nghe âm thanh rồi chọn đúng nhạc cụ.',
          audio_url: '/lesson-media/nhe/audio/flute.ogg',
          audio_lang: 'vi-VN',
          choice_cards: [
            createPresetChoiceCard('flute', 'Sáo trúc', '/lesson-media/nhe/photos/bamboo-flute.jpg'),
            createPresetChoiceCard('dan-bau', 'Đàn bầu', '/lesson-media/nhe/photos/dan-bau.jpg'),
          ],
          correct_choice: 'flute',
        },
        makeLabActivity(secondDraft, 'amnhac-rhythm', 'Canh đúng nhịp rồi chạm vào trống để gõ phách.'),
      ]
    case 'my thuat':
      return [
        makeLabActivity(firstDraft, 'mythuat-fill', 'Chọn màu và tô kín vùng tranh theo mảng rõ ràng.'),
        makeLabActivity(secondDraft, 'mythuat-card', 'Kéo sticker để thiết kế thiệp điện tử.'),
      ]
    case 'giao duc dia phuong':
      return [
        makeLabActivity(firstDraft, 'dia-phuong-flashcard', 'Chạm để lật flashcard địa danh và đặc sản Đồng Nai.'),
        makeLabActivity(secondDraft, 'dia-phuong-video', 'Xem video rồi bấm micro trả lời: Đây là đâu?', {
          answer_mode: 'voice_ai_grade',
          expected_answer: 'Văn miếu Trấn Biên',
          accepted_answers: ['Văn miếu Trấn Biên', 'Trấn Biên', 'Văn miếu'],
        }),
      ]
    case 'hoat dong trai nghiem':
      return [
        {
          ...firstDraft,
          activity_type: 'drag_drop',
          prompt: 'Kéo đúng đồ dùng vào nhóm cần cho ngày đi học.',
          drag_items: ['Sách Toán', 'Vở ghi', 'Bút chì', 'Đồ chơi'],
          drag_targets: ['Cho vào cặp', 'Để ở nhà'],
        },
        {
          ...secondDraft,
          activity_type: 'drag_drop',
          prompt: 'Chia tiền vào nhóm tiết kiệm và chi tiêu.',
          drag_items: ['10 xu', '5 xu', 'Kẹo', 'Heo đất'],
          drag_targets: ['Tiết kiệm', 'Chi tiêu'],
        },
      ]
    default:
      return [firstDraft, secondDraft]
  }
}

function buildActivityDraftsForLevel(level: LessonLevel, template: {
  subject_name: string
  h1: TemplateActivityTemplate
  h2: TemplateActivityTemplate
}): ActivityDraft[] {
  if (level === 'nhe') return buildLightActivityDrafts(template)
  if (level === 'trung_binh') return buildMediumActivityDrafts(template)
  return buildHeavyActivityDrafts(template)
}

function buildBlankActivityDraftsForSubject(subjectName: string): ActivityDraft[] {
  const common = createCommonActivityDraft()
  return [
    {
      title: `Bài tập ${subjectName || 'môn học'}`,
      activity_type: 'image_choice',
      interaction_type: 'selection',
      objective: '',
      steps: [],
      is_mandatory: true,
      ...common,
      prompt: '',
      choice_cards: [createChoiceCardDraft('Lựa chọn 1'), createChoiceCardDraft('Lựa chọn 2')],
    },
    {
      title: `Hoạt động ${subjectName || 'môn học'}`,
      activity_type: 'watch_answer',
      interaction_type: 'selection',
      objective: '',
      steps: [],
      is_mandatory: false,
      ...createCommonActivityDraft(),
      answer_mode: 'none',
    },
  ]
}

function buildHeavyActivityDrafts(template: {
  subject_name: string
  h1: TemplateActivityTemplate
  h2: TemplateActivityTemplate
}): ActivityDraft[] {
  const firstDraft = buildStructuredDraftFromTemplate(template.h1, template.subject_name, true)
  const secondDraft = buildStructuredDraftFromTemplate(template.h2, template.subject_name, false)
  const subjectKey = canonicalSubjectLookup(template.subject_name)

  switch (subjectKey) {
    case 'ngu van':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Ai là cô Tấm?',
          audio_text: 'Ai là cô Tấm?',
          choice_cards: [
            createPresetChoiceCard('co-tam', 'Cô Tấm', '/lesson-media/nang/co-tam-card.svg'),
            createPresetChoiceCard('con-cho', 'Con chó', '/lesson-media/nang/con-cho-card.svg'),
          ],
          correct_choice: 'co-tam',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Xem truyện tranh động rồi bấm xác nhận khi em nghe xong.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=nguvan-story',
          answer_mode: 'none',
        },
      ]
    case 'toan hoc':
      return [
        {
          ...firstDraft,
          activity_type: 'drag_drop',
          prompt: 'Kéo đúng 2 quả táo vào rổ của cô, quả còn lại để trên bàn.',
          drag_items: ['Táo đỏ', 'Táo xanh', 'Táo vàng'],
          drag_targets: ['Rổ của cô', 'Để trên bàn'],
        },
        {
          ...secondDraft,
          activity_type: 'drag_drop',
          prompt: 'Chia các khối vào đúng hộp hình Tròn hoặc hình Vuông.',
          drag_items: ['Đĩa tròn', 'Khung vuông', 'Bóng tròn', 'Khối vuông'],
          drag_targets: ['Hộp hình Tròn', 'Hộp hình Vuông'],
        },
      ]
    case 'tieng anh':
      return [
        {
          ...firstDraft,
          activity_type: 'listen_choose',
          prompt: 'Nghe màu rồi chọn đúng thẻ.',
          audio_text: 'Red',
          audio_lang: 'en-US',
          choice_cards: [
            createPresetChoiceCard('red', 'Red', '/lesson-media/nang/red-card.svg'),
            createPresetChoiceCard('blue', 'Blue', '/lesson-media/nang/blue-card.svg'),
          ],
          correct_choice: 'red',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Nhìn chữ Stand up, đứng lên theo mẫu rồi bấm xác nhận.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=tienganh-standup',
          answer_mode: 'none',
        },
      ]
    case 'khoa hoc tu nhien':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Chạm để đặt mắt, mũi, miệng vào đúng vị trí trên khuôn mặt.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=khtn-face',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'drag_drop',
          prompt: 'Kéo con chó vào nhóm vật sống và cái ghế vào nhóm vật không sống.',
          drag_items: ['Con chó', 'Cái ghế', 'Cây xanh', 'Bàn học'],
          drag_targets: ['Vật sống', 'Vật không sống'],
        },
      ]
    case 'lich su dia ly':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Mưa rồi, lấy gì đây?',
          audio_text: 'Mưa rồi, lấy gì đây?',
          choice_cards: [
            createPresetChoiceCard('umbrella', 'Cái ô', '/lesson-media/nang/umbrella-card.svg'),
            createPresetChoiceCard('sunglasses', 'Kính râm', '/lesson-media/nang/sunglasses-card.svg'),
          ],
          correct_choice: 'umbrella',
        },
        {
          ...secondDraft,
          activity_type: 'drag_drop',
          prompt: 'Kéo thuyền xuống nước và kéo ô tô lên đường bộ.',
          drag_items: ['Thuyền', 'Ô tô', 'Xe máy', 'Ca nô'],
          drag_targets: ['Đường thủy', 'Đường bộ'],
        },
      ]
    case 'cong nghe':
      return [
        {
          ...firstDraft,
          activity_type: 'drag_drop',
          prompt: 'Kéo thẻ cảnh báo lên các vật nguy hiểm trong nhà.',
          drag_items: ['Dấu X cho ổ điện', 'Dấu X cho dao', 'Nhãn an toàn cho bát cơm'],
          drag_targets: ['Nguy hiểm', 'An toàn'],
        },
        {
          ...secondDraft,
          activity_type: 'drag_drop',
          prompt: 'Xếp bát to ở kệ dưới và bát nhỏ ở kệ trên.',
          drag_items: ['Bát to', 'Bát nhỏ', 'Bát vừa'],
          drag_targets: ['Kệ dưới', 'Kệ trên'],
        },
      ]
    case 'giao duc cong dan':
      return [
        {
          ...firstDraft,
          activity_type: 'multiple_choice',
          prompt: 'Bạn vứt rác ra sân. Em chọn mặt cười hay mặt mếu?',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=gdcd-litter',
          media_kind: 'video',
          text_choices: ['😊 Mặt cười', '☹️ Mặt mếu'],
          correct_choice: '☹️ Mặt mếu',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Nhìn cô giáo, bấm micro và nói “ạ” để hoàn thành lời chào.',
          media_url: '/lesson-media/nang/teacher-greeting-card.svg',
          media_kind: 'image',
          answer_mode: 'voice_ai_grade',
          expected_answer: 'ạ',
          accepted_answers: ['a', 'ạ ạ', 'con chào cô ạ'],
        },
      ]
    case 'tin hoc':
      return [
        {
          ...firstDraft,
          activity_type: 'image_choice',
          prompt: 'Chuột máy tính đâu?',
          audio_text: 'Chuột máy tính đâu?',
          choice_cards: [
            createPresetChoiceCard('computer-mouse', 'Chuột máy tính', '/lesson-media/nang/computer-mouse-card.svg'),
            createPresetChoiceCard('animal-mouse', 'Con chuột', '/lesson-media/nang/animal-mouse-card.svg'),
          ],
          correct_choice: 'computer-mouse',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Vuốt trái phải để lật trang và chạm để bật sáng màn hình máy tính bảng.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=tinhoc-swipe',
          answer_mode: 'none',
        },
      ]
    case 'giao duc the chat':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Xem thầy làm mẫu chậm rồi bắt chước động tác vươn vai, nhún gối theo nhịp.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=gdtc-warmup',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Đứng trước màn hình và vung tay đập các vòng tròn ảo.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=gdtc-ar',
          answer_mode: 'none',
        },
      ]
    case 'am nhac':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Canh đúng nhịp rồi gõ vào mặt trống khi nốt nhạc chạm đích.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=amnhac-rhythm',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'listen_choose',
          prompt: 'Nghe âm thanh rồi chọn đúng nhạc cụ.',
          audio_url: '/lesson-media/nang/audio/flute.ogg',
          audio_lang: 'vi-VN',
          choice_cards: [
            createPresetChoiceCard('flute', 'Sáo trúc', '/lesson-media/nang/photos/bamboo-flute.jpg'),
            createPresetChoiceCard('dan-bau', 'Đàn bầu', '/lesson-media/nang/photos/dan-bau.jpg'),
          ],
          correct_choice: 'flute',
        },
      ]
    case 'my thuat':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Chọn màu cam rồi tô kín hình quả cam.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=mythuat-fill',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'watch_answer',
          prompt: 'Thêm sticker con ong và bươm bướm vào bức tranh vườn hoa.',
          media_url: '/lesson-media/nang/heavy-lab.html?activity=mythuat-card',
          answer_mode: 'none',
        },
      ]
    case 'giao duc dia phuong':
      return [
        {
          ...firstDraft,
          activity_type: 'watch_answer',
          prompt: 'Chạm để lật thẻ và xem ruột quả bưởi Tân Triều.',
          media_url: '/lesson-media/nang/photos/buoi.jpg',
          media_kind: 'image',
          answer_mode: 'none',
        },
        {
          ...secondDraft,
          activity_type: 'image_puzzle',
          prompt: 'Kéo 2 mảnh lại gần nhau để ghép thành quả bưởi hoàn chỉnh.',
          media_url: '/lesson-media/nang/photos/buoi.jpg',
          media_kind: 'image',
          puzzle_rows: 1,
          puzzle_cols: 2,
        },
      ]
    case 'hoat dong trai nghiem':
      return [
        {
          ...firstDraft,
          activity_type: 'step_by_step',
          prompt: 'Sắp xếp đúng thứ tự rửa tay.',
          step_items: ['Mở vòi nước', 'Lấy xà phòng', 'Rửa tay'],
        },
        {
          ...secondDraft,
          activity_type: 'aac',
          prompt: 'Bấm vào thẻ để app nói thay em câu em muốn.',
          aac_cards: ['Con muốn uống nước', 'Con muốn ăn cơm', 'Con mệt'],
          aac_image_cards: [
            createPresetChoiceCard('aac-food', 'Cơm', '/lesson-media/nang/aac-com.svg'),
            createPresetChoiceCard('aac-play', 'Chơi', '/lesson-media/nang/aac-choi.svg'),
          ],
        },
      ]
    default:
      return [firstDraft, secondDraft]
  }
}

function isTeacherActivityType(value: string): value is TeacherActivityType {
  return SUPPORTED_TEACHER_ACTIVITY_TYPES.has(value as TeacherActivityType)
}

function buildStructuredActivityConfig(activity: ActivityDraft) {
  const prompt = activity.prompt.trim()
  switch (activity.activity_type) {
    case 'multiple_choice':
      return {
        prompt,
        choices: activity.text_choices.map((item) => item.trim()).filter(Boolean),
        correct: activity.correct_choice.trim(),
        image_selection_mode: activity.choice_cards.some((card) => card.media_url.trim()) ? 'carousel_find' : undefined,
        image_cards: activity.choice_cards
          .filter((card) => card.label.trim() || card.media_url.trim())
          .map((card) => ({
            id: card.id,
            label: card.label.trim() || 'Lựa chọn',
            media_url: card.media_url.trim(),
            media_kind: card.media_kind || undefined,
          })),
        audio_text: activity.audio_text.trim() || undefined,
        audio_url: activity.audio_url.trim() || undefined,
        audio_lang: activity.audio_lang.trim() || undefined,
        media_url: activity.media_url.trim() || undefined,
        media_kind: activity.media_kind || undefined,
      }
    case 'image_choice':
      return {
        prompt,
        correct: activity.correct_choice.trim(),
        image_selection_mode: 'carousel_find',
        image_cards: activity.choice_cards
          .filter((card) => card.label.trim() || card.media_url.trim())
          .map((card) => ({
            id: card.id,
            label: card.label.trim() || 'Lựa chọn',
            media_url: card.media_url.trim(),
            media_kind: card.media_kind || undefined,
          })),
        audio_text: activity.audio_text.trim() || undefined,
        audio_url: activity.audio_url.trim() || undefined,
        audio_lang: activity.audio_lang.trim() || undefined,
        media_url: activity.media_url.trim() || undefined,
        media_kind: activity.media_kind || undefined,
      }
    case 'image_puzzle':
      return {
        prompt,
        image_url: activity.media_url.trim() || undefined,
        rows: Math.max(1, Number(activity.puzzle_rows) || 1),
        cols: Math.max(2, Number(activity.puzzle_cols) || 2),
        piece_count: Math.max(2, (Math.max(1, Number(activity.puzzle_rows) || 1) * Math.max(2, Number(activity.puzzle_cols) || 2))),
      }
    case 'listen_choose':
      return {
        prompt,
        correct: activity.correct_choice.trim(),
        image_selection_mode: 'carousel_find',
        image_cards: activity.choice_cards
          .filter((card) => card.label.trim() || card.media_url.trim())
          .map((card) => ({
            id: card.id,
            label: card.label.trim() || 'Lựa chọn',
            media_url: card.media_url.trim(),
            media_kind: card.media_kind || undefined,
          })),
        audio_text: activity.audio_text.trim() || prompt,
        audio_url: activity.audio_url.trim() || undefined,
        audio_lang: activity.audio_lang.trim() || undefined,
        media_url: activity.media_url.trim() || undefined,
        media_kind: activity.media_kind || undefined,
      }
    case 'matching':
      return {
        prompt,
        pairs: activity.matching_pairs
          .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
          .filter((pair) => pair.left && pair.right),
      }
    case 'drag_drop':
      return {
        prompt,
        items: activity.drag_items.map((item) => item.trim()).filter(Boolean),
        targets: activity.drag_targets.map((target) => target.trim()).filter(Boolean),
        visual_style: activity.visual_style.trim() || undefined,
      }
    case 'watch_answer':
      return {
        prompt,
        media_url: activity.media_url.trim() || undefined,
        media_kind: activity.media_kind || undefined,
        answer_mode: activity.answer_mode,
        expected_answer: activity.expected_answer.trim() || undefined,
        accepted_answers: activity.accepted_answers.map((item) => item.trim()).filter(Boolean),
      }
    case 'step_by_step':
      return {
        prompt,
        steps: activity.step_items.map((item) => item.trim()).filter(Boolean),
        media_url: activity.media_url.trim() || undefined,
        media_kind: activity.media_kind || undefined,
      }
    case 'aac':
      return {
        prompt,
        cards: activity.aac_cards.map((item) => item.trim()).filter(Boolean),
        image_cards: activity.aac_image_cards
          .filter((card) => card.label.trim() || card.media_url.trim())
          .map((card) => ({
            id: card.id,
            label: card.label.trim() || 'Thẻ',
            media_url: card.media_url.trim(),
            media_kind: card.media_kind || undefined,
          })),
      }
    default:
      return {}
  }
}

function buildLegacyActivityPayload(activity: ActivityDraft) {
  return {
    activity_type: 'step_by_step' as TeacherActivityType,
    config: {
      prompt: activity.objective || activity.title,
      steps: activity.steps.map((step) => [step.title, step.description].filter(Boolean).join(': ')).filter(Boolean),
    },
  }
}

function buildPreviewActivityItem(activity: ActivityDraft, sortOrder: number, level?: LessonLevel): LessonActivityItem {
  const payload = isTeacherActivityType(activity.activity_type)
    ? {
        activity_type: activity.activity_type,
        config: buildStructuredActivityConfig(activity),
      }
    : buildLegacyActivityPayload(activity)

  return {
    id: sortOrder,
    lesson_id: 0,
    title: activity.title.trim() || `Hoạt động ${sortOrder}`,
    activity_type: payload.activity_type,
    instruction_text: activity.objective.trim() || activity.prompt.trim() || activity.title.trim(),
    voice_answer_enabled: false,
    is_required: Boolean(activity.is_mandatory),
    sort_order: sortOrder,
    difficulty_stage: level === 'nhe' ? 1 : level === 'trung_binh' ? 2 : level === 'nang' ? 3 : 1,
    config_json: JSON.stringify(payload.config),
  }
}

function getStructuredActivityValidationError(activity: ActivityDraft) {
  if (!activity.title.trim()) return 'Tên hoạt động đang trống.'
  if (!activity.objective.trim()) return `Hoạt động "${activity.title}" chưa có mục tiêu/hướng dẫn.`
  if (!activity.prompt.trim()) return `Hoạt động "${activity.title}" chưa có câu hỏi hoặc lời dẫn.`

  switch (activity.activity_type) {
    case 'multiple_choice': {
      const choices = activity.text_choices.map((item) => item.trim()).filter(Boolean)
      if (choices.length < 2) return `Hoạt động "${activity.title}" cần ít nhất 2 đáp án chữ.`
      if (!activity.correct_choice.trim()) return `Hoạt động "${activity.title}" chưa chọn đáp án đúng.`
      return null
    }
    case 'image_choice':
    case 'listen_choose': {
      const cards = activity.choice_cards.filter((card) => card.label.trim() || card.media_url.trim())
      if (cards.length < 2) return `Hoạt động "${activity.title}" cần ít nhất 2 lựa chọn bằng ảnh.`
      if (!activity.correct_choice.trim()) return `Hoạt động "${activity.title}" chưa chọn đáp án đúng.`
      return null
    }
    case 'image_puzzle':
      if (!activity.media_url.trim()) return `Hoạt động "${activity.title}" cần có ảnh nguồn để ghép.`
      return null
    case 'matching': {
      const pairs = activity.matching_pairs.filter((pair) => pair.left.trim() && pair.right.trim())
      if (pairs.length < 2) return `Hoạt động "${activity.title}" cần ít nhất 2 cặp nối.`
      return null
    }
    case 'drag_drop': {
      const items = activity.drag_items.map((item) => item.trim()).filter(Boolean)
      const targets = activity.drag_targets.map((target) => target.trim()).filter(Boolean)
      if (!items.length || !targets.length) return `Hoạt động "${activity.title}" cần có mục kéo và vị trí đích.`
      return null
    }
    case 'watch_answer':
      return null
    case 'step_by_step': {
      const steps = activity.step_items.map((item) => item.trim()).filter(Boolean)
      if (!steps.length) return `Hoạt động "${activity.title}" cần ít nhất 1 bước.`
      return null
    }
    case 'aac': {
      const textCards = activity.aac_cards.map((item) => item.trim()).filter(Boolean)
      const imageCards = activity.aac_image_cards.filter((card) => card.label.trim() || card.media_url.trim())
      if (!textCards.length && !imageCards.length) return `Hoạt động "${activity.title}" cần ít nhất 1 thẻ giao tiếp.`
      return null
    }
    default:
      return null
  }
}

function mediumActivityTypeDescription(activityType: TeacherActivityType) {
  return TEACHER_ACTIVITY_TYPE_OPTIONS.find((item) => item.value === activityType)?.hint ?? ''
}

function parseActivityConfigJson(configJson: string | null): Record<string, unknown> {
  if (!configJson) return {}
  try {
    const parsed = JSON.parse(configJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function configStringArray(value: unknown, fallback: string[] = ['']) {
  if (!Array.isArray(value)) return fallback
  const items = value.map((item) => {
    if (typeof item === 'string') return item
    if (item && typeof item === 'object') {
      const rawItem = item as { title?: unknown; text?: unknown; label?: unknown; description?: unknown }
      return cleanAIString(rawItem.title) || cleanAIString(rawItem.text) || cleanAIString(rawItem.label) || cleanAIString(rawItem.description)
    }
    return String(item ?? '').trim()
  }).filter(Boolean)
  return items.length ? items : fallback
}

function normalizeSavedMediaKind(value: unknown): ActivityMediaKind | '' {
  const mediaKind = cleanAIString(value)
  return mediaKind === 'image' || mediaKind === 'video' ? mediaKind : ''
}

function savedImageCardsToDraft(value: unknown, labelPrefix: string) {
  if (!Array.isArray(value)) return [createChoiceCardDraft(`${labelPrefix} 1`), createChoiceCardDraft(`${labelPrefix} 2`)]
  const cards = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const rawItem = item as { id?: unknown; label?: unknown; media_url?: unknown; media_kind?: unknown }
      return {
        id: cleanAIString(rawItem.id) || makeDraftId('card'),
        label: cleanAIString(rawItem.label) || `${labelPrefix} ${index + 1}`,
        media_url: cleanAIString(rawItem.media_url),
        media_kind: normalizeSavedMediaKind(rawItem.media_kind),
      } satisfies ChoiceCardDraft
    })
    .filter((item): item is ChoiceCardDraft => item !== null)
  return cards.length ? cards : [createChoiceCardDraft(`${labelPrefix} 1`), createChoiceCardDraft(`${labelPrefix} 2`)]
}

function savedPairsToDraft(value: unknown) {
  if (!Array.isArray(value)) return [createMatchingPairDraft(), createMatchingPairDraft()]
  const pairs = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const rawItem = item as { left?: unknown; right?: unknown }
      const left = cleanAIString(rawItem.left)
      const right = cleanAIString(rawItem.right)
      return left || right ? { left, right } : null
    })
    .filter((item): item is MatchingPairDraft => item !== null)
  return pairs.length ? pairs : [createMatchingPairDraft(), createMatchingPairDraft()]
}

function activityItemToDraft(item: LessonActivityItem): ActivityDraft {
  const config = parseActivityConfigJson(item.config_json)
  const activityType = isTeacherActivityType(item.activity_type) ? item.activity_type : 'step_by_step'
  const base: ActivityDraft = {
    ...createCommonActivityDraft(),
    id: item.id,
    title: item.title || 'Hoạt động',
    activity_type: activityType,
    objective: item.instruction_text || '',
    steps: [],
    is_mandatory: item.is_required,
    is_approved: true,
  }

  const prompt = cleanAIString(config.prompt) || item.instruction_text || item.title || ''
  const shared = {
    ...base,
    prompt,
    media_url: cleanAIString(config.media_url || config.image_url),
    media_kind: normalizeSavedMediaKind(config.media_kind),
    audio_text: cleanAIString(config.audio_text),
    audio_url: cleanAIString(config.audio_url),
    audio_lang: cleanAIString(config.audio_lang) || 'vi-VN',
  }

  switch (activityType) {
    case 'multiple_choice': {
      const choices = configStringArray(config.choices, ['', ''])
      return {
        ...shared,
        text_choices: choices,
        correct_choice: cleanAIString(config.correct) || choices[0] || '',
      }
    }
    case 'image_choice':
    case 'listen_choose': {
      const cards = savedImageCardsToDraft(config.image_cards, 'Lựa chọn')
      return {
        ...shared,
        choice_cards: cards,
        correct_choice: cleanAIString(config.correct) || cards[0]?.id || '',
      }
    }
    case 'image_puzzle':
      return {
        ...shared,
        media_url: cleanAIString(config.image_url || config.media_url),
        puzzle_rows: Number(config.rows) || 1,
        puzzle_cols: Number(config.cols) || 2,
      }
    case 'matching':
      return { ...shared, matching_pairs: savedPairsToDraft(config.pairs) }
    case 'drag_drop':
      return {
        ...shared,
        drag_items: configStringArray(config.items, ['', '']),
        drag_targets: configStringArray(config.targets, ['', '']),
        visual_style: cleanAIString(config.visual_style),
      }
    case 'watch_answer': {
      const answerMode = cleanAIString(config.answer_mode)
      return {
        ...shared,
        answer_mode: answerMode === 'text' || answerMode === 'voice_ai_grade' || answerMode === 'none' ? answerMode : 'none',
        expected_answer: cleanAIString(config.expected_answer),
        accepted_answers: configStringArray(config.accepted_answers, []),
      }
    }
    case 'step_by_step':
      return { ...shared, step_items: configStringArray(config.steps, ['']) }
    case 'aac':
      return {
        ...shared,
        aac_cards: configStringArray(config.cards, ['']),
        aac_image_cards: savedImageCardsToDraft(config.image_cards, 'Thẻ'),
      }
    default:
      return shared
  }
}

function lessonItemToDraft(lesson: LessonItem): LessonDraft {
  return {
    subject_id: lesson.subject_id,
    subject_name: lesson.subject?.name,
    class_id: lesson.class_id ?? undefined,
    class_name: lesson.classroom?.name,
    difficulty_level: isLessonLevel(lesson.primary_level) ? lesson.primary_level : undefined,
    title: lesson.title,
    theme: '',
    description: lesson.description || '',
    activities: (lesson.activities || [])
      .slice()
      .sort((left, right) => left.sort_order - right.sort_order)
      .map(activityItemToDraft),
  }
}

export function LessonsPage() {
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list')
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [assigningLessonId, setAssigningLessonId] = useState<number | null>(null)

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

  const lessonsQuery = useQuery({
    queryKey: ['lessons', accessToken],
    queryFn: () => fetchLessons(accessToken!),
    enabled: Boolean(accessToken),
  })

  const classesQuery = useQuery({
    queryKey: ['classes', accessToken],
    queryFn: () => fetchClasses(accessToken!),
    enabled: Boolean(accessToken),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLesson(accessToken!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lessons'] }),
  })

  const resetWizardDraft = () => {
    setCurrentStep(1)
    setLessonDraft({
      title: '',
      theme: '',
      description: '',
      difficulty_level: undefined,
      subject_id: undefined,
      subject_name: undefined,
      activities: [],
    })
    setIsAutoFilled(false)
  }

  const startCreateLesson = () => {
    setEditingLessonId(null)
    resetWizardDraft()
    setViewMode('create')
  }

  const openEditLesson = async (lesson: LessonItem) => {
    if (!accessToken) return
    setIsLoadingEdit(true)
    try {
      const fullLesson = await fetchLesson(accessToken, lesson.id)
      setEditingLessonId(fullLesson.id)
      setLessonDraft(lessonItemToDraft(fullLesson))
      setCurrentStep(2)
      setIsAutoFilled(true)
      setViewMode('create')
    } catch (error) {
      alert('Không mở được bài để chỉnh sửa: ' + (error as Error).message)
    } finally {
      setIsLoadingEdit(false)
    }
  }

  const mergedSubjects = useMemo(() => {
    const apiSubjects: Array<{ id: number; name: string; icon?: string }> = (subjectsQuery.data || []).map((subject: SubjectItem) => ({
      id: subject.id,
      name: subject.name,
    }))
    const level = lessonDraft.difficulty_level
    const templates = level ? SUBJECT_TEMPLATES[level] : []
    const templateByName = new Map(templates.map((template) => [canonicalSubjectLookup(template.subject_name), template]))
    const seen = new Set<string>()
    const result: Array<{ id: number; name: string; icon: string }> = []

    for (const subject of apiSubjects) {
      const template = templateByName.get(canonicalSubjectLookup(subject.name))
      result.push({ id: subject.id, name: subject.name, icon: template?.icon ?? '📘' })
      seen.add(subject.name)
    }

    for (const template of templates) {
      if (!apiSubjects.length && !seen.has(canonicalSubjectLookup(template.subject_name))) {
        result.push({ id: template.subject_id, name: template.subject_name, icon: template.icon })
        seen.add(canonicalSubjectLookup(template.subject_name))
      }
    }

    return result
  }, [lessonDraft.difficulty_level, subjectsQuery.data])

  useEffect(() => {
    if (!lessonDraft.difficulty_level || !lessonDraft.subject_id || isAutoFilled) return
    const templates = SUBJECT_TEMPLATES[lessonDraft.difficulty_level]
    const template = findSubjectTemplate(templates, lessonDraft.subject_id, lessonDraft.subject_name)

    const activities = template
      ? buildActivityDraftsForLevel(lessonDraft.difficulty_level, template)
      : buildBlankActivityDraftsForSubject(lessonDraft.subject_name ?? '')

    setLessonDraft((current) => ({
      ...current,
      title: template?.title ?? current.title,
      theme: template?.theme ?? current.theme,
      description: template?.description ?? current.description,
      activities,
    }))
    setIsAutoFilled(true)
  }, [isAutoFilled, lessonDraft.difficulty_level, lessonDraft.subject_id, lessonDraft.subject_name])

  useEffect(() => {
    if (!(currentStep === 2 || currentStep === 3)) return
    if (lessonDraft.activities && lessonDraft.activities.length) return
    if (!lessonDraft.difficulty_level || !lessonDraft.subject_id) return

    const templates = SUBJECT_TEMPLATES[lessonDraft.difficulty_level]
    const template = findSubjectTemplate(templates, lessonDraft.subject_id, lessonDraft.subject_name)

    const activities = template
      ? buildActivityDraftsForLevel(lessonDraft.difficulty_level, template)
      : buildBlankActivityDraftsForSubject(lessonDraft.subject_name ?? '')

    setLessonDraft((current) => ({
      ...current,
      title: current.title || template?.title || '',
      theme: current.theme || template?.theme || '',
      description: current.description || template?.description || '',
      activities,
    }))
    setIsAutoFilled(true)
  }, [currentStep])

  const handleLevelSelect = (level: LessonLevel) => {
    setLessonDraft({
      title: '',
      theme: '',
      description: '',
      difficulty_level: level,
      subject_id: undefined,
      subject_name: undefined,
      activities: [],
    })
    setIsAutoFilled(false)
  }

  const handleSubjectSelect = (id: number, name: string) => {
    setLessonDraft((current) => ({
      ...current,
      subject_id: id,
      subject_name: name,
      title: '',
      theme: '',
      description: '',
      activities: [],
    }))
    setIsAutoFilled(false)
  }

  const handleClassSelect = (id: number, name: string) => {
    setLessonDraft((current) => ({
      ...current,
      class_id: id,
      class_name: name,
    }))
  }

  const approveActivity = (index: number) => {
    setLessonDraft((current) => {
      const nextActivities = [...current.activities]
      if (!nextActivities[index]) return current
      nextActivities[index] = { ...nextActivities[index], is_approved: true }
      return { ...current, activities: nextActivities }
    })
    if (index === 0) setCurrentStep(3)
    else setCurrentStep(4)
  }

  const handleInfoChange = (field: keyof Pick<LessonDraft, 'title' | 'theme' | 'description'>, value: string) => {
    setLessonDraft((current) => ({ ...current, [field]: value }))
  }

  const updateActivityDraft = (activityIndex: number, updater: (activity: ActivityDraft) => ActivityDraft) => {
    setLessonDraft((current) => {
      const nextActivities = [...current.activities]
      const currentActivity = nextActivities[activityIndex]
      if (!currentActivity) return current
      nextActivities[activityIndex] = updater(currentActivity)
      return { ...current, activities: nextActivities }
    })
  }

  const handleLegacyStepChange = (activityIndex: number, stepIndex: number, field: keyof EnhancedStepItem, value: string | number | string[]) => {
    updateActivityDraft(activityIndex, (activity) => {
      const nextSteps = [...activity.steps]
      const currentStep = nextSteps[stepIndex]
      if (!currentStep) return activity
      nextSteps[stepIndex] = { ...currentStep, [field]: value }
      return { ...activity, steps: nextSteps }
    })
  }

  const handleMediaUpload = async (
    applyUpdate: (uploaded: { url: string; media_kind: UploadableMediaKind }) => void,
    file: File,
    expectedKinds?: UploadableMediaKind[],
  ) => {
    if (!accessToken) return
    setIsUploading(true)
    try {
      const uploaded = await uploadLessonMedia(accessToken, file)
      if (expectedKinds && !expectedKinds.includes(uploaded.media_kind)) {
        throw new Error(`File tải lên phải thuộc loại: ${expectedKinds.join(', ')}`)
      }
      applyUpdate({ url: uploaded.url, media_kind: uploaded.media_kind })
    } catch (error) {
      alert('Lỗi upload file: ' + (error as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleLegacyStepUpload = async (activityIndex: number, stepIndex: number, file: File) => {
    await handleMediaUpload(({ url, media_kind }) => {
      handleLegacyStepChange(activityIndex, stepIndex, 'media_url', url)
      handleLegacyStepChange(activityIndex, stepIndex, 'media_kind', media_kind as ActivityMediaKind)
    }, file, ['image', 'video'])
  }

  const handleStructuredMediaUpload = async (activityIndex: number, file: File) => {
    await handleMediaUpload(({ url, media_kind }) => {
      updateActivityDraft(activityIndex, (activity) => ({ ...activity, media_url: url, media_kind: media_kind as ActivityMediaKind }))
    }, file, ['image', 'video'])
  }

  const handleStructuredAudioUpload = async (activityIndex: number, file: File) => {
    await handleMediaUpload(({ url }) => {
      updateActivityDraft(activityIndex, (activity) => ({ ...activity, audio_url: url }))
    }, file, ['audio'])
  }

  const handleChoiceCardUpload = async (activityIndex: number, field: 'choice_cards' | 'aac_image_cards', cardIndex: number, file: File) => {
    await handleMediaUpload(({ url, media_kind }) => {
      updateActivityDraft(activityIndex, (activity) => {
        const nextCards = [...activity[field]]
        const currentCard = nextCards[cardIndex]
        if (!currentCard) return activity
        nextCards[cardIndex] = { ...currentCard, media_url: url, media_kind: media_kind as ActivityMediaKind }
        return { ...activity, [field]: nextCards }
      })
    }, file, ['image', 'video'])
  }

  const handleSave = async () => {
    if (!accessToken || !lessonDraft.subject_id || !lessonDraft.difficulty_level || !lessonDraft.title.trim()) return

    if (isStructuredLessonLevel(lessonDraft.difficulty_level)) {
      const validationError = lessonDraft.activities.map(getStructuredActivityValidationError).find(Boolean)
      if (validationError) {
        alert(validationError)
        return
      }
    }

    try {
      const lessonPayload = {
        title: lessonDraft.title.trim(),
        subject_id: lessonDraft.subject_id,
        class_id: lessonDraft.class_id,
        primary_level: lessonDraft.difficulty_level,
        description: lessonDraft.description?.trim() || undefined,
      }
      const lesson = editingLessonId
        ? await updateLesson(accessToken, editingLessonId, lessonPayload)
        : await createLesson(accessToken, lessonPayload)

      for (const [activityIndex, activity] of lessonDraft.activities.entries()) {
        const activityPayload = isTeacherActivityType(activity.activity_type)
          ? {
              activity_type: activity.activity_type,
              config: buildStructuredActivityConfig(activity),
            }
          : buildLegacyActivityPayload(activity)

        const savedActivityPayload = {
          title: activity.title.trim(),
          activity_type: activityPayload.activity_type,
          instruction_text: activity.objective.trim() || activity.prompt.trim() || activity.title.trim(),
          is_required: activity.is_mandatory,
          sort_order: activityIndex + 1,
          difficulty_stage: lessonDraft.difficulty_level === 'nhe' ? 1 : lessonDraft.difficulty_level === 'trung_binh' ? 2 : lessonDraft.difficulty_level === 'nang' ? 3 : 1,
          config_json: JSON.stringify(activityPayload.config),
        }

        if (editingLessonId && activity.id) {
          await updateLessonActivity(accessToken, activity.id, savedActivityPayload)
        } else {
          await createLessonActivity(accessToken, lesson.id, savedActivityPayload)
        }
      }

      alert(editingLessonId ? '✅ Cập nhật bài học thành công!' : '🎉 Lưu bài học thành công!')
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      setViewMode('list')
      setEditingLessonId(null)
      resetWizardDraft()
    } catch (error) {
      alert((editingLessonId ? 'Lỗi cập nhật bài học: ' : 'Lỗi lưu bài học: ') + (error as Error).message)
    }
  }

  const handleQuickAssign = async (lesson: LessonItem) => {
    if (!accessToken) return
    const fallbackClass = classesQuery.data?.[0]
    const classId = lesson.class_id ?? fallbackClass?.id

    if (!classId) {
      alert('Bạn cần tạo lớp trước khi giao bài.')
      return
    }

    setAssigningLessonId(lesson.id)
    try {
      await createAssignment(accessToken, {
        lesson_id: lesson.id,
        class_id: classId,
        subject_id: lesson.subject_id,
        target_type: 'class',
        required_completion_percent: 80,
      })
      alert('Giao bài thành công!')
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    } catch (error) {
      alert('Lỗi giao bài: ' + (error as Error).message)
    } finally {
      setAssigningLessonId(null)
    }
  }

  if (viewMode === 'list') {
    return (
      <RequireAuth allowedRoles={['teacher']}>
        <div className={styles.wizardContainer}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <h1>📚 Thư Viện Bài Học Của Tôi</h1>
              <button className={styles.btnPrimary} onClick={startCreateLesson}>+ Tạo bài mới</button>
            </div>
            <p style={{ color: '#636e72' }}>Quản lý nội dung bài giảng và giao bài cho các lớp của bạn ngay tại đây.</p>
          </div>

          <div className={styles.content}>
            <div className={styles.scrollArea}>
              <div className={styles.lessonListGrid}>
                {lessonsQuery.data?.map((lesson) => (
                  <div key={lesson.id} className={styles.lessonCard}>
                    <div className={styles.lessonCardMeta}>
                      <span className={styles.badge}>{lesson.subject?.name || 'Môn học'}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#636e72' }}>
                        {DIFFICULTY_LEVELS.find((item) => item.value === lesson.primary_level)?.icon} {DIFFICULTY_LEVELS.find((item) => item.value === lesson.primary_level)?.label}
                      </span>
                    </div>
                    <h3 className={styles.lessonCardTitle}>{lesson.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: '#636e72', margin: 0 }}>{lesson.description || 'Không có mô tả.'}</p>
                    <div className={styles.lessonCardTags}>
                      <span className={styles.badgeSecondary}>{lesson.activity_count} Hoạt động</span>
                    </div>
                    <div className={styles.lessonCardActions}>
                      <button
                        className={`${styles.btnAction} ${styles.btnAssign}`}
                        onClick={() => handleQuickAssign(lesson)}
                        disabled={assigningLessonId === lesson.id}
                      >
                        {assigningLessonId === lesson.id ? 'Đang giao...' : 'Giao bài'}
                      </button>
                      <button className={`${styles.btnAction} ${styles.btnEdit}`} onClick={() => openEditLesson(lesson)} disabled={isLoadingEdit}>Chỉnh sửa</button>
                      <button className={`${styles.btnAction} ${styles.btnSecondary}`} onClick={() => { if (confirm('Xóa bài học này?')) deleteMutation.mutate(lesson.id) }}>Xóa</button>
                    </div>
                  </div>
                ))}
                {lessonsQuery.data?.length === 0 && <p>Bạn chưa có bài học nào. Hãy bấm "Tạo bài mới" để bắt đầu.</p>}
                {lessonsQuery.isLoading && <p>Đang tải bài học...</p>}
              </div>
            </div>
          </div>
        </div>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className={styles.wizardContainer}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setViewMode('list')
                  setEditingLessonId(null)
                  resetWizardDraft()
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                ← Quay lại
              </button>
              <h1>{editingLessonId ? '✏️ Chỉnh Sửa Bài Học' : '🛠️ Xây Dựng Bài Học Thông Minh'}</h1>
            </div>
            <div className={styles.autoFillBadge}>
              {editingLessonId ? 'Đang sửa bài đã lưu' : isAutoFilled ? '✨ Đã nạp mẫu theo môn đã chọn' : '💡 Chọn môn để nạp khung bài'}
            </div>
          </div>
          <div className={styles.stepIndicator}>
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={styles.stepWrapper}>
                <div className={`${styles.step} ${currentStep === step ? styles.active : ''} ${currentStep > step ? styles.completed : ''}`}>
                  <span>{currentStep > step ? '✓' : step}</span>
                  <p>{step === 1 ? 'Thiết lập' : step === 2 ? 'Hoạt động 1' : step === 3 ? 'Hoạt động 2' : 'Xác nhận'}</p>
                </div>
                {step < 4 ? <div className={`${styles.line} ${currentStep > step ? styles.lineCompleted : ''}`}></div> : null}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.scrollArea}>
            {currentStep === 1 ? (
              <StepOne
                draft={lessonDraft}
                subjects={mergedSubjects}
                classes={classesQuery.data || []}
                onLevelSelect={handleLevelSelect}
                onSubSelect={handleSubjectSelect}
                onClassSelect={handleClassSelect}
                onInfoChange={handleInfoChange}
              />
            ) : null}

            {(currentStep === 2 || currentStep === 3) ? (
              lessonDraft.activities[currentStep - 2] ? (
                <StepBuilder
                  level={lessonDraft.difficulty_level}
                  activity={lessonDraft.activities[currentStep - 2]}
                  onChange={(nextActivity) => updateActivityDraft(currentStep - 2, () => nextActivity)}
                  onLegacyStepChange={(stepIndex, field, value) => handleLegacyStepChange(currentStep - 2, stepIndex, field, value)}
                  onLegacyUpload={(stepIndex, file) => handleLegacyStepUpload(currentStep - 2, stepIndex, file)}
                  onStructuredMediaUpload={(file) => handleStructuredMediaUpload(currentStep - 2, file)}
                  onStructuredAudioUpload={(file) => handleStructuredAudioUpload(currentStep - 2, file)}
                  onChoiceCardUpload={(field, cardIndex, file) => handleChoiceCardUpload(currentStep - 2, field, cardIndex, file)}
                  isH1={currentStep === 2}
                  token={accessToken!}
                  lessonTitle={lessonDraft.title}
                  subjectName={lessonDraft.subject_name}
                  onApprove={() => approveActivity(currentStep - 2)}
                />
              ) : (
                <div className={styles.stepContent}>
                  <div className={styles.sectionHeader}>
                    <h2>✨ Hoạt động trống</h2>
                    <p>Chưa có hoạt động cho bước này. Vui lòng quay lại Bước 1 hoàn tất: chọn lớp, chọn mức độ, chọn môn và điền tiêu đề bài học để hệ thống nạp khung hoạt động tự động.</p>
                  </div>
                </div>
              )
            ) : null}

            {currentStep === 4 ? <StepReview draft={lessonDraft} onApproveActivity={approveActivity} /> : null}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnSecondary} onClick={() => setCurrentStep((prev) => prev - 1)} disabled={editingLessonId ? currentStep <= 2 : currentStep === 1}>← Quay lại</button>
          <div className={styles.spacer}></div>
          {currentStep < 4 ? (
            (() => {
              const canProceed = () => {
                if (currentStep === 1) {
                  return Boolean(lessonDraft.class_id && lessonDraft.difficulty_level && lessonDraft.subject_id && lessonDraft.title && lessonDraft.title.trim())
                }

                if (currentStep === 2 || currentStep === 3) {
                  const activity = lessonDraft.activities[currentStep - 2]
                  if (!activity) return false
                  if (isStructuredLessonLevel(lessonDraft.difficulty_level)) {
                    return getStructuredActivityValidationError(activity) === null
                  }
                  return Boolean(activity.title && activity.title.trim())
                }

                return true
              }

              return (
                <button type="button" className={styles.btnPrimary} onClick={() => setCurrentStep((prev) => prev + 1)} disabled={!canProceed()}>Tiếp theo →</button>
              )
            })()
          ) : (
            <button type="button" className={styles.btnSuccess} onClick={handleSave} disabled={isUploading}>
              {isUploading ? '⌛ Đang tải file...' : editingLessonId ? '✅ Cập nhật bài học' : '🚀 Hoàn thành & Lưu bài học'}
            </button>
          )}
        </div>
      </div>
    </RequireAuth>
  )
}

export function AssignModal({ lesson, classes, onClose, token }: { lesson: LessonItem; classes: ClassItem[]; onClose: () => void; token: string }) {
  const [classId, setClassId] = useState('')
  const [percent, setPercent] = useState('80')
  const [dueAt, setDueAt] = useState('')
  const queryClient = useQueryClient()

  const assignMutation = useMutation({
    mutationFn: () => createAssignment(token, {
      lesson_id: lesson.id,
      class_id: Number(classId),
      subject_id: lesson.subject_id,
      target_type: 'class',
      due_at: dueAt || undefined,
      required_completion_percent: Number(percent),
    }),
    onSuccess: () => {
      alert('🚀 Giao bài thành công!')
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      onClose()
    },
  })

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>🚀 Giao bài nhanh</h2>
          <p>Giao bài <strong>{lesson.title}</strong> cho lớp của bạn.</p>
        </div>
        <div className={styles.formStack}>
          <div className={styles.formSection}>
            <label className={styles.label}>Chọn lớp học</label>
            <select className={styles.select} value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">-- Chọn lớp --</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className={styles.formSection}>
            <label className={styles.label}>Mức hoàn thành (%)</label>
            <select className={styles.select} value={percent} onChange={(event) => setPercent(event.target.value)}>
              <option value="70">70% (Dễ)</option>
              <option value="80">80% (Phổ biến)</option>
              <option value="100">100% (Bắt buộc)</option>
            </select>
          </div>
          <div className={styles.formSection}>
            <label className={styles.label}>Hạn nộp (Không bắt buộc)</label>
            <input className={styles.input} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnAction} ${styles.btnGhost}`} onClick={onClose}>Hủy</button>
          <button className={`${styles.btnAction} ${styles.btnAssign}`} onClick={() => assignMutation.mutate()} disabled={!classId || assignMutation.isPending}>
            {assignMutation.isPending ? 'Đang giao...' : 'Xác nhận giao bài'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepOne({
  draft,
  subjects,
  classes,
  onLevelSelect,
  onSubSelect,
  onClassSelect,
  onInfoChange,
}: {
  draft: LessonDraft
  subjects: Array<{ id: number; name: string; icon: string }>
  classes: Array<{ id: number; name: string }>
  onLevelSelect: (level: LessonLevel) => void
  onSubSelect: (id: number, name: string) => void
  onClassSelect: (id: number, name: string) => void
  onInfoChange: (field: keyof Pick<LessonDraft, 'title' | 'theme' | 'description'>, value: string) => void
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <h2>🎯 Thiết lập cơ bản</h2>
        <p>
          Chọn mức độ và môn học để hệ thống nạp khung bài. <strong>Mức nhẹ</strong> và <strong>mức trung bình</strong> sẽ có form tạo câu hỏi theo hình thức như trong
          <code style={{ marginLeft: '0.35rem' }}>kehoach.html</code>.
        </p>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Mức độ nhận thức</label>
        <div className={styles.levelSelector}>
          {DIFFICULTY_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              className={`${styles.levelCard} ${draft.difficulty_level === level.value ? styles.selected : ''}`}
              onClick={() => onLevelSelect(level.value)}
              style={{ '--accent-color': level.color } as CSSProperties}
            >
              <span className={styles.levelIcon}>{level.icon}</span>
              <span>{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Chọn lớp</label>
        <div className={styles.subjectGrid}>
          {classes && classes.length ? classes.map((cls) => (
            <button
              key={`class-${cls.id}`}
              type="button"
              className={`${styles.subjectCard} ${draft.class_id === cls.id ? styles.selected : ''}`}
              onClick={() => onClassSelect(cls.id, cls.name)}
            >
              <span className={styles.subjectIcon}>🏫</span>
              <span>{cls.name}</span>
            </button>
          )) : <p>Đang tải danh sách lớp...</p>}
        </div>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Môn học mục tiêu {!draft.difficulty_level ? <span style={{ color: '#9ca3af', fontWeight: 500 }}> — Chọn mức độ trước</span> : null}</label>
        <div className={styles.subjectGrid}>
          {subjects.length > 0 ? subjects.map((subject) => (
            <button
              key={`${subject.id}-${subject.name}`}
              type="button"
              className={`${styles.subjectCard} ${draft.subject_id === subject.id ? styles.selected : ''}`}
              onClick={() => onSubSelect(subject.id, subject.name)}
            >
              <span className={styles.subjectIcon}>{subject.icon || '📘'}</span>
              <span>{subject.name}</span>
            </button>
          )) : <p>Đang tải danh sách môn học...</p>}
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formSection}>
          <label className={styles.label}>Tiêu đề bài học</label>
          <input className={styles.input} value={draft.title} onChange={(event) => onInfoChange('title', event.target.value)} placeholder="Ví dụ: Nhận diện nhân vật..." />
        </div>
        <div className={styles.formSection}>
          <label className={styles.label}>Chủ đề</label>
          <input className={styles.input} value={draft.theme} onChange={(event) => onInfoChange('theme', event.target.value)} placeholder="Ví dụ: Truyện cổ tích, Màu sắc..." />
        </div>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Mô tả bài học</label>
        <textarea
          className={styles.input}
          value={draft.description}
          onChange={(event) => onInfoChange('description', event.target.value)}
          placeholder="Mô tả ngắn về mục tiêu và nội dung bài học..."
          rows={3}
          style={{ resize: 'none', minHeight: '80px' }}
        />
      </div>
    </div>
  )
}

function StepBuilder({
  level,
  activity,
  onChange,
  onLegacyStepChange,
  onLegacyUpload,
  onStructuredMediaUpload,
  onStructuredAudioUpload,
  onChoiceCardUpload,
  isH1,
  token,
  lessonTitle,
  subjectName,
  onApprove,
}: {
  level?: LessonLevel
  activity: ActivityDraft
  onChange: (activity: ActivityDraft) => void
  onLegacyStepChange: (stepIndex: number, field: keyof EnhancedStepItem, value: string | number | string[]) => void
  onLegacyUpload: (stepIndex: number, file: File) => void
  onStructuredMediaUpload: (file: File) => void
  onStructuredAudioUpload: (file: File) => void
  onChoiceCardUpload: (field: 'choice_cards' | 'aac_image_cards', cardIndex: number, file: File) => void
  isH1: boolean
  token: string
  lessonTitle: string
  subjectName?: string
  onApprove: () => void
}) {
  if (isStructuredLessonLevel(level)) {
    return (
      <MediumActivityBuilder
        activity={activity}
        onChange={onChange}
        onStructuredMediaUpload={onStructuredMediaUpload}
        onStructuredAudioUpload={onStructuredAudioUpload}
        onChoiceCardUpload={onChoiceCardUpload}
        isH1={isH1}
        token={token}
        lessonTitle={lessonTitle}
        subjectName={subjectName}
        level={level}
        onApprove={onApprove}
      />
    )
  }

  return (
    <LegacyStepBuilder
      activity={activity}
      onChange={onChange}
      onLegacyStepChange={onLegacyStepChange}
      onLegacyUpload={onLegacyUpload}
      isH1={isH1}
    />
  )
}

function LegacyStepBuilder({
  activity,
  onChange,
  onLegacyStepChange,
  onLegacyUpload,
  isH1,
}: {
  activity: ActivityDraft
  onChange: (activity: ActivityDraft) => void
  onLegacyStepChange: (stepIndex: number, field: keyof EnhancedStepItem, value: string | number | string[]) => void
  onLegacyUpload: (stepIndex: number, file: File) => void
  isH1: boolean
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <span className={isH1 ? styles.badge : styles.badgeSecondary}>{isH1 ? 'H1 - BÀI TẬP' : 'H2 - HOẠT ĐỘNG'}</span>
        <h2>{isH1 ? '🎯 Dựng các bước bài tập' : '✨ Dựng các bước trải nghiệm'}</h2>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formSection}>
          <label className={styles.label}>Tên hoạt động</label>
          <input className={styles.input} value={activity.title} onChange={(event) => onChange({ ...activity, title: event.target.value })} />
        </div>
        <div className={styles.formSection}>
          <label className={styles.label}>Kiểu tương tác chính</label>
          <select className={styles.select} value={activity.interaction_type} onChange={(event) => onChange({ ...activity, interaction_type: event.target.value as ActivityDraft['interaction_type'] })}>
            <option value="selection">Trắc nghiệm / Chọn ảnh</option>
            <option value="drag">Kéo thả</option>
            <option value="voice_ai">AI nhận diện giọng nói</option>
            <option value="ai_camera">AI Camera (Theo dõi vận động)</option>
            <option value="3d_interaction">Tương tác vật thể 3D</option>
            <option value="touch">Chạm nhanh</option>
          </select>
        </div>
      </div>

      <div className={styles.stepsGrid}>
        {activity.steps.map((step, stepIndex) => (
          <div key={`${activity.title}-${stepIndex}`} className={styles.stepBuilderCard}>
            <div className={styles.stepNum}>{step.step_number}</div>
            <div className={styles.stepMain}>
              <div className={styles.stepRow}>
                <input className={styles.stepTitleInput} value={step.title} onChange={(event) => onLegacyStepChange(stepIndex, 'title', event.target.value)} />
                <select className={styles.stepTypeSelect} value={step.content_type} onChange={(event) => onLegacyStepChange(stepIndex, 'content_type', event.target.value)}>
                  {STEP_CONTENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <textarea
                className={styles.stepDesc}
                value={step.description}
                onChange={(event) => onLegacyStepChange(stepIndex, 'description', event.target.value)}
                rows={2}
                placeholder="Mô tả chi tiết bước này..."
              />
              <div className={styles.mediaZone}>
                {step.media_url ? (
                  <div className={styles.mediaPreview}>
                    {step.media_kind === 'image' ? <img src={step.media_url} alt="preview" /> : null}
                    {step.media_kind === 'video' ? <video src={step.media_url} /> : null}
                    {step.media_kind === 'audio' ? <div className={styles.audioIcon}>🎵</div> : null}
                    <button className={styles.btnDeleteMedia} onClick={() => onLegacyStepChange(stepIndex, 'media_url', '')}>Xóa</button>
                  </div>
                ) : (
                  <label className={styles.uploadBtn}>
                    <span>📤 Tải lên ảnh hoặc video</span>
                    <input type="file" hidden onChange={(event) => event.target.files?.[0] ? onLegacyUpload(stepIndex, event.target.files[0]) : undefined} />
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

function MediumActivityBuilder({
  activity,
  onChange,
  onStructuredMediaUpload,
  onStructuredAudioUpload,
  onChoiceCardUpload,
  isH1,
  token,
  lessonTitle,
  subjectName,
  level,
  onApprove,
}: {
  activity: ActivityDraft
  onChange: (activity: ActivityDraft) => void
  onStructuredMediaUpload: (file: File) => void
  onStructuredAudioUpload: (file: File) => void
  onChoiceCardUpload: (field: 'choice_cards' | 'aac_image_cards', cardIndex: number, file: File) => void
  isH1: boolean
  token: string
  lessonTitle: string
  subjectName?: string
  level?: LessonLevel
  onApprove: () => void
}) {
  const activityType = isTeacherActivityType(activity.activity_type) ? activity.activity_type : 'image_choice'
  const showSharedMedia = activityType === 'image_puzzle' || Boolean(activity.media_url.trim())
  const showPromptAudio = activityType === 'multiple_choice' || activityType === 'image_choice' || activityType === 'listen_choose'
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [aiSuggestion, setAISuggestion] = useState<LessonQuestionDraftSuggestion | null>(null)
  const [aiError, setAIError] = useState('')
  const [isAILoading, setIsAILoading] = useState(false)
  const levelLabel = level === 'nhe' ? 'mức nhẹ' : 'mức trung bình'

  const updateField = <K extends keyof ActivityDraft>(field: K, value: ActivityDraft[K]) => {
    onChange({ ...activity, [field]: value })
  }

  const updateStringList = (field: 'text_choices' | 'drag_items' | 'drag_targets' | 'step_items' | 'accepted_answers' | 'aac_cards', index: number, value: string) => {
    const nextValues = [...activity[field]]
    nextValues[index] = value
    onChange({ ...activity, [field]: nextValues })
  }

  const addStringListItem = (field: 'text_choices' | 'drag_items' | 'drag_targets' | 'step_items' | 'accepted_answers' | 'aac_cards') => {
    onChange({ ...activity, [field]: [...activity[field], ''] })
  }

  const removeStringListItem = (field: 'text_choices' | 'drag_items' | 'drag_targets' | 'step_items' | 'accepted_answers' | 'aac_cards', index: number) => {
    const nextValues = activity[field].filter((_, itemIndex) => itemIndex !== index)
    onChange({ ...activity, [field]: nextValues.length ? nextValues : [''] })
  }

  const updateMatchingPair = (index: number, side: 'left' | 'right', value: string) => {
    const nextPairs = [...activity.matching_pairs]
    nextPairs[index] = { ...nextPairs[index], [side]: value }
    onChange({ ...activity, matching_pairs: nextPairs })
  }

  const addMatchingPair = () => {
    onChange({ ...activity, matching_pairs: [...activity.matching_pairs, createMatchingPairDraft()] })
  }

  const removeMatchingPair = (index: number) => {
    const nextPairs = activity.matching_pairs.filter((_, pairIndex) => pairIndex !== index)
    onChange({ ...activity, matching_pairs: nextPairs.length ? nextPairs : [createMatchingPairDraft()] })
  }

  const updateChoiceCards = (field: 'choice_cards' | 'aac_image_cards', nextCards: ChoiceCardDraft[]) => {
    let nextActivity: ActivityDraft = { ...activity, [field]: nextCards }
    if (field === 'choice_cards' && !nextCards.some((card) => card.id === activity.correct_choice)) {
      nextActivity = { ...nextActivity, correct_choice: nextCards[0]?.id ?? '' }
    }
    onChange(nextActivity)
  }

  const updateChoiceCard = (field: 'choice_cards' | 'aac_image_cards', index: number, patch: Partial<ChoiceCardDraft>) => {
    const nextCards = [...activity[field]]
    const currentCard = nextCards[index]
    if (!currentCard) return
    nextCards[index] = { ...currentCard, ...patch }
    updateChoiceCards(field, nextCards)
  }

  const addChoiceCard = (field: 'choice_cards' | 'aac_image_cards', labelPrefix: string) => {
    updateChoiceCards(field, [...activity[field], createChoiceCardDraft(`${labelPrefix} ${activity[field].length + 1}`)])
  }

  const removeChoiceCard = (field: 'choice_cards' | 'aac_image_cards', index: number) => {
    const nextCards = activity[field].filter((_, cardIndex) => cardIndex !== index)
    if (!nextCards.length) {
      updateChoiceCards(field, [createChoiceCardDraft(field === 'choice_cards' ? 'Lựa chọn 1' : 'Thẻ 1')])
      return
    }
    updateChoiceCards(field, nextCards)
  }

  const requestAISuggestion = async () => {
    setIsAIOpen(true)
    setAIError('')
    setIsAILoading(true)
    try {
      const response = await generateLessonQuestionDraft(token, {
        subject_name: subjectName,
        lesson_title: lessonTitle,
        difficulty_level: level,
        activity_slot: isH1 ? 'H1' : 'H2',
        activity_title: activity.title,
        activity_type: activityType,
        current_prompt: activity.prompt,
        objective: activity.objective,
      })
      setAISuggestion(response.suggestion)
    } catch (error) {
      const message = (error as Error).message || ''
      setAIError(
        message.toLowerCase().includes('high demand')
          ? 'Gemini đang quá tải tạm thời. Bạn bấm tạo lại sau vài giây, hoặc dùng bản nháp hiện có để sửa tiếp.'
          : message.includes('Unterminated string') || message.includes('JSON')
          ? 'AI trả nội dung chưa đúng định dạng. Bạn bấm tạo lại giúp mình, hoặc thử đổi loại câu hỏi.'
          : message || 'AI chưa tạo được gợi ý.',
      )
    } finally {
      setIsAILoading(false)
    }
  }

  const applyAISuggestionToPreview = () => {
    if (!aiSuggestion) return
    onChange(applyLessonQuestionSuggestion(activity, aiSuggestion))
    setAIError('')
  }

  return (
    <div className={`${styles.stepContent} ${styles.mediumStepContent}`}>
      <div className={styles.mediumBuilderLayout}>
        <div className={styles.mediumFormColumn}>
          <div className={styles.sectionHeader}>
            <span className={isH1 ? styles.badge : styles.badgeSecondary}>{isH1 ? 'H1 - BÀI TẬP' : 'H2 - HOẠT ĐỘNG'}</span>
            <h2>{isH1 ? `Form câu hỏi ${levelLabel}` : `Form hoạt động ${levelLabel}`}</h2>
            <p>
              Giáo viên đang nhập theo <strong>hình thức câu hỏi</strong> để hệ thống lưu đúng cấu trúc mà màn học sinh đã render được sẵn.
            </p>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formSection}>
              <label className={styles.label}>Tên hoạt động</label>
              <input className={styles.input} value={activity.title} onChange={(event) => updateField('title', event.target.value)} />
            </div>
            <div className={styles.formSection}>
              <label className={styles.label}>Loại câu hỏi</label>
              <div className={styles.lockedTypeBox}>
                <strong>{TEACHER_ACTIVITY_TYPE_LABEL_MAP[activityType]}</strong>
                <span>Form này đã khóa theo môn, mức độ và H{isH1 ? '1' : '2'}.</span>
              </div>
              <p className={styles.helperText}>{mediumActivityTypeDescription(activityType)}</p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formSection}>
              <label className={styles.label}>Mục tiêu / hướng dẫn</label>
              <textarea className={styles.input} rows={3} value={activity.objective} onChange={(event) => updateField('objective', event.target.value)} />
            </div>
            <div className={styles.formSection}>
              <label className={styles.label}>Câu hỏi / lời dẫn chính</label>
              <textarea className={styles.input} rows={3} value={activity.prompt} onChange={(event) => updateField('prompt', event.target.value)} />
            </div>
          </div>

          {showSharedMedia ? (
            <div className={styles.builderPanel}>
              <div className={styles.formSection}>
                <label className={styles.label}>Ảnh hoặc video minh họa chung</label>
                <div className={styles.inlineBuilderRow}>
                  <input
                    className={styles.input}
                    value={activity.media_url}
                    onChange={(event) => updateField('media_url', event.target.value)}
                    placeholder="Dán URL ảnh/video hoặc upload file"
                  />
                  <select className={styles.select} value={activity.media_kind} onChange={(event) => updateField('media_kind', event.target.value as ActivityDraft['media_kind'])}>
                    <option value="">Chưa chọn</option>
                    <option value="image">Ảnh</option>
                    <option value="video">Video</option>
                  </select>
                  <label className={styles.smallUploadBtn}>
                    Upload
                    <input type="file" accept="image/*,video/*" hidden onChange={(event) => event.target.files?.[0] ? onStructuredMediaUpload(event.target.files[0]) : undefined} />
                  </label>
                </div>
                {activity.media_url ? (
                  <div className={styles.mediaPreviewInline}>
                    {activity.media_kind === 'image' ? <img src={activity.media_url} alt="preview" /> : null}
                    {activity.media_kind === 'video' ? <video src={activity.media_url} controls /> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {showPromptAudio ? (
            <div className={styles.builderPanel}>
              <div className={styles.builderSectionHeader}>
                <h3>Audio câu hỏi</h3>
                <span className={styles.helperBadge}>Hỗ trợ text-to-speech hoặc file ghi âm</span>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formSection}>
                  <label className={styles.label}>Nội dung audio / text đọc</label>
                  <textarea
                    className={styles.input}
                    rows={2}
                    value={activity.audio_text}
                    onChange={(event) => updateField('audio_text', event.target.value)}
                    placeholder="Ví dụ: Nam châm có hút sắt không?"
                  />
                </div>
                <div className={styles.formSection}>
                  <label className={styles.label}>Audio URL hoặc file đã upload</label>
                  <input
                    className={styles.input}
                    value={activity.audio_url}
                    onChange={(event) => updateField('audio_url', event.target.value)}
                    placeholder="Có thể để trống và dùng audio_text"
                  />
                </div>
              </div>
              <div className={styles.audioControlRow}>
                <div className={styles.audioLangGroup}>
                  <label className={styles.label}>Ngôn ngữ đọc</label>
                  <select className={styles.select} value={activity.audio_lang} onChange={(event) => updateField('audio_lang', event.target.value)}>
                    <option value="vi-VN">Tiếng Việt</option>
                    <option value="en-US">Tiếng Anh</option>
                  </select>
                </div>
                <label className={styles.smallUploadBtn}>
                  Upload audio
                  <input type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,audio/*" hidden onChange={(event) => event.target.files?.[0] ? onStructuredAudioUpload(event.target.files[0]) : undefined} />
                </label>
              </div>
              {activity.audio_url ? (
                <div className={styles.audioPreviewBox}>
                  <audio controls preload="metadata" src={activity.audio_url} />
                </div>
              ) : null}
            </div>
          ) : null}

          {activityType === 'multiple_choice' ? (
            <StringListEditor
              label="Danh sách đáp án chữ"
              values={activity.text_choices}
              onChange={(index, value) => updateStringList('text_choices', index, value)}
              onAdd={() => addStringListItem('text_choices')}
              onRemove={(index) => removeStringListItem('text_choices', index)}
              placeholder="Nhập đáp án"
              trailing={
                <div className={styles.formSection}>
                  <label className={styles.label}>Đáp án đúng</label>
                  <select className={styles.select} value={activity.correct_choice} onChange={(event) => updateField('correct_choice', event.target.value)}>
                    <option value="">-- Chọn đáp án đúng --</option>
                    {activity.text_choices.map((choice, index) => (
                      <option key={`${choice}-${index}`} value={choice}>{choice || `Đáp án ${index + 1}`}</option>
                    ))}
                  </select>
                </div>
              }
            />
          ) : null}

          {(activityType === 'image_choice' || activityType === 'listen_choose' || (activityType === 'multiple_choice' && activity.choice_cards.some((card) => card.media_url.trim()))) ? (
            <ChoiceCardEditor
              label="Các lựa chọn bằng ảnh"
              cards={activity.choice_cards}
              correctChoice={activity.correct_choice}
              onCardChange={(cardIndex, patch) => updateChoiceCard('choice_cards', cardIndex, patch)}
              onAdd={() => addChoiceCard('choice_cards', 'Lựa chọn')}
              onRemove={(cardIndex) => removeChoiceCard('choice_cards', cardIndex)}
              onCorrectChange={(value) => updateField('correct_choice', value)}
              onUpload={(cardIndex, file) => onChoiceCardUpload('choice_cards', cardIndex, file)}
            />
          ) : null}

          {activityType === 'image_puzzle' ? (
            <div className={styles.builderPanel}>
              <div className={styles.formGrid}>
                <div className={styles.formSection}>
                  <label className={styles.label}>Số hàng</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    max={4}
                    value={activity.puzzle_rows}
                    onChange={(event) => updateField('puzzle_rows', Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
                <div className={styles.formSection}>
                  <label className={styles.label}>Số cột</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={2}
                    max={4}
                    value={activity.puzzle_cols}
                    onChange={(event) => updateField('puzzle_cols', Math.max(2, Number(event.target.value) || 2))}
                  />
                </div>
              </div>
              <p className={styles.helperText}>Dùng cho bài ghép 2 mảnh, 4 mảnh hoặc ảnh chia ô đơn giản theo đúng mẫu trong `nang.html`.</p>
            </div>
          ) : null}

          {activityType === 'matching' ? (
            <MatchingPairEditor
              pairs={activity.matching_pairs}
              onChange={updateMatchingPair}
              onAdd={addMatchingPair}
              onRemove={removeMatchingPair}
            />
          ) : null}

          {activityType === 'drag_drop' ? (
            <>
          <StringListEditor
            label="Các mục cần kéo"
            values={activity.drag_items}
            onChange={(index, value) => updateStringList('drag_items', index, value)}
            onAdd={() => addStringListItem('drag_items')}
                onRemove={(index) => removeStringListItem('drag_items', index)}
                placeholder="Ví dụ: Kim tự tháp"
              />
          <StringListEditor
            label="Nhóm / vị trí đích"
            values={activity.drag_targets}
            onChange={(index, value) => updateStringList('drag_targets', index, value)}
            onAdd={() => addStringListItem('drag_targets')}
            onRemove={(index) => removeStringListItem('drag_targets', index)}
            placeholder="Ví dụ: Hình chóp"
          />
          <div className={styles.builderPanel}>
            <div className={styles.formSection}>
              <label className={styles.label}>Phong cách hiển thị</label>
              <select className={styles.select} value={activity.visual_style} onChange={(event) => updateField('visual_style', event.target.value)}>
                <option value="">Chuẩn</option>
                <option value="shape_3d">Khối 3D / giả 3D</option>
              </select>
              <p className={styles.helperText}>Dùng `Khối 3D` cho các bài phân loại hình khối hoặc đồ vật có dạng không gian.</p>
            </div>
          </div>
        </>
      ) : null}

          {activityType === 'watch_answer' ? (
            <div className={styles.builderPanel}>
              <div className={styles.formGrid}>
                <div className={styles.formSection}>
                  <label className={styles.label}>Kiểu trả lời</label>
                  <select className={styles.select} value={activity.answer_mode} onChange={(event) => updateField('answer_mode', event.target.value as AnswerMode)}>
                    <option value="text">Nhập câu trả lời</option>
                    <option value="voice_ai_grade">Nói và AI chấm</option>
                    <option value="none">Chỉ xác nhận đã làm xong</option>
                  </select>
                </div>
                <div className={styles.formSection}>
                  <label className={styles.label}>Đáp án mong đợi</label>
                  <input className={styles.input} value={activity.expected_answer} onChange={(event) => updateField('expected_answer', event.target.value)} placeholder="Ví dụ: Báo cô giáo" />
                </div>
              </div>
              <StringListEditor
                label="Các đáp án chấp nhận thêm"
                values={activity.accepted_answers}
                onChange={(index, value) => updateStringList('accepted_answers', index, value)}
                onAdd={() => addStringListItem('accepted_answers')}
                onRemove={(index) => removeStringListItem('accepted_answers', index)}
                placeholder="Ví dụ: Em báo cô"
              />
            </div>
          ) : null}

          {activityType === 'step_by_step' ? (
            <StringListEditor
              label="Danh sách các bước"
              values={activity.step_items}
              onChange={(index, value) => updateStringList('step_items', index, value)}
              onAdd={() => addStringListItem('step_items')}
              onRemove={(index) => removeStringListItem('step_items', index)}
              placeholder="Nhập từng bước giáo viên muốn học sinh làm"
            />
          ) : null}

          {activityType === 'aac' ? (
            <>
              <StringListEditor
                label="Thẻ chữ"
                values={activity.aac_cards}
                onChange={(index, value) => updateStringList('aac_cards', index, value)}
                onAdd={() => addStringListItem('aac_cards')}
                onRemove={(index) => removeStringListItem('aac_cards', index)}
                placeholder="Ví dụ: Báo cô giáo"
              />
              <ChoiceCardEditor
                label="Thẻ hình (nếu muốn)"
                cards={activity.aac_image_cards}
                correctChoice=""
                onCardChange={(cardIndex, patch) => updateChoiceCard('aac_image_cards', cardIndex, patch)}
                onAdd={() => addChoiceCard('aac_image_cards', 'Thẻ')}
                onRemove={(cardIndex) => removeChoiceCard('aac_image_cards', cardIndex)}
                onCorrectChange={() => {}}
                onUpload={(cardIndex, file) => onChoiceCardUpload('aac_image_cards', cardIndex, file)}
                hideCorrectChoice
              />
            </>
          ) : null}

          {activity.suggested_steps.length ? (
            <div className={styles.referencePanel}>
              <h3>Gợi ý từ khung bài hiện tại</h3>
              <div className={styles.referenceStepList}>
                {activity.suggested_steps.map((step) => (
                  <div key={`${activity.title}-${step.step_number}-${step.title}`} className={styles.referenceStepItem}>
                    <strong>B{step.step_number}. {step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.mediumPreviewColumn}>
          <StudentActivityPreview
            activity={activity}
            sortOrder={isH1 ? 1 : 2}
            level={level}
            title={isH1 ? 'Preview hoạt động H1' : 'Preview hoạt động H2'}
            description="Khung này bám theo giao diện học sinh thật. Audio chỉ phát khi bấm nghe lại để tránh làm phiền lúc giáo viên nhập liệu."
            extraActions={
              <button type="button" className={styles.aiOpenButton} onClick={() => setIsAIOpen((current) => !current)}>
                AI
              </button>
            }
            onApprove={onApprove}
          />
          {isAIOpen ? (
            <div className={styles.aiAssistantPanel}>
              <div className={styles.aiAssistantHeader}>
                <div>
                  <span className={styles.previewEyebrow}>AI trợ lý</span>
                  <h3>{isH1 ? 'Gợi ý câu hỏi H1' : 'Gợi ý hoạt động H2'}</h3>
                  <p>AI dùng đúng loại câu hỏi đang chọn, đúng môn và bài học hiện tại.</p>
                </div>
                <button type="button" className={styles.previewCloseButton} onClick={() => setIsAIOpen(false)}>Đóng</button>
              </div>
              <div className={styles.aiChoiceGrid}>
                <button type="button" className={styles.aiPrimaryButton} onClick={requestAISuggestion} disabled={isAILoading}>
                  {isAILoading ? 'Đang tạo...' : '1. Tạo cho tôi câu hỏi đó'}
                </button>
                <button type="button" className={styles.aiApplyButton} onClick={applyAISuggestionToPreview} disabled={!aiSuggestion || isAILoading}>
                  2. Add câu hỏi vào Preview
                </button>
              </div>
              {aiError ? <p className={styles.aiErrorText}>{aiError}</p> : null}
              {aiSuggestion ? (
                <div className={styles.aiSuggestionBox}>
                  <div className={styles.aiSuggestionMeta}>
                    <span>{TEACHER_ACTIVITY_TYPE_LABEL_MAP[(isTeacherActivityType(cleanAIString(aiSuggestion.activity_type)) ? cleanAIString(aiSuggestion.activity_type) : activityType) as TeacherActivityType]}</span>
                    {aiSuggestion.media_sources?.length ? <span>Đã tìm media: {aiSuggestion.media_sources.length}</span> : null}
                  </div>
                  <h4>{aiSuggestion.title || activity.title}</h4>
                  <p>{aiSuggestion.teacher_note || aiSuggestion.objective || 'AI đã tạo một bản nháp phù hợp để giáo viên xem thử.'}</p>
                  {getAISuggestionCards(aiSuggestion).some((card) => card.media_url) ? (
                    <div className={styles.aiCardPreviewGrid}>
                      {getAISuggestionCards(aiSuggestion).filter((card) => card.media_url).slice(0, 4).map((card) => (
                        <figure key={`${card.id}-${card.media_url}`} className={styles.aiCardPreview}>
                          <img src={card.media_url} alt={card.label} />
                          <figcaption>{card.label}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.aiPreviewSnippet}>
                    <strong>Câu hỏi</strong>
                    <span>{aiSuggestion.prompt || activity.prompt}</span>
                  </div>
                  {aiSuggestion.example ? (
                    <div className={styles.aiPreviewSnippet}>
                      <strong>Ví dụ</strong>
                      <span>{aiSuggestion.example}</span>
                    </div>
                  ) : null}
                  {aiSuggestion.correct_choice ? (
                    <div className={styles.aiPreviewSnippet}>
                      <strong>Đáp án</strong>
                      <span>{getAISuggestionAnswerText(aiSuggestion)}</span>
                    </div>
                  ) : null}
                  {(aiSuggestion.media_url || aiSuggestion.media_sources?.[0]?.media_url) ? (
                    <a
                      className={styles.aiMediaLink}
                      href={aiSuggestion.media_url || aiSuggestion.media_sources?.[0]?.media_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở media AI tìm được
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className={styles.aiEmptyBox}>Chọn loại câu hỏi trước, rồi bấm lựa chọn 1 để AI tư vấn nội dung và đáp án.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StudentActivityPreview({
  activity,
  sortOrder,
  level,
  title,
  description,
  extraActions,
  onApprove,
}: {
  activity: ActivityDraft
  sortOrder: number
  level?: LessonLevel
  title?: string
  description?: string
  extraActions?: ReactNode
  onApprove?: () => void
}) {
  const previewActivity = useMemo(() => buildPreviewActivityItem(activity, sortOrder, level), [activity, sortOrder, level])
  const previewKey = `${previewActivity.activity_type}:${previewActivity.title}:${previewActivity.config_json ?? ''}`
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, string>>({})
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, string[]>>({})
  const [dragAnswers, setDragAnswers] = useState<Record<number, string[]>>({})
  const [stepAnswers, setStepAnswers] = useState<Record<number, boolean[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({})
  const [aacSelections, setAacSelections] = useState<Record<number, string>>({})
  const [previewVersion, setPreviewVersion] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const resetPreviewAnswers = () => {
    setChoiceAnswers({})
    setMatchingAnswers({})
    setDragAnswers({})
    setStepAnswers({})
    setTextAnswers({})
    setAacSelections({})
  }

  useEffect(() => {
    resetPreviewAnswers()
  }, [previewKey])

  useEffect(() => {
    if (!isPreviewOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isPreviewOpen])

  return (
    <aside className={styles.previewLauncherPanel}>
      <div>
        <span className={styles.previewEyebrow}>Xem như học sinh</span>
        <h3>{title || 'Preview bài học'}</h3>
        <p>{description || 'Kiểm tra nhanh bố cục, audio và cách tương tác trước khi lưu.'}</p>
      </div>
      <div className={styles.previewLauncherActions}>
        {extraActions}
        <button type="button" className={styles.previewOpenButton} onClick={() => setIsPreviewOpen(true)}>
          Preview
        </button>
      </div>

      {isPreviewOpen ? (
        <div className={styles.previewPageOverlay} role="dialog" aria-modal="true" onClick={() => setIsPreviewOpen(false)}>
          <section className={styles.previewPage} onClick={(event) => event.stopPropagation()}>
            <div className={styles.previewHeader}>
              <div>
                <span className={styles.previewEyebrow}>Xem như học sinh</span>
                <h3>{title || 'Preview bài học'}</h3>
                <p>{description || 'Kiểm tra nhanh bố cục, audio và cách tương tác trước khi lưu.'}</p>
              </div>
              <div className={styles.previewPageActions}>
                {onApprove ? (
                  <button type="button" className={styles.btnSuccess} onClick={onApprove}>Duyệt</button>
                ) : null}
                <button
                  type="button"
                  className={styles.previewResetButton}
                  onClick={() => {
                    resetPreviewAnswers()
                    setPreviewVersion((current) => current + 1)
                  }}
                >
                  Làm lại
                </button>
                <button type="button" className={styles.previewCloseButton} onClick={() => setIsPreviewOpen(false)}>
                  Đóng
                </button>
              </div>
            </div>
            <div className={styles.previewCanvas}>
              <ActivityCard
                key={`${previewKey}-${previewVersion}`}
                activity={previewActivity}
                answers={{
                  choiceAnswers,
                  matchingAnswers,
                  dragAnswers,
                  stepAnswers,
                  textAnswers,
                  aacSelections,
                }}
                setAnswers={{
                  setChoiceAnswers,
                  setMatchingAnswers,
                  setDragAnswers,
                  setStepAnswers,
                  setTextAnswers,
                  setAacSelections,
                }}
                presentationMode="immersive_square"
              />
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  )
}

function StepReview({ draft, onApproveActivity }: { draft: LessonDraft; onApproveActivity: (index: number) => void }) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.sectionHeader}>
        <h2>🏁 Xác nhận cấu hình</h2>
        <p>Kiểm tra lại môn học, mức độ và hai hoạt động trước khi lưu.</p>
      </div>
      <div className={styles.reviewLayout}>
        <div className={styles.reviewMain}>
          <h3>{draft.title}</h3>
          <div className={styles.reviewMeta}>
            <span>📍 {draft.subject_name}</span>
            <span>📊 Mức: {draft.difficulty_level}</span>
          </div>
          <p style={{ color: '#636e72', marginTop: '1rem' }}>{draft.description || 'Chưa có mô tả.'}</p>
        </div>
        <div className={styles.reviewGrid}>
          {draft.activities.map((activity, index) => (
            <div key={`${activity.title}-${index}`} className={styles.reviewBox}>
              <h4>{index === 0 ? 'Hoạt động H1' : 'Hoạt động H2'}</h4>
              <p><strong>{activity.title}</strong></p>
              <p>{isTeacherActivityType(activity.activity_type) ? TEACHER_ACTIVITY_TYPE_LABEL_MAP[activity.activity_type] : 'Theo từng bước'}</p>
              <p style={{ color: '#636e72' }}>{activity.prompt || activity.objective}</p>
            </div>
          ))}
        </div>
      </div>
      {isStructuredLessonLevel(draft.difficulty_level) ? (
        <div className={styles.reviewPreviewGrid}>
          {draft.activities.map((activity, index) => (
            <StudentActivityPreview
              key={`review-preview-${activity.title}-${index}`}
              activity={activity}
              sortOrder={index + 1}
              level={draft.difficulty_level}
                  title={index === 0 ? 'Preview H1 trước khi lưu' : 'Preview H2 trước khi lưu'}
                  onApprove={() => onApproveActivity(index)}
              description="Đây là mô phỏng cuối cùng để giáo viên kiểm tra câu hỏi, media và cách tương tác."
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StringListEditor({
  label,
  values,
  onChange,
  onAdd,
  onRemove,
  placeholder,
  trailing,
}: {
  label: string
  values: string[]
  onChange: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
  placeholder: string
  trailing?: ReactNode
}) {
  return (
    <div className={styles.builderPanel}>
      <div className={styles.builderSectionHeader}>
        <h3>{label}</h3>
        <button type="button" className={styles.inlineAddButton} onClick={onAdd}>+ Thêm</button>
      </div>
      <div className={styles.repeatList}>
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className={styles.repeatRow}>
            <input className={styles.input} value={value} onChange={(event) => onChange(index, event.target.value)} placeholder={placeholder} />
            <button type="button" className={styles.inlineRemoveButton} onClick={() => onRemove(index)}>Xóa</button>
          </div>
        ))}
      </div>
      {trailing}
    </div>
  )
}

function MatchingPairEditor({
  pairs,
  onChange,
  onAdd,
  onRemove,
}: {
  pairs: MatchingPairDraft[]
  onChange: (index: number, side: 'left' | 'right', value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className={styles.builderPanel}>
      <div className={styles.builderSectionHeader}>
        <h3>Các cặp ghép</h3>
        <button type="button" className={styles.inlineAddButton} onClick={onAdd}>+ Thêm cặp</button>
      </div>
      <div className={styles.repeatList}>
        {pairs.map((pair, index) => (
          <div key={`pair-${index}`} className={styles.pairRow}>
            <input className={styles.input} value={pair.left} onChange={(event) => onChange(index, 'left', event.target.value)} placeholder="Vế trái" />
            <span className={styles.pairArrow}>↔</span>
            <input className={styles.input} value={pair.right} onChange={(event) => onChange(index, 'right', event.target.value)} placeholder="Vế phải" />
            <button type="button" className={styles.inlineRemoveButton} onClick={() => onRemove(index)}>Xóa</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceCardEditor({
  label,
  cards,
  correctChoice,
  onCardChange,
  onAdd,
  onRemove,
  onCorrectChange,
  onUpload,
  hideCorrectChoice = false,
}: {
  label: string
  cards: ChoiceCardDraft[]
  correctChoice: string
  onCardChange: (index: number, patch: Partial<ChoiceCardDraft>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onCorrectChange: (value: string) => void
  onUpload: (index: number, file: File) => void
  hideCorrectChoice?: boolean
}) {
  return (
    <div className={styles.builderPanel}>
      <div className={styles.builderSectionHeader}>
        <h3>{label}</h3>
        <button type="button" className={styles.inlineAddButton} onClick={onAdd}>+ Thêm thẻ</button>
      </div>
      <div className={styles.choiceCardGrid}>
        {cards.map((card, index) => (
          <div key={card.id} className={styles.choiceCardItem}>
            <input className={styles.input} value={card.label} onChange={(event) => onCardChange(index, { label: event.target.value })} placeholder="Tên lựa chọn" />
            <input className={styles.input} value={card.media_url} onChange={(event) => onCardChange(index, { media_url: event.target.value })} placeholder="URL ảnh hoặc video" />
            <div className={styles.inlineBuilderRow}>
              <select className={styles.select} value={card.media_kind} onChange={(event) => onCardChange(index, { media_kind: event.target.value as ChoiceCardDraft['media_kind'] })}>
                <option value="">Chưa chọn</option>
                <option value="image">Ảnh</option>
                <option value="video">Video</option>
              </select>
              <label className={styles.smallUploadBtn}>
                Upload
                <input type="file" hidden onChange={(event) => event.target.files?.[0] ? onUpload(index, event.target.files[0]) : undefined} />
              </label>
              <button type="button" className={styles.inlineRemoveButton} onClick={() => onRemove(index)}>Xóa</button>
            </div>
            {card.media_url && card.media_kind === 'image' ? <div className={styles.mediaPreviewInline}><img src={card.media_url} alt={card.label || 'preview'} /></div> : null}
            {card.media_url && card.media_kind === 'video' ? <div className={styles.mediaPreviewInline}><video src={card.media_url} controls /></div> : null}
          </div>
        ))}
      </div>
      {!hideCorrectChoice ? (
        <div className={styles.formSection}>
          <label className={styles.label}>Đáp án đúng</label>
          <select className={styles.select} value={correctChoice} onChange={(event) => onCorrectChange(event.target.value)}>
            <option value="">-- Chọn đáp án đúng --</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{card.label || card.id}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
}
