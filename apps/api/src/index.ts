import { serve } from '@hono/node-server'
import type { SessionUser } from '@daily-report/types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth.js'
import { env } from './env.js'
import { requireAuth, type AuthedEnv } from './middleware/require-auth.js'
import authState from './routes/auth-state.js'

const app = new Hono<AuthedEnv>()

app.use(
  '*',
  cors({
    origin: env.WEB_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

// better-auth sert tout /api/auth/** (sign-in, sign-up, sign-out, session…)
app.on(['GET', 'POST'], '/api/auth/**', (c) => auth.handler(c.req.raw))

// Publiques
app.get('/health', (c) => c.json({ ok: true }))
app.route('/api/auth-state', authState)

// Protégées — les routes notes/calendrier/recherche/pièces jointes viendront ici
app.use('/api/me', requireAuth)
app.get('/api/me', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const user = session!.user
  return c.json<SessionUser>({ id: user.id, name: user.name, email: user.email })
})

console.log(`API à l'écoute sur http://localhost:${env.PORT}`)
serve({ fetch: app.fetch, port: env.PORT })
