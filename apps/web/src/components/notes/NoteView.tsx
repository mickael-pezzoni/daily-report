import type { DailyNote } from '@daily-report/types'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { api } from '../../api/client'
import { useAttachments } from '../../hooks/useAttachments'
import { useCurrentProject } from '../../hooks/useCurrentProject'
import { useDateFormat } from '../../hooks/useDateFormat'
import { useNote } from '../../hooks/useNote'
import { AttachmentBar } from '../attachments/AttachmentBar'
import { UserMenu } from '../auth/UserMenu'
import { useConfirm } from '../ui/ConfirmDialog'
import { DayNav } from './DayNav'
import { NoteEditor } from './NoteEditor'
import { SaveStatus } from './SaveStatus'
import styles from './NoteView.module.css'

interface NoteViewProps {
  date: string
  /** Remonte à la coquille pour rafraîchir calendrier et « derniers jours ». */
  onNoteSaved: (note: DailyNote) => void
  /**
   * Appelé **après** confirmation — la coquille possède la suppression elle-même
   * (appel API, retour à l'écran vide, calendrier et « derniers jours »), sur le
   * modèle de `NoteResultCard.onDelete`.
   */
  onNoteDeleted: (note: DailyNote) => void
}

/** Ne réagir qu'aux fichiers — pas à une sélection de texte déplacée. */
function carriesFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/** L'écran 2a : la journée ouverte, sa feuille et sa navigation. */
export function NoteView({ date, onNoteSaved, onNoteDeleted }: NoteViewProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { projectId } = useParams<{ projectId: string }>()
  const { project: currentProject } = useCurrentProject()
  const { note, draft, state, errorKey, edit, ensureNoteId } = useNote(date, onNoteSaved)
  const attachments = useAttachments(note?.id ?? null, ensureNoteId)
  const { confirm, dialog: confirmDialog } = useConfirm()

  // Un projet archivé n'accepte plus d'écriture — l'API le refuse (403
  // PROJECT_ARCHIVED), l'éditeur se met en lecture seule pour ne pas laisser
  // taper dans le vide.
  const readOnly = !!currentProject?.archivedAt

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  /**
   * `dragenter` et `dragleave` se déclenchent pour chaque enfant survolé : se
   * fier au premier `dragleave` ferait clignoter le tiroir dès que le curseur
   * passe d'un élément à l'autre. On compte les entrées.
   */
  const dragDepth = useRef(0)

  function handleDragEnter(event: React.DragEvent) {
    if (readOnly || !carriesFiles(event)) return
    dragDepth.current += 1
    if (dragDepth.current === 1) {
      setDragging(true)
      // Le geste demandé : survoler un fichier ouvre le tiroir.
      setDrawerOpen(true)
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    if (readOnly || !carriesFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  function handleDragOver(event: React.DragEvent) {
    if (readOnly || !carriesFiles(event)) return
    // Sans ce preventDefault, l'événement `drop` n'arrive jamais.
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: React.DragEvent) {
    if (!carriesFiles(event)) return
    // Sinon le navigateur remplace la page par le fichier lâché — y compris
    // en lecture seule, où le dépôt n'a jamais été activé plus haut.
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (readOnly) return

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) void attachments.upload(files)
  }

  /**
   * Le bouton 🗑 de l'en-tête (maquette 2a) — absent tant que le jour est
   * vierge : rien n'existe encore côté serveur pour ces jours-là.
   */
  async function handleDelete() {
    if (!note) return
    const day = format.dayShort(date)
    const fileCount = attachments.items.length
    const confirmed = await confirm({
      title: t('card.confirmDelete.title', { day }),
      body:
        fileCount > 0
          ? t('card.confirmDelete.bodyWithFiles', {
              files: t('attachments.files', { count: fileCount }),
            })
          : t('card.confirmDelete.body'),
      confirmLabel: t('card.confirmDelete.confirm'),
      tone: 'danger',
    })
    if (confirmed) onNoteDeleted(note)
  }

  /**
   * Envoi depuis l'éditeur : le fichier est joint, puis rendu à l'appelant pour
   * qu'il l'insère dans le document.
   */
  const uploadFromEditor = useCallback(
    async (files: File[]) => {
      const created = await attachments.upload(files)
      setDrawerOpen(true)
      return created.map((item) => ({
        src: api.attachments.contentUrl(item.id),
        alt: item.filename,
      }))
    },
    [attachments],
  )

  return (
    <div
      className={styles.view}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className={styles.header}>
        <span className={styles.date_pill}>
          {format.dayLong(date)}
          {/* Referme la journée et ramène à l'écran « aucune note ouverte ».
              Ce qui est en attente d'enregistrement part au démontage. */}
          <Link to={`/projets/${projectId}`} className={styles.close} title={t('note.close')} aria-label={t('note.close')}>
            ✕
          </Link>
        </span>
        {readOnly ? (
          <span className="tag tag-neutral">{t('note.archivedReadOnly')}</span>
        ) : (
          <SaveStatus state={state} errorKey={errorKey} />
        )}
        <span className={styles.spacer} />
        {/* Absent sur un jour vierge : sans note enregistrée, il n'y a rien à
            supprimer côté serveur. `⌕` et « Exporter ▾ » de la maquette
            restent volontairement non rendus — voir CLAUDE.md. */}
        {note ? (
          <button
            type="button"
            className={`btn btn-secondary ${styles.delete}`}
            onClick={() => void handleDelete()}
            title={t('note.delete')}
            aria-label={t('card.deleteDay', { day: format.dayShort(date) })}
          >
            🗑
          </button>
        ) : null}
        <UserMenu />
      </header>
      {confirmDialog}

      <div className={`${styles.desk} ${dragging ? styles.desk_dragging : ''}`}>
        <article className={styles.paper}>
          {/* On attend la réponse avant de monter l'éditeur. TipTap prend son
              document au montage : le monter sur un brouillon vide puis laisser
              arriver le contenu ne l'atteindrait jamais — contrairement au
              titre, qui est un champ contrôlé et suit la donnée. */}
          {state === 'loading' ? (
            <p className={styles.loading}>{t('app.loading')}</p>
          ) : (
            <>
              <input
                className={styles.title}
                value={draft.title}
                onChange={(event) => edit({ title: event.target.value })}
                placeholder={t('note.titlePlaceholder')}
                aria-label={t('note.titleLabel')}
                disabled={readOnly}
              />
              <NoteEditor
                documentKey={date}
                content={draft.content}
                onChange={(content) => edit({ content })}
                onUploadImages={uploadFromEditor}
                attachments={attachments.items}
                editable={!readOnly}
              />
            </>
          )}
        </article>
      </div>

      <DayNav date={date} projectId={projectId} />

      <AttachmentBar
        items={attachments.items}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((open) => !open)}
        uploading={attachments.uploading}
        errorKey={attachments.errorKey}
        onUpload={(files) => void attachments.upload(files)}
        onRemove={(id) => void attachments.remove(id)}
        dragging={dragging}
        readOnly={readOnly}
      />
    </div>
  )
}
