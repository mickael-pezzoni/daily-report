import type { Attachment, RichTextDoc } from '@daily-report/types'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContextMenu } from './EditorContextMenu'
import { EditorToolbar } from './EditorToolbar'
import styles from './NoteEditor.module.css'

/** What an image upload returns: what's needed to insert it into the document. */
export interface UploadedImage {
  src: string
  alt: string
}

interface NoteEditorProps {
  /** Key of the loaded document — the date. A change reloads the editor. */
  documentKey: string
  content: RichTextDoc
  onChange: (content: RichTextDoc) => void
  /** Attaches the files to the note and returns the images to insert. */
  onUploadImages: (files: File[]) => Promise<UploadedImage[]>
  /** Attachments already uploaded to the note — for the context menu (screen 7a). */
  attachments: Attachment[]
  /** Archived project: read-only — no typing, pasting, or image dropping. */
  editable: boolean
}

const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

function imagesFrom(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

export function NoteEditor({
  documentKey,
  content,
  onChange,
  onUploadImages,
  attachments,
  editable,
}: NoteEditorProps) {
  const { t } = useTranslation()

  // ProseMirror's handlers are captured when the editor is created. They
  // therefore go through refs, otherwise they'd freeze the first render's
  // closures — and the instance doesn't exist yet when they're declared.
  const editorRef = useRef<Editor | null>(null)
  const uploadRef = useRef(onUploadImages)
  // Read in `handleDrop`/`handlePaste`/right-click, also captured when the
  // editor is created: `editor.isEditable` alone wouldn't be enough, since
  // these handlers call commands directly, outside the path that the DOM's
  // `contenteditable` attribute blocks on its own.
  const editableRef = useRef(editable)
  // Right-click position, in screen coordinates — `null` means the menu is
  // closed. The menu itself doesn't need a ref: it closes via its own effect.
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  // Same reason for the translation function: the ghost text is read on
  // every decoration computation, not frozen at editor creation, which lets
  // it follow a language change without remounting the instance.
  const tRef = useRef(t)

  useEffect(() => {
    uploadRef.current = onUploadImages
  }, [onUploadImages])

  useEffect(() => {
    editableRef.current = editable
  }, [editable])

  useEffect(() => {
    tRef.current = t
  }, [t])

  /**
   * Uploads the images then inserts them.
   *
   * ProseMirror expects a synchronous response even though the upload isn't
   * one: we tell it "this is handled" right away, and the insertion happens
   * once the server has responded.
   */
  function insertUploaded(files: File[], at?: number) {
    void uploadRef.current(files).then((images) => {
      const editor = editorRef.current
      if (!editor || images.length === 0) return

      const chain = editor.chain().focus()
      // `at` only on drop: on paste, the current position is authoritative.
      if (at !== undefined) chain.setTextSelection(at)
      for (const image of images) chain.setImage({ src: image.src, alt: image.alt })
      chain.run()
    })
  }

  const editor = useEditor({
    extensions: [
      // v3: Link and Underline are now in StarterKit.
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Placeholder.configure({ placeholder: () => tRef.current('note.bodyPlaceholder') }),
    ],
    content: (content.content?.length ? content : EMPTY_DOC) as JSONContent,
    editable,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as RichTextDoc)
    },
    editorProps: {
      attributes: { class: styles.surface ?? '' },

      /**
       * Image dropped on the text: attached to the note AND inserted at the
       * cursor, as described in mockup 2a. A non-image file isn't handled
       * here — it bubbles up to `NoteView`, which attaches it without
       * inserting anything.
       *
       * `editable: false` already blocks insertion on the ProseMirror side,
       * but not this call: it pushes the file to the server before even
       * touching the document, so the guard has to come from here, not the
       * editor.
       */
      handleDrop: (view, event, _slice, moved) => {
        if (!editableRef.current) return false
        // `moved`: a move within the document, not a dropped file.
        if (moved) return false
        const files = imagesFrom(event.dataTransfer?.files)
        if (files.length === 0) return false

        event.preventDefault()
        // NoteView's root also listens for drop: without this, the file
        // would be sent twice.
        event.stopPropagation()

        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        insertUploaded(files, at)
        return true
      },

      /** Ctrl+V of a screenshot: same path as drop. */
      handlePaste: (_view, event) => {
        if (!editableRef.current) return false
        const files = imagesFrom(event.clipboardData?.files)
        if (files.length === 0) return false

        event.preventDefault()
        insertUploaded(files)
        return true
      },

      handleDOMEvents: {
        /**
         * Screen 7a — replaces the native menu with ours. The cursor only
         * jumps to the click point if it falls outside an already-active
         * selection: a right-click inside selected text must be able to
         * cut/copy it, not overwrite it — as any browser would.
         *
         * In read-only mode, we let the browser's native menu show (Copy is
         * enough) rather than ours, which leads to Cut/Paste/Insert an
         * image — none of that makes sense on an archived project.
         */
        contextmenu: (_view, domEvent) => {
          if (!editableRef.current) return false
          const event = domEvent as MouseEvent
          const instance = editorRef.current
          const pos = instance?.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
          if (instance && pos !== undefined) {
            const { from, to } = instance.state.selection
            if (from === to || pos < from || pos > to) instance.commands.setTextSelection(pos)
          }
          event.preventDefault()
          setMenuAnchor({ x: event.clientX, y: event.clientY })
          return true
        },
      },
    },
  })

  editorRef.current = editor

  /**
   * Reload the document when the day changes. `setContent` without this
   * guard would overwrite ongoing typing on every render; the dependency is
   * therefore the document key, not the content.
   */
  useEffect(() => {
    if (!editor) return
    const next = (content.content?.length ? content : EMPTY_DOC) as JSONContent
    editor.commands.setContent(next, { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentKey])

  // `useEditor`'s `editable` only sets the initial state: changing it
  // afterward (the project gets archived while you're looking at it) goes
  // through this call.
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  return (
    <div className={styles.editor}>
      {/* Absent in read-only mode: its commands would run on the editor we
          just made non-editable. */}
      {editable ? <EditorToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      {menuAnchor ? (
        <EditorContextMenu
          editor={editor}
          attachments={attachments}
          anchor={menuAnchor}
          onClose={() => setMenuAnchor(null)}
        />
      ) : null}
    </div>
  )
}
