import { useQuery } from '@tanstack/react-query'

import { fetchParentChildren } from '../services/api'
import { RequireAuth } from '../components/RequireAuth'
import { useAuthStore } from '../store/authStore'

export function ParentPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  const childrenQuery = useQuery({
    queryKey: ['parent-children', token],
    queryFn: () => fetchParentChildren(token!),
    enabled: Boolean(token && user?.role === 'parent'),
  })

  return (
    <RequireAuth>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Task 32</p>
          <h2>Dashboard phu huynh</h2>
          <p>Phu huynh co the duoc giao vien add vao theo doi nhieu con. Man nay tong hop nhanh tinh hinh hoc tap hien tai cua tung con.</p>
        </section>

        {user?.role !== 'parent' ? (
          <section className="placeholder-panel">
            <h3>Man nay danh cho tai khoan phu huynh</h3>
            <p>Dang nhap bang parent@example.com / 123456 de xem dashboard phu huynh mau da duoc seed.</p>
          </section>
        ) : (
          <section className="dashboard-grid">
            {childrenQuery.data?.map((item) => (
              <article key={item.student.id} className="roadmap-panel">
                <div className="student-row">
                  <strong>{item.student.full_name}</strong>
                  <span>{item.student.disability_level} / {item.student.preferred_input}</span>
                </div>
                <div className="metrics-grid">
                  <div className="info-card mini-card">
                    <span>Tong assignment</span>
                    <strong>{item.progress_summary.total_assignments}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Da xong</span>
                    <strong>{item.progress_summary.completed_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Dang hoc</span>
                    <strong>{item.progress_summary.in_progress_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Tien do gan nhat</span>
                    <strong>{item.progress_summary.last_progress_percent}%</strong>
                  </div>
                </div>
                <p>Bai hoc gan nhat: {item.progress_summary.last_assignment_title ?? 'Chua co assignment nao'}</p>
                <div className="tag-wrap">
                  {item.classes.map((classroom) => (
                    <span key={classroom.id} className="subject-pill">{classroom.name}</span>
                  ))}
                  {!item.classes.length ? <p>Chua duoc gan lop hoc nao.</p> : null}
                </div>
              </article>
            ))}
            {!childrenQuery.data?.length && !childrenQuery.isLoading ? (
              <article className="roadmap-panel">
                <h3>Chua co lien ket nao</h3>
                <p>Giao vien can add phu huynh vao hoc sinh truoc khi dashboard co du lieu.</p>
              </article>
            ) : null}
          </section>
        )}
      </div>
    </RequireAuth>
  )
}
