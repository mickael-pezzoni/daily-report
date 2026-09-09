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
  /** Translation key, not a message: it must follow the language. */
  errorKey: string | null
  onUpload: (files: File[]) => void
  onRemove: (id: string) => void
  /** A file is hovering over the day: the bar signals it even while collapsed. */
  dragging: boolean
  /** Archived project: no more adding, but removing an already-attached file remains possible. */
  readOnly?: boolean
}

/**
 * The footer bar of screen 2a, collapsed, and the 2a-open drawer, expanded.
 *
 * A single component for both states: it's the same bar, and the header acts
 * as the toggle button.
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
  readOnly,
}: AttachmentBarProps) {
  const { t } = useTranslation()
  const count = items.length

  return (
    <div className={`${styles.bar} ${dragging ? styles.bar_dragging : ''}`}>
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
            {readOnly ? null : <DropZone onFiles={onUpload} />}
          </div>
        </div>
      ) : null}
    </div>
  )
}
