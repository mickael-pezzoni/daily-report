import { toUtcNoon } from './dates'

/**
 * Le rendu lisible des dates, pour une langue donnée.
 *
 * Séparé de `dates.ts`, qui ne fait que du calcul : c'est ici, et ici seul, que
 * la langue courante entre en jeu. Tout passe par `Intl`, donc traduire une
 * langue de plus ne demande aucune liste de mois ni de jours à écrire à la main.
 *
 * ⚠️ `timeZone: 'UTC'` partout — les `Date` de ce module sont construits à midi
 * UTC. Sans ça, un fuseau à l'ouest ferait afficher la veille.
 */
export interface DateFormat {
  /** `lun. 3 août` — l'en-tête et la navigation de l'écran 2a. */
  dayLong(iso: string): string
  /** `ven. 31 juil.` — les cartes et la liste « derniers jours ». */
  dayShort(iso: string): string
  /** `août 2026` — l'en-tête du calendrier. */
  month(month: string): string
  /** Les douze mois abrégés, pour le sélecteur. */
  monthNames(): string[]
  /** `L M M J V S D` — l'en-tête de la grille, dans l'ordre lundi → dimanche. */
  weekdayInitials(): string[]
}

/**
 * Un `Intl.DateTimeFormat` coûte cher à construire ; les vues en demandent un à
 * chaque rendu. On garde un jeu par langue.
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
    month: (month) => monthYear.format(new Date(`${month}-01T12:00:00Z`)),
    monthNames: () =>
      Array.from({ length: 12 }, (_, index) =>
        monthOnly.format(new Date(Date.UTC(2026, index, 15, 12))),
      ),
    // Une semaine quelconque dont on sait qu'elle commence un lundi : le
    // 5 janvier 2026 en est un. La grille de `monthGrid` part du lundi elle
    // aussi, les deux restent donc alignées quelle que soit la langue.
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
