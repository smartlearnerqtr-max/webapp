const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  token?: string | null
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const json = await response.json()
  if (!response.ok || !json.success) {
    throw new Error(json.message ?? 'Request failed')
  }

  return json.data as T
}

export type AuthUser = {
  id: number
  email: string | null
  phone: string | null
  role: string
  status: string
}

export type HealthResponse = {
  service: string
  status: string
  app_name: string
}

export type LoginResponse = {
  user: AuthUser
  profile: Record<string, unknown> | null
  access_token: string
  refresh_token: string
}

export type RegisterPayload = {
  role: 'student' | 'parent'
  full_name: string
  email?: string
  phone?: string
  password: string
  disability_level?: string
  support_note?: string
  preferred_input?: string
  preferred_read_speed?: string
  preferred_font_size?: string
  preferred_bg_color?: string
  relationship_label?: string
}

export type TeacherContactItem = {
  id: number
  user_id: number
  full_name: string
  school_name: string | null
  avatar_url: string | null
  note: string | null
  email: string | null
  phone: string | null
}

export type StudentTeacherLinkItem = {
  link_id: number
  teacher: TeacherContactItem
  source: string | null
  active_class_count: number
}

export type ClassItem = {
  id: number
  teacher_id: number
  name: string
  grade_label: string | null
  description: string | null
  default_disability_level?: string | null
  status: string
  student_count: number
  subject_count: number
  created_at?: string | null
  updated_at?: string | null
  teacher?: TeacherContactItem | null
  join_credential?: {
    id: number
    class_id: number
    class_password: string | null
    created_at?: string | null
    updated_at?: string | null
  } | null
}

export type StudentItem = {
  id: number
  user_id?: number | null
  full_name: string
  disability_level: string
  preferred_input: string
  support_note: string | null
  preferred_read_speed?: string | null
  preferred_font_size?: string | null
  preferred_bg_color?: string | null
  created_by_teacher_id?: number | null
}

export type ClassStudentLink = {
  id: number
  class_id: number
  student_id: number
  status: string
  student: StudentItem | null
}

export type SubjectItem = {
  id: number
  code: string
  name: string
  description: string | null
}

export type ClassSubjectLink = {
  id: number
  class_id: number
  subject_id: number
  sort_order: number
  is_active: boolean
  subject: SubjectItem | null
}

export type LessonActivityItem = {
  id: number
  lesson_id: number
  title: string
  activity_type: string
  instruction_text: string | null
  voice_answer_enabled: boolean
  is_required: boolean
  sort_order: number
  difficulty_stage: number
  config_json: string | null
}

export type LessonItem = {
  id: number
  subject_id: number
  title: string
  description: string | null
  primary_level: string
  estimated_minutes: number | null
  difficulty_stage: number
  is_published: boolean
  is_archived: boolean
  activity_count: number
  subject: SubjectItem | null
  activities?: LessonActivityItem[]
  created_at?: string | null
}

export type AssignmentItem = {
  id: number
  lesson_id: number
  class_id: number
  subject_id: number
  assigned_by_teacher_id: number
  target_type: string
  due_at: string | null
  required_completion_percent: number
  status: string
  lesson: LessonItem | null
  classroom: ClassItem | null
  subject: SubjectItem | null
  student_ids: number[]
  created_at: string | null
}

export type AssignmentProgressItem = {
  id: number
  assignment_id: number
  student_id: number
  status: string
  progress_percent: number
  total_learning_seconds: number
  retry_count: number
  help_count: number
  reward_star_count: number
  completion_score: number
  completed_at: string | null
  readiness_status: string
  readiness_reasons: string[]
  student: StudentItem | null
}

export type AssignmentProgressResponse = {
  assignment: AssignmentItem
  progresses: AssignmentProgressItem[]
  summary: {
    student_count: number
    completed_count: number
    in_progress_count: number
    need_support_count: number
    ready_to_increase_count: number
  }
}

export type MyAssignmentItem = {
  id: number
  assignment_id: number
  student_id: number
  status: string
  progress_percent: number
  total_learning_seconds: number
  retry_count: number
  help_count: number
  reward_star_count: number
  completion_score: number
  completed_at: string | null
  readiness_status: string
  readiness_reasons: string[]
  assignment: AssignmentItem | null
  lesson?: LessonItem | null
}

export type MyAssignmentDetail = MyAssignmentItem & {
  lesson: LessonItem | null
}

export type ParentProgressSummary = {
  total_assignments: number
  completed_count: number
  in_progress_count: number
  last_assignment_title: string | null
  last_progress_percent: number
  readiness_status: string
  help_count: number
  retry_count: number
  completion_score: number
}

export type ParentAccountItem = {
  id: number
  user_id: number
  full_name: string
  relationship_label: string | null
  avatar_url: string | null
  note: string | null
  email: string | null
  phone: string | null
  students: StudentItem[]
}

export type ParentReportItem = {
  id: number
  teacher_id: number
  parent_id: number
  student_id: number
  report_date: string
  title: string
  teacher_note: string | null
  summary_text: string
  recommendation: string | null
  total_assignments: number
  completed_count: number
  in_progress_count: number
  last_assignment_title: string | null
  last_progress_percent: number
  readiness_status: string
  help_count: number
  retry_count: number
  completion_score: number
  created_at?: string | null
  updated_at?: string | null
  parent?: ParentAccountItem | null
  student?: StudentItem | null
  teacher?: TeacherContactItem | null
}

export type TeacherParentGroupItem = {
  link_id: number
  status: string
  parent: ParentAccountItem | null
  student: StudentItem | null
  classes: ClassItem[]
  progress_summary: ParentProgressSummary
  latest_report: ParentReportItem | null
}

export type ParentChildDashboardItem = {
  student: StudentItem
  classes: ClassItem[]
  teachers: TeacherContactItem[]
  progress_summary: ParentProgressSummary
}

export type JoinClassResponse = {
  classroom: ClassItem
  student: StudentItem
  class_join_status: string
}

export type AISettings = {
  id: number
  provider: string
  model_name: string
  api_key_masked: string
  status: string
  last_validated_at: string | null
  last_error_message: string | null
}

export type AITestResult = {
  status: string
  provider: string
  model_name: string
  last_validated_at: string | null
  sample_response: string
}

export type AIChatResponse = {
  text: string
  model_name: string
  usage_metadata: Record<string, unknown> | null
  prompt_feedback: Record<string, unknown> | null
}

export type LogItem = {
  id: number
  level: string
  module: string
  action_name: string | null
  message: string
  request_id: string | null
  created_at: string | null
}

export type AdminTeacherItem = {
  user: AuthUser
  profile: {
    id: number
    user_id: number
    full_name: string
    school_name: string | null
    avatar_url: string | null
    note: string | null
  } | null
}

export type AdminRelationshipOverview = {
  summary: {
    teacher_count: number
    teacher_student_link_count: number
    teacher_parent_group_count: number
    shared_student_count: number
  }
  teachers: Array<{
    teacher: AdminTeacherItem
    student_count: number
    parent_group_count: number
    shared_student_count: number
  }>
  shared_students: Array<{
    student: StudentItem
    teachers: Array<{
      id: number
      full_name: string
      school_name: string | null
    }>
  }>
}

export type TeacherSharedStudentItem = {
  student: StudentItem
  teachers: Array<{
    id: number
    full_name: string
    school_name: string | null
    email: string | null
    phone: string | null
    is_current_teacher: boolean
  }>
  peer_teachers: Array<{
    id: number
    full_name: string
    school_name: string | null
    email: string | null
    phone: string | null
    is_current_teacher: boolean
  }>
  my_active_class_count: number
  parent_group_count: number
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/v1/health')
}

export async function login(identity: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { identity, password },
  })
}

export async function registerAccount(payload: RegisterPayload): Promise<LoginResponse> {
  return request<LoginResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: payload,
  })
}

export async function fetchAdminTeachers(token: string): Promise<AdminTeacherItem[]> {
  return request<AdminTeacherItem[]>('/api/v1/admin/teachers', { token })
}

export async function fetchAdminRelationshipOverview(token: string): Promise<AdminRelationshipOverview> {
  return request<AdminRelationshipOverview>('/api/v1/admin/relationships/overview', { token })
}

export async function createTeacherByAdmin(token: string, payload: {
  full_name: string
  email?: string
  phone?: string
  password: string
  school_name?: string
}) {
  return request<AdminTeacherItem>('/api/v1/admin/teachers', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchClasses(token: string): Promise<ClassItem[]> {
  return request<ClassItem[]>('/api/v1/classes', { token })
}

export async function createClass(token: string, payload: { name: string; grade_label?: string; description?: string }) {
  return request<ClassItem>('/api/v1/classes', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchMyClasses(token: string): Promise<ClassItem[]> {
  return request<ClassItem[]>('/api/v1/my/classes', { token })
}

export async function joinClassByCredential(token: string, payload: { class_id: number; class_password: string }) {
  return request<JoinClassResponse>('/api/v1/my/classes/join', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchClassStudents(token: string, classId: number): Promise<ClassStudentLink[]> {
  return request<ClassStudentLink[]>(`/api/v1/classes/${classId}/students`, { token })
}

export async function addStudentsToClass(token: string, classId: number, payload: { student_ids: number[] }) {
  return request<ClassStudentLink[]>(`/api/v1/classes/${classId}/students`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchClassSubjects(token: string, classId: number): Promise<ClassSubjectLink[]> {
  return request<ClassSubjectLink[]>(`/api/v1/classes/${classId}/subjects`, { token })
}

export async function addSubjectToClass(token: string, classId: number, payload: { subject_id: number }) {
  return request<ClassSubjectLink>(`/api/v1/classes/${classId}/subjects`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchStudents(token: string): Promise<StudentItem[]> {
  return request<StudentItem[]>('/api/v1/students', { token })
}

export async function fetchStudentTeachers(token: string, studentId: number): Promise<StudentTeacherLinkItem[]> {
  return request<StudentTeacherLinkItem[]>(`/api/v1/students/${studentId}/teachers`, { token })
}

export async function fetchMyTeachers(token: string): Promise<StudentTeacherLinkItem[]> {
  return request<StudentTeacherLinkItem[]>('/api/v1/my/teachers', { token })
}

export async function fetchTeacherSharedStudents(token: string): Promise<TeacherSharedStudentItem[]> {
  return request<TeacherSharedStudentItem[]>('/api/v1/teacher/shared-students', { token })
}

export async function createStudent(token: string, payload: { full_name: string; disability_level: string }) {
  return request<StudentItem>('/api/v1/students', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchParents(token: string): Promise<ParentAccountItem[]> {
  return request<ParentAccountItem[]>('/api/v1/parents', { token })
}

export async function linkParentToStudent(token: string, studentId: number, payload: { parent_id: number }) {
  return request<{ link_id: number; student: StudentItem; parent: ParentAccountItem }>(`/api/v1/students/${studentId}/parents/link`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchTeacherParentGroups(token: string): Promise<TeacherParentGroupItem[]> {
  return request<TeacherParentGroupItem[]>('/api/v1/teacher/parent-groups', { token })
}

export async function fetchTeacherReports(token: string): Promise<ParentReportItem[]> {
  return request<ParentReportItem[]>('/api/v1/teacher/reports', { token })
}

export async function sendDailyReports(token: string, payload: { student_id?: number; note?: string; title?: string; report_date?: string }) {
  return request<ParentReportItem[]>('/api/v1/teacher/reports/send', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchSubjects(): Promise<SubjectItem[]> {
  return request<SubjectItem[]>('/api/v1/subjects')
}

export async function fetchLessons(token: string): Promise<LessonItem[]> {
  return request<LessonItem[]>('/api/v1/lessons', { token })
}

export async function fetchLesson(token: string, lessonId: number): Promise<LessonItem> {
  return request<LessonItem>(`/api/v1/lessons/${lessonId}`, { token })
}

export async function createLesson(token: string, payload: {
  title: string
  subject_id: number
  primary_level: string
  description?: string
  estimated_minutes?: number
  difficulty_stage?: number
  is_published?: boolean
}) {
  return request<LessonItem>('/api/v1/lessons', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function createLessonActivity(token: string, lessonId: number, payload: {
  title: string
  activity_type: string
  instruction_text?: string
  voice_answer_enabled?: boolean
  is_required?: boolean
  sort_order?: number
  difficulty_stage?: number
  config_json?: string
}) {
  return request<LessonActivityItem>(`/api/v1/lessons/${lessonId}/activities`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchAssignments(token: string): Promise<AssignmentItem[]> {
  return request<AssignmentItem[]>('/api/v1/assignments', { token })
}

export async function createAssignment(token: string, payload: {
  lesson_id: number
  class_id: number
  subject_id?: number
  target_type?: string
  due_at?: string
  required_completion_percent?: number
  student_ids?: number[]
}) {
  return request<AssignmentItem>('/api/v1/assignments', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchAssignmentProgress(token: string, assignmentId: number): Promise<AssignmentProgressResponse> {
  return request<AssignmentProgressResponse>(`/api/v1/assignments/${assignmentId}/progress`, { token })
}

export async function fetchMyAssignments(token: string): Promise<MyAssignmentItem[]> {
  return request<MyAssignmentItem[]>('/api/v1/my/assignments', { token })
}

export async function fetchMyAssignment(token: string, assignmentId: number): Promise<MyAssignmentDetail> {
  return request<MyAssignmentDetail>(`/api/v1/my/assignments/${assignmentId}`, { token })
}

export async function startMyAssignment(token: string, assignmentId: number): Promise<MyAssignmentItem> {
  return request<MyAssignmentItem>(`/api/v1/my/assignments/${assignmentId}/start`, {
    method: 'POST',
    token,
  })
}

export async function updateMyAssignmentProgress(token: string, assignmentId: number, payload: {
  progress_percent?: number
  total_learning_seconds?: number
  retry_count?: number
  help_count?: number
  reward_star_count?: number
  completion_score?: number
  status?: 'not_started' | 'in_progress' | 'completed'
}) {
  return request<MyAssignmentItem>(`/api/v1/my/assignments/${assignmentId}/progress`, {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function completeMyAssignment(token: string, assignmentId: number): Promise<MyAssignmentItem> {
  return request<MyAssignmentItem>(`/api/v1/my/assignments/${assignmentId}/complete`, {
    method: 'POST',
    token,
  })
}

export async function fetchParentChildren(token: string): Promise<ParentChildDashboardItem[]> {
  return request<ParentChildDashboardItem[]>('/api/v1/parent/my-children', { token })
}

export async function fetchTeacherByIdForParent(token: string, teacherId: number): Promise<TeacherContactItem> {
  return request<TeacherContactItem>(`/api/v1/parent/teachers/${teacherId}`, { token })
}

export async function fetchParentReports(token: string): Promise<ParentReportItem[]> {
  return request<ParentReportItem[]>('/api/v1/parent/reports', { token })
}

export async function fetchAISettings(token: string): Promise<AISettings | null> {
  return request<AISettings | null>('/api/v1/ai/settings', { token })
}

export async function saveAISettings(token: string, payload: { api_key: string; model_name: string }) {
  return request<AISettings>('/api/v1/ai/settings', {
    method: 'PUT',
    token,
    body: payload,
  })
}

export async function testAISettings(token: string): Promise<AITestResult> {
  return request<AITestResult>('/api/v1/ai/settings/test', {
    method: 'POST',
    token,
  })
}

export async function sendAIChat(token: string, payload: {
  message: string
  context?: {
    target_role?: string
    disability_level?: string
    lesson_title?: string
    subject_name?: string
    activity_type?: string
  }
}): Promise<AIChatResponse> {
  return request<AIChatResponse>('/api/v1/ai/chat', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function fetchLogs(token: string): Promise<LogItem[]> {
  return request<LogItem[]>('/api/v1/logs', { token })
}

export type RealtimeEventItem = {
  id: number
  recipient_user_id: number | null
  recipient_role: string | null
  event_type: string
  title: string | null
  message: string
  payload_json: string | null
  created_at: string | null
  updated_at: string | null
}

export function getRealtimeStreamUrl(token: string, lastEventId?: number): string {
  const url = new URL('/api/v1/realtime/stream', API_BASE_URL)
  url.searchParams.set('access_token', token)
  if (lastEventId) {
    url.searchParams.set('last_event_id', String(lastEventId))
  }
  return url.toString()
}
