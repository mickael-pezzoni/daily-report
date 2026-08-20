import { useTranslation } from 'react-i18next'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addWeeks, todayISO, weekOf } from '../../lib/dates'
import { DayCell } from './DayCell'
import styles from './WeekStrip.module.css'

interface WeekStripProps {
  /** N'importe quel jour de la semaine affichée. */
  anchor: string
  onAnchorChange: (anchor: string) => void
  selected: string | null
  onSelect: (date: string) => void
  daysWithNotes: string[]
}

/**
 * La bande de semaine de l'écran mobile 2b, onglet Calendrier — la même
 * grille de jours que `MonthCalendar` (via `DayCell`), réduite à sept
 * colonnes plutôt qu'à six semaines : la maquette montre un mois entier, mais
 * ça ne tient pas sur un écran de téléphone sans faire défiler.
 */
export function WeekStrip({ anchor, onAnchorChange, selected, onSelect, daysWithNotes }: WeekStripProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const written = new Set(daysWithNotes)
  const today = todayISO()

  return (
    <div className={styles.week}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => onAnchorChange(addWeeks(anchor, -1))}
          aria-label={t('calendar.previousWeek')}
        >
          ‹
        </button>
        <span className={styles.label}>{format.month(anchor.slice(0, 7))}</span>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => onAnchorChange(addWeeks(anchor, 1))}
          aria-label={t('calendar.nextWeek')}
        >
          ›
        </button>
      </div>

      <div className={styles.weekdays}>
        {format.weekdayInitials().map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {weekOf(anchor).map((day) => (
          <DayCell
            key={day.iso}
            iso={day.iso}
            dayOfMonth={day.dayOfMonth}
            selected={day.iso === selected}
            today={day.iso === today}
            hasNote={written.has(day.iso)}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className={styles.legend}>{t('calendar.legend')}</p>
    </div>
  )
}
