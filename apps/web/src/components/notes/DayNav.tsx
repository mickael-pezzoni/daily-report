import { Link } from 'react-router'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addDays } from '../../lib/dates'
import styles from './DayNav.module.css'

/** Le pied de l'écran 2a : ‹ dim. 2 août · lun. 3 août · mar. 4 août › */
export function DayNav({ date }: { date: string }) {
  const format = useDateFormat()
  const previous = addDays(date, -1)
  const next = addDays(date, 1)

  return (
    <nav className={styles.nav}>
      <Link to={`/notes/${previous}`} className={`btn btn-ghost ${styles.link}`}>
        ‹ {format.dayLong(previous)}
      </Link>
      <span className={styles.current}>{format.dayLong(date)}</span>
      <Link to={`/notes/${next}`} className={`btn btn-ghost ${styles.link}`}>
        {format.dayLong(next)} ›
      </Link>
    </nav>
  )
}
