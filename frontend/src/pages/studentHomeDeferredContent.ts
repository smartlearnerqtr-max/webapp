import type { LessonActivityItem } from '../services/api'
import studentHomeContent from '../data/studentHomeDeferredContent.json'
import type { StudentEntryLevelKey, StudentGameActivityType } from './studentHomeMeta'

type DemoGameCard = {
  id: string
  label: string
  media_url: string
  media_kind: string
}

export type CommunicationCard = {
  label: string
  phrase: string
  tone: string
  icon: string
  imageUrl: string
}

export type CareerDetailStep = {
  title: string
  description: string
}

export type CareerDetailMeta = {
  key: string
  title: string
  description: string
  coverImageUrl: string
  meaningTitle: string
  meaningText: string
  videoEmbedUrl: string
  videoNote: string
  steps: CareerDetailStep[]
  skills: string[]
  levels: StudentEntryLevelKey[]
}

type StandaloneGameConfig = {
  id: number
  title: string
  config: Record<string, unknown>
}

type StudentHomeDeferredData = {
  demoGameCards: DemoGameCard[]
  communicationCards: CommunicationCard[]
  aiPromptCards: string[]
  careerPreviewCards: CareerDetailMeta[]
  gameConfigs: Record<StudentGameActivityType, StandaloneGameConfig>
}

const studentHomeData = studentHomeContent as StudentHomeDeferredData
const { communicationCards, aiPromptCards, careerPreviewCards, gameConfigs } = studentHomeData

export function loadCommunicationCards() {
  return communicationCards
}

export function loadAiPromptCards() {
  return aiPromptCards
}

export function loadCareerPreviewCards() {
  return careerPreviewCards
}

export function buildStandaloneGameActivity(activityType: StudentGameActivityType, levelKey: string): LessonActivityItem {
  const selectedGame = gameConfigs[activityType]
  return {
    id: selectedGame.id,
    lesson_id: 0,
    title: selectedGame.title,
    activity_type: activityType,
    instruction_text: String(selectedGame.config.prompt ?? ''),
    voice_answer_enabled: false,
    is_required: true,
    sort_order: 1,
    difficulty_stage: levelKey === 'nhe' ? 1 : levelKey === 'trung_binh' ? 2 : levelKey === 'nang' ? 3 : 1,
    config_json: JSON.stringify(selectedGame.config),
  }
}
