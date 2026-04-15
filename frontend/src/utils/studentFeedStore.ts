import { nSQL } from '@nano-sql/core'

export type StudentFeedTone = 'celebration' | 'focus' | 'support' | 'update'

export type StudentFeedItem = {
  id: string
  studentId: number
  category: string
  title: string
  description: string
  badge: string
  tone: StudentFeedTone
  updatedAt: string
  rank: number
}

type StudentFeedRow = {
  id: string
  student_id: number
  category: string
  title: string
  description: string
  badge: string
  tone: StudentFeedTone
  updated_at: string
  rank: number
}

const STUDENT_FEED_DB_ID = 'student-feed-db'
const STUDENT_FEED_TABLE = 'student_feed'

let initializationPromise: Promise<void> | null = null

function toRow(item: StudentFeedItem): StudentFeedRow {
  return {
    id: item.id,
    student_id: item.studentId,
    category: item.category,
    title: item.title,
    description: item.description,
    badge: item.badge,
    tone: item.tone,
    updated_at: item.updatedAt,
    rank: item.rank,
  }
}

function fromRow(row: StudentFeedRow): StudentFeedItem {
  return {
    id: row.id,
    studentId: row.student_id,
    category: row.category,
    title: row.title,
    description: row.description,
    badge: row.badge,
    tone: row.tone,
    updatedAt: row.updated_at,
    rank: row.rank,
  }
}

async function ensureStudentFeedDatabase() {
  if (!initializationPromise) {
    initializationPromise = nSQL().createDatabase({
      id: STUDENT_FEED_DB_ID,
      mode: 'PERM',
      tables: [
        {
          name: STUDENT_FEED_TABLE,
          model: {
            'id:string': { pk: true },
            'student_id:int': {},
            'category:string': {},
            'title:string': {},
            'description:string': {},
            'badge:string': {},
            'tone:string': {},
            'updated_at:string': {},
            'rank:int': {},
          },
        },
      ],
    }).then(() => undefined)
  }

  await initializationPromise
}

export async function readStudentFeed(studentId: number): Promise<StudentFeedItem[]> {
  await ensureStudentFeedDatabase()
  const rows = await nSQL(STUDENT_FEED_TABLE).query('select').exec() as StudentFeedRow[]
  return rows
    .filter((row) => row.student_id === studentId)
    .sort((left, right) => {
      if (right.rank !== left.rank) return right.rank - left.rank
      return right.updated_at.localeCompare(left.updated_at)
    })
    .map(fromRow)
}

export async function syncStudentFeed(studentId: number, items: StudentFeedItem[]): Promise<StudentFeedItem[]> {
  await ensureStudentFeedDatabase()

  const existingRows = await readStudentFeed(studentId)
  const nextIds = new Set(items.map((item) => item.id))

  await Promise.all(
    existingRows
      .filter((row) => !nextIds.has(row.id))
      .map((row) => nSQL(STUDENT_FEED_TABLE).query('delete').where(['id', '=', row.id]).exec()),
  )

  await Promise.all(items.map((item) => nSQL(STUDENT_FEED_TABLE).query('upsert', toRow(item)).exec()))

  return readStudentFeed(studentId)
}
