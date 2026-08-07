import type { Editor } from '@tiptap/react'
// En v3, les menus flottants vivent dans leur propre point d'entrée.
import { BubbleMenu } from '@tiptap/react/menus'
import styles from './EditorToolbar.module.css'

interface EditorToolbarProps {
  editor: Editor
}

function button(label: string, title: string, isActive: boolean, run: () => void) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={isActive ? styles.itemActive : styles.item}
      // `onMouseDown` plutôt que `onClick` : sans ça, le bouton prend le focus
      // et la sélection de texte s'efface avant l'exécution de la commande.
      onMouseDown={(event) => {
        event.preventDefault()
        run()
      }}
    >
      {label}
    </button>
  )
}

/**
 * La « barre flottante au survol » de la maquette : elle n'apparaît que sur une
 * sélection, à l'endroit où l'on travaille, plutôt qu'en ruban permanent.
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <BubbleMenu editor={editor} className={`card elev-md ${styles.bar}`}>
      {button('B', 'Gras', editor.isActive('bold'), () =>
        editor.chain().focus().toggleBold().run(),
      )}
      {button('I', 'Italique', editor.isActive('italic'), () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      <span className={styles.separator} />
      {button('H1', 'Titre 1', editor.isActive('heading', { level: 1 }), () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
      )}
      {button('H2', 'Titre 2', editor.isActive('heading', { level: 2 }), () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
      )}
      <span className={styles.separator} />
      {button('•', 'Liste à puces', editor.isActive('bulletList'), () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {button('☑', 'Liste de tâches', editor.isActive('taskList'), () =>
        editor.chain().focus().toggleTaskList().run(),
      )}
      <span className={styles.separator} />
      {button('code', 'Code', editor.isActive('code'), () =>
        editor.chain().focus().toggleCode().run(),
      )}
      {button('lien', 'Lien', editor.isActive('link'), () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
          return
        }
        const url = window.prompt('Adresse du lien')
        if (url) editor.chain().focus().setLink({ href: url }).run()
      })}
    </BubbleMenu>
  )
}
