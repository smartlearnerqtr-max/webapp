import { create } from 'zustand'

type AuthUser = {
  id: number
  email: string | null
  phone: string | null
  role: string
  status: string
}

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  profile: Record<string, unknown> | null
  hydrate: () => void
  setSession: (payload: {
    accessToken: string
    refreshToken: string
    user: AuthUser
    profile: Record<string, unknown> | null
  }) => void
  clearSession: () => void
}

const STORAGE_KEY = 'webapp-auth'

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  profile: null,
  hydrate: () => {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Omit<AuthState, 'hydrate' | 'setSession' | 'clearSession'>
    set({
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      user: parsed.user,
      profile: parsed.profile,
    })
  },
  setSession: ({ accessToken, refreshToken, user, profile }) => {
    const payload = { accessToken, refreshToken, user, profile }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    set(payload)
  },
  clearSession: () => {
    window.sessionStorage.removeItem(STORAGE_KEY)
    set({ accessToken: null, refreshToken: null, user: null, profile: null })
  },
}))
