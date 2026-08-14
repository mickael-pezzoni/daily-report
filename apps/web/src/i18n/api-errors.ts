import { ApiError } from '../api/client'

/**
 * De l'échec d'une requête à une clé de traduction.
 *
 * L'API répond en **anglais technique** : ses messages sont écrits pour un
 * journal de serveur, pas pour la personne devant l'écran. On ne les affiche
 * donc jamais tels quels — on traduit ce que la réponse dit *structurellement*,
 * son `code` d'abord, son statut ensuite.
 *
 * Les vues gardent la clé et non le texte : une erreur affichée au moment où
 * l'on change de langue doit changer de langue avec le reste.
 */

/** Les codes que l'API pose explicitement dans son corps de réponse. */
const BY_CODE: Record<string, string> = {
  NOTE_EXISTS: 'errors.noteExists',
  FILE_TOO_LARGE: 'errors.fileTooLarge',
  SIGNUP_CLOSED: 'auth.errors.SIGNUP_CLOSED',
}

/** À défaut de code, le statut HTTP dit déjà quelque chose d'utile. */
const BY_STATUS: Record<number, string> = {
  401: 'errors.unauthorized',
  403: 'errors.unauthorized',
  404: 'errors.notFound',
  413: 'errors.fileTooLarge',
}

/**
 * @param fallback clé à utiliser quand la réponse n'apprend rien de plus que
 *   « ça a échoué » — elle dit alors *quel geste* a échoué, ce que le statut
 *   seul ne peut pas exprimer.
 */
export function apiErrorKey(cause: unknown, fallback: string): string {
  // `fetch` rejette avec un TypeError quand la requête n'est jamais partie :
  // serveur éteint, réseau coupé, DNS muet. Ce n'est pas la même chose qu'une
  // réponse d'erreur, et ce n'est pas au même endroit qu'il faut agir.
  if (cause instanceof TypeError) return 'errors.network'
  if (!(cause instanceof ApiError)) return fallback

  if (cause.code !== undefined && cause.code in BY_CODE) return BY_CODE[cause.code]!
  return BY_STATUS[cause.status] ?? fallback
}

/**
 * Idem pour better-auth, qui a ses propres codes et répond, lui aussi, en
 * anglais.
 *
 * Renvoie **deux** clés, à passer telles quelles à `t()` : i18next prend la
 * première qui existe. better-auth ajoute des codes au fil de ses versions —
 * un code que le catalogue ne connaît pas encore retombe ainsi sur le message
 * générique de l'écran au lieu d'afficher `auth.errors.QUELQUE_CHOSE`.
 */
export function authErrorKeys(
  error: { code?: string } | undefined | null,
  fallback: string,
): string[] {
  return error?.code ? [`auth.errors.${error.code}`, fallback] : [fallback]
}
