import type { RichTextDoc } from '@daily-report/types'
import { defaultMarkdownParser, MarkdownParser } from 'prosemirror-markdown'
import { Schema } from 'prosemirror-model'

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

/**
 * A schema naming nodes and marks exactly like the web editor's TipTap
 * StarterKit configuration (`apps/web/src/components/notes/NoteEditor.tsx`)
 * — `bold`/`italic` rather than prosemirror-markdown's default `strong`/`em`,
 * `bulletList` rather than `bullet_list`, etc. — so a parsed document is
 * already in the right shape, with no renaming pass afterward. Only a subset
 * of the editor's node types: the ones CommonMark actually has a syntax for
 * (no `taskList`/`taskItem`, no `strike`/`underline` — GFM extensions
 * `defaultMarkdownParser`'s plain-CommonMark tokenizer doesn't produce).
 *
 * `toDOM`/`parseDOM` are deliberately absent: this schema only ever
 * constructs nodes programmatically and serializes them with `.toJSON()`,
 * it never touches a `DOMSerializer` — which is also why this runs fine in
 * Node, with no browser DOM in sight.
 */
const markdownSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
    blockquote: { content: 'block+', group: 'block' },
    bulletList: { content: 'listItem+', group: 'block' },
    orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } } },
    listItem: { content: 'paragraph block*' },
    codeBlock: { content: 'text*', marks: '', code: true, group: 'block' },
    horizontalRule: { group: 'block' },
    hardBreak: { group: 'inline', inline: true },
  },
  marks: {
    bold: {},
    italic: {},
    code: {},
    link: { attrs: { href: { default: null } } },
  },
})

/**
 * Parses CommonMark into `markdownSchema`'s shape. Reuses
 * `defaultMarkdownParser`'s own tokenizer (a `markdown-it` instance) rather
 * than depending on `markdown-it` directly just to build one — tokenizing is
 * stateless per call, so sharing it across two `MarkdownParser`s is safe.
 * Only the token-to-schema mapping below is ours.
 */
const markdownParser = new MarkdownParser(markdownSchema, defaultMarkdownParser.tokenizer, {
  paragraph: { block: 'paragraph' },
  heading: { block: 'heading', getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }) },
  blockquote: { block: 'blockquote' },
  bullet_list: { block: 'bulletList' },
  ordered_list: { block: 'orderedList', getAttrs: (tok) => ({ start: Number(tok.attrGet('start')) || 1 }) },
  list_item: { block: 'listItem' },
  code_block: { block: 'codeBlock' },
  fence: { block: 'codeBlock' },
  hr: { node: 'horizontalRule' },
  hardbreak: { node: 'hardBreak' },
  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  code_inline: { mark: 'code' },
  link: { mark: 'link', getAttrs: (tok) => ({ href: tok.attrGet('href') }) },
})

/**
 * Builds a TipTap document from Markdown — what `write_note` accepts, since
 * an MCP client can write Markdown reliably but can't hand-write TipTap's
 * JSON tree. `isRichTextDoc`'s validation is shallow (`type === 'doc'`), so
 * this is all the rest of the write path requires.
 */
export function markdownToRichTextDoc(markdown: string): RichTextDoc {
  const doc = markdownParser.parse(markdown)
  // An empty (or whitespace/comment-only) input parses to a doc with no
  // blocks, which `content: 'block+'` doesn't allow — fall back to a single
  // empty paragraph rather than letting `.toJSON()` produce an invalid doc.
  const content = doc.childCount > 0 ? doc.toJSON().content : [{ type: 'paragraph' }]

  return { type: 'doc', content }
}
