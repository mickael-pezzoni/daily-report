import type { Attachment } from '@daily-report/types'
import { AttachmentChip } from './AttachmentChip'
import { DropZone } from './DropZone'
import styles from './AttachmentBar.module.css'

interface AttachmentBarProps {
  items: Attachment[]
  open: boolean
  onToggle: () => void
  uploading: boolean
  error: string | null
  onUpload: (files: File[]) => void
  onRemove: (id: string) => void
  /** Un fichier survole la journée : la bande le signale même repliée. */
  dragging: boolean
}

/**
 * La bande de pied de l'écran 2a, repliée, et le tiroir 2a-open déplié.
 *
 * Un seul composant pour les deux états : c'est la même bande, et l'en-tête sert
 * de bouton de bascule.
 */
export function AttachmentBar({
  items,
  open,
  onToggle,
  uploading,
  error,
  onUpload,
  onRemove,
  dragging,
}: AttachmentBarProps) {
  const count = items.length

  return (
    <div className={`${styles.bar} ${dragging ? styles.barDragging : ''}`}>
      <button
        type="button"
        className={styles.header}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>📎</span>
        {open ? (
          <>
            <span className={styles.title}>Pièces jointes</span>
            <span className={styles.hint}>
              {count} · glissez un fichier ici pour l'ajouter
            </span>
          </>
        ) : (
          <span className={styles.label}>
            {count === 0
              ? 'Aucune pièce jointe'
              : `${count} pièce${count > 1 ? 's' : ''} jointe${count > 1 ? 's' : ''}`}
          </span>
        )}
        <span className={styles.spacer} />
        {uploading ? <span className={styles.hint}>envoi…</span> : null}
        <span className={styles.toggle}>{open ? 'replier ▴' : 'voir / ajouter ▾'}</span>
      </button>

      {open ? (
        <div className={styles.drawer}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.items}>
            {items.map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} onRemove={onRemove} />
            ))}
            <DropZone onFiles={onUpload} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
