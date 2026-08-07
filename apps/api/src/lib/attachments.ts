import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'

/**
 * Types servis **en ligne** dans le navigateur. Tout le reste est renvoyé en
 * pièce jointe téléchargée.
 *
 * C'est une mesure de sécurité, pas de confort : servir un `.html` ou un `.svg`
 * déposé par un tiers avec `inline` exécuterait son script dans l'origine de
 * l'application. La liste ne contient donc que des formats inertes — et pas
 * `image/svg+xml`, qui n'en est pas un.
 */
const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
])

export function isInlineType(mimeType: string): boolean {
  return INLINE_TYPES.has(mimeType)
}

/**
 * Fabrique la clé de stockage d'un fichier.
 *
 * Le nom d'origine n'entre jamais dedans : il est conservé en base et rendu au
 * téléchargement. La clé, elle, est un UUID — pas de collision entre deux
 * `capture.png`, pas de caractère hostile à échapper, et rien à deviner pour
 * qui listerait un bucket. Seule l'extension est reprise, filtrée, pour que le
 * répertoire reste lisible en exploitation.
 */
export function buildStorageKey(userId: string, noteId: string, filename: string): string {
  const raw = extname(filename).toLowerCase()
  const extension = /^\.[a-z0-9]{1,12}$/.test(raw) ? raw : ''
  return `${userId}/${noteId}/${randomUUID()}${extension}`
}

/**
 * En-tête `Content-Disposition`.
 *
 * Deux formes de nom : une repliée en ASCII pour les clients anciens, et la
 * version UTF-8 encodée (RFC 5987) que comprennent les navigateurs actuels —
 * sans quoi « réunion-équipe.pdf » arriverait mutilé.
 */
export function contentDisposition(filename: string, mimeType: string): string {
  const disposition = isInlineType(mimeType) ? 'inline' : 'attachment'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/** Nom de fichier sain à stocker en base : sans chemin ni caractère de contrôle. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return clean.slice(0, 255) || 'fichier'
}
