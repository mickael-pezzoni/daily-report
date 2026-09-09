/**
 * Journal dates, with no dependency.
 *
 * Convention held everywhere: a note date is **a `YYYY-MM-DD` string**, never
 * a `Date` object. The rare calculations go through a `Date` built at noon
 * UTC, which puts daylight-saving shifts out of reach — a `+1 day` can never
 * land back on the same day or skip one. Only `todayISO()` reads the local
 * time, so that "today" is the user's today.
 *
 * This module only does **calculation**, identical across all languages.
 * Anything that produces human-readable text lives in `date-format.ts`,
 * which depends on the current language.
 */

/** `YYYY-MM-DD` → `Date` at noon UTC. */
export function toUtcNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

/** `Date` → `YYYY-MM-DD`, read in UTC. */
function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Today's date, in the user's time zone. */
export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  const date = toUtcNoon(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

/** The Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const date = toUtcNoon(iso)
  // getUTCDay(): 0 = Sunday. We want 0 = Monday, like `monthGrid`.
  const leading = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - leading)
  return toIso(date)
}

export function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7)
}

/** The seven days (Monday → Sunday) of the week containing `iso`. */
export function weekOf(iso: string): CalendarDay[] {
  const monday = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index)
    return { iso: day, dayOfMonth: Number(day.slice(8, 10)), outside: false }
  })
}

/** `2026-08-03` → `2026-08`. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function addMonths(month: string, delta: number): string {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return toIso(date).slice(0, 7)
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = toUtcNoon(value)
  return !Number.isNaN(date.getTime()) && toIso(date) === value
}

export interface CalendarDay {
  iso: string
  dayOfMonth: number
  /** Overflow into the previous or next month — grayed out in the grid. */
  outside: boolean
}

/**
 * A month's grid, in weeks starting on Monday (L M M J V S D), with overflow
 * from neighboring months so every week is complete.
 */
export function monthGrid(month: string): CalendarDay[][] {
  const first = new Date(`${month}-01T12:00:00Z`)

  // getUTCDay(): 0 = Sunday. We want 0 = Monday.
  const leading = (first.getUTCDay() + 6) % 7
  const cursor = new Date(first)
  cursor.setUTCDate(cursor.getUTCDate() - leading)

  const weeks: CalendarDay[][] = []
  // 6 weeks cover every possible month; we prune the ones that are entirely
  // outside the month.
  for (let week = 0; week < 6; week++) {
    const days: CalendarDay[] = []
    for (let day = 0; day < 7; day++) {
      const iso = toIso(cursor)
      days.push({
        iso,
        dayOfMonth: cursor.getUTCDate(),
        outside: iso.slice(0, 7) !== month,
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    if (days.some((day) => !day.outside)) weeks.push(days)
  }
  return weeks
}
