import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getRealtimeStreamUrl, type RealtimeEventItem } from '../services/api'
import { useAuthStore } from '../store/authStore'

type RealtimeBridgeProps = {
  isNotificationPanelOpen: boolean
  onUnreadCountChange?: (count: number) => void
}

type NotificationTone = 'teacher' | 'student' | 'parent' | 'system'

type NotificationCopy = {
  title: string
  message: string
  tone: NotificationTone
}

type EventPayload = {
  source?: string
  assignment_count?: number
  class_name?: string
  lesson_title?: string
  student_count?: number
  student_name?: string
  parent_name?: string
  teacher_name?: string
  sender_role?: string
  sender_name?: string
  message_preview?: string
  report_count?: number
  auto_assignment_count?: number
}

function invalidateTeacherQueries(queryClient: ReturnType<typeof useQueryClient>, token: string) {
  void queryClient.invalidateQueries({ queryKey: ['assignments', token] })
  void queryClient.invalidateQueries({ queryKey: ['assignment-progress'] })
  void queryClient.invalidateQueries({ queryKey: ['classes', token] })
  void queryClient.invalidateQueries({ queryKey: ['class-students'] })
  void queryClient.invalidateQueries({ queryKey: ['students', token] })
  void queryClient.invalidateQueries({ queryKey: ['teacher-parent-groups', token] })
  void queryClient.invalidateQueries({ queryKey: ['teacher-reports', token] })
  void queryClient.invalidateQueries({ queryKey: ['teacher-shared-students', token] })
  void queryClient.invalidateQueries({ queryKey: ['parents', token] })
  void queryClient.invalidateQueries({ queryKey: ['teacher-messages', token] })
}

function invalidateStudentQueries(queryClient: ReturnType<typeof useQueryClient>, token: string) {
  void queryClient.invalidateQueries({ queryKey: ['my-assignments', token] })
  void queryClient.invalidateQueries({ queryKey: ['my-assignment-detail'] })
  void queryClient.invalidateQueries({ queryKey: ['my-classes', token] })
  void queryClient.invalidateQueries({ queryKey: ['my-teachers', token] })
}

function invalidateParentQueries(queryClient: ReturnType<typeof useQueryClient>, token: string) {
  void queryClient.invalidateQueries({ queryKey: ['parent-children', token] })
  void queryClient.invalidateQueries({ queryKey: ['parent-reports', token] })
  void queryClient.invalidateQueries({ queryKey: ['parent-messages', token] })
}

function parsePayload(payloadJson: string | null): EventPayload {
  if (!payloadJson) return {}
  try {
    return JSON.parse(payloadJson) as EventPayload
  } catch {
    return {}
  }
}

function getUnreadStorageKey(userId: number | undefined) {
  return userId ? `webapp-realtime-unread-${userId}` : null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.')
  if (segments.length < 2) return null

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = window.atob(padded)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function isJwtExpired(token: string, skewSeconds = 15): boolean {
  const payload = decodeJwtPayload(token)
  const exp = Number(payload?.exp)
  if (!Number.isFinite(exp)) return false
  const now = Math.floor(Date.now() / 1000)
  return exp <= now + skewSeconds
}

function playIncomingMessageTone(audioContextRef: { current: AudioContext | null }) {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return

    const context = audioContextRef.current ?? new AudioContextClass()
    audioContextRef.current = context

    if (context.state === 'suspended') {
      void context.resume()
    }

    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    const now = context.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(720, now)
    oscillator.frequency.linearRampToValueAtTime(520, now + 0.12)

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.045, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.18)
  } catch {
    // Ignore audio failures so realtime updates never break the UI.
  }
}

function formatNotification(event: RealtimeEventItem, role: string): NotificationCopy {
  const payload = parsePayload(event.payload_json)
  const className = payload.class_name ?? 'lớp học'
  const lessonTitle = payload.lesson_title ?? 'bài học mới'
  const assignmentCount = payload.assignment_count ?? 0
  const studentCount = payload.student_count ?? 0
  const studentName = payload.student_name ?? 'học sinh'
  const parentName = payload.parent_name ?? 'phụ huynh'
  const teacherName = payload.teacher_name ?? 'giáo viên'
  const senderName = payload.sender_name ?? 'Người dùng'
  const messagePreview = payload.message_preview ?? 'Bạn có một tin nhắn mới.'
  const reportCount = payload.report_count ?? 0
  const autoAssignmentCount = payload.auto_assignment_count ?? 0

  if (role === 'teacher') {
    if (event.event_type === 'assignment_created' && payload.source === 'class_sync') {
      return {
        title: 'Đã bù bài cho học sinh mới',
        message: `${studentName} vừa nhận thêm ${assignmentCount} bài đang mở trong ${className}.`,
        tone: 'teacher',
      }
    }
    if (event.event_type === 'assignment_created') {
      return {
        title: 'Đã giao bài mới',
        message: `${lessonTitle} đã được giao${studentCount ? ` cho ${studentCount} học sinh` : ''}.`,
        tone: 'teacher',
      }
    }
    if (event.event_type === 'assignment_progress_updated') {
      return {
        title: 'Tiến độ vừa thay đổi',
        message: 'Một học sinh vừa lưu tiến độ mới. Bạn có thể mở mục Tiến độ để xem chi tiết.',
        tone: 'teacher',
      }
    }
    if (event.event_type === 'assignment_completed') {
      return {
        title: 'Có bài học vừa hoàn thành',
        message: 'Một học sinh vừa hoàn thành bài được giao. Readiness sẽ được cập nhật ngay trên dashboard.',
        tone: 'teacher',
      }
    }
    if (event.event_type === 'class_membership_updated') {
      return {
        title: 'Danh sách lớp vừa thay đổi',
        message: autoAssignmentCount > 0
          ? `${className} vừa có cập nhật học sinh và hệ thống đã gắn thêm ${autoAssignmentCount} bài đang mở.`
          : `${className} vừa có thay đổi về danh sách học sinh.`,
        tone: 'teacher',
      }
    }
    if (event.event_type === 'parent_group_updated') {
      return {
        title: 'Đã cập nhật nhóm phụ huynh',
        message: `${parentName} đã được thêm vào nhóm theo dõi của ${studentName}.`,
        tone: 'teacher',
      }
    }
    if (event.event_type === 'parent_report_sent') {
      return {
        title: 'Báo cáo đã gửi',
        message: `Đã gửi thành công ${reportCount || 'một'} báo cáo học tập tới phụ huynh.`,
        tone: 'teacher',
      }
    }
    if (event.event_type === 'parent_teacher_message_created') {
      return {
        title: 'Phụ huynh vừa nhắn',
        message: `${parentName} vừa nhắn về ${studentName}: ${messagePreview}`,
        tone: 'teacher',
      }
    }
  }

  if (role === 'student') {
    if (event.event_type === 'assignment_created' && payload.source === 'class_sync') {
      return {
        title: 'Bài đang mở đã sẵn sàng',
        message: `Khi vào ${className}, bạn đã được thêm ${assignmentCount} bài đang hoạt động để học ngay.`,
        tone: 'student',
      }
    }
    if (event.event_type === 'assignment_created') {
      return {
        title: 'Bạn có bài tập mới',
        message: `${lessonTitle} đã xuất hiện trong trang học tập của bạn.`,
        tone: 'student',
      }
    }
    if (event.event_type === 'class_membership_updated') {
      return {
        title: 'Bạn vừa vào lớp mới',
        message: autoAssignmentCount > 0
          ? `Bạn đã vào ${className} và được thêm sẵn ${autoAssignmentCount} bài đang mở.`
          : `Bạn đã vào ${className}. Các nội dung học tập sẽ hiện ngay khi giáo viên giao bài.`,
        tone: 'student',
      }
    }
    if (event.event_type === 'assignment_progress_updated') {
      return {
        title: 'Tiến độ đã được lưu',
        message: 'Hệ thống đã ghi nhận phần bạn vừa học. Bạn có thể tiếp tục mà không lo mất dữ liệu.',
        tone: 'student',
      }
    }
    if (event.event_type === 'assignment_completed') {
      return {
        title: 'Bạn đã hoàn thành bài học',
        message: 'Kết quả vừa được lưu xong. Bạn có thể xem tiếp bài khác hoặc chờ giáo viên giao thêm.',
        tone: 'student',
      }
    }
  }

  if (role === 'parent') {
    if (event.event_type === 'assignment_created' && payload.source === 'class_sync') {
      return {
        title: 'Con vừa có thêm bài học',
        message: `${studentName} vừa vào ${className} và được thêm ${assignmentCount} bài đang mở để bắt đầu học.`,
        tone: 'parent',
      }
    }
    if (event.event_type === 'assignment_created') {
      return {
        title: 'Con có bài tập mới',
        message: `${lessonTitle} vừa được giao. Quý phụ huynh có thể theo dõi tiến độ của con ngay trên ứng dụng.`,
        tone: 'parent',
      }
    }
    if (event.event_type === 'assignment_progress_updated') {
      return {
        title: 'Tiến độ của con vừa thay đổi',
        message: 'Hệ thống vừa ghi nhận thêm tiến độ học tập mới của con.',
        tone: 'parent',
      }
    }
    if (event.event_type === 'assignment_completed') {
      return {
        title: 'Con vừa hoàn thành một bài học',
        message: 'Kết quả mới đã được lưu. Quý phụ huynh có thể mở dashboard để xem tổng quan cập nhật.',
        tone: 'parent',
      }
    }
    if (event.event_type === 'parent_report_sent') {
      return {
        title: 'Bạn vừa nhận báo cáo mới',
        message: `Giáo viên đã gửi ${reportCount || 'một'} báo cáo học tập mới.`,
        tone: 'parent',
      }
    }
    if (event.event_type === 'parent_group_updated') {
      return {
        title: 'Bạn đã được thêm vào nhóm theo dõi',
        message: `Giờ đây bạn có thể theo dõi tiến độ học tập của ${studentName} trực tiếp trên ứng dụng.`,
        tone: 'parent',
      }
    }
    if (event.event_type === 'parent_teacher_message_created') {
      if (payload.sender_role === 'teacher') {
        return {
          title: 'Giáo viên vừa nhắn',
          message: `${teacherName} vừa nhắn về ${studentName}: ${messagePreview}`,
          tone: 'parent',
        }
      }

      return {
        title: 'Tin nhắn mới',
        message: `${senderName} vừa gửi một tin nhắn mới: ${messagePreview}`,
        tone: 'parent',
      }
    }
  }

  return {
    title: event.title ?? 'Thông báo mới',
    message: event.message,
    tone: 'system',
  }
}

export function RealtimeBridge({ isNotificationPanelOpen, onUnreadCountChange }: RealtimeBridgeProps) {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [latestEvent, setLatestEvent] = useState<RealtimeEventItem | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const lastEventIdRef = useRef(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const storageKey = useMemo(() => getUnreadStorageKey(user?.id), [user?.id])

  useEffect(() => {
    if (!storageKey) {
      setUnreadCount(0)
      return
    }

    const rawValue = window.sessionStorage.getItem(storageKey)
    const parsedValue = rawValue ? Number(rawValue) : 0
    setUnreadCount(Number.isFinite(parsedValue) ? parsedValue : 0)
  }, [storageKey])

  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [onUnreadCountChange, unreadCount])

  useEffect(() => {
    if (!storageKey) return
    window.sessionStorage.setItem(storageKey, String(unreadCount))
  }, [storageKey, unreadCount])

  useEffect(() => {
    if (!accessToken || !user) {
      setLatestEvent(null)
      setUnreadCount(0)
      lastEventIdRef.current = 0
      return undefined
    }

    if (isJwtExpired(accessToken)) {
      clearSession()
      setLatestEvent(null)
      setUnreadCount(0)
      lastEventIdRef.current = 0
      return undefined
    }

    let isClosed = false
    let reconnectTimer: number | null = null
    let eventSource: EventSource | null = null

    const connect = () => {
      if (isClosed) return

      eventSource = new EventSource(getRealtimeStreamUrl(accessToken, lastEventIdRef.current || undefined))

      eventSource.addEventListener('realtime', (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as RealtimeEventItem
        lastEventIdRef.current = payload.id
        setLatestEvent(payload)
        setUnreadCount((current) => current + 1)

        if (payload.event_type === 'parent_teacher_message_created') {
          playIncomingMessageTone(audioContextRef)
        }

        if (user.role === 'teacher') {
          invalidateTeacherQueries(queryClient, accessToken)
          return
        }

        if (user.role === 'student') {
          invalidateStudentQueries(queryClient, accessToken)
          return
        }

        if (user.role === 'parent') {
          invalidateParentQueries(queryClient, accessToken)
        }
      })

      eventSource.onerror = () => {
        eventSource?.close()
        if (isClosed) return
        reconnectTimer = window.setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      isClosed = true
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      eventSource?.close()
    }
  }, [accessToken, clearSession, queryClient, user])

  useEffect(() => {
    if (!latestEvent) return undefined
    const timer = window.setTimeout(() => setLatestEvent(null), 7000)
    return () => window.clearTimeout(timer)
  }, [latestEvent])

  useEffect(() => {
    if (!isNotificationPanelOpen) return
    setUnreadCount(0)
    setLatestEvent(null)
  }, [isNotificationPanelOpen])

  const notificationCopy = useMemo(() => {
    if (!latestEvent || !user) return null
    return formatNotification(latestEvent, user.role)
  }, [latestEvent, user])

  if (!notificationCopy) return null

  return (
    <div className={`realtime-banner realtime-banner-${notificationCopy.tone}`} role="status" aria-live="polite">
      <div className="realtime-banner-head">
        <span className="realtime-banner-label">{notificationCopy.title}</span>
        <button type="button" className="realtime-banner-action" onClick={() => { setLatestEvent(null); setUnreadCount(0) }}>
          Đã xem
        </button>
      </div>
      <strong>{notificationCopy.message}</strong>
    </div>
  )
}
