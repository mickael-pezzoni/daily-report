import type { DailyNote, NoteListItem } from '@daily-report/types'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api } from '../../api/client'
import { useCurrentProject } from '../../hooks/useCurrentProject'
import { useDateFormat } from '../../hooks/useDateFormat'
import { isValidISODate, monthOf, startOfWeek, todayISO } from '../../lib/dates'
import { WeekStrip } from '../calendar/WeekStrip'
import { EmptyState } from '../notes/EmptyState'
import { NoteView } from '../notes/NoteView'
import { NoteResultCard } from '../notes/NoteResultCard'
import { SearchModal } from '../search/SearchModal'
import { Splash } from '../ui/Splash'
import { MobileTabBar, type MobileTab } from './MobileTabBar'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

const RECENT_LIMIT = 10

/**
 * The shell of the main screen: permanent sidebar on the left, open day or
 * empty state on the right.
 *
 * This is where the data shared by the two columns lives — the displayed
 * month calendar and the recent days — so a save in the editor lights up the
 * calendar dot without a reload.
 */
export function AppShell() {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { projectId, date } = useParams<{ projectId: string; date?: string }>()
  const { project, isPending: projectPending } = useCurrentProject()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => monthOf(date ?? todayISO()))
  const [daysWithNotes, setDaysWithNotes] = useState<string[]>([])
  const [recent, setRecent] = useState<NoteListItem[]>([])
  // Mobile screen 2b: which of the two tabs is shown. No third "Export" tab
  // — there's nothing behind it on the API side.
  const [mobileTab, setMobileTab] = useState<MobileTab>('today')
  // The week shown in the Calendar tab — the mobile equivalent of `month`,
  // shorter: the mockup shows a whole month, which doesn't fit on a phone
  // screen without scrolling.
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(date ?? todayISO()))
  // Screen 2c — global search. Ctrl+K/⌘K from anywhere in the app, not just
  // from a button; that's the whole point of the shortcut.
  const [searchOpen, setSearchOpen] = useState(false)
  // The last note deleted somewhere other than the view displaying it
  // (search modal or mobile Calendar tab) — `WeekDigest` uses it to remove
  // itself locally, since it loads its own notes and would otherwise never
  // receive them.
  const [deletedNote, setDeletedNote] = useState<DailyNote | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // The displayed month (desktop) and the displayed week (mobile) both
  // follow the open day.
  useEffect(() => {
    if (date) {
      setMonth(monthOf(date))
      setWeekAnchor(startOfWeek(date))
    }
  }, [date])

  /**
   * Navigating the week strip can move its Monday into a different month
   * than the one already loaded — otherwise the new week's dots would stay
   * flat, since `daysWithNotes` only carries the month displayed elsewhere.
   */
  function handleWeekChange(nextAnchor: string) {
    setWeekAnchor(nextAnchor)
    const nextMonth = monthOf(nextAnchor)
    if (nextMonth !== month) setMonth(nextMonth)
  }

  /** A day chosen in the week strip opens its note and switches back to the Today tab. */
  function handleWeekSelect(day: string) {
    setMobileTab('today')
    void navigate(`/projets/${projectId}/notes/${day}`)
  }

  const loadMonth = useCallback(
    (target: string) => {
      if (!projectId) return
      api.calendar
        .month(target, projectId)
        .then((calendar) => setDaysWithNotes(calendar.daysWithNotes))
        .catch(() => setDaysWithNotes([]))
    },
    [projectId],
  )

  const loadRecent = useCallback(() => {
    if (!projectId) return
    api.notes
      .recent(RECENT_LIMIT, projectId)
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [projectId])

  useEffect(() => loadMonth(month), [month, loadMonth])
  useEffect(() => loadRecent(), [loadRecent])

  /** A save can create a written day: both views refresh. */
  const handleNoteSaved = useCallback(
    (note: DailyNote) => {
      setDaysWithNotes((days) => (days.includes(note.date) ? days : [...days, note.date]))
      loadRecent()
    },
    [loadRecent],
  )

  /**
   * Deletion from a search card (2c), the mobile Calendar tab (2b), or the
   * 🗑 button of the open day (2a) — the week digest in 2f/2g doesn't offer
   * one.
   *
   * We remove the note and the calendar dot right away — the response is a
   * bodiless 204, there's nothing to wait for to know what to paint — then
   * reload the list: other notes were hidden by the limit, a new one can now
   * surface.
   */
  const handleNoteDeleted = useCallback(
    (note: DailyNote) => {
      setRecent((notes) => notes.filter((item) => item.id !== note.id))
      setDaysWithNotes((days) => days.filter((day) => day !== note.date))
      setDeletedNote(note)

      // The deleted note is the one currently open: staying on this route
      // would leave the editor and the calendar day displayed as "open" on a
      // note that no longer exists.
      if (note.date === date) {
        void navigate(`/projets/${projectId}`, { replace: true })
      }

      api.notes
        .remove(note.id)
        .catch(() => {
          // The deletion failed: we bring the view back in line with the
          // server rather than leaving a note gone from the screen but still
          // alive.
          loadMonth(month)
        })
        .finally(loadRecent)
    },
    [loadMonth, loadRecent, month, date, projectId, navigate],
  )

  // The project in the URL doesn't exist (or no longer does) for this
  // account: off to the management screen rather than a shell with nothing to load.
  if (projectPending) return <Splash />
  if (!project) return <Navigate to="/projets" replace />

  // A tampered-with date in the URL falls back to today rather than to a broken screen.
  if (date !== undefined && !isValidISODate(date)) {
    return <Navigate to={`/projets/${projectId}/notes/${todayISO()}`} replace />
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

      {/* Today tab — always mounted: it's the desktop view, and on mobile
          `.note_pane` hides it in CSS when the other tab is active, rather
          than unmounting useNote/useAttachments on every switch. */}
      <div className={`${styles.note_pane} ${mobileTab === 'today' ? '' : styles.pane_inactive}`}>
        {date ? (
          <NoteView
            key={date}
            date={date}
            onNoteSaved={handleNoteSaved}
            onNoteDeleted={handleNoteDeleted}
          />
        ) : (
          <EmptyState onOpenSearch={() => setSearchOpen(true)} deletedNote={deletedNote} />
        )}
      </div>

      {/* Calendar tab — only exists on mobile, see AppShell.module.css.
          Mockup 2b puts the week strip AND the recent days here: on desktop
          both live in `Sidebar` for lack of tabs, here they share the same
          pane.

          Days take the row form of mockup 2b here — the same as search
          results (2c) — rather than the week digest form of `WeekDigest`
          (2f/2g): at this width, a row without week navigation stays simpler
          to scroll. */}
      <div className={`${styles.calendar_pane} ${mobileTab === 'calendar' ? '' : styles.pane_inactive}`}>
        {/* The "search my notes…" bar from mockup 2b: the same modal as
            Ctrl+K/⌘K and the 2f bar, not a second search system. A keyboard
            shortcut doesn't make sense here — no "⌘K" hint like on desktop. */}
        <button
          type="button"
          className={`input ${styles.calendar_search}`}
          onClick={() => setSearchOpen(true)}
        >
          {t('search.placeholder')}
        </button>

        <WeekStrip
          anchor={weekAnchor}
          onAnchorChange={handleWeekChange}
          selected={date ?? null}
          onSelect={handleWeekSelect}
          daysWithNotes={daysWithNotes}
        />

        <section className={styles.calendar_recent}>
          <h2 className={styles.calendar_recent_title}>{t('sidebar.recentTitle')}</h2>
          {recent.length === 0 ? (
            <p className={styles.calendar_recent_empty}>{t('sidebar.recentEmpty')}</p>
          ) : (
            <div className={styles.calendar_recent_cards}>
              {recent.map((note) => (
                <NoteResultCard
                  key={note.id}
                  note={note}
                  onOpen={handleWeekSelect}
                  onDelete={handleNoteDeleted}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <MobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        todayLabel={format.dayShort(date ?? todayISO())}
      />

      {searchOpen ? (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={(day) => {
            setSearchOpen(false)
            setMobileTab('today')
            void navigate(`/projets/${projectId}/notes/${day}`)
          }}
          onDelete={handleNoteDeleted}
        />
      ) : null}
    </div>
  )
}
