import { SEARCH_SCOPES, type Attachment, type DailyNote, type NoteListItem } from '@daily-report/types'
import { Hono } from 'hono'
import { sql } from 'kysely'
import { db } from '../db/index.js'
import { ATTACHMENT_COLUMNS, toAttachment } from '../lib/attachments.js'
import { excerptOf, flattenRichText } from '../lib/rich-text.js'
import { isRichTextDoc, isSearchScope, isUuid, isValidDate } from '../lib/validate.js'
import type { AuthedEnv } from '../middleware/require-auth.js'
import { storage } from '../storage/index.js'

const notes = new Hono<AuthedEnv>()

/** Code d'erreur Postgres pour une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505'

/**
 * Un fragment `LIKE` encadré de jokers, le texte de l'utilisateur échappé.
 *
 * Sans cet échappement, un `%` tapé dans la recherche ferait tout sortir et un
 * `_` matcherait n'importe quel caractère : ce qu'on cherche est du texte, pas
 * un motif.
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
 * Les pièces jointes de plusieurs notes, groupées par note.
 *
 * Une seule requête pour toute la page : une par note ferait un N+1 dont le
 * coût grimperait avec la limite demandée.
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
 * `GET /api/notes?date=YYYY-MM-DD` — la note de ce jour, tableau vide si vierge.
 * `GET /api/notes?limit=3`        — les dernières notes, date décroissante.
 * `GET /api/notes?q=…`            — recherche plein texte (titre, contenu, noms
 *                                    de pièces jointes), triée par pertinence.
 * `GET /api/notes?q=…&scope=text` — ne fouille que le texte, ou que les noms de
 *                                    fichiers avec `files`. Défaut : `all`.
 * `GET /api/notes?from=YYYY-MM-DD` — borne basse sur la date, cumulable avec le
 *                                    reste (c'est le filtre « cette année »).
 * `GET /api/notes?to=YYYY-MM-DD`   — borne haute incluse, cumulable avec
 *                                    `from` (c'est le condensé de semaine des
 *                                    écrans 2f/2g).
 *
 * Chaque élément embarque ses pièces jointes : les cartes de l'écran « aucune
 * note ouverte » les affichent, et le détail `GET /api/notes/:id` n'est pas le
 * chemin qu'elles empruntent.
 */
notes.get('/', async (c) => {
  const userId = c.get('userId')
  const date = c.req.query('date')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const limitParam = c.req.query('limit')
  const qParam = c.req.query('q')
  const scope = c.req.query('scope') ?? 'all'

  let query = db.selectFrom('dailyNotes').select(COLUMNS).where('userId', '=', userId)

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

    // Titre/contenu via la colonne générée `search_vector` (langue figée par
    // compte à la création, cf. migration 004).
    //
    // Le nom de fichier, lui, se cherche en `ILIKE` et **non** avec l'opérateur
    // de similarité `%` : celui-ci compare les deux chaînes *entières*, si bien
    // qu'un terme court noyé dans un nom long passe sous le seuil et ne sort
    // jamais (« ecran » contre « Capture d'ecran_20260701_203406.png » ne vaut
    // que 0,18). L'index `gin_trgm_ops` de la migration 004 accélère les deux ;
    // c'est bien un `ILIKE` qu'il sert ici.
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

  // Par pertinence si `q` est fourni — une note qui ne matche que par une
  // pièce jointe a un rang de 0 et retombe en fin de liste, triée par date.
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

/** `POST /api/notes` — crée la note d'un jour. `409` si ce jour en a déjà une. */
notes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)

  if (!body || !isValidDate(body.date)) {
    return c.json({ error: 'invalid date, expected YYYY-MM-DD' }, 400)
  }
  if (!isRichTextDoc(body.content)) {
    return c.json({ error: 'invalid content, expected a TipTap document' }, 400)
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

  // 404 et non 403 : la note d'autrui n'existe pas de notre point de vue.
  if (!row) return c.json({ error: 'note not found' }, 404)
  return c.json(toDailyNote(row))
})

/** `PATCH /api/notes/:id` — modification partielle. */
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

  const row = await db
    .updateTable('dailyNotes')
    .set({ ...patch, updatedAt: new Date() })
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .returning(COLUMNS)
    .executeTakeFirst()

  if (!row) return c.json({ error: 'note not found' }, 404)
  return c.json(toDailyNote(row))
})

/** `DELETE /api/notes/:id` — emporte les pièces jointes avec la note. */
notes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

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

  if (result.numDeletedRows === 0n) return c.json({ error: 'note not found' }, 404)

  // Après la base : un objet qui survit est du déchet silencieux, une ligne qui
  // survit serait un lien mort. On préfère le premier.
  await Promise.allSettled(keys.map((row) => storage.delete(row.storageKey)))

  return c.body(null, 204)
})

export default notes
