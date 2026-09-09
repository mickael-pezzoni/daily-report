import { db } from '../db/index.js'

export type ProjectAccess = 'ok' | 'not_found' | 'archived'

/**
 * Does this project belong to this account, and does it still accept notes?
 * An archived project still exists (just tucked away), but refuses any
 * write — that's a business rule, not a display convention.
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
