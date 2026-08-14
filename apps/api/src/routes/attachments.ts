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
 * La note appartient-elle bien à cet utilisateur ?
 *
 * Rien d'autre ne garde les pièces jointes : c'est la note qui porte la
 * propriété, et toute route ci-dessous doit passer par là.
 */
async function ownsNote(noteId: string, userId: string): Promise<boolean> {
  const row = await db
    .selectFrom('dailyNotes')
    .select('id')
    .where('id', '=', noteId)
    .where('userId', '=', userId)
    .executeTakeFirst()
  return row !== undefined
}

/** Charge une pièce jointe **et** sa clé de stockage, en vérifiant le propriétaire. */
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

// ── Routes portées par une note : /api/notes/:noteId/attachments ────────────

export const noteAttachments = new Hono<AuthedEnv>()

/** Liste les pièces jointes d'une note. */
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
 * Dépose un ou plusieurs fichiers sur une note.
 *
 * `multipart/form-data`, champ `file` — répétable pour un envoi groupé, ce que
 * le glisser-déposer de plusieurs fichiers produit naturellement.
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
  /** Clés déjà écrites, à nettoyer si une écriture ultérieure échoue. */
  const written: string[] = []

  try {
    for (const file of files) {
      const filename = sanitizeFilename(file.name)
      const mimeType = file.type || 'application/octet-stream'
      const key = buildStorageKey(userId, noteId, filename)

      // Le fichier part au stockage d'abord : une ligne en base sans objet
      // derrière serait un lien mort, alors qu'un objet sans ligne n'est
      // qu'un orphelin silencieux — rattrapable, et invisible de l'utilisateur.
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
    // Envoi groupé interrompu : on retire ce qu'on venait d'écrire plutôt que
    // de laisser des objets sans ligne.
    await Promise.allSettled(written.map((key) => storage.delete(key)))
    throw error
  }

  return c.json(saved, 201)
})

// ── Routes portées par la pièce jointe : /api/attachments/:id ───────────────

export const attachments = new Hono<AuthedEnv>()

/** Métadonnées d'une pièce jointe. */
attachments.get('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const row = await findOwnedAttachment(id, c.get('userId'))
  if (!row) return c.json({ error: 'attachment not found' }, 404)
  return c.json(toAttachment(row))
})

/**
 * Le contenu du fichier.
 *
 * Si le driver sait signer une URL, on redirige : la bande passante ne traverse
 * pas l'API. Sinon on relaie le flux. Le contrôle d'accès a lieu ici dans les
 * deux cas — c'est la seule porte.
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
    // Le type déclaré fait foi : sans ça, un navigateur pourrait renifler le
    // contenu et exécuter en HTML un fichier annoncé autrement.
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=0, must-revalidate',
  })
})

/** Supprime une pièce jointe, ligne et objet. */
attachments.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const row = await findOwnedAttachment(id, c.get('userId'))
  if (!row) return c.json({ error: 'attachment not found' }, 404)

  // La ligne d'abord : elle est la source de vérité. Si la suppression de
  // l'objet échoue derrière, il reste un orphelin — pas un lien mort.
  await db.deleteFrom('attachments').where('id', '=', id).execute()
  await storage.delete(row.storageKey)

  return c.body(null, 204)
})
