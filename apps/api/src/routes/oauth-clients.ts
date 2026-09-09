import type { OAuthClientInfo } from '@daily-report/types'
import { Hono } from 'hono'
import { pool } from '../db/index.js'
import type { AuthedEnv } from '../middleware/require-auth.js'

const oauthClients = new Hono<AuthedEnv>()

/**
 * `GET /api/oauth-clients/:clientId` — name and icon of an mcp plugin OAuth
 * client, for the consent screen (`/mcp/consent` on the web side): the
 * plugin only redirects there with an opaque `client_id` in the query, no
 * human-readable name. Raw query assumed: `oauthApplication` belongs to
 * better-auth, it doesn't go through Kysely — see src/db/index.ts. A client
 * doesn't belong to anyone in particular, hence no `userId` filter.
 */
oauthClients.get('/:clientId', async (c) => {
  const clientId = c.req.param('clientId')
  const { rows } = await pool.query<OAuthClientInfo>(
    'SELECT "name", "icon" FROM "oauthApplication" WHERE "clientId" = $1',
    [clientId],
  )
  const row = rows[0]
  if (!row) return c.json({ error: 'oauth client not found' }, 404)

  return c.json<OAuthClientInfo>(row)
})

export default oauthClients
