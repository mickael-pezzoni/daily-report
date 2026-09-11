import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { insertProject, listProjects } from '../../routes/projects.js'

/**
 * `list_projects` isn't in the original request, but it's what lets a
 * client discover the `projectId` values the other tools need — without it,
 * an MCP client has no way to know which project to write a note into.
 */
export function registerProjectTools(server: McpServer, userId: string): void {
  server.registerTool(
    'list_projects',
    {
      description:
        "Lists the account's projects (active and archived alike), each with its note count and latest note date.",
    },
    async () => {
      const projects = await listProjects(userId)
      return {
        content: [{ type: 'text', text: JSON.stringify(projects) }],
        structuredContent: { projects },
      }
    },
  )

  server.registerTool(
    'create_project',
    {
      description: 'Creates a new, empty, active project.',
      inputSchema: z.object({ name: z.string().describe('Project name') }),
    },
    async ({ name }) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('invalid name, expected a non-empty string')

      const project = await insertProject(userId, trimmed)
      return {
        content: [{ type: 'text', text: JSON.stringify(project) }],
        structuredContent: { project },
      }
    },
  )
}
