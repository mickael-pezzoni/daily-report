import type { Attachment } from '@daily-report/types'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import {
  ATTACHMENT_COLUMNS,
  buildStorageKey,
  contentDisposition,
  sanitizeFilename,
  toAttachment,
} from '../lib/attachments.js'
import { isUuid } from '../lib/validate.js'
import { env } from '../env.js'
import type { AuthedEnv } from '../middleware/require-auth.js'
import { storage } from '../storage/index.js'

/**
 * Does the note actually belong to this user?
 *
 * Nothing else guards attachments: it's the note that carries ownership, and
 * every route below must go through here.
 */
export async function ownsNote(noteId: string, userId: string): Promise<boolean> {
  const row = await db
    .selectFrom('dailyNotes')
    .select('id')
    .where('id', '=', noteId)
    .where('userId', '=', userId)
    .executeTakeFirst()
  return row !== undefined
}

/** Loads an attachment **and** its storage key, checking ownership. */
async function findOwnedAttachment(id: string, userId: string) {
  return db
    .selectFrom('attachments')
    .innerJoin('dailyNotes', 'dailyNotes.id', 'attachments.noteId')
    .select([
      'attachments.id',
      'attachments.noteId',
      'attachments.storageKey',
      'attachments.filename',
      'attachments.mimeType',
      'attachments.sizeBytes',
      'attachments.createdAt',
    ])
    .where('attachments.id', '=', id)
    .where('dailyNotes.userId', '=', userId)
    .executeTakeFirst()
}

// ── Routes carried by a note: /api/notes/:noteId/attachments ────────────────

export const noteAttachments = new Hono<AuthedEnv>()

/** Lists a note's attachments. */
noteAttachments.get('/', async (c) => {
  const noteId = c.req.param('noteId')
  if (!isUuid(noteId)) return c.json({ error: 'invalid note id' }, 400)
  if (!(await ownsNote(noteId, c.get('userId')))) {
    return c.json({ error: 'note not found' }, 404)
  }

  const rows = await db
    .selectFrom('attachments')
    .select(ATTACHMENT_COLUMNS)
    .where('noteId', '=', noteId)
    .orderBy('createdAt', 'asc')
    .execute()

  return c.json(rows.map(toAttachment))
})

/**
 * Uploads one or more files to a note.
 *
 * `multipart/form-data`, `file` field — repeatable for a batch upload, which
 * is what dragging and dropping several files naturally produces.
 */
noteAttachments.post('/', async (c) => {
  const noteId = c.req.param('noteId')
  const userId = c.get('userId')
  if (!isUuid(noteId)) return c.json({ error: 'invalid note id' }, 400)
  if (!(await ownsNote(noteId, userId))) return c.json({ error: 'note not found' }, 404)

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'expected a multipart/form-data body' }, 400)
  }

  const files = form.getAll('file').filter((entry): entry is File => entry instanceof File)
  if (files.length === 0) return c.json({ error: 'no file in the "file" field' }, 400)

  for (const file of files) {
    if (file.size === 0) return c.json({ error: `empty file: ${file.name}` }, 400)
    if (file.size > env.MAX_UPLOAD_BYTES) {
      return c.json(
        {
          error: `file too large: ${file.name}`,
          code: 'FILE_TOO_LARGE',
          maxBytes: env.MAX_UPLOAD_BYTES,
        },
        413,
      )
    }
  }

  const saved: Attachment[] = []
  /** Keys already written, to clean up if a later write fails. */
  const written: string[] = []

  try {
    for (const file of files) {
      const filename = sanitizeFilename(file.name)
      const mimeType = file.type || 'application/octet-stream'
      const key = buildStorageKey(userId, noteId, filename)

      // The file goes to storage first: a database row with no object behind
      // it would be a dead link, whereas an object with no row is just a
      // silent orphan — recoverable, and invisible to the user.
      await storage.put(key, new Uint8Array(await file.arrayBuffer()), { contentType: mimeType })
      written.push(key)

      const row = await db
        .insertInto('attachments')
        .values({ noteId, storageKey: key, filename, mimeType, sizeBytes: file.size })
        .returning(ATTACHMENT_COLUMNS)
        .executeTakeFirstOrThrow()

      saved.push(toAttachment(row))
    }
  } catch (error) {
    // Batch upload interrupted: remove what was just written rather than
    // leave objects with no row.
    await Promise.allSettled(written.map((key) => storage.delete(key)))
    throw error
  }

  return c.json(saved, 201)
})

// ── Routes carried by the attachment: /api/attachments/:id ──────────────────

export const attachments = new Hono<AuthedEnv>()

/** Metadata of an attachment. */
attachments.get('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const row = await findOwnedAttachment(id, c.get('userId'))
  if (!row) return c.json({ error: 'attachment not found' }, 404)
  return c.json(toAttachment(row))
})

/**
 * The file's content.
 *
 * If the driver knows how to sign a URL, we redirect: bandwidth doesn't
 * flow through the API. Otherwise we relay the stream. Access control
 * happens here in both cases — it's the only gate.
 */
attachments.get('/:id/content', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const row = await findOwnedAttachment(id, c.get('userId'))
  if (!row) return c.json({ error: 'attachment not found' }, 404)

  if (storage.getSignedUrl) {
    const url = await storage.getSignedUrl(row.storageKey, {
      expiresInSeconds: env.SIGNED_URL_TTL_SECONDS,
      filename: row.filename,
      contentType: row.mimeType,
    })
    return c.redirect(url, 302)
  }

  const stream = await storage.get(row.storageKey)
  return c.body(stream, 200, {
    'Content-Type': row.mimeType,
    'Content-Length': row.sizeBytes,
    'Content-Disposition': contentDisposition(row.filename, row.mimeType),
    // The declared type is authoritative: without this, a browser could
    // sniff the content and execute as HTML a file announced as something else.
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=0, must-revalidate',
  })
})

/** Deletes an attachment, row and object. */
attachments.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const row = await findOwnedAttachment(id, c.get('userId'))
  if (!row) return c.json({ error: 'attachment not found' }, 404)

  // The row first: it's the source of truth. If deleting the object fails
  // afterward, we're left with an orphan — not a dead link.
  await db.deleteFrom('attachments').where('id', '=', id).execute()
  await storage.delete(row.storageKey)

  return c.body(null, 204)
})
