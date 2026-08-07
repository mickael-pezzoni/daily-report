import type { Attachment } from '@daily-report/types'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import styles from './AttachmentChip.module.css'

interface AttachmentChipProps {
  attachment: Attachment
  onRemove: (id: string) => void
}

/** `capture-1.png` → `PNG`, pour la pastille des fichiers non prévisualisables. */
function extensionLabel(filename: string): string {
  const match = /\.([a-z0-9]{1,5})$/i.exec(filename)
  return match?.[1]?.toUpperCase() ?? 'FIC'
}

/** Une vignette du tiroir : aperçu, nom, menu ⋯. */
export function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)
  const isImage = attachment.mimeType.startsWith('image/')
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

  function handleRemove() {
    setMenuOpen(false)
    const confirmed = window.confirm(
      `Supprimer « ${attachment.filename} » ?\n\n` +
        "Si cette image a été insérée dans le texte, elle n'y sera plus affichée.",
    )
    if (confirmed) onRemove(attachment.id)
  }

  return (
    <div className={`card ${styles.chip}`} ref={chipRef}>
      {isImage ? (
        <img src={url} alt="" className={styles.preview} loading="lazy" />
      ) : (
        <span className={`tag tag-accent ${styles.badge}`}>{extensionLabel(attachment.filename)}</span>
      )}

      <a href={url} className={styles.name} title={attachment.filename} download>
        {attachment.filename}
      </a>

      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={`Actions pour ${attachment.filename}`}
      >
        ⋯
      </button>

      {menuOpen ? (
        <div className={`card elev-lg ${styles.menu}`} role="menu">
          <a href={url} className={styles.menuItem} download onClick={() => setMenuOpen(false)}>
            Télécharger
          </a>
          <button type="button" className={styles.menuItem} onClick={handleRemove}>
            Supprimer
          </button>
        </div>
      ) : null}
    </div>
  )
}
