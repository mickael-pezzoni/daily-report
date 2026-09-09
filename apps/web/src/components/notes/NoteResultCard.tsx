import type { NoteListItem } from '@daily-report/types'
import { type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useDateFormat } from '../../hooks/useDateFormat'
import { extensionLabel, isPreviewableImage } from '../../lib/attachments'
import { todayISO } from '../../lib/dates'
import { useConfirm } from '../ui/ConfirmDialog'
import styles from './NoteResultCard.module.css'

interface NoteResultCardProps {
  note: NoteListItem
  /**
   * The search term: tightens the excerpt around it, highlights it, and
   * surfaces attachments whose name matches. Absent — the mobile calendar
   * list — the excerpt displays as-is.
   */
  query?: string
  /** Current row of the search's ↑ ↓ navigation. */
  selected?: boolean
  onOpen: (date: string) => void
  /** Called **after** confirmation: the card asks the question itself. */
  onDelete: (note: NoteListItem) => void
  onMouseEnter?: () => void
  ref?: Ref<HTMLDivElement>
}

/** What we keep on each side of the found term, in the excerpt. */
const LEAD_CHARS = 40
const TRAIL_CHARS = 90

/** Unaccented and case-insensitive — the client-side equivalent of the server's `f_unaccent`. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
}

/**
 * Like `fold`, but keeping track of which original character each folded
 * character came from.
 *
 * Essential for highlighting: `'é'.normalize('NFD')` makes **two**
 * characters, so an index found in the folded string doesn't point to the
 * same spot in the original string once an accent precedes it. We fold
 * character by character to keep the exact correspondence.
 */
function foldWithMap(value: string): { folded: string; map: number[] } {
  let folded = ''
  const map: number[] = []
  for (let index = 0; index < value.length; index++) {
    for (const char of fold(value[index]!)) {
      folded += char
      map.push(index)
    }
  }
  return { folded, map }
}

/**
 * The excerpt, tightened around the search term and highlighted — the "…the
 * *latency* dropped after the cache…" from mockup 2c.
 *
 * Purely cosmetic, and working on the excerpt **already truncated** by the
 * server: a term found by stemming ("latencies" for "latency") or located
 * further away in the note isn't found there literally. The excerpt then
 * displays as-is, without highlighting, rather than guessing.
 */
function excerptAroundMatch(text: string, query: string): ReactNode {
  const term = query.trim()
  if (!term) return text

  const { folded, map } = foldWithMap(text)
  const needle = fold(term)
  const at = folded.indexOf(needle)
  if (at === -1) return text

  const start = map[at]!
  const foldedEnd = at + needle.length
  const end = foldedEnd < map.length ? map[foldedEnd]! : text.length

  const from = Math.max(0, start - LEAD_CHARS)
  const to = Math.min(text.length, end + TRAIL_CHARS)

  return (
    <>
      {from > 0 ? '…' : ''}
      {text.slice(from, start)}
      <mark className={styles.mark}>{text.slice(start, end)}</mark>
      {text.slice(end, to)}
      {to < text.length ? '…' : ''}
    </>
  )
}

/**
 * A day as a **full-width row**: date, tags, excerpt.
 *
 * This is the result card for screen 2c, and the one for "recent days" in
 * the mobile Calendar tab (2b) — the mockup gives them the same shape. Not
 * to be confused with `WeekDigest` rows (2f/2g), which are simpler — no
 * "delete" button — and borderless.
 *
 * The whole card opens the day: the date button is stretched via `::after`
 * over it, and "delete" sits back above it via `z-index`. A button inside a
 * button doesn't exist — that's what rules out the obvious solution.
 */
export function NoteResultCard({
  note,
  query,
  selected,
  onOpen,
  onDelete,
  onMouseEnter,
  ref,
}: NoteResultCardProps) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const { confirm, dialog } = useConfirm()

  const day = format.dayShort(note.date)
  const fileCount = note.attachments.length
  const term = query?.trim() ?? ''
  const matchingFiles = term
    ? note.attachments.filter((attachment) => fold(attachment.filename).includes(fold(term)))
    : []

  async function handleDelete() {
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
    if (confirmed) onDelete(note)
  }

  return (
    <article
      ref={ref}
      className={`card elev-sm ${styles.card} ${selected ? styles.selected : ''}`}
      onMouseEnter={onMouseEnter}
    >
      <div className={styles.head}>
        <h3 className={styles.date}>
          <button type="button" className={styles.open} onClick={() => onOpen(note.date)}>
            {day}
          </button>
        </h3>
        {note.date === todayISO() ? (
          <span className="tag tag-neutral">{t('search.today')}</span>
        ) : null}
        {fileCount > 0 ? (
          <span className="tag tag-accent-2">{t('attachments.files', { count: fileCount })}</span>
        ) : null}
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.remove}
          onClick={() => void handleDelete()}
          aria-label={t('card.deleteDay', { day })}
        >
          {t('search.delete')}
        </button>
      </div>

      {note.excerpt ? (
        <p className={styles.excerpt}>
          {term ? excerptAroundMatch(note.excerpt, term) : note.excerpt}
        </p>
      ) : null}

      {matchingFiles.map((attachment) => (
        <div key={attachment.id} className={styles.file_match}>
          {isPreviewableImage(attachment.mimeType) ? (
            <img
              src={api.attachments.contentUrl(attachment.id)}
              alt=""
              className={styles.thumb}
              loading="lazy"
            />
          ) : (
            <span className={styles.thumb_fallback}>
              {extensionLabel(attachment.filename) ?? t('attachments.unknownType')}
            </span>
          )}
          <span className={styles.file_name}>{attachment.filename}</span>
        </div>
      ))}

      {dialog}
    </article>
  )
}
