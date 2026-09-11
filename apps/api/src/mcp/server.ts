import { McpServer, type McpRequestContext } from '@modelcontextprotocol/server'
import { registerAttachmentTools } from './tools/attachments.js'
import { registerNoteTools } from './tools/notes.js'
import { registerProjectTools } from './tools/projects.js'

/**
 * One fresh `McpServer` per request — `createMcpHandler` (see
 * `routes/mcp.ts`) calls this factory itself, per its per-request-instance
 * model. Tool handlers close over `userId`, resolved once here from the
 * Bearer token's `AuthInfo.extra` (set in `mcp/auth.ts`), rather than
 * re-reading it on every tool call.
 */
export function buildMcpServer(ctx: McpRequestContext): McpServer {
  const userId = ctx.authInfo?.extra?.userId
  if (typeof userId !== 'string') {
    // `routes/mcp.ts` gates every request on a valid Bearer token before
    // ever calling the handler — this should be unreachable.
    throw new Error('missing authenticated user')
  }

  const server = new McpServer({ name: 'daily-report', version: '1.0.0' })
  registerProjectTools(server, userId)
  registerNoteTools(server, userId)
  registerAttachmentTools(server, userId)
  return server
}
