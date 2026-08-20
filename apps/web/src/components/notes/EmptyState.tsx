import type { NoteListItem } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { todayISO } from '../../lib/dates'
import { shortcutHint } from '../../lib/platform'
import { UserMenu } from '../auth/UserMenu'
import { RecentNoteCard } from './RecentNoteCard'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  recent: NoteListItem[]
  onDelete: (note: NoteListItem) => void
  onOpenSearch: () => void
}

/** L'écran 2f : aucune note ouverte, les derniers jours en cartes. */
export function EmptyState({ recent, onDelete, onOpenSearch }: EmptyStateProps) {
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
            notes… » de la maquette : ouvre la même modale que Ctrl+K/⌘K, elle
            n'a donc de sens que là où le clavier est la norme — l'onglet
            Calendrier mobile porte son propre champ, pas encore branché. */}
        <button type="button" className={`card elev-sm ${styles.search}`} onClick={onOpenSearch}>
          <span aria-hidden="true">⌕</span>
          <span className={styles.searchLabel}>{t('search.placeholder')}</span>
          <span className={styles.searchShortcut} aria-hidden="true">
            {shortcutHint()}
          </span>
        </button>

        {/* Les derniers jours en post-it : uniquement sur desktop, où cette
            vue est la colonne de droite à côté du calendrier. Sur mobile, ils
            vivent dans l'onglet Calendrier — les répéter ici ferait double
            emploi sur un écran déjà à l'étroit. */}
        <div className={styles.desktopRecent}>
          {recent.length > 0 ? (
            <>
              <h2 className={styles.heading}>{t('empty.resume')}</h2>
              <div className={styles.cards}>
                {recent.map((note) => (
                  <RecentNoteCard key={note.id} note={note} onDelete={onDelete} />
                ))}
              </div>
            </>
          ) : (
            <h2 className={styles.heading}>{t('empty.blank')}</h2>
          )}
        </div>

        {/* Le pendant du « ＋ Note » de la barre latérale desktop, qui
            disparaît entièrement sous 900 px — un gros bouton rond centré,
            pas un lien pleine largeur : c'est ce que montre l'écran mobile
            dédié de la maquette 2b. */}
        <div className={styles.mobileCreate}>
          <p className={styles.mobileCreateHint}>{t('empty.mobileNoNote')}</p>
          <Link
            to={`/notes/${todayISO()}`}
            className={`btn btn-primary ${styles.mobileCreateButton}`}
            aria-label={t('empty.mobileCreate')}
          >
            ＋
          </Link>
          <p className={styles.mobileCreateHint}>{t('empty.mobileCreate')}</p>
        </div>

        <span className={styles.bodySpacer} />
        <p className={styles.hint}>{t('empty.hint')}</p>
      </div>
    </div>
  )
}
