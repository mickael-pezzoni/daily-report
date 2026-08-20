import styles from './DayCell.module.css'

interface DayCellProps {
  iso: string
  dayOfMonth: number
  /** Débordement sur le mois voisin — grisé. Absent dans une bande de semaine. */
  outside?: boolean
  selected: boolean
  today: boolean
  hasNote: boolean
  onSelect: (iso: string) => void
}

/**
 * Une case de jour — le grain commun à la grille du mois (desktop) et à la
 * bande de semaine (mobile). Trois états s'y superposent : le jour ouvert
 * (pastille pleine), aujourd'hui (cerclé) et l'existence d'une note (point
 * sauge), exactement comme dans la maquette 2a.
 */
export function DayCell({ iso, dayOfMonth, outside, selected, today, hasNote, onSelect }: DayCellProps) {
  const classes = [styles.day]
  if (outside) classes.push(styles.dayOutside)
  if (selected) classes.push(styles.daySelected)
  else if (today) classes.push(styles.dayToday)

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
