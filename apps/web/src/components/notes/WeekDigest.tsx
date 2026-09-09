import type { DailyNote, NoteListItem } from '@daily-report/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { api } from '../../api/client'
import { useDateFormat } from '../../hooks/useDateFormat'
import { addDays, addWeeks, startOfWeek, todayISO } from '../../lib/dates'
import { Loading } from '../ui/Loading'
import styles from './WeekDigest.module.css'

interface WeekDigestProps {
  /**
   * A note deleted from search, the mobile Calendar tab, or the open day's
   * 🗑 button — `WeekDigest` loads its own notes and would otherwise never
   * receive them. The removal is local, following the model of
   * `SearchModal.handleDelete`'s filter.
   */
  deletedNote: DailyNote | null
}

/**
 * The week digest for screens 2f and 2g — the replacement for the
 * `RecentNoteCard` sticky notes that the mockup dropped: no longer a column
 * of cards but a navigable week, with its written days as rows and a
 * dedicated state (2g) when it has none.
 *
 * Self-contained: unlike the rest of the right column, the displayed week
 * doesn't need to follow an open note — there isn't one — so its anchor
 * lives here rather than in `AppShell`.
 */
export function WeekDigest({ deletedNote }: WeekDigestProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { projectId } = useParams<{ projectId: string }>()
  const currentWeek = startOfWeek(todayISO())
  const [anchor, setAnchor] = useState(currentWeek)
  const [notes, setNotes] = useState<NoteListItem[]>([])
  // Without it, an empty `notes` array while the fetch is still in flight
  // would flash the "no notes this week" state (2g) before the real data —
  // wrong on every mount and every week change, not just the first load.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    api.notes
      .week(anchor, addDays(anchor, 6), projectId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
  }, [anchor, projectId])

  useEffect(() => {
    if (!deletedNote) return
    setNotes((items) => items.filter((item) => item.id !== deletedNote.id))
  }, [deletedNote])

  // Already sorted by descending date: `api.notes.week` doesn't send a `q`,
  // and without one the API sorts by `noteDate desc` (see `routes/notes.ts`).
  const fileCount = notes.reduce((sum, note) => sum + note.attachments.length, 0)
  const daysWithoutNote = 7 - notes.length

  return (
    <div className={styles.digest}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{t('empty.week.heading')}</h2>
        <span className={styles.spacer} />
        <div className={styles.nav}>
          {/* To the left of the arrows, not the right: a button that
              appears and disappears after the date range would shift it
              every time the current week is crossed. In front of it, only
              the button's text moves — the rest of the row stays put. */}
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

      {loading ? (
        <Loading />
      ) : notes.length > 0 ? (
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
              <Link key={note.id} to={`/projets/${projectId}/notes/${note.date}`} className={styles.row}>
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
          {/* The first day of the **displayed** week, not necessarily
              today: navigating to a past week then clicking must write
              that day, not reopen today's day. */}
          <Link to={`/projets/${projectId}/notes/${anchor}`} className="btn btn-primary">
            {t('empty.week.emptyCta', { day: format.dayShort(anchor) })}
          </Link>
        </div>
      )}
    </div>
  )
}
