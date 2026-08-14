import type {
  Attachment,
  AuthState,
  CalendarMonth,
  DailyNote,
  NoteDraft,
  NoteListItem,
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
  // Avec un FormData, on laisse le navigateur écrire le Content-Type lui-même :
  // il doit y placer la frontière multipart. L'imposer ici la lui volerait, et
  // le serveur recevrait un corps qu'il ne sait pas découper.
  const isFormData = init?.body instanceof FormData

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    // Après `...init` : sinon l'objet `headers` de l'appelant écraserait en bloc
    // celui qu'on vient de composer, Content-Type compris.
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
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
      const found = await request<NoteListItem[]>(`/notes?date=${date}`)
      return found[0] ?? null
    },
    /** Les derniers jours rédigés, pièces jointes comprises — les cartes de 2f. */
    recent: (limit: number) => request<NoteListItem[]>(`/notes?limit=${limit}`),
    create: (draft: NoteDraft) =>
      request<DailyNote>('/notes', { method: 'POST', body: JSON.stringify(draft) }),
    update: (id: string, patch: NotePatch) =>
      request<DailyNote>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  },

  calendar: {
    month: (month: string) => request<CalendarMonth>(`/calendar/${month}`),
  },

  attachments: {
    list: (noteId: string) => request<Attachment[]>(`/notes/${noteId}/attachments`),

    upload: (noteId: string, files: File[]) => {
      const form = new FormData()
      // Champ répété : c'est ainsi que l'API accepte un envoi groupé.
      for (const file of files) form.append('file', file)
      return request<Attachment[]>(`/notes/${noteId}/attachments`, {
        method: 'POST',
        body: form,
      })
    },

    remove: (id: string) => request<void>(`/attachments/${id}`, { method: 'DELETE' }),

    /**
     * URL du contenu — pas une requête, mais ce que consomment `<img src>`, le
     * lien de téléchargement et les images insérées dans le document.
     *
     * Requête same-origin : le cookie de session part avec. Avec le driver S3,
     * la redirection vers l'URL signée est suivie de façon transparente.
     */
    contentUrl: (id: string) => `/api/attachments/${id}/content`,
  },
}
