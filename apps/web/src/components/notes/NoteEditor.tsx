import type { RichTextDoc } from '@daily-report/types'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { EditorToolbar } from './EditorToolbar'
import styles from './NoteEditor.module.css'

interface NoteEditorProps {
  /** Clé du document chargé — la date. Un changement recharge l'éditeur. */
  documentKey: string
  content: RichTextDoc
  onChange: (content: RichTextDoc) => void
}

const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export function NoteEditor({ documentKey, content, onChange }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      // v3 : Link et Underline sont désormais dans StarterKit.
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Placeholder.configure({ placeholder: 'Racontez votre journée…' }),
    ],
    content: (content.content?.length ? content : EMPTY_DOC) as JSONContent,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as RichTextDoc)
    },
    editorProps: {
      attributes: { class: styles.surface ?? '' },
    },
  })

  /**
   * Recharger le document quand on change de jour. `setContent` sans cette
   * garde écraserait la frappe en cours à chaque rendu ; la dépendance est donc
   * la clé du document, pas le contenu.
   */
  useEffect(() => {
    if (!editor) return
    const next = (content.content?.length ? content : EMPTY_DOC) as JSONContent
    editor.commands.setContent(next, { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentKey])

  if (!editor) return null

  return (
    <div className={styles.editor}>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
