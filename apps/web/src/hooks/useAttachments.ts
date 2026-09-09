import type { Attachment } from '@daily-report/types'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { apiErrorKey } from '../i18n/api-errors'

/**
 * The attachments for a day.
 *
 * `noteId` can be `null` — a blank day doesn't have a note yet. Upload then
 * goes through `ensureNoteId`, provided by `useNote`, which creates it on the fly.
 *
 * The state lives here rather than in the drawer: the editor also adds files
 * (images pasted or dropped into the text), and both must see the same list.
 */
export function useAttachments(noteId: string | null, ensureNoteId: () => Promise<string>) {
  const [items, setItems] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  // A translation key, not a message: the API responds in technical English,
  // and a frozen piece of text wouldn't follow a language change.
  const [errorKey, setErrorKey] = useState<string | null>(null)

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

  /** Uploads files and returns what the API actually created. */
  const upload = useCallback(
    async (files: File[]): Promise<Attachment[]> => {
      if (files.length === 0) return []
      setUploading(true)
      setErrorKey(null)
      try {
        const id = await ensureNoteId()
        const created = await api.attachments.upload(id, files)
        // We start from the server's response rather than guessing: it's the
        // one that assigns the ids and the actual type.
        setItems((current) => [...current, ...created])
        return created
      } catch (cause) {
        setErrorKey(apiErrorKey(cause, 'errors.uploadFailed'))
        return []
      } finally {
        setUploading(false)
      }
    },
    [ensureNoteId],
  )

  const remove = useCallback(async (id: string) => {
    setErrorKey(null)
    try {
      await api.attachments.remove(id)
      setItems((current) => current.filter((item) => item.id !== id))
    } catch (cause) {
      setErrorKey(apiErrorKey(cause, 'errors.deleteFailed'))
    }
  }, [])

  return { items, uploading, errorKey, upload, remove, dismissError: () => setErrorKey(null) }
}
