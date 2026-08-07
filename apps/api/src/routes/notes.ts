import type { DailyNote } from '@daily-report/types'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { excerptOf, flattenRichText } from '../lib/rich-text.js'
import { isRichTextDoc, isUuid, isValidDate } from '../lib/validate.js'
import type { AuthedEnv } from '../middleware/require-auth.js'
import { storage } from '../storage/index.js'

const notes = new Hono<AuthedEnv>()

/** Code d'erreur Postgres pour une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505'

const COLUMNS = ['id', 'noteDate', 'title', 'content', 'contentText', 'updatedAt'] as const

interface NoteRow {
  id: string
  noteDate: string
  title: string
  content: DailyNote['content']
  contentText: string
  updatedAt: Date
}

function toDailyNote(row: NoteRow): DailyNote {
  return {
    id: row.id,
    date: row.noteDate,
    title: row.title,
    content: row.content,
    excerpt: excerptOf(row.contentText),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * `GET /api/notes?date=YYYY-MM-DD` — la note de ce jour, tableau vide si vierge.
 * `GET /api/notes?limit=3`        — les dernières notes, date décroissante.
 */
notes.get('/', async (c) => {
  const userId = c.get('userId')
  const date = c.req.query('date')
  const limitParam = c.req.query('limit')

  let query = db.selectFrom('dailyNotes').select(COLUMNS).where('userId', '=', userId)

  if (date !== undefined) {
    if (!isValidDate(date)) return c.json({ error: 'date invalide, attendu YYYY-MM-DD' }, 400)
    query = query.where('noteDate', '=', date)
  }

  const limit = limitParam === undefined ? 50 : Number(limitParam)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return c.json({ error: 'limit invalide, attendu un entier entre 1 et 100' }, 400)
  }

  const rows = await query.orderBy('noteDate', 'desc').limit(limit).execute()
  return c.json(rows.map(toDailyNote))
})

/** `POST /api/notes` — crée la note d'un jour. `409` si ce jour en a déjà une. */
notes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)

  if (!body || !isValidDate(body.date)) {
    return c.json({ error: 'date invalide, attendu YYYY-MM-DD' }, 400)
  }
  if (!isRichTextDoc(body.content)) {
    return c.json({ error: 'content invalide, attendu un document TipTap' }, 400)
  }
  const title = typeof body.title === 'string' ? body.title : ''
  const contentText = flattenRichText(body.content)

  try {
    const row = await db
      .insertInto('dailyNotes')
      .values({ userId, noteDate: body.date, title, content: body.content, contentText })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow()

    const note = toDailyNote(row)
    c.header('Location', `/api/notes/${note.id}`)
    return c.json(note, 201)
  } catch (error) {
    // On laisse la contrainte UNIQUE (user_id, note_date) trancher plutôt que
    // de faire un SELECT préalable, qui laisserait une fenêtre de concurrence.
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return c.json({ error: 'une note existe déjà pour ce jour', code: 'NOTE_EXISTS' }, 409)
    }
    throw error
  }
})

/** `GET /api/notes/:id` */
notes.get('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'identifiant invalide' }, 400)

  const row = await db
    .selectFrom('dailyNotes')
    .select(COLUMNS)
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .executeTakeFirst()

  // 404 et non 403 : la note d'autrui n'existe pas de notre point de vue.
  if (!row) return c.json({ error: 'note introuvable' }, 404)
  return c.json(toDailyNote(row))
})

/** `PATCH /api/notes/:id` — modification partielle. */
notes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'identifiant invalide' }, 400)

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'corps de requête invalide' }, 400)

  const patch: { title?: string; content?: DailyNote['content']; contentText?: string } = {}

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') return c.json({ error: 'title invalide' }, 400)
    patch.title = body.title
  }
  if (body.content !== undefined) {
    if (!isRichTextDoc(body.content)) {
      return c.json({ error: 'content invalide, attendu un document TipTap' }, 400)
    }
    patch.content = body.content
    patch.contentText = flattenRichText(body.content)
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'rien à modifier' }, 400)
  }

  const row = await db
    .updateTable('dailyNotes')
    .set({ ...patch, updatedAt: new Date() })
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .returning(COLUMNS)
    .executeTakeFirst()

  if (!row) return c.json({ error: 'note introuvable' }, 404)
  return c.json(toDailyNote(row))
})

/** `DELETE /api/notes/:id` — emporte les pièces jointes avec la note. */
notes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'identifiant invalide' }, 400)

  // Relever les clés AVANT la suppression : le `ON DELETE CASCADE` emporte les
  // lignes `attachments`, et avec elles la seule trace des objets stockés. Sans
  // ça, chaque note supprimée laisserait des fichiers orphelins que plus rien
  // ne référence — donc impossibles à retrouver.
  const keys = await db
    .selectFrom('attachments')
    .select('storageKey')
    .where('noteId', '=', id)
    .execute()

  const result = await db
    .deleteFrom('dailyNotes')
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .executeTakeFirst()

  if (result.numDeletedRows === 0n) return c.json({ error: 'note introuvable' }, 404)

  // Après la base : un objet qui survit est du déchet silencieux, une ligne qui
  // survit serait un lien mort. On préfère le premier.
  await Promise.allSettled(keys.map((row) => storage.delete(row.storageKey)))

  return c.body(null, 204)
})

export default notes
