import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

import App from './App'
import { fetchHealth } from './services/api'
import './index.css'

const LESSON_MEDIA_SHELL_FIX_KEY = 'lesson-media-shell-fix'

function isLessonMediaHtmlPath() {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/lesson-media/') && window.location.pathname.endsWith('.html')
}

async function unregisterServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.allSettled(registrations.map((registration) => registration.unregister()))
}

async function clearBrowserCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return
  const cacheKeys = await window.caches.keys()
  await Promise.allSettled(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)))
}

async function maybeRecoverLessonMediaShell() {
  if (typeof window === 'undefined') return false

  if (!isLessonMediaHtmlPath()) {
    window.sessionStorage.removeItem(LESSON_MEDIA_SHELL_FIX_KEY)
    return false
  }

  const requestKey = `${window.location.pathname}${window.location.search}`
  if (window.sessionStorage.getItem(LESSON_MEDIA_SHELL_FIX_KEY) === requestKey) {
    return false
  }

  window.sessionStorage.setItem(LESSON_MEDIA_SHELL_FIX_KEY, requestKey)
  await unregisterServiceWorkers()
  await clearBrowserCaches()
  window.location.replace(window.location.href)
  return true
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 5 * 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
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

async function bootstrap() {
  if (await maybeRecoverLessonMediaShell()) {
    return
  }

  void fetchHealth().catch(() => {})

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
}

void bootstrap()
