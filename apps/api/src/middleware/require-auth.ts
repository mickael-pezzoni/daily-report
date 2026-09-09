import { createMiddleware } from 'hono/factory'
import { auth } from '../auth.js'

export type AuthedEnv = { Variables: { userId: string } }

/**
 * Rejects the request if there's no session, and sets `userId` in context.
 *
 * There's no other authorization layer in this API: any route added behind
 * this middleware must explicitly filter on this `userId`.
 */
export const requireAuth = createMiddleware<AuthedEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.user.id)
  await next()
})
