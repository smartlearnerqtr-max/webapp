import type { QueryClient } from '@tanstack/react-query'

import {
  fetchAISettings,
  fetchAdminRelationshipOverview,
  fetchAdminTeachers,
  fetchAssignmentProgress,
  fetchAssignments,
  fetchClasses,
  fetchClassStudents,
  fetchClassSubjects,
  fetchLessons,
  fetchLesson,
  fetchMyAssignment,
  fetchMyAssignments,
  fetchMyClasses,
  fetchMyTeachers,
  fetchParentChildren,
  fetchParentReports,
  fetchParents,
  fetchStudents,
  fetchStudentTeachers,
  fetchSubjects,
  fetchTeacherParentGroups,
  fetchTeacherReports,
  fetchTeacherSharedStudents,
} from '../services/api'

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
      queryKey: ['parents', token],
      queryFn: () => fetchParents(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['teacher-parent-groups', token],
      queryFn: () => fetchTeacherParentGroups(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['teacher-reports', token],
      queryFn: () => fetchTeacherReports(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['teacher-shared-students', token],
      queryFn: () => fetchTeacherSharedStudents(token),
    }),
  ])
}

async function warmTeacherStudentsRoute(queryClient: QueryClient, token: string) {
  const students = await queryClient.ensureQueryData({
    queryKey: ['students', token],
    queryFn: () => fetchStudents(token),
  })

  const firstStudentId = students[0]?.id
  if (!firstStudentId) return

  await queryClient.prefetchQuery({
    queryKey: ['student-teachers', token, firstStudentId],
    queryFn: () => fetchStudentTeachers(token, firstStudentId),
  })
}

async function warmTeacherClassesRoute(queryClient: QueryClient, token: string) {
  const [classes] = await Promise.all([
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

  const firstClassId = classes[0]?.id
  if (!firstClassId) return

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['class-students', token, firstClassId],
      queryFn: () => fetchClassStudents(token, firstClassId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['class-subjects', token, firstClassId],
      queryFn: () => fetchClassSubjects(token, firstClassId),
    }),
  ])
}

async function warmTeacherLessonsRoute(queryClient: QueryClient, token: string) {
  const [lessons] = await Promise.all([
    queryClient.ensureQueryData({
      queryKey: ['lessons', token],
      queryFn: () => fetchLessons(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['subjects'],
      queryFn: fetchSubjects,
    }),
  ])

  const firstLessonId = lessons[0]?.id
  if (!firstLessonId) return

  await queryClient.prefetchQuery({
    queryKey: ['lesson-detail', token, firstLessonId],
    queryFn: () => fetchLesson(token, firstLessonId),
  })
}

async function warmTeacherAssignmentsRoute(queryClient: QueryClient, token: string) {
  const [classes] = await Promise.all([
    queryClient.ensureQueryData({
      queryKey: ['classes', token],
      queryFn: () => fetchClasses(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['lessons', token],
      queryFn: () => fetchLessons(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['assignments', token],
      queryFn: () => fetchAssignments(token),
    }),
  ])

  const firstClassId = classes[0]?.id
  if (!firstClassId) return

  await queryClient.prefetchQuery({
    queryKey: ['class-students', token, firstClassId],
    queryFn: () => fetchClassStudents(token, firstClassId),
  })
}

async function warmTeacherProgressRoute(queryClient: QueryClient, token: string) {
  const assignments = await queryClient.ensureQueryData({
    queryKey: ['assignments', token],
    queryFn: () => fetchAssignments(token),
  })

  const firstAssignmentId = assignments[0]?.id
  if (!firstAssignmentId) return

  await queryClient.prefetchQuery({
    queryKey: ['assignment-progress', token, String(firstAssignmentId)],
    queryFn: () => fetchAssignmentProgress(token, firstAssignmentId),
  })
}

async function warmStudentRoute(queryClient: QueryClient, token: string) {
  const assignments = await queryClient.ensureQueryData({
    queryKey: ['my-assignments', token],
    queryFn: () => fetchMyAssignments(token),
  })

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['my-classes', token],
      queryFn: () => fetchMyClasses(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['my-teachers', token],
      queryFn: () => fetchMyTeachers(token),
    }),
  ])

  const firstAssignmentId = assignments[0]?.assignment_id
  if (!firstAssignmentId) return

  await queryClient.prefetchQuery({
    queryKey: ['my-assignment-detail', token, firstAssignmentId],
    queryFn: () => fetchMyAssignment(token, firstAssignmentId),
  })
}

async function warmParentRoute(queryClient: QueryClient, token: string) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['parent-children', token],
      queryFn: () => fetchParentChildren(token),
    }),
    queryClient.prefetchQuery({
      queryKey: ['parent-reports', token],
      queryFn: () => fetchParentReports(token),
    }),
  ])
}

export async function prefetchRouteData(queryClient: QueryClient, route: string, token: string | null) {
  if (!token) return

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
}
