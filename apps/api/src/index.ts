import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import type { SessionUser } from '@daily-report/types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth.js'
import { DEV_EMAIL, DEV_PASSWORD } from './db/dev-account.js'
import { pool } from './db/index.js'
import { env } from './env.js'
import { requireAuth, type AuthedEnv } from './middleware/require-auth.js'
import { attachments, noteAttachments } from './routes/attachments.js'
import authState from './routes/auth-state.js'
import calendar from './routes/calendar.js'
import notes from './routes/notes.js'
import projects from './routes/projects.js'
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
app.use('/api/projects', requireAuth)
app.use('/api/projects/*', requireAuth)

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
app.route('/api/projects', projects)

// Image de production seulement : en dev, Vite sert le web sur son propre
// port. Monté après toutes les routes `/api/*`, mais le wildcard `'*'` les
// matcherait quand même pour tout chemin `/api/*` non enregistré (typo,
// route retirée) — d'où le garde explicite : un `/api/*` sans handler doit
// rester un 404, jamais retomber sur `index.html`.
if (env.WEB_DIST_DIR) {
  const serveIndex = serveStatic({ root: env.WEB_DIST_DIR, path: 'index.html' })
  const serveAssets = serveStatic({ root: env.WEB_DIST_DIR })
  app.use('/*', (c, next) => (c.req.path.startsWith('/api/') ? next() : serveAssets(c, next)))
  app.get('*', (c, next) => (c.req.path.startsWith('/api/') ? next() : serveIndex(c, next)))
}

// Dev convenience only (never in the production image): a reminder of the
// dev account's credentials, or of the command that creates it.
if (!env.WEB_DIST_DIR) {
  const { rows } = await pool.query<{ email: string }>('SELECT email FROM "user" LIMIT 1')
  if (rows.length === 0) {
    console.log(
      `No account yet — run "pnpm --filter @daily-report/api seed:account" to create ${DEV_EMAIL} / ${DEV_PASSWORD}`,
    )
  } else if (rows[0]!.email === DEV_EMAIL) {
    console.log(`Dev account: ${DEV_EMAIL} / ${DEV_PASSWORD}`)
  }
}

console.log(`API à l'écoute sur http://localhost:${env.PORT}`)
console.log(`Stockage des pièces jointes : ${storage.name}`)
serve({ fetch: app.fetch, port: env.PORT })
