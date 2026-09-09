import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addMonths, monthGrid, todayISO } from '../../lib/dates'
import { DayCell } from './DayCell'
import styles from './MonthCalendar.module.css'

interface MonthCalendarProps {
  /** Displayed month, `YYYY-MM`. */
  month: string
  onMonthChange: (month: string) => void
  /** Open day, `YYYY-MM-DD`, or `null` on the "no note open" screen. */
  selected: string | null
  onSelect: (date: string) => void
  /** Days of the month that carry a note — the sage dots. */
  daysWithNotes: string[]
}

/**
 * The permanent calendar of mockup 2a.
 *
 * Three pieces of information overlay on a cell: the open day (filled
 * pill), today's date (circled), and the existence of a note (sage dot
 * under the number).
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
          className={styles.month_label}
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
          <div className={styles.picker_header}>
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
          <div className={styles.picker_grid}>
            {format.monthNames().map((label, index) => {
              const value = `${year}-${String(index + 1).padStart(2, '0')}`
              return (
                <button
                  type="button"
                  key={value}
                  className={value === month ? styles.picker_month_active : styles.picker_month}
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
          <p className={styles.picker_hint}>{t('calendar.pickerHint')}</p>
        </div>
      ) : null}

      <div className={styles.weekdays}>
        {format.weekdayInitials().map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {monthGrid(month)
          .flat()
          .map((day) => (
            <DayCell
              key={day.iso}
              iso={day.iso}
              dayOfMonth={day.dayOfMonth}
              outside={day.outside}
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
