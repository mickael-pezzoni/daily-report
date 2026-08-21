import type { DailyNote } from '@daily-report/types'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../../api/client'
import { useAttachments } from '../../hooks/useAttachments'
import { useDateFormat } from '../../hooks/useDateFormat'
import { useNote } from '../../hooks/useNote'
import { AttachmentBar } from '../attachments/AttachmentBar'
import { UserMenu } from '../auth/UserMenu'
import { DayNav } from './DayNav'
import { NoteEditor } from './NoteEditor'
import { SaveStatus } from './SaveStatus'
import styles from './NoteView.module.css'

interface NoteViewProps {
  date: string
  /** Remonte à la coquille pour rafraîchir calendrier et « derniers jours ». */
  onNoteSaved: (note: DailyNote) => void
}

/** Ne réagir qu'aux fichiers — pas à une sélection de texte déplacée. */
function carriesFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/** L'écran 2a : la journée ouverte, sa feuille et sa navigation. */
export function NoteView({ date, onNoteSaved }: NoteViewProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { note, draft, state, errorKey, edit, ensureNoteId } = useNote(date, onNoteSaved)
  const attachments = useAttachments(note?.id ?? null, ensureNoteId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  /**
   * `dragenter` et `dragleave` se déclenchent pour chaque enfant survolé : se
   * fier au premier `dragleave` ferait clignoter le tiroir dès que le curseur
   * passe d'un élément à l'autre. On compte les entrées.
   */
  const dragDepth = useRef(0)

  function handleDragEnter(event: React.DragEvent) {
    if (!carriesFiles(event)) return
    dragDepth.current += 1
    if (dragDepth.current === 1) {
      setDragging(true)
      // Le geste demandé : survoler un fichier ouvre le tiroir.
      setDrawerOpen(true)
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!carriesFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  function handleDragOver(event: React.DragEvent) {
    if (!carriesFiles(event)) return
    // Sans ce preventDefault, l'événement `drop` n'arrive jamais.
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: React.DragEvent) {
    if (!carriesFiles(event)) return
    // Sinon le navigateur remplace la page par le fichier lâché.
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) void attachments.upload(files)
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
          <Link to="/" className={styles.close} title={t('note.close')} aria-label={t('note.close')}>
            ✕
          </Link>
        </span>
        <SaveStatus state={state} errorKey={errorKey} />
        <span className={styles.spacer} />
        <UserMenu />
      </header>

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
              />
              <NoteEditor
                documentKey={date}
                content={draft.content}
                onChange={(content) => edit({ content })}
                onUploadImages={uploadFromEditor}
                attachments={attachments.items}
              />
            </>
          )}
        </article>
      </div>

      <DayNav date={date} />

      <AttachmentBar
        items={attachments.items}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((open) => !open)}
        uploading={attachments.uploading}
        errorKey={attachments.errorKey}
        onUpload={(files) => void attachments.upload(files)}
        onRemove={(id) => void attachments.remove(id)}
        dragging={dragging}
      />
    </div>
  )
}
