import type { QueryClient } from '@tanstack/react-query'

import {
  fetchAISettings,
  fetchAdminRelationshipOverview,
  fetchAdminTeachers,
  fetchAssignments,
  fetchClasses,
  fetchLessons,
  fetchMyAssignments,
  fetchMyClasses,
  fetchParentChildren,
  fetchStudents,
  fetchSubjects,
  fetchTeacherReports,
} from '../services/api'

const warmedRouteCache = new Set<string>()

function buildWarmKey(route: string, token: string) {
  return `${route}:${token}`
}

async function warmAdminRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['admin-teachers', token],
      queryFn: () => fetchAdminTeachers(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['admin-relationships-overview', token],
      queryFn: () => fetchAdminRelationshipOverview(token),
    }),
  ])
}

async function warmTeacherHomeRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['students', token],
      queryFn: () => fetchStudents(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['teacher-reports', token],
      queryFn: () => fetchTeacherReports(token),
    }),
  ])
}

async function warmTeacherStudentsRoute(queryClient: QueryClient, token: string) {
  await queryClient.prefetchQuery({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token),
  })
}

async function warmTeacherClassesRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.ensureQueryData({
      queryKey: ['classes', token],
      queryFn: () => fetchClasses(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['students', token],
      queryFn: () => fetchStudents(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['subjects'],
      queryFn: fetchSubjects,
    }),
  ])
}

async function warmTeacherLessonsRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.ensureQueryData({
      queryKey: ['lessons', token],
      queryFn: () => fetchLessons(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['subjects'],
      queryFn: fetchSubjects,
    }),
  ])
}

async function warmTeacherAssignmentsRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['lessons', token],
      queryFn: () => fetchLessons(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['assignments', token],
      queryFn: () => fetchAssignments(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['classes', token],
      queryFn: () => fetchClasses(token),
    }),
  ])
}

async function warmTeacherProgressRoute(queryClient: QueryClient, token: string) {
  await queryClient.prefetchQuery({
    queryKey: ['assignments', token],
    queryFn: () => fetchAssignments(token),
  })
}

async function warmStudentRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['my-assignments', token],
      queryFn: () => fetchMyAssignments(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['my-classes', token],
      queryFn: () => fetchMyClasses(token),
    }),
  ])
}

async function warmParentRoute(queryClient: QueryClient, token: string) {
  await queryClient.prefetchQuery({
    queryKey: ['parent-children', token],
    queryFn: () => fetchParentChildren(token),
  })
}

export async function prefetchRouteData(queryClient: QueryClient, route: string, token: string | null) {
  if (!token) return
  const warmKey = buildWarmKey(route, token)
  if (warmedRouteCache.has(warmKey)) return

  switch (route) {
    case '/admin':
      await warmAdminRoute(queryClient, token)
      break
    case '/giao-vien':
      await warmTeacherHomeRoute(queryClient, token)
      break
    case '/hoc-sinh':
      await warmTeacherStudentsRoute(queryClient, token)
      break
    case '/lop-hoc':
      await warmTeacherClassesRoute(queryClient, token)
      break
    case '/bai-hoc':
      await warmTeacherLessonsRoute(queryClient, token)
      break
    case '/giao-bai':
      await warmTeacherAssignmentsRoute(queryClient, token)
      break
    case '/tien-do':
      await warmTeacherProgressRoute(queryClient, token)
      break
    case '/cai-dat-ai':
      await queryClient.prefetchQuery({
        queryKey: ['ai-settings', token],
        queryFn: () => fetchAISettings(token),
      })
      break
    case '/hoc-tap':
      await warmStudentRoute(queryClient, token)
      break
    case '/phu-huynh':
      await warmParentRoute(queryClient, token)
      break
    default:
      break
  }

  warmedRouteCache.add(warmKey)
}
