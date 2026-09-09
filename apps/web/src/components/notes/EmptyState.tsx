import type { DailyNote } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { todayISO } from '../../lib/dates'
import { shortcutHint } from '../../lib/platform'
import { UserMenu } from '../auth/UserMenu'
import { WeekDigest } from './WeekDigest'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  onOpenSearch: () => void
  /** A note deleted from search or the mobile tab — see `WeekDigest`. */
  deletedNote: DailyNote | null
}

/** Screens 2f/2g: no note open, the week digest. */
export function EmptyState({ onOpenSearch, deletedNote }: EmptyStateProps) {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className={styles.view}>
      {/* The mockup removed the "＋ Note" from this header: only the title
          and the user menu remain. The action still lives at the foot of the
          sidebar, which 2f also displays — hence the hint text pointing to it. */}
      <header className={styles.header}>
        <span className={styles.title}>{t('empty.title')}</span>
        <span className={styles.spacer} />
        <UserMenu />
      </header>

      <div className={styles.body}>
        {/* The desktop counterpart of the mockup's "Search all my notes…"
            bar: opens the same modal as Ctrl+K/⌘K. The mobile Calendar tab
            carries its own, with the same action — see `AppShell`,
            `.calendar_search`. */}
        <button type="button" className={`card elev-sm ${styles.search}`} onClick={onOpenSearch}>
          <span aria-hidden="true">⌕</span>
          <span className={styles.search_label}>{t('search.placeholder')}</span>
          <span className={styles.search_shortcut} aria-hidden="true">
            {shortcutHint()}
          </span>
        </button>

        {/* The week digest: only on desktop, where this view is the right
            column next to the calendar. On mobile, recent days live in the
            Calendar tab — repeating them here would be redundant on a
            screen that's already cramped. */}
        <div className={styles.desktop_week}>
          <WeekDigest deletedNote={deletedNote} />
        </div>

        {/* The counterpart of the "＋ Note" from the desktop sidebar, which
            disappears entirely under 900px — a big centered round button,
            not a full-width link: that's what the dedicated mobile screen
            in mockup 2b shows. */}
        <div className={styles.mobile_create}>
          <p className={styles.mobile_create_hint}>{t('empty.mobileNoNote')}</p>
          <Link
            to={`/projets/${projectId}/notes/${todayISO()}`}
            className={`btn btn-primary ${styles.mobile_create_button}`}
            aria-label={t('empty.mobileCreate')}
          >
            ＋
          </Link>
          <p className={styles.mobile_create_hint}>{t('empty.mobileCreate')}</p>
        </div>

        <p className={styles.hint}>{t('empty.hint')}</p>
      </div>
    </div>
  )
}
