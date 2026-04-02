import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { getDefaultRouteForRole } from '../utils/roleRoutes'

type RequireAuthProps = {
  children: ReactNode
  allowedRoles?: string[]
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return (
      <section className="placeholder-panel">
        <p className="eyebrow">Cần đăng nhập</p>
        <h2>Hãy đăng nhập để tiếp tục</h2>
        <p>Hệ thống sẽ đưa bạn vào đúng khu vực theo vai trò giáo viên, học sinh hoặc phụ huynh.</p>
        <Link className="action-button" to="/">
          Về trang đăng nhập
        </Link>
      </section>
    )
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />
  }

  return <>{children}</>
}
