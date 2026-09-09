import type { Project, ProjectDraft, ProjectPatch } from '@daily-report/types'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { isUuid } from '../lib/validate.js'
import type { AuthedEnv } from '../middleware/require-auth.js'
import { storage } from '../storage/index.js'

const projects = new Hono<AuthedEnv>()

interface ProjectRow {
  id: string
  name: string
  createdAt: Date
  archivedAt: Date | null
  noteCount: string
  lastNoteDate: string | null
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    noteCount: Number(row.noteCount),
    lastNoteDate: row.lastNoteDate,
  }
}

/**
 * `GET /api/projects` — the account's projects, in creation order (the first
 * one is the one sign-up offers by default), active and archived alike —
 * it's up to the client to distinguish them in the display. Each one carries
 * its note count and the date of the latest one: what the cards on the
 * selection screen display, with no separate query per project.
 */
projects.get('/', async (c) => {
  const rows = await db
    .selectFrom('projects')
    .leftJoin('dailyNotes', 'dailyNotes.projectId', 'projects.id')
    .select((eb) => [
      'projects.id as id',
      'projects.name as name',
      'projects.createdAt as createdAt',
      'projects.archivedAt as archivedAt',
      eb.fn.count<string>('dailyNotes.id').as('noteCount'),
      eb.fn.max<string | null>('dailyNotes.noteDate').as('lastNoteDate'),
    ])
    .where('projects.userId', '=', c.get('userId'))
    .groupBy(['projects.id', 'projects.name', 'projects.createdAt', 'projects.archivedAt'])
    .orderBy('projects.createdAt', 'asc')
    .execute()

  return c.json(rows.map(toProject))
})

/** `POST /api/projects` — creates a project, empty and active. */
projects.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as ProjectDraft | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'invalid name, expected a non-empty string' }, 400)

  const row = await db
    .insertInto('projects')
    .values({ userId: c.get('userId'), name })
    .returning(['id', 'name', 'createdAt'])
    .executeTakeFirstOrThrow()

  const project: Project = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    archivedAt: null,
    noteCount: 0,
    lastNoteDate: null,
  }
  return c.json(project, 201)
})

/**
 * `PATCH /api/projects/:id` — for now, only archiving. A two-way toggle:
 * archiving is only a display preference, not a deletion, so nothing
 * prevents undoing it.
 */
projects.patch('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)

  const body = (await c.req.json().catch(() => null)) as ProjectPatch | null
  if (typeof body?.archived !== 'boolean') {
    return c.json({ error: 'invalid archived, expected a boolean' }, 400)
  }

  const row = await db
    .updateTable('projects')
    .set({ archivedAt: body.archived ? new Date() : null })
    .where('id', '=', id)
    .where('userId', '=', c.get('userId'))
    .returning(['id', 'name', 'createdAt', 'archivedAt'])
    .executeTakeFirst()

  if (!row) return c.json({ error: 'project not found' }, 404)

  // No join here: (un)archiving doesn't change anything about the notes, a
  // separate query for the count and the latest date would be pure writing
  // convenience.
  const counts = await db
    .selectFrom('dailyNotes')
    .select((eb) => [eb.fn.count<string>('id').as('noteCount'), eb.fn.max<string | null>('noteDate').as('lastNoteDate')])
    .where('projectId', '=', id)
    .executeTakeFirstOrThrow()

  return c.json(toProject({ ...row, ...counts }))
})

/**
 * `DELETE /api/projects/:id` — deletes the project, its notes, and their
 * attachments. The storage keys are collected BEFORE deletion: the
 * `ON DELETE CASCADE` takes down `daily_notes` then `attachments`, and with
 * them the only trace of the uploaded files. Without this precaution, every
 * deleted project would leave behind orphan objects that no row references
 * anymore.
 */
projects.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'invalid id' }, 400)
  const userId = c.get('userId')

  const keys = await db
    .selectFrom('attachments')
    .innerJoin('dailyNotes', 'dailyNotes.id', 'attachments.noteId')
    .select('attachments.storageKey')
    .where('dailyNotes.projectId', '=', id)
    .execute()

  const result = await db
    .deleteFrom('projects')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst()

  if (result.numDeletedRows === 0n) return c.json({ error: 'project not found' }, 404)

  // After the database: an object that survives is silent waste, a row that
  // survives would be a dead link. We prefer the former.
  await Promise.allSettled(keys.map((row) => storage.delete(row.storageKey)))

  return c.body(null, 204)
})

export default projects
