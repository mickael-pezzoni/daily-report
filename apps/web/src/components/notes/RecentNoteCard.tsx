import type { Attachment, NoteListItem } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../../api/client'
import { useDateFormat } from '../../hooks/useDateFormat'
import { extensionLabel, isPreviewableImage } from '../../lib/attachments'
import styles from './RecentNoteCard.module.css'

interface RecentNoteCardProps {
  note: NoteListItem
  onDelete: (note: NoteListItem) => void
}

/**
 * Combien d'aperçus la carte montre avant de replier le reste en « +N ».
 *
 * La maquette en aligne deux ; on laisse un peu de marge, mais pas au point
 * qu'un jour très chargé fasse déborder la carte sur toute la hauteur.
 */
const PREVIEW_LIMIT = 4

/** Un aperçu : la vignette pour une image, une pastille de type sinon. */
function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const { t } = useTranslation()

  if (isPreviewableImage(attachment.mimeType)) {
    return (
      <img
        src={api.attachments.contentUrl(attachment.id)}
        alt={attachment.filename}
        title={attachment.filename}
        className={styles.thumb}
        loading="lazy"
      />
    )
  }

  return (
    <span className={`card ${styles.file}`} title={attachment.filename}>
      <span className="tag tag-accent">
        {extensionLabel(attachment.filename) ?? t('attachments.unknownType')}
      </span>
      <span className={styles.fileName}>{attachment.filename}</span>
    </span>
  )
}

/**
 * Une carte de jour récent — l'écran 2f en aligne trois.
 *
 * La maquette n'y met plus qu'une action explicite, « supprimer » : c'est donc
 * la carte entière qui ouvre la journée. Le lien de la date est étiré par-dessus
 * toute la carte (`::after`), et le bouton de suppression repasse au-dessus de
 * lui — un bouton ne peut pas être imbriqué dans un lien, et cette technique
 * garde les deux cibles distinctes pour le clavier comme pour la souris.
 */
export function RecentNoteCard({ note, onDelete }: RecentNoteCardProps) {
  const { t } = useTranslation()
  const format = useDateFormat()

  const shown = note.attachments.slice(0, PREVIEW_LIMIT)
  const hidden = note.attachments.length - shown.length
  const day = format.dayShort(note.date)
  const fileCount = note.attachments.length

  function handleDelete() {
    const confirmed = window.confirm(
      fileCount > 0
        ? t('card.confirmDeleteWithFiles', {
            day,
            files: t('attachments.files', { count: fileCount }),
          })
        : t('card.confirmDelete', { day }),
    )
    if (confirmed) onDelete(note)
  }

  return (
    <article className={`card elev-sm ${styles.card}`}>
      <header className={styles.head}>
        <h3 className={styles.date}>
          <Link to={`/notes/${note.date}`} className={styles.open}>
            {day}
          </Link>
        </h3>
        {note.title ? <span className={styles.title}>{note.title}</span> : null}
        {fileCount > 0 ? (
          <span className="tag tag-accent-2">
            {t('attachments.files', { count: fileCount })}
          </span>
        ) : null}

        <span className={styles.spacer} />

        <button
          type="button"
          className={styles.remove}
          onClick={handleDelete}
          aria-label={t('card.deleteDay', { day })}
        >
          {t('card.delete')}
        </button>
      </header>

      {note.excerpt ? <p className={styles.excerpt}>{note.excerpt}</p> : null}

      {shown.length > 0 ? (
        <div className={styles.previews}>
          {shown.map((attachment) => (
            <AttachmentPreview key={attachment.id} attachment={attachment} />
          ))}
          {hidden > 0 ? <span className={styles.more}>+{hidden}</span> : null}
        </div>
      ) : null}
    </article>
  )
}
