import type { Attachment } from '@daily-report/types'
import type { Editor } from '@tiptap/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { isPreviewableImage } from '../../lib/attachments'
import styles from './EditorContextMenu.module.css'

interface EditorContextMenuProps {
  editor: Editor
  attachments: Attachment[]
  anchor: { x: number; y: number }
  onClose: () => void
}

/**
 * Écran 7a de la maquette — clic droit dans le texte de l'éditeur.
 *
 * Remplace le menu natif du navigateur (celui-ci ne le voit jamais : l'appel
 * à `preventDefault()` vit dans `NoteEditor`, avant que ce composant existe).
 * Couper/Copier/Coller passent donc par `execCommand`/le presse-papiers —
 * Ctrl+X/C/V au clavier restent la voie de repli si l'un de ces trois échoue.
 *
 * Rendu dans un portail vers `document.body` : `.paper` (la feuille de
 * `NoteView`) porte un léger `transform: rotate()` pour l'effet « posée », et
 * un `transform` sur un ancêtre redéfinit le référentiel de tout descendant en
 * `position: fixed` — le menu suivrait alors cette rotation au lieu du
 * viewport, et n'apparaîtrait plus sous le curseur.
 */
export function EditorContextMenu({ editor, attachments, anchor, onClose }: EditorContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [position, setPosition] = useState(anchor)

  const hasSelection = !editor.state.selection.empty
  const images = attachments.filter((attachment) => isPreviewableImage(attachment.mimeType))

  // Referme au clic ailleurs et à Échap — même pattern que `UserMenu` et
  // `AttachmentChip`.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  // Un clic droit près du bord droit/bas de la fenêtre ouvrirait sinon un menu
  // partiellement invisible : on mesure sa taille réelle une fois rendu, et on
  // le ramène dans le viewport s'il déborde.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const clampedX = Math.min(anchor.x, window.innerWidth - rect.width - 8)
    const clampedY = Math.min(anchor.y, window.innerHeight - rect.height - 8)
    setPosition({ x: Math.max(8, clampedX), y: Math.max(8, clampedY) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, imagesOpen])

  function handleCut() {
    document.execCommand('cut')
    onClose()
  }

  function handleCopy() {
    document.execCommand('copy')
    onClose()
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) editor.chain().focus().insertContent(text).run()
    } catch {
      // Ctrl+V reste disponible : rien à signaler ici.
    }
    onClose()
  }

  function chooseImage(image: Attachment) {
    editor.chain().focus().setImage({ src: api.attachments.contentUrl(image.id), alt: image.filename }).run()
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      className={`card elev-lg ${styles.menu}`}
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      <button type="button" className={styles.item} onClick={handleCut} disabled={!hasSelection}>
        <span aria-hidden="true">✂️</span>
        {t('note.contextMenu.cut')}
      </button>
      <button type="button" className={styles.item} onClick={handleCopy} disabled={!hasSelection}>
        <span aria-hidden="true">⧉</span>
        {t('note.contextMenu.copy')}
      </button>
      <button type="button" className={styles.item} onClick={() => void handlePaste()}>
        <span aria-hidden="true">📋</span>
        {t('note.contextMenu.paste')}
      </button>

      <div className={styles.divider} />

      <button
        type="button"
        className={styles.item}
        disabled={images.length === 0}
        aria-expanded={imagesOpen}
        onClick={() => setImagesOpen((open) => !open)}
      >
        <span aria-hidden="true">🖼️</span>
        {t('note.contextMenu.insertImage')}
      </button>

      {imagesOpen ? (
        <div className={styles.images}>
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className={styles.imageItem}
              onClick={() => chooseImage(image)}
            >
              <img
                src={api.attachments.contentUrl(image.id)}
                alt=""
                className={styles.imageThumb}
                loading="lazy"
              />
              <span className={styles.imageName}>{image.filename}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
