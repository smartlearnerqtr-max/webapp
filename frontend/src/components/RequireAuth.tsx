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
        <p className="eyebrow">Can dang nhap</p>
        <h2>Hay dang nhap de tiep tuc</h2>
        <p>He thong se dua ban vao dung khu vuc theo vai tro giao vien, hoc sinh hoac phu huynh.</p>
        <Link className="action-button" to="/">
          Ve trang dang nhap
        </Link>
      </section>
    )
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />
  }

  return <>{children}</>
}
