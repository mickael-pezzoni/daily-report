import type { DailyNote } from '@daily-report/types'
import { useNote } from '../../hooks/useNote'
import { formatDayLong } from '../../lib/dates'
import { SignOutButton } from '../auth/SignOutButton'
import { DayNav } from './DayNav'
import { NoteEditor } from './NoteEditor'
import { SaveStatus } from './SaveStatus'
import styles from './NoteView.module.css'

interface NoteViewProps {
  date: string
  /** Remonte à la coquille pour rafraîchir calendrier et « derniers jours ». */
  onNoteSaved: (note: DailyNote) => void
}

/** L'écran 2a : la journée ouverte, sa feuille et sa navigation. */
export function NoteView({ date, onNoteSaved }: NoteViewProps) {
  const { draft, state, error, edit } = useNote(date, onNoteSaved)

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <span className={styles.datePill}>{formatDayLong(date)}</span>
        <SaveStatus state={state} error={error} />
        <span className={styles.spacer} />
        <SignOutButton />
      </header>

      <div className={styles.desk}>
        <article className={styles.paper}>
          <input
            className={styles.title}
            value={draft.title}
            onChange={(event) => edit({ title: event.target.value })}
            placeholder="Titre de la journée…"
            aria-label="Titre de la journée"
          />
          <NoteEditor
            documentKey={date}
            content={draft.content}
            onChange={(content) => edit({ content })}
          />
        </article>
      </div>

      <DayNav date={date} />

      {/* Bande de la maquette 2a, sans le chantier des pièces jointes derrière. */}
      <div className={styles.attachments}>
        <span>📎</span>
        <span className={styles.attachmentsLabel}>Pièces jointes</span>
        <span className={styles.attachmentsHint}>bientôt</span>
      </div>
    </div>
  )
}
