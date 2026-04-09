import { useQuery } from '@tanstack/react-query'

import { RequireAuth } from '../components/RequireAuth'
import { fetchLogs } from '../services/api'
import { useAuthStore } from '../store/authStore'

export function LogsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const logsQuery = useQuery({
    queryKey: ['logs', token],
    queryFn: () => fetchLogs(token!),
    enabled: Boolean(token),
  })

  return (
    <RequireAuth allowedRoles={['teacher']}>
      <div className="page-stack">
        <section className="roadmap-panel">
          <p className="eyebrow">Nhật ký hệ thống</p>
          <h2>Log kỹ thuật backend</h2>
          <p>Các hành động như đăng nhập, tạo lớp, tạo học sinh và lưu AI settings sẽ bắt đầu xuất hiện ở đây.</p>
        </section>

        <section className="roadmap-panel">
          <div className="student-list">
            {logsQuery.data?.map((log) => (
              <div key={log.id} className="student-row">
                <strong>{log.module} / {log.level}</strong>
                <span>{log.action_name ?? 'event'} | {log.request_id ?? 'no-request-id'}</span>
                <p>{log.message}</p>
              </div>
            ))}
            {!logsQuery.data?.length && !logsQuery.isLoading ? <p>Chưa có log nào được ghi.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}
