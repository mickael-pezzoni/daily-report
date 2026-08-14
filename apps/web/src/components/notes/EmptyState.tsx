import type { NoteListItem } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { UserMenu } from '../auth/UserMenu'
import { RecentNoteCard } from './RecentNoteCard'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  recent: NoteListItem[]
  onDelete: (note: NoteListItem) => void
}

/** L'écran 2f : aucune note ouverte, les derniers jours en cartes. */
export function EmptyState({ recent, onDelete }: EmptyStateProps) {
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

        <span className={styles.spacer} />
        <p className={styles.hint}>{t('empty.hint')}</p>
      </div>
    </div>
  )
}
