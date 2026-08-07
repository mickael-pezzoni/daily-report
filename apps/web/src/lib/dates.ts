/**
 * Dates du journal, sans dépendance.
 *
 * Convention tenue partout : une date de note est **une chaîne `YYYY-MM-DD`**,
 * jamais un objet `Date`. Les rares calculs passent par un `Date` construit à
 * midi UTC, ce qui met les changements d'heure hors de portée — un `+1 jour` ne
 * peut pas retomber sur le même jour ou en sauter un. Seul `todayISO()` lit
 * l'heure locale, pour qu'« aujourd'hui » soit celui de l'utilisateur.
 */

/** `YYYY-MM-DD` → `Date` à midi UTC. */
function toUtcNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

/** `Date` → `YYYY-MM-DD`, lu en UTC. */
function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** La date du jour, dans le fuseau de l'utilisateur. */
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

const longDay = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const shortDay = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const monthYear = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthOnly = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

/** `lun. 3 août` */
export function formatDayLong(iso: string): string {
  return longDay.format(toUtcNoon(iso))
}

/** `ven. 31 juil.` */
export function formatDayShort(iso: string): string {
  return shortDay.format(toUtcNoon(iso))
}

/** `août 2026` */
export function formatMonth(month: string): string {
  return monthYear.format(new Date(`${month}-01T12:00:00Z`))
}

/** Les douze mois abrégés d'une année, pour le sélecteur. */
export function monthNames(): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    monthOnly.format(new Date(Date.UTC(2026, index, 15, 12))),
  )
}

export interface CalendarDay {
  iso: string
  dayOfMonth: number
  /** Débordement sur le mois précédent ou suivant — grisé dans la grille. */
  outside: boolean
}

/**
 * La grille d'un mois, en semaines commençant le lundi (L M M J V S D), avec le
 * débordement des mois voisins pour que chaque semaine soit complète.
 */
export function monthGrid(month: string): CalendarDay[][] {
  const first = new Date(`${month}-01T12:00:00Z`)

  // getUTCDay() : 0 = dimanche. On veut 0 = lundi.
  const leading = (first.getUTCDay() + 6) % 7
  const cursor = new Date(first)
  cursor.setUTCDate(cursor.getUTCDate() - leading)

  const weeks: CalendarDay[][] = []
  // 6 semaines couvrent tous les mois possibles ; on élague celles qui sont
  // entièrement hors du mois.
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

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const
