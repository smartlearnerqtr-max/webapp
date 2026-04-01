export function getDefaultRouteForRole(role?: string | null): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'teacher':
      return '/giao-vien'
    case 'student':
      return '/hoc-tap'
    case 'parent':
      return '/phu-huynh'
    default:
      return '/'
  }
}
