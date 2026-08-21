import type { NoteListItem } from '@daily-report/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../../api/client'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addDays, addWeeks, startOfWeek, todayISO } from '../../lib/dates'
import styles from './WeekDigest.module.css'

/**
 * Le condensé de semaine des écrans 2f et 2g — le remplaçant des post-it
 * `RecentNoteCard` que la maquette a abandonnés : plus une colonne de cartes
 * mais une semaine navigable, avec ses jours rédigés en rangées et un état
 * dédié (2g) quand elle n'en compte aucun.
 *
 * Autonome : contrairement au reste de la colonne de droite, la semaine
 * affichée n'a pas besoin de suivre une note ouverte — il n'y en a pas — donc
 * son ancre vit ici plutôt que dans `AppShell`.
 */
export function WeekDigest() {
  const { t } = useTranslation()
  const format = useDateFormat()
  const currentWeek = startOfWeek(todayISO())
  const [anchor, setAnchor] = useState(currentWeek)
  const [notes, setNotes] = useState<NoteListItem[]>([])

  useEffect(() => {
    api.notes
      .week(anchor, addDays(anchor, 6))
      .then(setNotes)
      .catch(() => setNotes([]))
  }, [anchor])

  // Déjà triées par date décroissante : `api.notes.week` n'envoie pas de `q`,
  // et sans lui l'API trie par `noteDate desc` (voir `routes/notes.ts`).
  const fileCount = notes.reduce((sum, note) => sum + note.attachments.length, 0)
  const daysWithoutNote = 7 - notes.length

  return (
    <div className={styles.digest}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{t('empty.week.heading')}</h2>
        <span className={styles.spacer} />
        <div className={styles.nav}>
          {/* À gauche des flèches, pas à droite : un bouton qui apparaît et
              disparaît après la plage de dates la décalerait à chaque
              franchissement de la semaine courante. Devant elle, seul le
              texte du bouton bouge — le reste de la rangée reste en place. */}
          {anchor !== currentWeek ? (
            <button
              type="button"
              className={`btn btn-ghost ${styles.back_to_current}`}
              onClick={() => setAnchor(currentWeek)}
            >
              {t('empty.week.backToCurrent')}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.arrow}
            onClick={() => setAnchor(addWeeks(anchor, -1))}
            aria-label={t('calendar.previousWeek')}
          >
            ‹
          </button>
          <span className={styles.range}>{format.weekRange(anchor, addDays(anchor, 6))}</span>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => setAnchor(addWeeks(anchor, 1))}
            aria-label={t('calendar.nextWeek')}
          >
            ›
          </button>
        </div>
      </div>

      {notes.length > 0 ? (
        <>
          <div className={styles.tags}>
            <span className="tag tag-accent">{t('search.resultCount', { count: notes.length })}</span>
            {fileCount > 0 ? (
              <span className="tag tag-outline">{t('attachments.files', { count: fileCount })}</span>
            ) : null}
            {daysWithoutNote > 0 ? (
              <span className="tag tag-outline">
                {t('empty.week.daysWithoutNote', { count: daysWithoutNote })}
              </span>
            ) : null}
          </div>

          <div className={styles.rows}>
            {notes.map((note) => (
              <Link key={note.id} to={`/notes/${note.date}`} className={styles.row}>
                <span className={styles.day}>{format.weekdayShort(note.date)}</span>
                <span className={styles.excerpt}>{note.excerpt}</span>
                {note.attachments.length > 0 ? (
                  <span className="tag tag-accent-2">
                    {t('attachments.files', { count: note.attachments.length })}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <span className={styles.empty_icon} aria-hidden="true">
            ☺
          </span>
          <p className={styles.empty_title}>{t('empty.week.emptyTitle')}</p>
          <p className={styles.empty_description}>{t('empty.week.emptyDescription')}</p>
          {/* Le premier jour de la semaine **affichée**, pas forcément
              aujourd'hui : naviguer vers une semaine passée puis cliquer
              doit écrire ce jour-là, pas rouvrir la journée du jour. */}
          <Link to={`/notes/${anchor}`} className="btn btn-primary">
            {t('empty.week.emptyCta', { day: format.dayShort(anchor) })}
          </Link>
        </div>
      )}
    </div>
  )
}
