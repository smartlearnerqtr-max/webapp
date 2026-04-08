import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

import App from './App'
import { fetchHealth } from './services/api'
import './index.css'

// "Đánh thức" backend Render free tier ngay khi app load —
// tránh cold start 20-30 giây khi user bấm đăng nhập lần đầu.
void fetchHealth().catch(() => { /* bỏ qua nếu lỗi */ })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dữ liệu được coi là mới trong 30 giây — tránh refetch thừa khi navigate qua lại giữa các trang.
      staleTime: 30_000,
      // Giữ cache 5 phút sau khi component unmount — tẫt cả các query trước đó vẫn dùng được ngay mà không cần re-fetch.
      gcTime: 5 * 60_000,
      // Không retry khi lỗi xác thực (401/403) — tránh chḝ không cần thiết.
      retry: (failureCount, error) => {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('401') || message.includes('403') || message.includes('Forbidden') || message.includes('Unauthorized')) {
          return false
        }
        return failureCount < 2
      },
    },
  },
})

registerSW({
  immediate: true,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
