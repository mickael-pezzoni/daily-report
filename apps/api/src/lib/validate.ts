import { SEARCH_SCOPES, type RichTextDoc, type SearchScope } from '@daily-report/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ces valeurs partent dans des requêtes paramétrées — il n'y a pas de risque
 * d'injection. On valide pour une autre raison : sans ça, une date mal formée
 * remonterait au client une erreur Postgres brute au lieu d'un 400 clair.
 */

/** Vraie date calendaire — rejette aussi le 31 février. */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isValidMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_MONTH.test(value)) return false
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isSearchScope(value: unknown): value is SearchScope {
  return typeof value === 'string' && (SEARCH_SCOPES as readonly string[]).includes(value)
}

export function isRichTextDoc(value: unknown): value is RichTextDoc {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'doc'
  )
}
