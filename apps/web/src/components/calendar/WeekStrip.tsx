import { useTranslation } from 'react-i18next'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addWeeks, todayISO, weekOf } from '../../lib/dates'
import { DayCell } from './DayCell'
import styles from './WeekStrip.module.css'

interface WeekStripProps {
  /** Any day of the displayed week. */
  anchor: string
  onAnchorChange: (anchor: string) => void
  selected: string | null
  onSelect: (date: string) => void
  daysWithNotes: string[]
}

/**
 * The week strip of mobile screen 2b, Calendar tab — the same day grid
 * as `MonthCalendar` (via `DayCell`), reduced to seven columns instead of
 * six weeks: the mockup shows a whole month, but that doesn't fit on a
 * phone screen without scrolling.
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
