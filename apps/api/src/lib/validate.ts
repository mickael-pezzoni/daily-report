import { SEARCH_SCOPES, type RichTextDoc, type SearchScope } from '@daily-report/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * These values go into parameterized queries — there's no injection risk.
 * We validate for a different reason: without it, a malformed date would
 * surface a raw Postgres error to the client instead of a clean 400.
 */

/** A genuine calendar date — also rejects February 31st. */
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
