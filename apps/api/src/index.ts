import { serve } from '@hono/node-server'
import type { SessionUser } from '@daily-report/types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth.js'
import { env } from './env.js'
import { requireAuth, type AuthedEnv } from './middleware/require-auth.js'
import { attachments, noteAttachments } from './routes/attachments.js'
import authState from './routes/auth-state.js'
import calendar from './routes/calendar.js'
import notes from './routes/notes.js'
import { storage } from './storage/index.js'

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

// Protégées. Chaque route derrière `requireAuth` filtre elle-même sur `userId`.
// Les deux formes de chemin sont nécessaires : `/api/notes/*` ne couvre pas
// `/api/notes` sans segment, qui porte pourtant la collection.
app.use('/api/me', requireAuth)
app.use('/api/notes', requireAuth)
app.use('/api/notes/*', requireAuth)
app.use('/api/calendar', requireAuth)
app.use('/api/calendar/*', requireAuth)
app.use('/api/attachments', requireAuth)
app.use('/api/attachments/*', requireAuth)

app.get('/api/me', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const user = session!.user
  return c.json<SessionUser>({ id: user.id, name: user.name, email: user.email })
})

// Monté avant `/api/notes` : sinon `notes` capterait `/:id` et répondrait
// avant que la sous-ressource ne soit atteinte.
app.route('/api/notes/:noteId/attachments', noteAttachments)
app.route('/api/notes', notes)
app.route('/api/calendar', calendar)
app.route('/api/attachments', attachments)

console.log(`API à l'écoute sur http://localhost:${env.PORT}`)
console.log(`Stockage des pièces jointes : ${storage.name}`)
serve({ fetch: app.fetch, port: env.PORT })
