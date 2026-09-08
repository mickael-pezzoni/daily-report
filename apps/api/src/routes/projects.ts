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
 * `GET /api/projects` — les projets du compte, dans l'ordre de création (le
 * premier est celui que l'inscription propose par défaut), actifs et archivés
 * confondus — c'est au client de les distinguer à l'affichage. Chacun porte
 * son nombre de notes et la date de la dernière : ce que les cartes de
 * l'écran de sélection affichent, sans requête à part par projet.
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

/** `POST /api/projects` — crée un projet, vide et actif. */
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
 * `PATCH /api/projects/:id` — pour l'instant, seul l'archivage. Un bascule
 * dans les deux sens : archiver n'est qu'une préférence d'affichage, pas une
 * suppression, donc rien n'interdit d'y revenir.
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

  // Pas de jointure ici : (dés)archiver ne change rien aux notes, une requête
  // à part pour le compte et la dernière date serait pur confort d'écriture.
  const counts = await db
    .selectFrom('dailyNotes')
    .select((eb) => [eb.fn.count<string>('id').as('noteCount'), eb.fn.max<string | null>('noteDate').as('lastNoteDate')])
    .where('projectId', '=', id)
    .executeTakeFirstOrThrow()

  return c.json(toProject({ ...row, ...counts }))
})

/**
 * `DELETE /api/projects/:id` — supprime le projet, ses notes et leurs pièces
 * jointes. Les clés de stockage sont relevées AVANT la suppression : le
 * `ON DELETE CASCADE` emporte `daily_notes` puis `attachments`, et avec eux la
 * seule trace des fichiers déposés. Sans cette précaution, chaque projet
 * supprimé laisserait des objets orphelins qu'aucune ligne ne référence plus.
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

  // Après la base : un objet qui survit est du déchet silencieux, une ligne
  // qui survit serait un lien mort. On préfère le premier.
  await Promise.allSettled(keys.map((row) => storage.delete(row.storageKey)))

  return c.body(null, 204)
})

export default projects
