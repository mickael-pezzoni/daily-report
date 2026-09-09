import type { Attachment } from '@daily-report/types'
import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'

/**
 * The columns that suffice to build an `Attachment`. Shared by the
 * attachment routes and by the note list, which embeds them.
 */
export const ATTACHMENT_COLUMNS = [
  'id',
  'noteId',
  'filename',
  'mimeType',
  'sizeBytes',
  'createdAt',
] as const

export interface AttachmentRow {
  id: string
  noteId: string
  filename: string
  mimeType: string
  sizeBytes: string
  createdAt: Date
}

export function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    noteId: row.noteId,
    filename: row.filename,
    mimeType: row.mimeType,
    // BIGINT arrives as a string from `pg`; sizes stay well under
    // Number.MAX_SAFE_INTEGER.
    size: Number(row.sizeBytes),
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Types served **inline** in the browser. Everything else comes back as a
 * downloadable attachment.
 *
 * This is a security measure, not a convenience: serving a third-party
 * `.html` or `.svg` with `inline` would execute its script in the
 * application's origin. The list therefore only contains inert formats —
 * and not `image/svg+xml`, which isn't one.
 */
const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
])

export function isInlineType(mimeType: string): boolean {
  return INLINE_TYPES.has(mimeType)
}

/**
 * Builds a file's storage key.
 *
 * The original name never enters it: it's kept in the database and returned
 * on download. The key itself is a UUID — no collision between two
 * `capture.png` files, no hostile character to escape, and nothing to guess
 * for anyone listing a bucket. Only the extension is carried over, filtered,
 * so the directory stays readable in operations.
 */
export function buildStorageKey(userId: string, noteId: string, filename: string): string {
  const raw = extname(filename).toLowerCase()
  const extension = /^\.[a-z0-9]{1,12}$/.test(raw) ? raw : ''
  return `${userId}/${noteId}/${randomUUID()}${extension}`
}

/**
 * `Content-Disposition` header.
 *
 * Two forms of the name: one folded to ASCII for older clients, and the
 * encoded UTF-8 version (RFC 5987) that current browsers understand —
 * without which "réunion-équipe.pdf" would arrive mangled.
 */
export function contentDisposition(filename: string, mimeType: string): string {
  const disposition = isInlineType(mimeType) ? 'inline' : 'attachment'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/** A clean filename to store in the database: no path, no control character. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return clean.slice(0, 255) || 'fichier'
}
