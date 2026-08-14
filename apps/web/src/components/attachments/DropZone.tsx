import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './DropZone.module.css'

/**
 * La tuile « + » en pointillés du tiroir.
 *
 * C'est un **vrai `<input type="file">`** derrière un label, pas seulement une
 * cible de dépôt : c'est ce qui rend l'ajout atteignable au clavier et depuis un
 * mobile, où le glisser-déposer n'existe pas.
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
          // Réinitialiser : sans ça, redéposer le même fichier ne
          // déclencherait aucun `change`.
          event.target.value = ''
        }}
      />
      <label htmlFor={id} className={styles.zone} title={t('attachments.add')}>
        +
      </label>
    </>
  )
}
