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
  /** Bubbles up to the shell to refresh the calendar and "recent days". */
  onNoteSaved: (note: DailyNote) => void
  /**
   * Called **after** confirmation — the shell owns the deletion itself
   * (API call, return to the empty screen, calendar and "recent days"),
   * following the model of `NoteResultCard.onDelete`.
   */
  onNoteDeleted: (note: DailyNote) => void
}

/** Only react to files — not to a moved text selection. */
function carriesFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/** Screen 2a: the open day, its sheet, and its navigation. */
export function NoteView({ date, onNoteSaved, onNoteDeleted }: NoteViewProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { projectId } = useParams<{ projectId: string }>()
  const { project: currentProject } = useCurrentProject()
  const { note, draft, state, errorKey, edit, ensureNoteId } = useNote(date, onNoteSaved)
  const attachments = useAttachments(note?.id ?? null, ensureNoteId)
  const { confirm, dialog: confirmDialog } = useConfirm()

  // An archived project no longer accepts writes — the API refuses (403
  // PROJECT_ARCHIVED), the editor switches to read-only so it doesn't let
  // you type into the void.
  const readOnly = !!currentProject?.archivedAt

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  /**
   * `dragenter` and `dragleave` fire for every child hovered over: relying
   * on the first `dragleave` would make the drawer flicker every time the
   * cursor moves from one element to another. We count the entries instead.
   */
  const dragDepth = useRef(0)

  function handleDragEnter(event: React.DragEvent) {
    if (readOnly || !carriesFiles(event)) return
    dragDepth.current += 1
    if (dragDepth.current === 1) {
      setDragging(true)
      // The requested behavior: hovering a file opens the drawer.
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
    // Without this preventDefault, the `drop` event never fires.
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: React.DragEvent) {
    if (!carriesFiles(event)) return
    // Otherwise the browser replaces the page with the dropped file — even
    // in read-only mode, where drop was never enabled above.
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (readOnly) return

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) void attachments.upload(files)
  }

  /**
   * The 🗑 button in the header (mockup 2a) — absent while the day is blank:
   * nothing exists on the server yet for those days.
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
   * Upload from the editor: the file is attached, then returned to the
   * caller so it can insert it into the document.
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
          {/* Closes the day and returns to the "no note open" screen.
              Whatever's pending a save is flushed on unmount. */}
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
        {/* Absent on a blank day: without a saved note, there's nothing to
            delete server-side. The mockup's `⌕` and "Export ▾" remain
            deliberately unrendered — see CLAUDE.md. */}
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
          {/* We wait for the response before mounting the editor. TipTap
              takes its document at mount time: mounting it on an empty
              draft and letting the content arrive afterward would never
              reach it — unlike the title, which is a controlled field and
              follows the data. */}
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
