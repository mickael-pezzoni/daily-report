import styles from './DayCell.module.css'

interface DayCellProps {
  iso: string
  dayOfMonth: number
  /** Overflow into the neighboring month — grayed out. Absent in a week strip. */
  outside?: boolean
  selected: boolean
  today: boolean
  hasNote: boolean
  onSelect: (iso: string) => void
}

/**
 * A day cell — the shared grain of the month grid (desktop) and the week
 * strip (mobile). Three states overlay on it: the open day (filled pill),
 * today (circled), and the existence of a note (sage dot), exactly as in
 * mockup 2a.
 */
export function DayCell({ iso, dayOfMonth, outside, selected, today, hasNote, onSelect }: DayCellProps) {
  const classes = [styles.day]
  if (outside) classes.push(styles.day_outside)
  if (selected) classes.push(styles.day_selected)
  else if (today) classes.push(styles.day_today)

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={() => onSelect(iso)}
      aria-current={today ? 'date' : undefined}
    >
      <span>{dayOfMonth}</span>
      {hasNote ? <span className={styles.dot} /> : null}
    </button>
  )
}
