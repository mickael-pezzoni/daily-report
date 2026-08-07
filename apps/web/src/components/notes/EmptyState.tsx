import type { DailyNote } from '@daily-report/types'
import { Link } from 'react-router'
import { todayISO } from '../../lib/dates'
import { RecentNoteCard } from './RecentNoteCard'
import styles from './EmptyState.module.css'

/** L'écran 2f : aucune note ouverte, les derniers jours en cartes. */
export function EmptyState({ recent }: { recent: DailyNote[] }) {
  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <span className={styles.title}>Aucune note ouverte</span>
        <span className={styles.spacer} />
        <Link to={`/notes/${todayISO()}`} className="btn btn-primary">
          ＋ Note
        </Link>
      </header>

      <div className={styles.body}>
        {recent.length > 0 ? (
          <>
            <h2 className={styles.heading}>Reprendre où vous en étiez</h2>
            <div className={styles.cards}>
              {recent.map((note) => (
                <RecentNoteCard key={note.id} note={note} />
              ))}
            </div>
          </>
        ) : (
          <h2 className={styles.heading}>Votre journal est vierge</h2>
        )}

        <span className={styles.spacer} />
        <p className={styles.hint}>
          Choisissez un jour dans le calendrier, ou ＋ Note pour aujourd'hui.
        </p>
      </div>
    </div>
  )
}
