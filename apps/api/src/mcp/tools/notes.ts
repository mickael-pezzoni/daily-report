import type { NoteListItem } from '@daily-report/types'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { checkProjectAccess } from '../../lib/projects.js'
import { markdownToRichTextDoc } from '../../lib/rich-text.js'
import { isUuid, isValidDate } from '../../lib/validate.js'
import { attachmentsByNote, COLUMNS, toDailyNote, upsertNote } from '../../routes/notes.js'

const listNotesInput = z.object({
  projectId: z.string().optional().describe('Restrict to this project (UUID)'),
  date: z.string().optional().describe('Exact date, YYYY-MM-DD'),
  from: z.string().optional().describe('Lower date bound, YYYY-MM-DD, inclusive'),
  to: z.string().optional().describe('Upper date bound, YYYY-MM-DD, inclusive'),
  limit: z.number().int().min(1).max(100).default(50).describe('Max notes returned'),
})

const writeNoteInput = z.object({
  projectId: z.string().describe('UUID of the project the note belongs to'),
  date: z.string().describe('Date of the note, YYYY-MM-DD'),
  title: z.string().optional().describe('Note title'),
  content: z
    .string()
    .describe(
      'Markdown content — headings, bold, italic, inline/block code, blockquotes, bullet/ordered lists, links and horizontal rules are supported. No task lists, strikethrough or underline.',
    ),
})

/**
 * No full-text search here (`q`/`scope`, as `GET /api/notes` has) — not
 * asked for, and no separate `get_note`: this tool already returns each
 * note's full content and attachments, so a single-note lookup is just
 * `date` narrowed to one day.
 */
export function registerNoteTools(server: McpServer, userId: string): void {
  server.registerTool(
    'list_notes',
    {
      description:
        "Lists the account's notes, optionally filtered by project and/or date range. Each note carries its full content and attachments.",
      inputSchema: listNotesInput,
    },
    async ({ projectId, date, from, to, limit }) => {
      if (projectId !== undefined && !isUuid(projectId)) throw new Error('invalid projectId')
      if (date !== undefined && !isValidDate(date)) throw new Error('invalid date, expected YYYY-MM-DD')
      if (from !== undefined && !isValidDate(from)) throw new Error('invalid from, expected YYYY-MM-DD')
      if (to !== undefined && !isValidDate(to)) throw new Error('invalid to, expected YYYY-MM-DD')

      let query = db.selectFrom('dailyNotes').select(COLUMNS).where('userId', '=', userId)
      if (projectId !== undefined) query = query.where('projectId', '=', projectId)
      if (date !== undefined) query = query.where('noteDate', '=', date)
      if (from !== undefined) query = query.where('noteDate', '>=', from)
      if (to !== undefined) query = query.where('noteDate', '<=', to)

      const rows = await query.orderBy('noteDate', 'desc').limit(limit).execute()
      const grouped = await attachmentsByNote(rows.map((row) => row.id))
      const notes: NoteListItem[] = rows.map((row) => ({
        ...toDailyNote(row),
        attachments: grouped.get(row.id) ?? [],
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify(notes) }],
        structuredContent: { notes },
      }
    },
  )

  server.registerTool(
    'write_note',
    {
      description:
        "Writes the note for a day in a project — creates it if that day is blank, replaces its title and content otherwise. Not a partial update: always set the full note.",
      inputSchema: writeNoteInput,
    },
    async ({ projectId, date, title, content }) => {
      if (!isUuid(projectId)) throw new Error('invalid projectId')
      if (!isValidDate(date)) throw new Error('invalid date, expected YYYY-MM-DD')

      const access = await checkProjectAccess(userId, projectId)
      if (access === 'not_found') throw new Error('project not found')
      if (access === 'archived') throw new Error('project is archived')

      const note = await upsertNote(userId, projectId, date, title ?? '', markdownToRichTextDoc(content))
      return {
        content: [{ type: 'text', text: JSON.stringify(note) }],
        structuredContent: { note },
      }
    },
  )
}
