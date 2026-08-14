import type { DailyNote, NoteListItem } from '@daily-report/types'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { api } from '../../api/client'
import { isValidISODate, monthOf, todayISO } from '../../lib/dates'
import { EmptyState } from '../notes/EmptyState'
import { NoteView } from '../notes/NoteView'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

const RECENT_LIMIT = 3

/**
 * La coquille de l'écran principal : barre latérale permanente à gauche,
 * journée ouverte ou état vide à droite.
 *
 * C'est ici que vivent les données partagées par les deux colonnes — le
 * calendrier du mois affiché et les derniers jours — pour qu'un enregistrement
 * dans l'éditeur allume la pastille du calendrier sans rechargement.
 */
export function AppShell() {
  const { date } = useParams<{ date?: string }>()
  const [month, setMonth] = useState(() => monthOf(date ?? todayISO()))
  const [daysWithNotes, setDaysWithNotes] = useState<string[]>([])
  const [recent, setRecent] = useState<NoteListItem[]>([])

  // Le mois affiché suit la journée ouverte.
  useEffect(() => {
    if (date) setMonth(monthOf(date))
  }, [date])

  const loadMonth = useCallback((target: string) => {
    api.calendar
      .month(target)
      .then((calendar) => setDaysWithNotes(calendar.daysWithNotes))
      .catch(() => setDaysWithNotes([]))
  }, [])

  const loadRecent = useCallback(() => {
    api.notes
      .recent(RECENT_LIMIT)
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [])

  useEffect(() => loadMonth(month), [month, loadMonth])
  useEffect(() => loadRecent(), [loadRecent])

  /** Un enregistrement peut créer un jour rédigé : les deux vues se rafraîchissent. */
  const handleNoteSaved = useCallback(
    (note: DailyNote) => {
      setDaysWithNotes((days) => (days.includes(note.date) ? days : [...days, note.date]))
      loadRecent()
    },
    [loadRecent],
  )

  /**
   * Suppression depuis une carte de l'écran 2f.
   *
   * On retire la carte et la pastille du calendrier tout de suite — la réponse
   * est un 204 sans corps, il n'y a rien à attendre pour savoir quoi peindre —
   * puis on recharge la liste : trois cartes étaient affichées, une quatrième
   * peut maintenant remonter.
   */
  const handleNoteDeleted = useCallback(
    (note: NoteListItem) => {
      setRecent((notes) => notes.filter((item) => item.id !== note.id))
      setDaysWithNotes((days) => days.filter((day) => day !== note.date))

      api.notes
        .remove(note.id)
        .catch(() => {
          // La suppression a échoué : on remet la vue en accord avec le serveur
          // plutôt que de laisser une note disparue de l'écran mais bien vivante.
          loadMonth(month)
        })
        .finally(loadRecent)
    },
    [loadMonth, loadRecent, month],
  )

  // Une date bricolée dans l'URL ramène à aujourd'hui plutôt qu'à un écran cassé.
  if (date !== undefined && !isValidISODate(date)) {
    return <Navigate to={`/notes/${todayISO()}`} replace />
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        month={month}
        onMonthChange={setMonth}
        selected={date ?? null}
        daysWithNotes={daysWithNotes}
        recent={recent}
      />
      {date ? (
        <NoteView key={date} date={date} onNoteSaved={handleNoteSaved} />
      ) : (
        <EmptyState recent={recent} onDelete={handleNoteDeleted} />
      )}
    </div>
  )
}
