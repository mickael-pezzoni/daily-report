import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './DropZone.module.css'

/**
 * The dashed "+" tile in the drawer.
 *
 * It's a **real `<input type="file">`** behind a label, not just a drop
 * target: that's what makes adding a file reachable from the keyboard and from
 * mobile, where drag-and-drop doesn't exist.
 */
export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        id={id}
        ref={inputRef}
        type="file"
        multiple
        className={styles.input}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) onFiles(files)
          // Reset it: without this, re-dropping the same file wouldn't
          // trigger a `change` event.
          event.target.value = ''
        }}
      />
      <label htmlFor={id} className={styles.zone} title={t('attachments.add')}>
        +
      </label>
    </>
  )
}
