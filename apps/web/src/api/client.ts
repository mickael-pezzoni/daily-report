import type {
  Attachment,
  AuthState,
  CalendarMonth,
  DailyNote,
  NoteDraft,
  NoteListItem,
  NotePatch,
  OAuthClientInfo,
  Project,
  ProjectDraft,
  ProjectPatch,
  SearchScope,
  SessionUser,
} from '@daily-report/types'

/** The filters of screen 2c, as they travel through the URL. */
export interface SearchOptions {
  scope?: SearchScope
  /** Lower bound on the date — what the "this year" filter sets. */
  from?: string
  signal?: AbortSignal
}

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
 * Single passage point for all of the application's HTTP requests.
 * `credentials: 'include'` so the session cookie travels with it, and a
 * typed exception on every non-2xx response.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // With a FormData body, we let the browser write the Content-Type itself:
  // it must place the multipart boundary in it. Setting it here would steal
  // that from it, and the server would receive a body it can't parse.
  const isFormData = init?.body instanceof FormData

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    // After `...init`: otherwise the caller's `headers` object would wholesale
    // overwrite the one we just composed, Content-Type included.
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      // `error` is our API's shape, `message` is better-auth's.
      body?.error ?? body?.message ?? `La requête ${path} a échoué (${response.status}).`,
      body?.code,
    )
  }

  // 204 on DELETE: no body to deserialize.
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

export const api = {
  authState: () => request<AuthState>('/auth-state'),
  me: () => request<SessionUser>('/me'),

  notes: {
    /** The note for a day within a project, or `null` if the day is blank. */
    byDate: async (date: string, projectId: string): Promise<DailyNote | null> => {
      const found = await request<NoteListItem[]>(`/notes?date=${date}&projectId=${projectId}`)
      return found[0] ?? null
    },
    /** The most recent written days of a project, attachments included — the sidebar and the mobile Calendar tab. */
    recent: (limit: number, projectId: string) =>
      request<NoteListItem[]>(`/notes?limit=${limit}&projectId=${projectId}`),
    /** A project's notes for a week, bounds included — the digest for screens 2f/2g. */
    week: (from: string, to: string, projectId: string) =>
      request<NoteListItem[]>(`/notes?from=${from}&to=${to}&limit=7&projectId=${projectId}`),
    /** Full-text search across all projects (title, content, attachment names) — screen 2c. */
    search: (q: string, options: SearchOptions = {}) => {
      const params = new URLSearchParams({ q })
      if (options.scope && options.scope !== 'all') params.set('scope', options.scope)
      if (options.from) params.set('from', options.from)
      return request<NoteListItem[]>(`/notes?${params}`, { signal: options.signal })
    },
    create: (draft: NoteDraft) =>
      request<DailyNote>('/notes', { method: 'POST', body: JSON.stringify(draft) }),
    update: (id: string, patch: NotePatch) =>
      request<DailyNote>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  },

  calendar: {
    month: (month: string, projectId: string) =>
      request<CalendarMonth>(`/calendar/${month}?projectId=${projectId}`),
  },

  projects: {
    /** The account's projects, in creation order — screens 10b and 6a. */
    list: () => request<Project[]>('/projects'),
    create: (draft: ProjectDraft) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(draft) }),
    archive: (id: string, patch: ProjectPatch) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    /** Deletes the project, its notes and their attachments. */
    remove: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  },

  attachments: {
    list: (noteId: string) => request<Attachment[]>(`/notes/${noteId}/attachments`),

    upload: (noteId: string, files: File[]) => {
      const form = new FormData()
      // Repeated field: this is how the API accepts a batch upload.
      for (const file of files) form.append('file', file)
      return request<Attachment[]>(`/notes/${noteId}/attachments`, {
        method: 'POST',
        body: form,
      })
    },

    remove: (id: string) => request<void>(`/attachments/${id}`, { method: 'DELETE' }),

    /**
     * URL of the content — not a request, but what `<img src>`, the download
     * link, and images inserted into the document consume.
     *
     * Same-origin request: the session cookie travels with it. With the S3
     * driver, the redirect to the signed URL is followed transparently.
     */
    contentUrl: (id: string) => `/api/attachments/${id}/content`,
  },

  oauthClients: {
    /** Name and icon of an mcp plugin OAuth client — consent screen. */
    get: (clientId: string) => request<OAuthClientInfo>(`/oauth-clients/${clientId}`),
  },

  mcp: {
    /**
     * `POST /api/auth/oauth2/consent` — a better-auth endpoint, not the
     * application API, but reached through the same `request()`: the `/api`
     * prefix lands on `/api/auth/oauth2/consent`, which `auth.handler` serves.
     */
    consent: (params: { accept: boolean; consentCode: string }) =>
      request<{ redirectURI: string }>('/auth/oauth2/consent', {
        method: 'POST',
        body: JSON.stringify({ accept: params.accept, consent_code: params.consentCode }),
      }),
  },
}
