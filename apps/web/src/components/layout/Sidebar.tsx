import type { DailyNote } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useDateFormat } from '../../hooks/useDateFormat'
import { todayISO } from '../../lib/dates'
import { MonthCalendar } from '../calendar/MonthCalendar'
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
  const { t } = useTranslation()
  const format = useDateFormat()
  const navigate = useNavigate()

  return (
    <aside className={styles.sidebar}>
      {/* Le menu utilisateur vivait ici ; la maquette l'a déplacé dans
          l'en-tête de droite. La barre latérale ne porte plus que le titre. */}
      <div className={styles.brandRow}>
        <Link to="/" className={styles.brand}>
          {t('app.name')}
        </Link>
      </div>

      <MonthCalendar
        month={month}
        onMonthChange={onMonthChange}
        selected={selected}
        onSelect={(date) => void navigate(`/notes/${date}`)}
        daysWithNotes={daysWithNotes}
      />

      <section className={styles.recent}>
        <h2 className={styles.recentTitle}>{t('sidebar.recentTitle')}</h2>
        {recent.length === 0 ? (
          <p className={styles.recentEmpty}>{t('sidebar.recentEmpty')}</p>
        ) : (
          recent.map((note) => (
            <Link key={note.id} to={`/notes/${note.date}`} className={styles.recentItem}>
              {format.dayShort(note.date)}
              {note.title ? ` — ${note.title}` : ''}
            </Link>
          ))
        )}
      </section>

      <span className={styles.spacer} />

      <Link to={`/notes/${todayISO()}`} className="btn btn-primary btn-block">
        {t('sidebar.newNote')}
      </Link>
    </aside>
  )
}
