import { createMiddleware } from 'hono/factory'
import { auth } from '../auth.js'

export type AuthedEnv = { Variables: { userId: string } }

/**
 * Refuse la requête sans session et pose `userId` dans le contexte.
 *
 * Il n'y a pas d'autre couche d'autorisation dans cette API : toute requête
 * ajoutée derrière ce middleware doit filtrer explicitement sur ce `userId`.
 */
export const requireAuth = createMiddleware<AuthedEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.user.id)
  await next()
})
