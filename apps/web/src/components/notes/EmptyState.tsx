import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { todayISO } from '../../lib/dates'
import { shortcutHint } from '../../lib/platform'
import { UserMenu } from '../auth/UserMenu'
import { WeekDigest } from './WeekDigest'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  onOpenSearch: () => void
}

/** Les écrans 2f/2g : aucune note ouverte, la semaine en condensé. */
export function EmptyState({ onOpenSearch }: EmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.view}>
      {/* La maquette a retiré le « ＋ Note » de cet en-tête : il ne reste que le
          titre et le menu utilisateur. Le geste vit toujours au pied de la barre
          latérale, que 2f affiche aussi — d'où le renvoi du texte d'aide. */}
      <header className={styles.header}>
        <span className={styles.title}>{t('empty.title')}</span>
        <span className={styles.spacer} />
        <UserMenu />
      </header>

      <div className={styles.body}>
        {/* Le pendant desktop de la barre « Rechercher dans toutes mes
            notes… » de la maquette : ouvre la même modale que Ctrl+K/⌘K.
            L'onglet Calendrier mobile porte le sien, avec le même geste —
            voir `AppShell`, `.calendar_search`. */}
        <button type="button" className={`card elev-sm ${styles.search}`} onClick={onOpenSearch}>
          <span aria-hidden="true">⌕</span>
          <span className={styles.search_label}>{t('search.placeholder')}</span>
          <span className={styles.search_shortcut} aria-hidden="true">
            {shortcutHint()}
          </span>
        </button>

        {/* Le condensé de semaine : uniquement sur desktop, où cette vue est
            la colonne de droite à côté du calendrier. Sur mobile, les jours
            récents vivent dans l'onglet Calendrier — les répéter ici ferait
            double emploi sur un écran déjà à l'étroit. */}
        <div className={styles.desktop_week}>
          <WeekDigest />
        </div>

        {/* Le pendant du « ＋ Note » de la barre latérale desktop, qui
            disparaît entièrement sous 900 px — un gros bouton rond centré,
            pas un lien pleine largeur : c'est ce que montre l'écran mobile
            dédié de la maquette 2b. */}
        <div className={styles.mobile_create}>
          <p className={styles.mobile_create_hint}>{t('empty.mobileNoNote')}</p>
          <Link
            to={`/notes/${todayISO()}`}
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
