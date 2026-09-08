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

/** Ce que rend un envoi d'image : de quoi l'insérer dans le document. */
export interface UploadedImage {
  src: string
  alt: string
}

interface NoteEditorProps {
  /** Clé du document chargé — la date. Un changement recharge l'éditeur. */
  documentKey: string
  content: RichTextDoc
  onChange: (content: RichTextDoc) => void
  /** Joint les fichiers à la note et renvoie les images à insérer. */
  onUploadImages: (files: File[]) => Promise<UploadedImage[]>
  /** Pièces jointes déjà envoyées à la note — pour le menu contextuel (écran 7a). */
  attachments: Attachment[]
  /** Projet archivé : lecture seule — ni frappe, ni collage, ni dépôt d'image. */
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

  // Les handlers de ProseMirror sont capturés à la création de l'éditeur. Ils
  // passent donc par des refs, sinon ils figeraient les closures du premier
  // rendu — et l'instance n'existe pas encore quand on les déclare.
  const editorRef = useRef<Editor | null>(null)
  const uploadRef = useRef(onUploadImages)
  // Lu dans `handleDrop`/`handlePaste`/le clic droit, capturés eux aussi à la
  // création de l'éditeur : `editor.isEditable` ne suffirait pas à lui seul,
  // ces handlers appellent des commandes directement, en dehors du chemin que
  // l'attribut `contenteditable` du DOM bloque de lui-même.
  const editableRef = useRef(editable)
  // Position du clic droit, en coordonnées écran — `null` menu fermé. Le menu
  // lui-même n'a pas besoin de ref : il se referme via son propre effet.
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  // Même raison pour la traduction : le texte fantôme est lu à chaque calcul
  // des décorations, pas figé à la création de l'éditeur, ce qui lui permet de
  // suivre un changement de langue sans qu'on remonte l'instance.
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
   * Envoie les images puis les insère.
   *
   * ProseMirror attend une réponse synchrone alors que l'envoi ne l'est pas :
   * on lui dit « c'est pris en charge » tout de suite, et l'insertion arrive
   * quand le serveur a répondu.
   */
  function insertUploaded(files: File[], at?: number) {
    void uploadRef.current(files).then((images) => {
      const editor = editorRef.current
      if (!editor || images.length === 0) return

      const chain = editor.chain().focus()
      // `at` seulement au dépôt : au collage, la position courante fait foi.
      if (at !== undefined) chain.setTextSelection(at)
      for (const image of images) chain.setImage({ src: image.src, alt: image.alt })
      chain.run()
    })
  }

  const editor = useEditor({
    extensions: [
      // v3 : Link et Underline sont désormais dans StarterKit.
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
       * Image lâchée sur le texte : jointe à la note ET insérée au curseur,
       * comme le décrit la maquette 2a. Un fichier non-image n'est pas traité
       * ici — il remonte à `NoteView`, qui le joint sans rien insérer.
       *
       * `editable: false` bloque déjà l'insertion côté ProseMirror, mais pas
       * cet appel-ci : il pousse le fichier au serveur avant même de toucher
       * au document, donc le garde-fou doit venir d'ici, pas de l'éditeur.
       */
      handleDrop: (view, event, _slice, moved) => {
        if (!editableRef.current) return false
        // `moved` : déplacement interne au document, pas un fichier déposé.
        if (moved) return false
        const files = imagesFrom(event.dataTransfer?.files)
        if (files.length === 0) return false

        event.preventDefault()
        // La racine de NoteView écoute aussi le dépôt : sans ça, le fichier
        // partirait deux fois.
        event.stopPropagation()

        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        insertUploaded(files, at)
        return true
      },

      /** Ctrl+V d'une capture d'écran : même chemin que le dépôt. */
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
         * Écran 7a — remplace le menu natif par le nôtre. Le curseur ne saute
         * au point du clic que s'il tombe hors d'une sélection déjà active :
         * un clic droit à l'intérieur d'un texte sélectionné doit pouvoir le
         * couper/copier, pas l'écraser — comme le ferait tout navigateur.
         *
         * En lecture seule, on laisse le menu natif du navigateur s'afficher
         * (Copier suffit) plutôt que le nôtre, qui mène à Couper/Coller/Insérer
         * une image — rien de tout ça n'a de sens sur un projet archivé.
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

  // `editable` de `useEditor` ne pose que l'état initial : le faire varier
  // ensuite (le projet s'archive pendant qu'on regarde) passe par cet appel.
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  return (
    <div className={styles.editor}>
      {/* Absente en lecture seule : ses commandes s'exécuteraient sur
          l'éditeur qu'on vient justement de rendre non éditable. */}
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
