import type { Editor } from '@tiptap/react'
// In v3, floating menus live in their own entry point.
import { BubbleMenu } from '@tiptap/react/menus'
import { useTranslation } from 'react-i18next'
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
      className={isActive ? styles.item_active : styles.item}
      // `onMouseDown` rather than `onClick`: without this, the button takes
      // focus and the text selection clears before the command runs.
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
 * The mockup's "floating hover bar": it only appears on a selection, right
 * where you're working, rather than as a permanent ribbon.
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation()

  return (
    <BubbleMenu editor={editor} className={`card elev-md ${styles.bar}`}>
      {button('B', t('note.toolbar.bold'), editor.isActive('bold'), () =>
        editor.chain().focus().toggleBold().run(),
      )}
      {button('I', t('note.toolbar.italic'), editor.isActive('italic'), () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      <span className={styles.separator} />
      {button('H1', t('note.toolbar.heading1'), editor.isActive('heading', { level: 1 }), () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
      )}
      {button('H2', t('note.toolbar.heading2'), editor.isActive('heading', { level: 2 }), () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
      )}
      <span className={styles.separator} />
      {button('•', t('note.toolbar.bulletList'), editor.isActive('bulletList'), () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {button('☑', t('note.toolbar.taskList'), editor.isActive('taskList'), () =>
        editor.chain().focus().toggleTaskList().run(),
      )}
      <span className={styles.separator} />
      {button('code', t('note.toolbar.code'), editor.isActive('code'), () =>
        editor.chain().focus().toggleCode().run(),
      )}
      {button('lien', t('note.toolbar.link'), editor.isActive('link'), () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
          return
        }
        const url = window.prompt(t('note.toolbar.linkPrompt'))
        if (url) editor.chain().focus().setLink({ href: url }).run()
      })}
    </BubbleMenu>
  )
}
