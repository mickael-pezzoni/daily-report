import { toUtcNoon } from './dates'

/**
 * Human-readable date rendering, for a given language.
 *
 * Separate from `dates.ts`, which only does calculation: this is where, and
 * only where, the current language comes into play. Everything goes through
 * `Intl`, so translating one more language needs no hand-written list of
 * months or days.
 *
 * ⚠️ `timeZone: 'UTC'` everywhere — this module's `Date`s are built at noon
 * UTC. Without it, a western time zone would display the previous day.
 */
export interface DateFormat {
  /** `lun. 3 août` — the header and navigation of screen 2a. */
  dayLong(iso: string): string
  /** `ven. 31 juil.` — the cards and the "recent days" list. */
  dayShort(iso: string): string
  /** `ven. 31` — the rows of the week digest (2f/2g), the month is already in the header there. */
  weekdayShort(iso: string): string
  /** `27 juil. – 2 août` — the header of the week digest (2f/2g). */
  weekRange(startIso: string, endIso: string): string
  /** `août 2026` — the calendar header. */
  month(month: string): string
  /** The twelve abbreviated months, for the picker. */
  monthNames(): string[]
  /** `L M M J V S D` — the grid header, in Monday → Sunday order. */
  weekdayInitials(): string[]
}

/**
 * An `Intl.DateTimeFormat` is expensive to build; views request one on every
 * render. We keep one set per language.
 */
const cache = new Map<string, DateFormat>()

function build(locale: string): DateFormat {
  const longDay = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const shortDay = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const dayMonth = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const monthYear = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthOnly = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' })

  return {
    dayLong: (iso) => longDay.format(toUtcNoon(iso)),
    dayShort: (iso) => shortDay.format(toUtcNoon(iso)),
    weekdayShort: (iso) => weekday.format(toUtcNoon(iso)),
    weekRange: (startIso, endIso) =>
      `${dayMonth.format(toUtcNoon(startIso))} – ${dayMonth.format(toUtcNoon(endIso))}`,
    month: (month) => monthYear.format(new Date(`${month}-01T12:00:00Z`)),
    monthNames: () =>
      Array.from({ length: 12 }, (_, index) =>
        monthOnly.format(new Date(Date.UTC(2026, index, 15, 12))),
      ),
    // Any arbitrary week known to start on a Monday: January 5, 2026 is one.
    // `monthGrid`'s grid also starts on Monday, so the two stay aligned
    // regardless of the language.
    weekdayInitials: () =>
      Array.from({ length: 7 }, (_, index) =>
        weekdayNarrow.format(new Date(Date.UTC(2026, 0, 5 + index, 12))),
      ),
  }
}

export function dateFormatFor(locale: string): DateFormat {
  const found = cache.get(locale)
  if (found) return found

  const created = build(locale)
  cache.set(locale, created)
  return created
}
