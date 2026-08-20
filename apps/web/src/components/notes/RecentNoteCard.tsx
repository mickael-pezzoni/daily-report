import type { NoteListItem } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDateFormat } from '../../hooks/useDateFormat'
import { useConfirm } from '../ui/ConfirmDialog'
import styles from './RecentNoteCard.module.css'

interface RecentNoteCardProps {
  note: NoteListItem
  onDelete: (note: NoteListItem) => void
}

/**
 * Une carte de jour récent — l'écran 2f en aligne trois, en post-it plutôt
 * qu'en rangées. Plus de vignettes de pièces jointes ni de titre : à cette
 * taille fixe, seuls la date, le nombre de fichiers et l'extrait tiennent.
 *
 * La maquette n'y met qu'une action explicite, « ✕ » : c'est donc la carte
 * entière qui ouvre la journée. Le lien de la date est étiré par-dessus toute
 * la carte (`::after`), et le bouton de suppression repasse au-dessus de
 * lui — un bouton ne peut pas être imbriqué dans un lien, et cette technique
 * garde les deux cibles distinctes pour le clavier comme pour la souris.
 */
export function RecentNoteCard({ note, onDelete }: RecentNoteCardProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { confirm, dialog } = useConfirm()

  const day = format.dayShort(note.date)
  const fileCount = note.attachments.length

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('card.confirmDelete.title', { day }),
      body:
        fileCount > 0
          ? t('card.confirmDelete.bodyWithFiles', {
              files: t('attachments.files', { count: fileCount }),
            })
          : t('card.confirmDelete.body'),
      confirmLabel: t('card.confirmDelete.confirm'),
      tone: 'danger',
    })
    if (confirmed) onDelete(note)
  }

  return (
    <article className={`card ${styles.card}`}>
      <header className={styles.head}>
        <h3 className={styles.date}>
          <Link to={`/notes/${note.date}`} className={styles.open}>
            {day}
          </Link>
        </h3>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.remove}
          onClick={() => void handleDelete()}
          aria-label={t('card.deleteDay', { day })}
        >
          ✕
        </button>
      </header>

      {fileCount > 0 ? (
        <span className={`tag tag-accent-2 ${styles.tag}`}>
          {t('attachments.files', { count: fileCount })}
        </span>
      ) : null}

      {note.excerpt ? <p className={styles.excerpt}>{note.excerpt}</p> : null}

      {dialog}
    </article>
  )
}
