import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addMonths, monthGrid, todayISO } from '../../lib/dates'
import styles from './MonthCalendar.module.css'

interface MonthCalendarProps {
  /** Mois affiché, `YYYY-MM`. */
  month: string
  onMonthChange: (month: string) => void
  /** Jour ouvert, `YYYY-MM-DD`, ou `null` sur l'écran « aucune note ouverte ». */
  selected: string | null
  onSelect: (date: string) => void
  /** Jours du mois qui portent une note — les pastilles sauge. */
  daysWithNotes: string[]
}

/**
 * Le calendrier permanent de la maquette 2a.
 *
 * Trois informations se superposent sur une case : le jour ouvert (pastille
 * pleine), le jour d'aujourd'hui (cerclé) et l'existence d'une note (point
 * sauge sous le chiffre).
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  daysWithNotes,
}: MonthCalendarProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const [pickerOpen, setPickerOpen] = useState(false)
  const written = new Set(daysWithNotes)
  const today = todayISO()
  const year = Number(month.slice(0, 4))

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label={t('calendar.previousMonth')}
        >
          ‹
        </button>

        <button
          type="button"
          className={styles.monthLabel}
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
        >
          <span>{format.month(month)}</span>
          <span className={styles.caret}>▾</span>
        </button>

        <button
          type="button"
          className={styles.arrow}
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label={t('calendar.nextMonth')}
        >
          ›
        </button>
      </div>

      {pickerOpen ? (
        <div className={`card elev-lg ${styles.picker}`}>
          <div className={styles.pickerHeader}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => onMonthChange(addMonths(month, -12))}
              aria-label={t('calendar.previousYear')}
            >
              ‹
            </button>
            <strong>{year}</strong>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => onMonthChange(addMonths(month, 12))}
              aria-label={t('calendar.nextYear')}
            >
              ›
            </button>
          </div>
          <div className={styles.pickerGrid}>
            {format.monthNames().map((label, index) => {
              const value = `${year}-${String(index + 1).padStart(2, '0')}`
              return (
                <button
                  type="button"
                  key={value}
                  className={value === month ? styles.pickerMonthActive : styles.pickerMonth}
                  onClick={() => {
                    onMonthChange(value)
                    setPickerOpen(false)
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className={styles.pickerHint}>{t('calendar.pickerHint')}</p>
        </div>
      ) : null}

      <div className={styles.weekdays}>
        {format.weekdayInitials().map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {monthGrid(month).flat().map((day) => {
          const classes = [styles.day]
          if (day.outside) classes.push(styles.dayOutside)
          if (day.iso === selected) classes.push(styles.daySelected)
          else if (day.iso === today) classes.push(styles.dayToday)

          return (
            <button
              type="button"
              key={day.iso}
              className={classes.join(' ')}
              onClick={() => onSelect(day.iso)}
              aria-current={day.iso === today ? 'date' : undefined}
            >
              <span>{day.dayOfMonth}</span>
              {written.has(day.iso) ? <span className={styles.dot} /> : null}
            </button>
          )
        })}
      </div>

      <p className={styles.legend}>{t('calendar.legend')}</p>
    </div>
  )
}
