import type { Attachment } from '@daily-report/types'
import { useTranslation } from 'react-i18next'
import { AttachmentChip } from './AttachmentChip'
import { DropZone } from './DropZone'
import styles from './AttachmentBar.module.css'

interface AttachmentBarProps {
  items: Attachment[]
  open: boolean
  onToggle: () => void
  uploading: boolean
  /** Clé de traduction, pas un message : elle doit suivre la langue. */
  errorKey: string | null
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
  errorKey,
  onUpload,
  onRemove,
  dragging,
}: AttachmentBarProps) {
  const { t } = useTranslation()
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
            <span className={styles.title}>{t('attachments.title')}</span>
            <span className={styles.hint}>{t('attachments.drawerHint', { count })}</span>
          </>
        ) : (
          <span className={styles.label}>
            {count === 0 ? t('attachments.none') : t('attachments.count', { count })}
          </span>
        )}
        <span className={styles.spacer} />
        {uploading ? <span className={styles.hint}>{t('attachments.uploading')}</span> : null}
        <span className={styles.toggle}>
          {open ? t('attachments.collapse') : t('attachments.expand')}
        </span>
      </button>

      {open ? (
        <div className={styles.drawer}>
          {errorKey ? (
            <p className={styles.error} role="alert">
              {t(errorKey)}
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
