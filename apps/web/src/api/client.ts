import type {
  AuthState,
  CalendarMonth,
  DailyNote,
  NoteDraft,
  NotePatch,
  SessionUser,
} from '@daily-report/types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Point de passage unique de toutes les requêtes HTTP de l'application.
 * `credentials: 'include'` pour que le cookie de session parte avec, et une
 * exception typée sur toute réponse non-2xx.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      // `error` est la forme de notre API, `message` celle de better-auth.
      body?.error ?? body?.message ?? `La requête ${path} a échoué (${response.status}).`,
      body?.code,
    )
  }

  // 204 sur DELETE : pas de corps à désérialiser.
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

export const api = {
  authState: () => request<AuthState>('/auth-state'),
  me: () => request<SessionUser>('/me'),

  notes: {
    /** La note d'un jour, ou `null` si le jour est vierge. */
    byDate: async (date: string): Promise<DailyNote | null> => {
      const found = await request<DailyNote[]>(`/notes?date=${date}`)
      return found[0] ?? null
    },
    recent: (limit: number) => request<DailyNote[]>(`/notes?limit=${limit}`),
    create: (draft: NoteDraft) =>
      request<DailyNote>('/notes', { method: 'POST', body: JSON.stringify(draft) }),
    update: (id: string, patch: NotePatch) =>
      request<DailyNote>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  },

  calendar: {
    month: (month: string) => request<CalendarMonth>(`/calendar/${month}`),
  },
}
