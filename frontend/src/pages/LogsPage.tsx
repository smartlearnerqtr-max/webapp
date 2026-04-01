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
          <p className="eyebrow">Task 39 + 40</p>
          <h2>Log ky thuat backend</h2>
          <p>Cac hanh dong nhu dang nhap, tao lop, tao hoc sinh va luu AI settings se bat dau xuat hien o day.</p>
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
            {!logsQuery.data?.length && !logsQuery.isLoading ? <p>Chua co log nao duoc ghi.</p> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  )
}

