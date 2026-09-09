import { useTranslation } from 'react-i18next'
import styles from './MobileTabBar.module.css'

export type MobileTab = 'today' | 'calendar'

interface MobileTabBarProps {
  active: MobileTab
  onChange: (tab: MobileTab) => void
  /** The date shown by the Today tab, already formatted — see `AppShell`. */
  todayLabel: string
}

/**
 * The tab bar of mobile screen 2b.
 *
 * Two tabs, not three: the mockup draws a third one, "Export", which has
 * nothing behind it on the API side. Same rule as the ⌕ button or
 * "Export ▾" in the desktop header, already absent so as not to ship a dead
 * command.
 */
export function MobileTabBar({ active, onChange, todayLabel }: MobileTabBarProps) {
  const { t } = useTranslation()

  return (
    <nav className={styles.bar} aria-label={t('mobile.tabsLabel')}>
      <button
        type="button"
        className={`${styles.tab} ${active === 'today' ? `card elev-sm ${styles.tab_active}` : ''}`}
        aria-current={active === 'today' ? 'page' : undefined}
        onClick={() => onChange('today')}
      >
        {todayLabel}
      </button>
      <button
        type="button"
        className={`${styles.tab} ${active === 'calendar' ? `card elev-sm ${styles.tab_active}` : ''}`}
        aria-current={active === 'calendar' ? 'page' : undefined}
        onClick={() => onChange('calendar')}
      >
        {t('mobile.calendar')}
      </button>
    </nav>
  )
}
