import type { Attachment } from '@daily-report/types'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { env } from '../../env.js'
import { ATTACHMENT_COLUMNS, buildStorageKey, sanitizeFilename, toAttachment } from '../../lib/attachments.js'
import { checkProjectAccess } from '../../lib/projects.js'
import { isUuid } from '../../lib/validate.js'
import { storage } from '../../storage/index.js'

const uploadAttachmentInput = z.object({
  noteId: z.string().describe('UUID of the note to attach the file to'),
  filename: z.string().describe('Original file name'),
  mimeType: z.string().optional().describe('MIME type; guessed as application/octet-stream if omitted'),
  contentBase64: z.string().describe('File content, base64-encoded'),
})

/**
 * Also checks the project isn't archived — the REST attachments route
 * doesn't (a real gap there, only note ownership is checked), but there's
 * no reason to carry that gap into a new tool. See the mcp plan.
 */
export function registerAttachmentTools(server: McpServer, userId: string): void {
  server.registerTool(
    'upload_attachment',
    {
      description: 'Uploads a file, attached to an existing note.',
      inputSchema: uploadAttachmentInput,
    },
    async ({ noteId, filename, mimeType, contentBase64 }) => {
      if (!isUuid(noteId)) throw new Error('invalid note id')

      const note = await db
        .selectFrom('dailyNotes')
        .select('projectId')
        .where('id', '=', noteId)
        .where('userId', '=', userId)
        .executeTakeFirst()
      if (!note) throw new Error('note not found')

      const access = await checkProjectAccess(userId, note.projectId)
      if (access !== 'ok') throw new Error(access === 'archived' ? 'project is archived' : 'project not found')

      let bytes: Uint8Array
      try {
        bytes = new Uint8Array(Buffer.from(contentBase64, 'base64'))
      } catch {
        throw new Error('invalid contentBase64, expected base64-encoded data')
      }
      if (bytes.length === 0) throw new Error('empty file')
      if (bytes.length > env.MAX_UPLOAD_BYTES) {
        throw new Error(`file too large: max ${env.MAX_UPLOAD_BYTES} bytes, got ${bytes.length}`)
      }

      const safeFilename = sanitizeFilename(filename)
      const resolvedMimeType = mimeType || 'application/octet-stream'
      const key = buildStorageKey(userId, noteId, safeFilename)

      // Object before row, same ordering as the REST route: an orphan object
      // is recoverable trash, an orphan row would be a dead link.
      await storage.put(key, bytes, { contentType: resolvedMimeType })

      let attachment: Attachment
      try {
        const row = await db
          .insertInto('attachments')
          .values({
            noteId,
            storageKey: key,
            filename: safeFilename,
            mimeType: resolvedMimeType,
            sizeBytes: bytes.length,
          })
          .returning(ATTACHMENT_COLUMNS)
          .executeTakeFirstOrThrow()
        attachment = toAttachment(row)
      } catch (error) {
        await storage.delete(key)
        throw error
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(attachment) }],
        structuredContent: { attachment },
      }
    },
  )
}
