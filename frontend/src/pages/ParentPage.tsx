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
          <h2>Dashboard phụ huynh</h2>
          <p>Phụ huynh có thể được giáo viên thêm vào theo dõi nhiều con. Màn hình này tổng hợp nhanh tình hình học tập hiện tại của từng con.</p>
        </section>

        {user?.role !== 'parent' ? (
          <section className="placeholder-panel">
            <h3>Màn hình này dành cho tài khoản phụ huynh</h3>
            <p>Đăng nhập bằng parent@example.com / 123456 để xem dashboard phụ huynh mẫu đã được seed.</p>
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
                    <span>Tổng assignment</span>
                    <strong>{item.progress_summary.total_assignments}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Đã xong</span>
                    <strong>{item.progress_summary.completed_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Đang học</span>
                    <strong>{item.progress_summary.in_progress_count}</strong>
                  </div>
                  <div className="info-card mini-card">
                    <span>Tiến độ gần nhất</span>
                    <strong>{item.progress_summary.last_progress_percent}%</strong>
                  </div>
                </div>
                <p>Bài học gần nhất: {item.progress_summary.last_assignment_title ?? 'Chưa có assignment nào'}</p>
                <div className="tag-wrap">
                  {item.classes.map((classroom) => (
                    <span key={classroom.id} className="subject-pill">{classroom.name}</span>
                  ))}
                  {!item.classes.length ? <p>Chưa được gán lớp học nào.</p> : null}
                </div>
              </article>
            ))}
            {!childrenQuery.data?.length && !childrenQuery.isLoading ? (
              <article className="roadmap-panel">
                <h3>Chưa có liên kết nào</h3>
                <p>Giáo viên cần add phụ huynh vào học sinh trước khi dashboard có dữ liệu.</p>
              </article>
            ) : null}
          </section>
        )}
      </div>
    </RequireAuth>
  )
}
