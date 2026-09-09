/**
 * JSON shapes exchanged between the API and the web app. These are the
 * shapes as they travel over the wire — not the database row types.
 */

/**
 * The interface languages, by their code alone.
 *
 * This package usually only carries JSON shapes, but these codes are one:
 * it's the value the web app writes to its account and that the API must be
 * able to reject if it's anything else. The label and the Intl `locale`,
 * though, only concern the web app — they stay in `apps/web/src/i18n`.
 */
export const LANGUAGE_CODES = ['fr', 'en'] as const

export type LanguageCode = (typeof LANGUAGE_CODES)[number]

/**
 * What global search (screen 2c) accepts to search through.
 *
 * Shared for the same reason as `LANGUAGE_CODES`: it's the value the web app
 * puts in the URL and that the API must be able to reject if it's anything
 * else. The labels, though, only concern the web app.
 */
export const SEARCH_SCOPES = ['all', 'text', 'files'] as const

export type SearchScope = (typeof SEARCH_SCOPES)[number]

/** Response of `GET /api/auth-state`. Public: called before any session. */
export interface AuthState {
  /**
   * True as soon as an account exists on this space. The web app uses it to
   * choose between the sign-in screen and the first-launch screen; the API
   * uses it to reject any further sign-up.
   */
  hasAccount: boolean
}

/** The signed-in user, as returned by `GET /api/me`. */
export interface SessionUser {
  id: string
  name: string
  email: string
}

/**
 * Response of `GET /api/oauth-clients/:clientId` — name and icon of a
 * better-auth mcp plugin OAuth client, for the consent screen
 * (`/mcp/consent`). A client doesn't belong to anyone in particular, hence
 * the absence of any other field here.
 */
export interface OAuthClientInfo {
  name: string
  icon: string | null
}

/**
 * A rich-text document, described structurally.
 *
 * Deliberately not TipTap's `JSONContent`: this package is shared with the
 * API, which has no reason to drag the editor into its dependencies. The
 * web app bridges the gap at the editor's boundary.
 */
export interface RichTextDoc {
  type: 'doc'
  content?: unknown[]
}

/** A journal entry — a day written up. */
export interface DailyNote {
  id: string
  /** Calendar date in `YYYY-MM-DD` format. */
  date: string
  title: string
  content: RichTextDoc
  /** Start of the flattened text, for lists and cards. */
  excerpt: string
  updatedAt: string
}

/** Body of `POST /api/notes`. */
export interface NoteDraft {
  date: string
  projectId: string
  title: string
  content: RichTextDoc
}

/** Body of `PATCH /api/notes/:id` — partial update. */
export interface NotePatch {
  title?: string
  content?: RichTextDoc
}

/** An attachment on a note. The content is fetched separately. */
export interface Attachment {
  id: string
  noteId: string
  /** Original filename, as uploaded. */
  filename: string
  mimeType: string
  /** Size in bytes. */
  size: number
  createdAt: string
}

/**
 * A note as the **collection** returns it (`GET /api/notes`).
 *
 * The list carries its attachments, whereas `GET /api/notes/:id` doesn't:
 * the cards on the "no note open" screen display them, and fetching them
 * card by card would mean one request per displayed day.
 */
export interface NoteListItem extends DailyNote {
  /** In upload order. Empty array if the day carries none. */
  attachments: Attachment[]
}

/** Response of `GET /api/calendar/:month` — which days of the month are written up. */
export interface CalendarMonth {
  /** `YYYY-MM`. */
  month: string
  /** `YYYY-MM-DD` dates carrying a note. */
  daysWithNotes: string[]
}

/**
 * A project — groups an account's notes (a job, a client...). An account
 * always has at least one.
 */
export interface Project {
  id: string
  name: string
  createdAt: string
  /** Archival date, `null` if the project is active — archiving can be undone. */
  archivedAt: string | null
  /** Number of notes written in this project. */
  noteCount: number
  /** Date of the most recent note, `null` if the project is still empty. */
  lastNoteDate: string | null
}

/** Body of `POST /api/projects`. */
export interface ProjectDraft {
  name: string
}

/** Body of `PATCH /api/projects/:id` — for now, only archiving. */
export interface ProjectPatch {
  archived: boolean
}
