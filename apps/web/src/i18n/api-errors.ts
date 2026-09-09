import { ApiError } from '../api/client'

/**
 * From a failed request to a translation key.
 *
 * The API responds in **technical English**: its messages are written for a
 * server log, not for the person in front of the screen. So we never display
 * them as-is — we translate what the response says *structurally*, its
 * `code` first, its status second.
 *
 * Views keep the key, not the text: an error shown at the moment the
 * language changes must change language along with everything else.
 */

/** The codes the API explicitly sets in its response body. */
const BY_CODE: Record<string, string> = {
  NOTE_EXISTS: 'errors.noteExists',
  FILE_TOO_LARGE: 'errors.fileTooLarge',
  SIGNUP_CLOSED: 'auth.errors.SIGNUP_CLOSED',
  PROJECT_ARCHIVED: 'errors.projectArchived',
}

/** Failing a code, the HTTP status already says something useful. */
const BY_STATUS: Record<number, string> = {
  401: 'errors.unauthorized',
  403: 'errors.unauthorized',
  404: 'errors.notFound',
  413: 'errors.fileTooLarge',
}

/**
 * @param fallback key to use when the response teaches nothing more than
 *   "it failed" — it then says *which action* failed, something the status
 *   alone can't express.
 */
export function apiErrorKey(cause: unknown, fallback: string): string {
  // `fetch` rejects with a TypeError when the request never went out: server
  // down, network cut, DNS silent. This isn't the same thing as an error
  // response, and it's not the same place to act on it.
  if (cause instanceof TypeError) return 'errors.network'
  if (!(cause instanceof ApiError)) return fallback

  if (cause.code !== undefined && cause.code in BY_CODE) return BY_CODE[cause.code]!
  return BY_STATUS[cause.status] ?? fallback
}

/**
 * Same idea for better-auth, which has its own codes and also responds in
 * English.
 *
 * Returns **two** keys, to pass as-is to `t()`: i18next picks the first one
 * that exists. better-auth adds codes across its versions — a code the
 * catalog doesn't know yet thus falls back to the screen's generic message
 * instead of displaying `auth.errors.SOMETHING`.
 */
export function authErrorKeys(
  error: { code?: string } | undefined | null,
  fallback: string,
): string[] {
  return error?.code ? [`auth.errors.${error.code}`, fallback] : [fallback]
}
