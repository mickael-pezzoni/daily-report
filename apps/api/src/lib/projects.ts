import { db } from '../db/index.js'

export type ProjectAccess = 'ok' | 'not_found' | 'archived'

/**
 * Le projet appartient-il à ce compte, et accepte-t-il encore des notes ? Un
 * projet archivé existe toujours (juste rangé), mais refuse toute écriture —
 * c'est la règle métier, pas une convention d'affichage.
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
  const row = await db
    .selectFrom('projects')
    .select('archivedAt')
    .where('id', '=', projectId)
    .where('userId', '=', userId)
    .executeTakeFirst()

  if (!row) return 'not_found'
  return row.archivedAt ? 'archived' : 'ok'
}
