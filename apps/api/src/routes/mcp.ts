import { createMcpHandler, requireBearerAuth } from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { mcpTokenVerifier } from '../mcp/auth.js'
import { buildMcpServer } from '../mcp/server.js'

const mcp = new Hono()

const gate = requireBearerAuth({ verifier: mcpTokenVerifier })
const handler = createMcpHandler(buildMcpServer)

/**
 * `/api/mcp` — the MCP tool server's Streamable HTTP endpoint. `all()`
 * rather than a single method: the SDK's handler decides per-method
 * behavior itself (e.g. it answers legacy session operations on GET/DELETE
 * with its own 405), so the route shouldn't pre-filter methods ahead of it.
 *
 * A separate Bearer gate from `requireAuth` in `middleware/require-auth.ts`:
 * this is the `mcp` plugin's OAuth access token, not the cookie session —
 * unrelated mechanisms that happen to look alike.
 */
mcp.all('/', async (c) => {
  const auth = await gate(c.req.raw)
  if (auth instanceof Response) return auth
  return handler.fetch(c.req.raw, { authInfo: auth })
})

export default mcp
