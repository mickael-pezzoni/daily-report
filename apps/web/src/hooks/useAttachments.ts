import type { Attachment } from '@daily-report/types'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Les pièces jointes d'une journée.
 *
 * `noteId` peut être `null` — un jour vierge n'a pas encore de note. L'envoi
 * passe alors par `ensureNoteId`, fourni par `useNote`, qui la crée à la volée.
 *
 * L'état vit ici plutôt que dans le tiroir : l'éditeur ajoute lui aussi des
 * fichiers (images collées ou déposées dans le texte), et les deux doivent voir
 * la même liste.
 */
export function useAttachments(noteId: string | null, ensureNoteId: () => Promise<string>) {
  const [items, setItems] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!noteId) {
      setItems([])
      return
    }
    let cancelled = false
    api.attachments
      .list(noteId)
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [noteId])

  /** Envoie des fichiers et renvoie ce que l'API a réellement créé. */
  const upload = useCallback(
    async (files: File[]): Promise<Attachment[]> => {
      if (files.length === 0) return []
      setUploading(true)
      setError(null)
      try {
        const id = await ensureNoteId()
        const created = await api.attachments.upload(id, files)
        // On repart de la réponse du serveur plutôt que de deviner : c'est lui
        // qui attribue les identifiants et le vrai type.
        setItems((current) => [...current, ...created])
        return created
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "L'envoi a échoué.")
        return []
      } finally {
        setUploading(false)
      }
    },
    [ensureNoteId],
  )

  const remove = useCallback(async (id: string) => {
    setError(null)
    try {
      await api.attachments.remove(id)
      setItems((current) => current.filter((item) => item.id !== id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La suppression a échoué.')
    }
  }, [])

  return { items, uploading, error, upload, remove, dismissError: () => setError(null) }
}
