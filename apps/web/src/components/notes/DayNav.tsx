import { Link } from 'react-router'
import { addDays, formatDayLong } from '../../lib/dates'
import styles from './DayNav.module.css'

/** Le pied de l'écran 2a : ‹ dim. 2 août · lun. 3 août · mar. 4 août › */
export function DayNav({ date }: { date: string }) {
  const previous = addDays(date, -1)
  const next = addDays(date, 1)

  return (
    <nav className={styles.nav}>
      <Link to={`/notes/${previous}`} className={`btn btn-ghost ${styles.link}`}>
        ‹ {formatDayLong(previous)}
      </Link>
      <span className={styles.current}>{formatDayLong(date)}</span>
      <Link to={`/notes/${next}`} className={`btn btn-ghost ${styles.link}`}>
        {formatDayLong(next)} ›
      </Link>
    </nav>
  )
}
