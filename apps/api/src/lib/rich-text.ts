import type { RichTextDoc } from '@daily-report/types'

interface RichTextNode {
  type?: string
  text?: string
  content?: RichTextNode[]
}

/** Nodes that separate two text blocks when flattening. */
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
])

/**
 * Flattens a TipTap document into plain text.
 *
 * Always computed server-side, never accepted from the client:
 * `content_text` must stay the exact reflection of `content`, otherwise
 * excerpts — and, down the line, search — would lie about what the note
 * contains.
 */
export function flattenRichText(doc: RichTextDoc): string {
  const parts: string[] = []

  function walk(node: RichTextNode) {
    if (node.text) parts.push(node.text)
    if (node.content) for (const child of node.content) walk(child)
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push('\n')
  }

  walk(doc as RichTextNode)

  return parts
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** The first characters of the flattened text, for cards and lists. */
export function excerptOf(contentText: string, max = 160): string {
  const flat = contentText.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`
}
