import type { DailyNote } from '@daily-report/types'
import { Link, useNavigate } from 'react-router'
import { MonthCalendar } from '../calendar/MonthCalendar'
import { formatDayShort, todayISO } from '../../lib/dates'
import styles from './Sidebar.module.css'

interface SidebarProps {
  month: string
  onMonthChange: (month: string) => void
  selected: string | null
  daysWithNotes: string[]
  recent: DailyNote[]
}

/** La colonne de gauche, permanente, de la maquette 2a. */
export function Sidebar({
  month,
  onMonthChange,
  selected,
  daysWithNotes,
  recent,
}: SidebarProps) {
  const navigate = useNavigate()

  return (
    <aside className={styles.sidebar}>
      <Link to="/" className={styles.brand}>
        Mon journal
      </Link>

      <MonthCalendar
        month={month}
        onMonthChange={onMonthChange}
        selected={selected}
        onSelect={(date) => void navigate(`/notes/${date}`)}
        daysWithNotes={daysWithNotes}
      />

      <section className={styles.recent}>
        <h2 className={styles.recentTitle}>Derniers jours</h2>
        {recent.length === 0 ? (
          <p className={styles.recentEmpty}>Aucune note pour l'instant.</p>
        ) : (
          recent.map((note) => (
            <Link key={note.id} to={`/notes/${note.date}`} className={styles.recentItem}>
              {formatDayShort(note.date)}
              {note.title ? ` — ${note.title}` : ''}
            </Link>
          ))
        )}
      </section>

      <span className={styles.spacer} />

      <Link to={`/notes/${todayISO()}`} className="btn btn-primary btn-block">
        ＋ Note
      </Link>
    </aside>
  )
}
