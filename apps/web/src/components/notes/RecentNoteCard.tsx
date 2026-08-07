import type { DailyNote } from '@daily-report/types'
import { Link } from 'react-router'
import { formatDayShort } from '../../lib/dates'
import styles from './RecentNoteCard.module.css'

/** Une carte de jour récent — l'écran 2f en aligne trois. */
export function RecentNoteCard({ note }: { note: DailyNote }) {
  return (
    <Link to={`/notes/${note.date}`} className={`card elev-sm ${styles.card}`}>
      <div className={styles.head}>
        <span className={styles.date}>{formatDayShort(note.date)}</span>
        {note.title ? <span className={styles.title}>{note.title}</span> : null}
        <span className={styles.spacer} />
        <span className={styles.open}>ouvrir</span>
      </div>
      {note.excerpt ? <p className={styles.excerpt}>{note.excerpt}</p> : null}
    </Link>
  )
}
