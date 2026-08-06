import type { AuthState, SessionUser } from '@daily-report/types'

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
      body?.message ?? `La requête ${path} a échoué (${response.status}).`,
      body?.code,
    )
  }

  return response.json() as Promise<T>
}

export const api = {
  authState: () => request<AuthState>('/auth-state'),
  me: () => request<SessionUser>('/me'),
}
