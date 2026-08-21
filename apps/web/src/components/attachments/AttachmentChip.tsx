import type { Attachment } from '@daily-report/types'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { extensionLabel, isPreviewableImage } from '../../lib/attachments'
import { useConfirm } from '../ui/ConfirmDialog'
import styles from './AttachmentChip.module.css'

interface AttachmentChipProps {
  attachment: Attachment
  onRemove: (id: string) => void
}

/** Une vignette du tiroir : aperçu, nom, menu ⋯. */
export function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  const { t } = useTranslation()
  const { confirm, dialog } = useConfirm()
  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)
  const isImage = isPreviewableImage(attachment.mimeType)
  const url = api.attachments.contentUrl(attachment.id)

  // Referme le menu au clic ailleurs et à Échap — sans ça, il resterait ouvert
  // pendant qu'on travaille dans la note.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: PointerEvent) {
      if (!chipRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  async function handleRemove() {
    setMenuOpen(false)
    const confirmed = await confirm({
      title: t('attachments.confirmRemove.title', { filename: attachment.filename }),
      body: t('attachments.confirmRemove.body'),
      confirmLabel: t('attachments.remove'),
      tone: 'danger',
    })
    if (confirmed) onRemove(attachment.id)
  }

  return (
    <div className={`card ${styles.chip}`} ref={chipRef}>
      {isImage ? (
        <img src={url} alt="" className={styles.preview} loading="lazy" />
      ) : (
        <span className={`tag tag-accent ${styles.badge}`}>
          {extensionLabel(attachment.filename) ?? t('attachments.unknownType')}
        </span>
      )}

      <a href={url} className={styles.name} title={attachment.filename} download>
        {attachment.filename}
      </a>

      <button
        type="button"
        className={styles.menu_button}
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={t('attachments.actionsFor', { filename: attachment.filename })}
      >
        ⋯
      </button>

      {menuOpen ? (
        <div className={`card elev-lg ${styles.menu}`} role="menu">
          <a href={url} className={styles.menu_item} download onClick={() => setMenuOpen(false)}>
            {t('attachments.download')}
          </a>
          <button type="button" className={styles.menu_item} onClick={() => void handleRemove()}>
            {t('attachments.remove')}
          </button>
        </div>
      ) : null}

      {dialog}
    </div>
  )
}
