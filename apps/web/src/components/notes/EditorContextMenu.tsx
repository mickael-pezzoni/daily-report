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
 * Mockup screen 7a — right-click in the editor text.
 *
 * Replaces the browser's native menu (which never sees it: the call to
 * `preventDefault()` lives in `NoteEditor`, before this component exists).
 * Cut/Copy/Paste therefore go through `execCommand`/the clipboard —
 * keyboard Ctrl+X/C/V remain the fallback if one of these three fails.
 *
 * Rendered into a portal to `document.body`: `.paper` (the sheet in
 * `NoteView`) carries a slight `transform: rotate()` for the "laid down"
 * effect, and a `transform` on an ancestor redefines the containing block for
 * any `position: fixed` descendant — the menu would then follow that
 * rotation instead of the viewport, and would no longer appear under the
 * cursor.
 */
export function EditorContextMenu({ editor, attachments, anchor, onClose }: EditorContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [position, setPosition] = useState(anchor)

  const hasSelection = !editor.state.selection.empty
  const images = attachments.filter((attachment) => isPreviewableImage(attachment.mimeType))

  // Closes on click elsewhere and on Escape — same pattern as `UserMenu` and
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

  // A right-click near the window's right/bottom edge would otherwise open a
  // partially invisible menu: we measure its real size once rendered, and
  // pull it back into the viewport if it overflows.
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
      // Ctrl+V remains available: nothing to report here.
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
              className={styles.image_item}
              onClick={() => chooseImage(image)}
            >
              <img
                src={api.attachments.contentUrl(image.id)}
                alt=""
                className={styles.image_thumb}
                loading="lazy"
              />
              <span className={styles.image_name}>{image.filename}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
