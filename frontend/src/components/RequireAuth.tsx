import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

type RequireAuthProps = {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return (
      <section className="placeholder-panel">
        <p className="eyebrow">Can dang nhap</p>
        <h2>Dang nhap giao vien de tiep tuc</h2>
        <p>Hay quay ve tong quan va dang nhap bang tai khoan demo de thu luong API.</p>
        <Link className="action-button" to="/">
          Ve trang tong quan
        </Link>
      </section>
    )
  }

  return <>{children}</>
}
