import { SEARCH_SCOPES, type Attachment, type DailyNote, type NoteListItem } from '@daily-report/types'
import { Hono } from 'hono'
import { sql } from 'kysely'
import { db } from '../db/index.js'
import { ATTACHMENT_COLUMNS, toAttachment } from '../lib/attachments.js'
import { checkProjectAccess } from '../lib/projects.js'
import { excerptOf, flattenRichText } from '../lib/rich-text.js'
import { isRichTextDoc, isSearchScope, isUuid, isValidDate } from '../lib/validate.js'
import type { AuthedEnv } from '../middleware/require-auth.js'
import { storage } from '../storage/index.js'

const notes = new Hono<AuthedEnv>()

/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * A `LIKE` fragment wrapped in wildcards, with the user's text escaped.
 *
 * Without this escaping, a `%` typed into the search would match everything
 * and a `_` would match any character: what we're searching for is text, not
 * a pattern.
 */
function likeFragment(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

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
 * The attachments of several notes, grouped by note.
 *
 * A single query for the whole page: one per note would be an N+1 whose cost
 * would climb with the requested limit.
 */
async function attachmentsByNote(noteIds: string[]): Promise<Map<string, Attachment[]>> {
  const grouped = new Map<string, Attachment[]>()
  if (noteIds.length === 0) return grouped

  const rows = await db
    .selectFrom('attachments')
    .select(ATTACHMENT_COLUMNS)
    .where('noteId', 'in', noteIds)
    .orderBy('createdAt', 'asc')
    .execute()

  for (const row of rows) {
    const list = grouped.get(row.noteId)
    if (list) list.push(toAttachment(row))
    else grouped.set(row.noteId, [toAttachment(row)])
  }
  return grouped
}

/**
 * `GET /api/notes?date=YYYY-MM-DD` — the note for that day, empty array if
 *                                    blank.
 * `GET /api/notes?limit=3`        — the latest notes, descending date.
 * `GET /api/notes?q=…`            — full-text search (title, content,
 *                                    attachment names), sorted by relevance.
 * `GET /api/notes?q=…&scope=text` — searches only the text, or only the
 *                                    filenames with `files`. Default: `all`.
 * `GET /api/notes?from=YYYY-MM-DD` — lower bound on the date, stackable with
 *                                    the rest (this is the "this year" filter).
 * `GET /api/notes?to=YYYY-MM-DD`   — inclusive upper bound, stackable with
 *                                    `from` (this is the week digest of
 *                                    screens 2f/2g).
 * `GET /api/notes?projectId=…`     — restricted to a project; stackable with
 *                                    everything else except `q`, which
 *                                    searches every project on the account
 *                                    (global search).
 *
 * Each item embeds its attachments: the cards on the "no note open" screen
 * display them, and the `GET /api/notes/:id` detail isn't the path they go
 * through.
 */
notes.get('/', async (c) => {
  const userId = c.get('userId')
  const date = c.req.query('date')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const projectId = c.req.query('projectId')
  const limitParam = c.req.query('limit')
  const qParam = c.req.query('q')
  const scope = c.req.query('scope') ?? 'all'

  let query = db.selectFrom('dailyNotes').select(COLUMNS).where('userId', '=', userId)

  if (projectId !== undefined) {
    if (!isUuid(projectId)) return c.json({ error: 'invalid projectId' }, 400)
    query = query.where('projectId', '=', projectId)
  }

  if (date !== undefined) {
    if (!isValidDate(date)) return c.json({ error: 'invalid date, expected YYYY-MM-DD' }, 400)
    query = query.where('noteDate', '=', date)
  }

  if (from !== undefined) {
    if (!isValidDate(from)) return c.json({ error: 'invalid from, expected YYYY-MM-DD' }, 400)
    query = query.where('noteDate', '>=', from)
  }

  if (to !== undefined) {
    if (!isValidDate(to)) return c.json({ error: 'invalid to, expected YYYY-MM-DD' }, 400)
    query = query.where('noteDate', '<=', to)
  }

  const q = qParam?.trim()
  if (qParam !== undefined) {
    if (!q) return c.json({ error: 'invalid q, expected a non-empty string' }, 400)
    if (!isSearchScope(scope)) {
      return c.json({ error: `invalid scope, expected one of ${SEARCH_SCOPES.join(', ')}` }, 400)
    }

    // Title/content via the generated `search_vector` column (language fixed
    // per account at creation, see migration 004).
    //
    // The filename, on the other hand, is searched with `ILIKE` and **not**
    // with the `%` similarity operator: the latter compares both strings in
    // their *entirety*, so a short term buried in a long name falls under
    // the threshold and never surfaces ("ecran" against "Capture
    // d'ecran_20260701_203406.png" only scores 0.18). The `gin_trgm_ops`
    // index from migration 004 speeds up both cases; it's indeed an `ILIKE`
    // it serves here.
    const matchesText = sql<boolean>`search_vector @@ websearch_to_tsquery(search_language, ${q})`
    const noteIdsWithMatchingFile = db
      .selectFrom('attachments')
      .select('noteId')
      .where(sql<boolean>`f_unaccent(filename) ILIKE f_unaccent(${likeFragment(q)})`)

    query = query.where((eb) => {
      const matchesFilename = eb('id', 'in', noteIdsWithMatchingFile)
      if (scope === 'text') return matchesText
      if (scope === 'files') return matchesFilename
      return eb.or([matchesText, matchesFilename])
    })
  }

  const limit = limitParam === undefined ? 50 : Number(limitParam)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return c.json({ error: 'invalid limit, expected an integer between 1 and 100' }, 400)
  }

  // By relevance if `q` is provided — a note that only matches through an
  // attachment has a rank of 0 and falls back to the end of the list, sorted
  // by date.
  const rows = await (q
    ? query
        .orderBy(sql<number>`ts_rank(search_vector, websearch_to_tsquery(search_language, ${q}))`, 'desc')
        .orderBy('noteDate', 'desc')
    : query.orderBy('noteDate', 'desc')
  )
    .limit(limit)
    .execute()
  const grouped = await attachmentsByNote(rows.map((row) => row.id))

  const items: NoteListItem[] = rows.map((row) => ({
    ...toDailyNote(row),
    attachments: grouped.get(row.id) ?? [],
  }))
  return c.json(items)
})

/**
 * `POST /api/notes` — creates the note for a day, in the given project.
 * `409` if that project already has a note for that day, `404` if
 * `projectId` doesn't belong to the account (a resource belonging to someone
 * else doesn't exist from our point of view), `403` if it's archived — an
 * archived project no longer accepts new notes.
 */
notes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)

  if (!body || !isValidDate(body.date)) {
    return c.json({ error: 'invalid date, expected YYYY-MM-DD' }, 400)
  }
  if (!isUuid(body.projectId)) {
    return c.json({ error: 'invalid projectId' }, 400)
  }
  if (!isRichTextDoc(body.content)) {
    return c.json({ error: 'invalid content, expected a TipTap document' }, 400)
  }
  const title = typeof body.title === 'string' ? body.title : ''
  const contentText = flattenRichText(body.content)

  const access = await checkProjectAccess(userId, body.projectId)
  if (access === 'not_found') return c.json({ error: 'project not found' }, 404)
  if (access === 'archived') {
    return c.json({ error: 'project is archived', code: 'PROJECT_ARCHIVED' }, 403)
  }

  try {
    const row = await db
      .insertInto('dailyNotes')
      .values({
        userId,
        projectId: body.projectId,
        noteDate: body.date,
        title,
        content: body.content,
        contentText,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow()

    const note = toDailyNote(row)
    c.header('Location', `/api/notes/${note.id}`)
    return c.json(note, 201)
  } catch (error) {
    // We let the UNIQUE (project_id, note_date) constraint decide rather
    // than doing a prior SELECT, which would leave a race window.
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return c.json({ error: 'a note already exists for this day', code: 'NOTE_EXISTS' }, 409)
    }
    throw error
  }
})

/** `GET /api/notes/:id` */
notes.get('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const row = await db
    .selectFrom('dailyNotes')
    .select(COLUMNS)
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .executeTakeFirst()

  // 404, not 403: someone else's note doesn't exist from our point of view.
  if (!row) return c.json({ error: 'note not found' }, 404)
  return c.json(toDailyNote(row))
})

/**
 * `PATCH /api/notes/:id` — partial update. `403` if the note's project is
 * archived — beyond the 404 for ownership, yet another, different check:
 * the note does exist, it's the write that's refused.
 */
notes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'invalid request body' }, 400)

  const patch: { title?: string; content?: DailyNote['content']; contentText?: string } = {}

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') return c.json({ error: 'invalid title' }, 400)
    patch.title = body.title
  }
  if (body.content !== undefined) {
    if (!isRichTextDoc(body.content)) {
      return c.json({ error: 'invalid content, expected a TipTap document' }, 400)
    }
    patch.content = body.content
    patch.contentText = flattenRichText(body.content)
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'nothing to update' }, 400)
  }

  const noteProject = await db
    .selectFrom('dailyNotes')
    .innerJoin('projects', 'projects.id', 'dailyNotes.projectId')
    .select('projects.archivedAt as archivedAt')
    .where('dailyNotes.id', '=', id)
    .where('dailyNotes.userId', '=', c.get('userId'))
    .executeTakeFirst()

  if (!noteProject) return c.json({ error: 'note not found' }, 404)
  if (noteProject.archivedAt) {
    return c.json({ error: 'project is archived', code: 'PROJECT_ARCHIVED' }, 403)
  }

  const row = await db
    .updateTable('dailyNotes')
    .set({ ...patch, updatedAt: new Date() })
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .returning(COLUMNS)
    .executeTakeFirstOrThrow()

  return c.json(toDailyNote(row))
})

/** `DELETE /api/notes/:id` — takes the attachments down with the note. */
notes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  // Collect the keys BEFORE deleting: the `ON DELETE CASCADE` takes the
  // `attachments` rows with it, and with them the only trace of the stored
  // objects. Without this, every deleted note would leave behind orphan
  // files that nothing references anymore — hence impossible to find.
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

  if (result.numDeletedRows === 0n) return c.json({ error: 'note not found' }, 404)

  // After the database: an object that survives is silent waste, a row that
  // survives would be a dead link. We prefer the former.
  await Promise.allSettled(keys.map((row) => storage.delete(row.storageKey)))

  return c.body(null, 204)
})

export default notes
