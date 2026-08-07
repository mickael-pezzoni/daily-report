import type { RichTextDoc } from '@daily-report/types'

interface RichTextNode {
  type?: string
  text?: string
  content?: RichTextNode[]
}

/** Nœuds qui séparent deux blocs de texte à l'aplatissement. */
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
 * Aplatit un document TipTap en texte brut.
 *
 * Toujours calculé au serveur, jamais accepté du client : `content_text` doit
 * rester le reflet exact de `content`, sinon les extraits — et demain la
 * recherche — mentiraient sur ce que contient la note.
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

/** Les premiers caractères du texte aplati, pour les cartes et les listes. */
export function excerptOf(contentText: string, max = 160): string {
  const flat = contentText.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`
}
