import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'

import { BarChartCard } from '../components/BarChartCard'
import { ChatDock } from '../components/ChatDock'
import { RequireAuth } from '../components/RequireAuth'
import {
  createTeacherCareerCard,
  deleteTeacherCareerCard,
  fetchParents,
  fetchStudents,
  fetchTeacherCareerCards,
  fetchTeacherMessages,
  fetchTeacherParentGroups,
  fetchTeacherReports,
  linkParentToStudent,
  markTeacherMessagesRead,
  sendDailyReports,
  sendTeacherMessage,
  updateTeacherCareerCard,
  uploadLessonMedia,
} from '../services/api'
import type { CareerCardItem, ParentTeacherConversationItem } from '../services/api'
import { useAuthStore } from '../store/authStore'

const readinessLabelMap: Record<string, string> = {
  can_ho_tro_them: 'Cần hỗ trợ',
  dang_phu_hop: 'Đang phù hợp',
  san_sang_nang_do_kho: 'Sẵn sàng tăng mức',
}

type TeacherWorkspaceView = 'home' | 'overview' | 'parent_groups' | 'parent_link' | 'reports' | 'report_history' | 'messages' | 'career_cards'

type TeacherCareerStepDraft = {
  title: string
  description: string
}

type TeacherCareerFormState = {
  title: string
  description: string
  coverImageUrl: string
  videoUrl: string
  meaningTitle: string
  meaningText: string
  videoNote: string
  sortOrder: string
  skillsText: string
  levels: Array<'nang' | 'trung_binh' | 'nhe'>
  steps: TeacherCareerStepDraft[]
}

function createEmptyCareerForm(): TeacherCareerFormState {
  return {
    title: '',
    description: '',
    coverImageUrl: '',
    videoUrl: '',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText: '',
    videoNote: '',
    sortOrder: '0',
    skillsText: '',
    levels: ['nhe'],
    steps: [
      { title: 'Bước 1', description: '' },
      { title: 'Bước 2', description: '' },
      { title: 'Bước 3', description: '' },
    ],
  }
}

function buildCareerFormFromCard(card: CareerCardItem): TeacherCareerFormState {
  return {
    title: card.title,
    description: card.description ?? '',
    coverImageUrl: card.cover_image_url ?? '',
    videoUrl: card.video_url ?? '',
    meaningTitle: card.meaning_title,
    meaningText: card.meaning_text,
    videoNote: card.video_note ?? '',
    sortOrder: String(card.sort_order ?? 0),
    skillsText: card.skills.join(', '),
    levels: card.levels.length ? card.levels : ['nhe'],
    steps: card.steps.length
      ? card.steps.map((step) => ({ title: step.title, description: step.description }))
      : [{ title: 'Bước 1', description: '' }],
  }
}

const teacherCareerLevelLabelMap: Record<'nhe' | 'trung_binh' | 'nang', string> = {
  nhe: 'Nhẹ',
  trung_binh: 'Trung bình',
  nang: 'Nặng',
}

function parseCareerSkills(skillsText: string) {
  return skillsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeCareerSteps(steps: TeacherCareerStepDraft[]) {
  return steps
    .map((step) => ({ title: step.title.trim(), description: step.description.trim() }))
    .filter((step) => step.title || step.description)
}

function canPreviewCareerVideoInline(videoUrl: string) {
  const trimmedUrl = videoUrl.trim()
  return /\.(mp4|webm|ogg|mov)(?:$|\?)/i.test(trimmedUrl) || trimmedUrl.includes('/api/v1/media/files/')
}

function canEmbedCareerPreviewInline(videoUrl: string) {
  const trimmedUrl = videoUrl.trim()
  return /^\/.+\.html(?:$|\?)/i.test(trimmedUrl) || /^https?:\/\/.+\.html(?:$|\?)/i.test(trimmedUrl)
}

function getCareerPreviewEmbedUrl(videoUrl: string) {
  const trimmedUrl = videoUrl.trim()
  if (!trimmedUrl) return ''
  if (canEmbedCareerPreviewInline(trimmedUrl)) return trimmedUrl
  try {
    const url = new URL(trimmedUrl)
    const host = url.hostname.toLowerCase()
    if (host.includes('youtu.be')) {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) return trimmedUrl
      const videoId = url.searchParams.get('v')
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    if (host.includes('drive.google.com')) {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
      if (fileMatch?.[1]) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
      const fileId = url.searchParams.get('id')
      return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : ''
    }
  } catch {
    return ''
  }
  return ''
}

function validateCareerForm(careerForm: TeacherCareerFormState) {
  if (!careerForm.title.trim()) return 'Cần nhập tiêu đề nghề nghiệp.'
  if (!careerForm.meaningText.trim()) return 'Cần nhập ý nghĩa công việc để học sinh nghe audio.'
  if (!parseCareerSkills(careerForm.skillsText).length) return 'Cần nhập ít nhất 1 kỹ năng học được.'
  if (!normalizeCareerSteps(careerForm.steps).length) return 'Cần nhập ít nhất 1 bước thực hiện.'
  return null
}

const teacherCareerSampleTemplates: TeacherCareerFormState[] = [
  {
    title: 'Làm vườn cơ bản',
    description: 'Làm quen với việc tưới cây, quan sát lá và giữ khu vườn gọn gàng.',
    coverImageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gardening.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=MJMO7LjWMFQ',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText:
      'Làm vườn giúp học sinh rèn sự kiên nhẫn, biết chăm sóc cây xanh và nhận ra mỗi hành động nhỏ đều có thể làm môi trường đẹp hơn.',
    videoNote: 'Video thật về làm vườn sinh thái, giúp học sinh quan sát công việc chăm cây và khu vườn.',
    sortOrder: '10',
    skillsText: 'Quan sát, Tưới cây, Kiên nhẫn, Giữ khu vực sạch',
    levels: ['nhe', 'trung_binh', 'nang'],
    steps: [
      { title: 'Chuẩn bị bình tưới', description: 'Lấy bình tưới vừa tay và đổ nước vừa đủ.' },
      { title: 'Tưới quanh gốc', description: 'Tưới nhẹ vào gốc cây, tránh làm đất bắn ra ngoài.' },
      { title: 'Cất dụng cụ', description: 'Đặt bình tưới về đúng chỗ và lau phần nước rơi nếu có.' },
    ],
  },
  {
    title: 'Làm bánh cơ bản',
    description: 'Làm quen với việc chuẩn bị nguyên liệu, giữ vệ sinh và làm theo công thức đơn giản.',
    coverImageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/The%20Bakery%20%28Unsplash%29.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=ijbUDFk6fE0',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText:
      'Làm bánh giúp học sinh rèn sự cẩn thận, biết giữ vệ sinh khi làm việc và học cách hoàn thành từng bước theo hướng dẫn.',
    videoNote: 'Video thật về lớp học làm bánh, giúp học sinh thấy môi trường và thao tác nghề bánh.',
    sortOrder: '20',
    skillsText: 'Vệ sinh, Đong đếm, Làm theo công thức, Cẩn thận',
    levels: ['nhe', 'trung_binh', 'nang'],
    steps: [
      { title: 'Rửa tay và chuẩn bị', description: 'Rửa tay sạch, lấy tạp dề và đặt nguyên liệu lên bàn.' },
      { title: 'Làm theo công thức', description: 'Đong từng nguyên liệu và làm đúng thứ tự giáo viên hướng dẫn.' },
      { title: 'Dọn khu vực làm bánh', description: 'Cất dụng cụ, lau bàn và bỏ rác đúng nơi.' },
    ],
  },
  {
    title: 'Nhân viên bán hàng',
    description: 'Làm quen với chào hỏi, sắp xếp sản phẩm và hỗ trợ khách theo câu ngắn rõ ràng.',
    coverImageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cashier%20at%20her%20register.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=m0h_gcAubUQ',
    meaningTitle: 'Ý nghĩa công việc',
    meaningText:
      'Bán hàng giúp học sinh luyện giao tiếp lịch sự, nhận biết đồ vật, giữ quầy gọn gàng và biết hỗ trợ người khác trong tình huống quen thuộc.',
    videoNote: 'Video hướng nghiệp thật về tiếp thị - bán hàng, giúp học sinh hình dung nhóm nghề dịch vụ.',
    sortOrder: '30',
    skillsText: 'Chào hỏi, Sắp xếp hàng, Quan sát nhu cầu, Giao tiếp lịch sự',
    levels: ['nhe', 'trung_binh', 'nang'],
    steps: [
      { title: 'Chào khách', description: 'Nhìn về phía khách và nói một câu chào ngắn, lịch sự.' },
      { title: 'Sắp xếp sản phẩm', description: 'Đặt sản phẩm cùng loại gần nhau và quay nhãn ra ngoài.' },
      { title: 'Nhờ hỗ trợ khi cần', description: 'Nếu khách hỏi khó, gọi giáo viên hoặc người phụ trách.' },
    ],
  },
]

export function TeacherHomePage() {
  const token = useAuthStore((state) => state.accessToken)
  const profile = useAuthStore((state) => state.profile)
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const careerEditorRef = useRef<HTMLElement | null>(null)

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedParentId, setSelectedParentId] = useState('')
  const [parentLookup, setParentLookup] = useState('')
  const [reportStudentId, setReportStudentId] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedConversationKey, setSelectedConversationKey] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [selectedChatStudentId, setSelectedChatStudentId] = useState('')
  const [conversationSearchTerm, setConversationSearchTerm] = useState('')
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<TeacherWorkspaceView>('home')
  const [editingCareerCardId, setEditingCareerCardId] = useState<number | null>(null)
  const [careerForm, setCareerForm] = useState<TeacherCareerFormState>(() => createEmptyCareerForm())
  const [isCareerUploading, setIsCareerUploading] = useState(false)
  const [careerUploadError, setCareerUploadError] = useState<string | null>(null)
  const [careerFormError, setCareerFormError] = useState<string | null>(null)

  useEffect(() => {
    const view = new URLSearchParams(location.search).get('view')
    if (view === 'career_cards') {
      setActiveWorkspaceView('career_cards')
    } else if (!view) {
      setActiveWorkspaceView('home')
    }
  }, [location.search])

  function openWorkspaceView(view: TeacherWorkspaceView) {
    setActiveWorkspaceView(view)
    const nextSearch = view === 'career_cards' ? '?view=career_cards' : ''
    navigate(`/giao-vien${nextSearch}`, { replace: false })
  }

  function scrollCareerEditorIntoView() {
    window.requestAnimationFrame(() => {
      careerEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const deferredSearchTerm = useDeferredValue(conversationSearchTerm)
  const deferredParentLookup = useDeferredValue(parentLookup)
  const hasParentLookup = deferredParentLookup.trim().length > 0

  const studentsQuery = useQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token!),
    enabled: Boolean(token),
  })

  const parentsQuery = useQuery({
    queryKey: ['parents', token, deferredParentLookup.trim()],
    queryFn: () => fetchParents(token!, deferredParentLookup),
    enabled: Boolean(token),
  })

  const parentGroupsQuery = useQuery({
    queryKey: ['teacher-parent-groups', token],
    queryFn: () => fetchTeacherParentGroups(token!),
    enabled: Boolean(token),
  })

  const reportsQuery = useQuery({
    queryKey: ['teacher-reports', token],
    queryFn: () => fetchTeacherReports(token!),
    enabled: Boolean(token),
  })

  const careerCardsQuery = useQuery({
    queryKey: ['teacher-career-cards', token],
    queryFn: () => fetchTeacherCareerCards(token!),
    enabled: Boolean(token),
  })

  const conversationsQuery = useQuery({
    queryKey: ['teacher-messages', token],
    queryFn: () => fetchTeacherMessages(token!),
    enabled: Boolean(token),
  })

  const linkedPairKeys = useMemo(
    () => new Set((parentGroupsQuery.data ?? []).map((item) => `${item.student?.id ?? 'x'}-${item.parent?.id ?? 'y'}`)),
    [parentGroupsQuery.data],
  )

  const availableParents = useMemo(() => {
    if (!selectedStudentId) return []
    return (parentsQuery.data ?? []).filter((parent) => !linkedPairKeys.has(`${selectedStudentId}-${parent.id}`))
  }, [linkedPairKeys, parentsQuery.data, selectedStudentId])

  useEffect(() => {
    setSelectedParentId('')
  }, [selectedStudentId, deferredParentLookup])

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data])
  const unreadConversationCount = conversations.reduce((count, item) => count + item.unread_count, 0)

  const conversationStudentOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const conversation of conversations) {
      if (conversation.student) {
        options.set(String(conversation.student.id), conversation.student.full_name)
      }
    }
    return Array.from(options.entries()).map(([id, fullName]) => ({ id, fullName }))
  }, [conversations])

  const filteredConversations = useMemo(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase()
    return conversations.filter((conversation) => {
      if (selectedChatStudentId && String(conversation.student?.id ?? '') !== selectedChatStudentId) return false
      if (!keyword) return true

      const haystack = [
        conversation.parent?.full_name,
        conversation.parent?.relationship_label,
        conversation.student?.full_name,
        conversation.latest_message?.message,
      ].join(' ').toLowerCase()

      return haystack.includes(keyword)
    })
  }, [conversations, deferredSearchTerm, selectedChatStudentId])

  const selectedConversation = useMemo(
    () => filteredConversations.find((item) => item.conversation_key === selectedConversationKey) ?? filteredConversations[0] ?? null,
    [filteredConversations, selectedConversationKey],
  )
  const effectiveSelectedConversationKey = selectedConversation?.conversation_key ?? ''

  const linkMutation = useMutation({
    mutationFn: () => linkParentToStudent(token!, Number(selectedStudentId), { parent_id: Number(selectedParentId) }),
    onSuccess: async () => {
      setSelectedParentId('')
      setParentLookup('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-parent-groups', token] }),
        queryClient.invalidateQueries({ queryKey: ['parents', token] }),
        queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] }),
      ])
    },
  })

  const reportMutation = useMutation({
    mutationFn: (studentId?: number) => sendDailyReports(token!, {
      student_id: studentId,
      title: reportTitle.trim() || undefined,
      note: reportNote.trim() || undefined,
    }),
    onSuccess: async () => {
      setReportTitle('')
      setReportNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-reports', token] }),
        queryClient.invalidateQueries({ queryKey: ['teacher-parent-groups', token] }),
      ])
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) => sendTeacherMessage(token!, {
      parent_id: conversation.parent?.id ?? 0,
      student_id: conversation.student?.id ?? 0,
      message: messageDraft.trim(),
    }),
    onSuccess: async () => {
      setMessageDraft('')
      await queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] })
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (conversation: ParentTeacherConversationItem) => markTeacherMessagesRead(token!, {
      parent_id: conversation.parent?.id ?? 0,
      student_id: conversation.student?.id ?? 0,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] })
    },
  })

  useEffect(() => {
    if (!isChatOpen || !selectedConversation || selectedConversation.unread_count <= 0 || markReadMutation.isPending) return
    markReadMutation.mutate(selectedConversation)
  }, [isChatOpen, markReadMutation, selectedConversation])

  const saveCareerCardMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateCareerForm(careerForm)
      if (validationError) {
        setCareerFormError(validationError)
        throw new Error(validationError)
      }

      const payload = {
        title: careerForm.title.trim(),
        description: careerForm.description.trim() || undefined,
        cover_image_url: careerForm.coverImageUrl.trim() || null,
        meaning_title: careerForm.meaningTitle.trim() || 'Ý nghĩa công việc',
        meaning_text: careerForm.meaningText.trim(),
        video_url: careerForm.videoUrl.trim() || null,
        video_note: careerForm.videoNote.trim() || undefined,
        sort_order: Number(careerForm.sortOrder) || 0,
        skills: parseCareerSkills(careerForm.skillsText),
        levels: careerForm.levels,
        steps: normalizeCareerSteps(careerForm.steps),
      }

      if (editingCareerCardId) {
        return updateTeacherCareerCard(token!, editingCareerCardId, payload)
      }
      return createTeacherCareerCard(token!, payload)
    },
    onSuccess: async () => {
      setEditingCareerCardId(null)
      setCareerForm(createEmptyCareerForm())
      setCareerFormError(null)
      setCareerUploadError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-career-cards', token] }),
        queryClient.invalidateQueries({ queryKey: ['my-career-cards'] }),
      ])
    },
  })

  const deleteCareerCardMutation = useMutation({
    mutationFn: (cardId: number) => deleteTeacherCareerCard(token!, cardId),
    onSuccess: async () => {
      if (editingCareerCardId) {
        setEditingCareerCardId(null)
        setCareerForm(createEmptyCareerForm())
      }
      setCareerFormError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-career-cards', token] }),
        queryClient.invalidateQueries({ queryKey: ['my-career-cards'] }),
      ])
    },
  })

  const teacherId = typeof profile?.id === 'number' ? profile.id : null
  const studentCount = studentsQuery.data?.length ?? 0
  const parentGroupCount = parentGroupsQuery.data?.length ?? 0
  const reportCount = reportsQuery.data?.length ?? 0
  const latestParentGroups = (parentGroupsQuery.data ?? []).slice(0, 6)
  const showTeacherParentOnboarding = !parentGroupCount && !parentGroupsQuery.isLoading

  const averageLatestProgress = useMemo(() => {
    const groups = parentGroupsQuery.data ?? []
    if (!groups.length) return 0
    const total = groups.reduce((sum, item) => sum + item.progress_summary.last_progress_percent, 0)
    return Math.round(total / groups.length)
  }, [parentGroupsQuery.data])

  const teacherOverviewChartItems = [
    { label: 'Học sinh', value: studentCount, color: 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)' },
    { label: 'Phụ huynh', value: parentGroupCount, color: 'linear-gradient(180deg, #53b7a8 0%, #2a8f80 100%)' },
    { label: 'Tiến độ TB', value: averageLatestProgress, color: 'linear-gradient(180deg, #ffbe3d 0%, #f29f05 100%)' },
    { label: 'Chat chưa đọc', value: unreadConversationCount, color: 'linear-gradient(180deg, #ff8d7a 0%, #ec6a55 100%)' },
  ]

  function openConversation(conversation: ParentTeacherConversationItem) {
    openWorkspaceView('messages')
    setSelectedConversationKey(conversation.conversation_key)
    setIsChatOpen(true)
  }

  function updateCareerFormField<K extends keyof TeacherCareerFormState>(field: K, value: TeacherCareerFormState[K]) {
    setCareerFormError(null)
    setCareerForm((current) => ({ ...current, [field]: value }))
  }

  function updateCareerStep(stepIndex: number, field: keyof TeacherCareerStepDraft, value: string) {
    setCareerFormError(null)
    setCareerForm((current) => ({
      ...current,
      steps: current.steps.map((step, index) => index === stepIndex ? { ...step, [field]: value } : step),
    }))
  }

  function addCareerStep() {
    setCareerFormError(null)
    setCareerForm((current) => ({
      ...current,
      steps: [...current.steps, { title: `Bước ${current.steps.length + 1}`, description: '' }],
    }))
  }

  function removeCareerStep(stepIndex: number) {
    setCareerFormError(null)
    setCareerForm((current) => ({
      ...current,
      steps: current.steps.filter((_, index) => index !== stepIndex),
    }))
  }

  function toggleCareerLevel(level: 'nang' | 'trung_binh' | 'nhe') {
    setCareerFormError(null)
    setCareerForm((current) => {
      const hasLevel = current.levels.includes(level)
      const levels = hasLevel ? current.levels.filter((item) => item !== level) : [...current.levels, level]
      return {
        ...current,
        levels: levels.length ? levels : ['nhe'],
      }
    })
  }

  async function handleCareerMediaUpload(kind: 'image' | 'video', file: File) {
    if (!token) return
    setCareerFormError(null)
    setCareerUploadError(null)
    setIsCareerUploading(true)
    try {
      const upload = await uploadLessonMedia(token, file)
      if (kind === 'image') {
        updateCareerFormField('coverImageUrl', upload.url)
      } else {
        updateCareerFormField('videoUrl', upload.url)
      }
    } catch (error) {
      setCareerUploadError(error instanceof Error ? error.message : 'Không tải được media.')
    } finally {
      setIsCareerUploading(false)
    }
  }

  function startEditCareerCard(card: CareerCardItem) {
    setEditingCareerCardId(card.id)
    setCareerForm(buildCareerFormFromCard(card))
    setCareerFormError(null)
    setCareerUploadError(null)
    openWorkspaceView('career_cards')
    scrollCareerEditorIntoView()
  }

  function resetCareerEditor() {
    setEditingCareerCardId(null)
    setCareerForm(createEmptyCareerForm())
    setCareerFormError(null)
    setCareerUploadError(null)
    scrollCareerEditorIntoView()
  }

  function applyCareerSampleTemplate(template: TeacherCareerFormState) {
    setEditingCareerCardId(null)
    setCareerForm({
      ...template,
      levels: [...template.levels],
      steps: template.steps.map((step) => ({ ...step })),
    })
    setCareerFormError(null)
    setCareerUploadError(null)
    openWorkspaceView('career_cards')
    scrollCareerEditorIntoView()
  }

  function renderParentOnboarding() {
    if (!showTeacherParentOnboarding) return null
    return (
      <article className="roadmap-panel">
        <h3>Bắt đầu gắn phụ huynh</h3>
        <p>1. Phụ huynh tự đăng ký tài khoản.</p>
        <p>2. Phụ huynh gửi Parent ID hoặc email cho giáo viên.</p>
        <p>3. Giáo viên chọn học sinh, tìm đúng phụ huynh rồi bấm gắn.</p>
      </article>
    )
  }


  const workspaceCards = [
    { key: 'overview', eyebrow: 'Tổng quan', title: 'Xem số liệu lớp', description: 'Mở toàn màn hình để theo dõi các số chính trong ngày.', badge: `${studentCount} học sinh` },
    { key: 'parent_groups', eyebrow: 'Theo dõi', title: 'Nhóm phụ huynh', description: 'Xem toàn bộ học sinh đã liên kết và tiến độ gần nhất.', badge: `${parentGroupCount} nhóm` },
    { key: 'parent_link', eyebrow: 'Thiết lập', title: 'Gắn phụ huynh', description: 'Vào một màn hình riêng để tìm Parent ID và gắn đúng tài khoản.', badge: hasParentLookup ? 'Đang tìm phụ huynh' : 'Mở form' },
    { key: 'reports', eyebrow: 'Báo cáo', title: 'Gửi báo cáo nhanh', description: 'Mở trang gửi báo cáo riêng để thao tác thoải mái hơn.', badge: reportStudentId ? 'Đã chọn học sinh' : 'Gửi nhanh' },
    { key: 'report_history', eyebrow: 'Lịch sử', title: 'Xem báo cáo gần đây', description: 'Hiển thị trọn danh sách báo cáo thay vì bó trong khung nhỏ.', badge: `${reportCount} báo cáo` },
    { key: 'messages', eyebrow: 'Trao đổi', title: 'Chat phụ huynh', description: 'Xem danh sách hội thoại trên màn hình riêng rồi mở chat ngay.', badge: unreadConversationCount ? `${unreadConversationCount} tin mới` : 'Đã đọc hết' },
    { key: 'career_cards', eyebrow: 'Hướng nghiệp', title: 'Quản lý nghề nghiệp', description: 'Giáo viên nhập video, ảnh, ý nghĩa công việc, các bước và kỹ năng để hiện sang trang học sinh.', badge: `${careerCardsQuery.data?.length ?? 0} thẻ` },
  ] as const satisfies Array<{ key: Exclude<TeacherWorkspaceView, 'home'>; eyebrow: string; title: string; description: string; badge: string }>

  function renderWorkspaceHeader(title: string) {
    return (
      <section className="roadmap-panel teacher-clean-hero">
        <div>
          <button type="button" className="ghost-button" onClick={() => openWorkspaceView('home')}>
            Quay lại
          </button>

          <h2 style={{ marginTop: '0.9rem' }}>{title}</h2>

        </div>
        <div className="teacher-clean-hero-badges">
          <span>ID {teacherId ?? '---'}</span>
          <span>{averageLatestProgress}% tiến độ TB</span>
          <span>{unreadConversationCount} chat</span>
        </div>
      </section>
    )
  }

  function renderHomeWorkspace() {
    return (
      <>
        <section className="roadmap-panel teacher-clean-hero">
          <div>

            <h2>Bảng điều khiển</h2>
            <p className="helper-text">Chọn đúng mục để vào một màn hình làm việc riêng, không còn bị bó trong các khung nhỏ.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button type="button" className="action-button" onClick={() => openWorkspaceView('career_cards')}>
                Tạo thẻ nghề nghiệp
              </button>
              <button type="button" className="ghost-button" onClick={() => applyCareerSampleTemplate(teacherCareerSampleTemplates[0])}>
                Dùng mẫu nghề
              </button>
            </div>
          </div>
          <div className="teacher-clean-hero-badges">
            <span>ID {teacherId ?? '---'}</span>
            <span>{averageLatestProgress}% tiến độ TB</span>
            <span>{unreadConversationCount} chat</span>
          </div>
        </section>

        <section className="teacher-clean-metrics">
          {[
            { label: 'Học sinh', value: studentCount, tone: 'blue' },
            { label: 'Phụ huynh', value: parentGroupCount, tone: 'green' },
            { label: 'Báo cáo', value: reportCount, tone: 'gold' },
            { label: 'Chat mới', value: unreadConversationCount, tone: 'coral' },
            { label: 'Nghề nghiệp', value: careerCardsQuery.data?.length ?? 0, tone: 'green' },
          ].map((item) => (
            <article key={item.label} className={`mini-card teacher-clean-metric teacher-clean-metric-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          {workspaceCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className="roadmap-panel"
              style={{ width: '100%', textAlign: 'left', background: 'var(--color-background-primary)' }}
              onClick={() => openWorkspaceView(item.key)}
            >
              <div className="teacher-clean-section-head">
                <div>
                  <p className="eyebrow">{item.eyebrow}</p>
                  <h3>{item.title}</h3>
                </div>
                <span className="subject-pill muted-pill">{item.badge}</span>
              </div>
              <p className="helper-text">{item.description}</p>
            </button>
          ))}
        </section>
      </>
    )
  }

  function renderOverviewWorkspace() {
    return (
      <>
        {renderWorkspaceHeader('Nhìn nhanh toàn lớp')}
        <section className="page-stack">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Số liệu chính</h3>
              </div>
              <span className="subject-pill muted-pill">{studentCount} HS</span>
            </div>
            <BarChartCard
              title="Nhìn nhanh"
              description="Các số chính giáo viên cần theo dõi"
              items={teacherOverviewChartItems}
            />
          </article>

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Nhóm phụ huynh gần đây</h3>
              </div>
              <span className="subject-pill muted-pill">{averageLatestProgress}% TB</span>
            </div>
            <div className="student-list compact-list">
              {latestParentGroups.map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.student?.full_name ?? 'Học sinh'}</strong>
                  <span>{item.parent?.full_name ?? 'Phụ huynh'}</span>
                  <p>{item.progress_summary.last_progress_percent}% • {readinessLabelMap[item.progress_summary.readiness_status] ?? item.progress_summary.readiness_status}</p>
                </div>
              ))}
              {!latestParentGroups.length && !parentGroupsQuery.isLoading ? <p>Chưa có nhóm phụ huynh.</p> : null}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderParentGroupsWorkspace() {
    return (
      <>
        {renderWorkspaceHeader('Nhóm phụ huynh')}
        <section className="page-stack">
          {renderParentOnboarding()}

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Học sinh và phụ huynh</h3>
              </div>
              <span className="subject-pill muted-pill">{parentGroupCount} nhóm</span>
            </div>
            <div className="student-list compact-list">
              {(parentGroupsQuery.data ?? []).map((item) => (
                <div key={item.link_id} className="student-row">
                  <strong>{item.student?.full_name ?? 'Học sinh'}</strong>
                  <span>{item.parent?.full_name ?? 'Phụ huynh'}</span>
                  <p>{item.progress_summary.last_progress_percent}% • {readinessLabelMap[item.progress_summary.readiness_status] ?? item.progress_summary.readiness_status}</p>
                </div>
              ))}
              {!parentGroupsQuery.data?.length && !parentGroupsQuery.isLoading ? <p>Chưa có nhóm phụ huynh.</p> : null}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderParentLinkWorkspace() {
    return (
      <>
        {renderWorkspaceHeader('Gắn phụ huynh cho học sinh')}
        <section className="page-stack">
          {renderParentOnboarding()}

          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Gắn phụ huynh</h3>
              </div>
            </div>

            <div className="form-stack">
              <label>
                Học sinh
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                  <option value="">Chọn học sinh</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} - ID {student.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tìm phụ huynh
                <input
                  value={parentLookup}
                  onChange={(event) => setParentLookup(event.target.value)}
                  placeholder="Nhập Parent ID hoặc email"
                  disabled={!selectedStudentId}
                />
              </label>

              <label>
                Phụ huynh
                <select value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)} disabled={!selectedStudentId}>
                  <option value="">Chọn phụ huynh</option>
                  {availableParents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name} - ID {parent.id} {parent.email ? `- ${parent.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="action-button"
                type="button"
                disabled={!selectedStudentId || !selectedParentId || linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
              >
                {linkMutation.isPending ? 'Đang gắn...' : 'Gắn phụ huynh'}
              </button>

              {linkMutation.error ? <p className="error-text">{(linkMutation.error as Error).message}</p> : null}
              {!selectedStudentId ? <p>Chọn học sinh trước.</p> : null}
              {selectedStudentId && !hasParentLookup ? <p>Phụ huynh mới cần gửi Parent ID hoặc email để giáo viên tìm và gắn đúng tài khoản.</p> : null}
              {selectedStudentId && hasParentLookup && !availableParents.length && !parentsQuery.isLoading ? <p>Không tìm thấy phụ huynh khớp với Parent ID hoặc email này.</p> : null}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderReportsWorkspace() {
    return (
      <>
        {renderWorkspaceHeader('Gửi báo cáo nhanh')}
        <section className="page-stack">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Gửi nhanh</h3>
              </div>
            </div>

            <div className="form-stack">
              <label>
                Học sinh
                <select value={reportStudentId} onChange={(event) => setReportStudentId(event.target.value)}>
                  <option value="">Tất cả phụ huynh đã liên kết</option>
                  {(studentsQuery.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tiêu đề
                <input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} placeholder="Để trống nếu dùng mặc định" />
              </label>

              <label>
                Ghi chú
                <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} rows={5} placeholder="Viết ngắn gọn." />
              </label>

              <button
                className="action-button"
                type="button"
                disabled={reportMutation.isPending || !parentGroupCount}
                onClick={() => reportMutation.mutate(reportStudentId ? Number(reportStudentId) : undefined)}
              >
                {reportMutation.isPending ? 'Đang gửi...' : reportStudentId ? 'Gửi cho học sinh này' : 'Gửi tất cả'}
              </button>

              {reportMutation.error ? <p className="error-text">{(reportMutation.error as Error).message}</p> : null}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderReportHistoryWorkspace() {
    return (
      <>
        {renderWorkspaceHeader('Báo cáo gần đây')}
        <section className="page-stack">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Tất cả báo cáo</h3>
              </div>
              <span className="subject-pill muted-pill">{reportCount}</span>
            </div>
            <div className="student-list compact-list">
              {(reportsQuery.data ?? []).map((report) => (
                <div key={report.id} className="student-row">
                  <strong>{report.student?.full_name ?? `Học sinh #${report.student_id}`}</strong>
                  <span>{report.report_date} • {report.parent?.full_name ?? `Phụ huynh #${report.parent_id}`}</span>
                  <p>{report.summary_text}</p>
                </div>
              ))}
              {!reportsQuery.data?.length && !reportsQuery.isLoading ? <p>Chưa có báo cáo.</p> : null}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderMessagesWorkspace() {
    return (
      <>
        {renderWorkspaceHeader('Chat phụ huynh')}
        <section className="page-stack">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Hội thoại gần đây</h3>
              </div>
              <button type="button" className="action-button" onClick={() => setIsChatOpen(true)}>
                Mở chat
              </button>
            </div>
            <div className="student-list compact-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.conversation_key}
                  type="button"
                  className="student-row student-row-button"
                  onClick={() => openConversation(conversation)}
                >
                  <strong>{conversation.student?.full_name ?? 'Học sinh'} • {conversation.parent?.full_name ?? 'Phụ huynh'}</strong>
                  <span>{conversation.unread_count ? `${conversation.unread_count} tin mới` : 'Đã đọc'}</span>
                  <p>{conversation.latest_message?.message ?? 'Chưa có tin nhắn.'}</p>
                </button>
              ))}
              {!conversations.length && !conversationsQuery.isLoading ? <p>Chưa có đoạn chat nào.</p> : null}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderCareerCardsWorkspace() {
    const careerCards = careerCardsQuery.data ?? []

    return (
      <>
        {renderWorkspaceHeader('Quản lý thẻ nghề nghiệp')}
        <section className="page-stack">
          <article className="roadmap-panel">
            <div className="teacher-clean-section-head">
              <div>

                <h3>Thẻ nghề nghiệp đã tạo</h3>
              </div>
              <button type="button" className="ghost-button" onClick={resetCareerEditor}>
                Tạo thẻ mới
              </button>
            </div>
            <div className="student-list compact-list">
              {careerCards.map((card) => (
                <div key={card.id} className="student-row">
                  <strong>{card.title}</strong>
                  <span>{card.levels.map((level) => teacherCareerLevelLabelMap[level] ?? level).join(', ')} • {card.skills.length} kỹ năng • {card.steps.length} bước</span>
                  <p>{card.description || card.meaning_text}</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <button type="button" className="ghost-button" onClick={() => startEditCareerCard(card)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        if (window.confirm(`Ẩn thẻ nghề "${card.title}"?`)) {
                          deleteCareerCardMutation.mutate(card.id)
                        }
                      }}
                      disabled={deleteCareerCardMutation.isPending}
                    >
                      Ẩn
                    </button>
                  </div>
                </div>
              ))}
              {!careerCards.length && !careerCardsQuery.isLoading ? <p>Chưa có thẻ nghề nghiệp nào.</p> : null}
            </div>
          </article>

          <article className="roadmap-panel" ref={careerEditorRef}>
            <div className="teacher-clean-section-head">
              <div>
                <p className="eyebrow">Biên tập</p>
                <h3>{editingCareerCardId ? 'Cập nhật thẻ nghề nghiệp' : 'Tạo thẻ nghề nghiệp mới'}</h3>
                {editingCareerCardId ? <p className="helper-text">Form bên dưới đang lấy dữ liệu từ thẻ đã chọn. Sửa nội dung rồi bấm cập nhật để lưu.</p> : null}
              </div>
              {editingCareerCardId ? <span className="subject-pill muted-pill">Đang sửa #{editingCareerCardId}</span> : null}
            </div>

            <div className="form-stack">
              <p className="helper-text">Bắt buộc: tiêu đề, ý nghĩa công việc, ít nhất 1 bước và 1 kỹ năng. Ảnh bìa và video có thể bổ sung sau.</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {teacherCareerSampleTemplates.map((template) => (
                  <button key={template.title} type="button" className="ghost-button" onClick={() => applyCareerSampleTemplate(template)}>
                    Mẫu: {template.title}
                  </button>
                ))}
              </div>
              <label>
                Tiêu đề nghề nghiệp
                <input value={careerForm.title} onChange={(event) => updateCareerFormField('title', event.target.value)} placeholder="Ví dụ: Làm vườn" />
              </label>

              <label>
                Mô tả ngắn
                <textarea value={careerForm.description} onChange={(event) => updateCareerFormField('description', event.target.value)} rows={3} placeholder="Giới thiệu ngắn để học sinh nhìn là hiểu." />
              </label>

              <label>
                Ảnh bìa
                <input value={careerForm.coverImageUrl} onChange={(event) => updateCareerFormField('coverImageUrl', event.target.value)} placeholder="Dán URL ảnh hoặc upload ở dưới" />
              </label>

              <label>
                Video nghề nghiệp
                <input value={careerForm.videoUrl} onChange={(event) => updateCareerFormField('videoUrl', event.target.value)} placeholder="Dán YouTube, Google Drive, TikTok hoặc URL video upload" />
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label className="ghost-button" style={{ cursor: 'pointer' }}>
                  Tải ảnh lên
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handleCareerMediaUpload('image', file)
                      }
                    }}
                  />
                </label>
                <label className="ghost-button" style={{ cursor: 'pointer' }}>
                  Tải video lên
                  <input
                    hidden
                    type="file"
                    accept="video/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handleCareerMediaUpload('video', file)
                      }
                    }}
                  />
                </label>
                <span className="subject-pill muted-pill">{isCareerUploading ? 'Đang tải media...' : 'Có thể nhập link hoặc upload'}</span>
              </div>

              {careerForm.coverImageUrl.trim() ? (
                <div className="teacher-career-preview-card">
                  <strong>Xem trước ảnh bìa</strong>
                  <img src={careerForm.coverImageUrl} alt={careerForm.title || 'Ảnh bìa nghề nghiệp'} className="teacher-career-preview-image" />
                </div>
              ) : null}

              {careerForm.videoUrl.trim() ? (
                <div className="teacher-career-preview-card">
                  <strong>Xem trước video</strong>
                  {canPreviewCareerVideoInline(careerForm.videoUrl) ? (
                    <video src={careerForm.videoUrl} controls preload="metadata" className="teacher-career-preview-video" />
                  ) : getCareerPreviewEmbedUrl(careerForm.videoUrl) ? (
                    <iframe
                      src={getCareerPreviewEmbedUrl(careerForm.videoUrl)}
                      title={`Xem trước ${careerForm.title || 'nghề nghiệp'}`}
                      className="teacher-career-preview-video"
                      style={{ border: 0 }}
                    />
                  ) : (
                    <a href={careerForm.videoUrl} target="_blank" rel="noreferrer" className="ghost-button" style={{ width: 'fit-content' }}>
                      Mở link video để kiểm tra
                    </a>
                  )}
                </div>
              ) : null}

              <label>
                Tiêu đề phần ý nghĩa
                <input value={careerForm.meaningTitle} onChange={(event) => updateCareerFormField('meaningTitle', event.target.value)} placeholder="Ý nghĩa công việc" />
              </label>

              <label>
                Ý nghĩa công việc
                <textarea value={careerForm.meaningText} onChange={(event) => updateCareerFormField('meaningText', event.target.value)} rows={5} placeholder="Đoạn này sẽ hiện cho học sinh và dùng để phát audio." />
              </label>

              <label>
                Ghi chú dưới video
                <textarea value={careerForm.videoNote} onChange={(event) => updateCareerFormField('videoNote', event.target.value)} rows={3} placeholder="Giải thích ngắn cho học sinh xem video để làm gì." />
              </label>

              <label>
                Kỹ năng học được
                <input value={careerForm.skillsText} onChange={(event) => updateCareerFormField('skillsText', event.target.value)} placeholder="Ví dụ: Quan sát, Kiên nhẫn, Gọn gàng" />
              </label>

              <label>
                Thứ tự hiển thị
                <input value={careerForm.sortOrder} onChange={(event) => updateCareerFormField('sortOrder', event.target.value)} inputMode="numeric" />
              </label>

              <div>
                <strong>Mức độ áp dụng</strong>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {[
                    { value: 'nhe', label: 'Nhẹ' },
                    { value: 'trung_binh', label: 'Trung bình' },
                    { value: 'nang', label: 'Nặng' },
                  ].map((level) => (
                    <label key={level.value} className="ghost-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={careerForm.levels.includes(level.value as 'nhe' | 'trung_binh' | 'nang')}
                        onChange={() => toggleCareerLevel(level.value as 'nhe' | 'trung_binh' | 'nang')}
                      />
                      {level.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="teacher-clean-section-head">
                  <div>
                    <p className="eyebrow">Các bước</p>
                    <h3>Quy trình thực hiện</h3>
                  </div>
                  <button type="button" className="ghost-button" onClick={addCareerStep}>
                    Thêm bước
                  </button>
                </div>
                <div className="student-list compact-list">
                  {careerForm.steps.map((step, index) => (
                    <div key={`${index}-${step.title}`} className="student-row">
                      <strong>Bước {index + 1}</strong>
                      <label>
                        Tiêu đề bước
                        <input value={step.title} onChange={(event) => updateCareerStep(index, 'title', event.target.value)} />
                      </label>
                      <label>
                        Mô tả bước
                        <textarea value={step.description} onChange={(event) => updateCareerStep(index, 'description', event.target.value)} rows={3} />
                      </label>
                      {careerForm.steps.length > 1 ? (
                        <button type="button" className="ghost-button" onClick={() => removeCareerStep(index)}>
                          Xóa bước này
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {careerFormError ? <p className="error-text">{careerFormError}</p> : null}
              {careerUploadError ? <p className="error-text">{careerUploadError}</p> : null}
              {saveCareerCardMutation.error ? <p className="error-text">{(saveCareerCardMutation.error as Error).message}</p> : null}
              {deleteCareerCardMutation.error ? <p className="error-text">{(deleteCareerCardMutation.error as Error).message}</p> : null}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="action-button"
                  type="button"
                  disabled={saveCareerCardMutation.isPending || isCareerUploading}
                  onClick={() => saveCareerCardMutation.mutate()}
                >
                  {saveCareerCardMutation.isPending ? 'Đang lưu...' : editingCareerCardId ? 'Cập nhật thẻ nghề' : 'Tạo thẻ nghề'}
                </button>
                <button className="ghost-button" type="button" onClick={resetCareerEditor}>
                  Làm mới form
                </button>
              </div>
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderWorkspaceBody() {
    switch (activeWorkspaceView) {
      case 'overview':
        return renderOverviewWorkspace()
      case 'parent_groups':
        return renderParentGroupsWorkspace()
      case 'parent_link':
        return renderParentLinkWorkspace()
      case 'reports':
        return renderReportsWorkspace()
      case 'report_history':
        return renderReportHistoryWorkspace()
      case 'messages':
        return renderMessagesWorkspace()
      case 'career_cards':
        return renderCareerCardsWorkspace()
      default:
        return renderHomeWorkspace()
    }
  }

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack teacher-clean-page">
        {renderWorkspaceBody()}
      </div>

      <ChatDock
        viewerRole="teacher"
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((current) => !current)}
        title="Chat với phụ huynh"
        subtitle="Trao đổi nhanh khi cần phối hợp"
        unreadCount={unreadConversationCount}
        conversations={filteredConversations}
        selectedConversationKey={effectiveSelectedConversationKey}
        onSelectConversation={setSelectedConversationKey}
        studentOptions={conversationStudentOptions}
        selectedStudentId={selectedChatStudentId}
        onStudentFilterChange={setSelectedChatStudentId}
        searchTerm={conversationSearchTerm}
        onSearchTermChange={setConversationSearchTerm}
        searchPlaceholder="Tìm phụ huynh, học sinh hoặc nội dung"
        selectedConversation={selectedConversation}
        renderConversationLabel={(conversation) => `${conversation.student?.full_name ?? 'Học sinh'} • ${conversation.parent?.full_name ?? 'Phụ huynh'}`}
        renderConversationMeta={(conversation) => conversation.parent?.relationship_label ?? 'Phụ huynh đang theo dõi'}
        emptyListTitle="Chưa có đoạn chat nào"
        emptyListDescription="Sau khi gắn phụ huynh vào học sinh, hộp chat sẽ xuất hiện tại đây."
        emptySearchTitle="Không tìm thấy đoạn chat phù hợp"
        emptySearchDescription="Thử đổi học sinh hoặc xóa từ khóa tìm kiếm."
        emptyChatTitle="Chưa có tin nhắn nào"
        emptyChatDescription="Bạn có thể mở đầu bằng một lời nhắn ngắn để phụ huynh biết cách phối hợp."
        counterpartName={(conversation) => conversation.parent?.full_name ?? 'Phụ huynh'}
        chatContextLabel={(conversation) => `Trao đổi về ${conversation.student?.full_name ?? 'học sinh'}`}
        messageDraft={messageDraft}
        onMessageDraftChange={setMessageDraft}
        onSend={() => { if (selectedConversation) sendMessageMutation.mutate(selectedConversation) }}
        sendPending={sendMessageMutation.isPending}
        sendError={sendMessageMutation.error ? (sendMessageMutation.error as Error).message : null}
        messagePlaceholder="Ví dụ: Hôm nay bé làm tốt phần bài học, phụ huynh nhắc bé ôn thêm 10 phút nhé."
        messageHelperText="Nội dung ngắn, rõ việc cần phối hợp sẽ giúp phụ huynh thực hiện dễ hơn."
      />
    </RequireAuth>
  )
}

