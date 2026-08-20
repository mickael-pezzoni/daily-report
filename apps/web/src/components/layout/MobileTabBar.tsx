import { useTranslation } from 'react-i18next'
import styles from './MobileTabBar.module.css'

export type MobileTab = 'today' | 'calendar'

interface MobileTabBarProps {
  active: MobileTab
  onChange: (tab: MobileTab) => void
  /** La date affichée par l'onglet Aujourd'hui, déjà mise en forme — voir `AppShell`. */
  todayLabel: string
}

/**
 * Le pied d'onglets de l'écran mobile 2b.
 *
 * Deux onglets, pas trois : la maquette en dessine un troisième, « Exporter »,
 * qui n'a rien derrière lui côté API. Même règle que le bouton ⌕ ou
 * « Exporter ▾ » de l'en-tête desktop, déjà absents pour ne pas livrer de
 * commande morte.
 */
export function MobileTabBar({ active, onChange, todayLabel }: MobileTabBarProps) {
  const { t } = useTranslation()

  return (
    <nav className={styles.bar} aria-label={t('mobile.tabsLabel')}>
      <button
        type="button"
        className={`${styles.tab} ${active === 'today' ? `card elev-sm ${styles.tabActive}` : ''}`}
        aria-current={active === 'today' ? 'page' : undefined}
        onClick={() => onChange('today')}
      >
        {todayLabel}
      </button>
      <button
        type="button"
        className={`${styles.tab} ${active === 'calendar' ? `card elev-sm ${styles.tabActive}` : ''}`}
        aria-current={active === 'calendar' ? 'page' : undefined}
        onClick={() => onChange('calendar')}
      >
        {t('mobile.calendar')}
      </button>
    </nav>
  )
}
