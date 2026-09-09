import type { DailyNote, RichTextDoc } from '@daily-report/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { api, ApiError } from '../api/client'
import { apiErrorKey } from '../i18n/api-errors'

export type SaveState = 'idle' | 'loading' | 'dirty' | 'saving' | 'saved' | 'error'

const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [] }
const SAVE_DELAY_MS = 800

interface Draft {
  title: string
  content: RichTextDoc
}

/**
 * Loads the note for a day and saves it on its own.
 *
 * Writing happens in two steps, since the note doesn't exist until something
 * has been written: `POST` on the first save of a blank day, `PATCH` afterwards.
 *
 * On failure, the hook exposes a **translation key**, not a message: the API
 * responds in technical English, and a frozen message wouldn't follow a
 * language change.
 */
export function useNote(date: string, onSaved?: (note: DailyNote) => void) {
  const { projectId: currentProjectId } = useParams<{ projectId: string }>()
  const [note, setNote] = useState<DailyNote | null>(null)
  const [draft, setDraft] = useState<Draft>({ title: '', content: EMPTY_DOC })
  const [state, setState] = useState<SaveState>('loading')
  const [errorKey, setErrorKey] = useState<string | null>(null)

  // Refs, not state: the save timer must read the current values without
  // restarting on every keystroke.
  const draftRef = useRef(draft)
  const noteIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  /** In-flight creation — avoids two POSTs on the same blank day. */
  const creatingRef = useRef<Promise<DailyNote> | null>(null)
  const onSavedRef = useRef(onSaved)

  useEffect(() => {
    onSavedRef.current = onSaved
  })

  /**
   * Creates the day's note, exactly once.
   *
   * Two calls close together on a blank day — typically a keystroke and a
   * file drop — share the same promise instead of firing two concurrent
   * `POST`s.
   */
  const createOnce = useCallback(
    (payload: Draft): Promise<DailyNote> => {
      const currentDate = date
      const projectId = currentProjectId
      if (!projectId) return Promise.reject(new Error('no current project'))

      creatingRef.current ??= api.notes
        .create({ date: currentDate, projectId, ...payload })
        .catch(async (cause) => {
          // 409: the note already exists (another tab, a replayed request).
          // This isn't an error to show — we fetch it and carry on.
          if (cause instanceof ApiError && cause.status === 409) {
            const existing = await api.notes.byDate(currentDate, projectId)
            if (existing) return api.notes.update(existing.id, payload)
          }
          throw cause
        })
      return creatingRef.current
    },
    [date, currentProjectId],
  )

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirtyRef.current) return

    const payload = draftRef.current
    dirtyRef.current = false
    setState('saving')

    try {
      const saved = noteIdRef.current
        ? await api.notes.update(noteIdRef.current, payload)
        : await createOnce(payload)
      creatingRef.current = null

      noteIdRef.current = saved.id
      setNote(saved)
      setState(dirtyRef.current ? 'dirty' : 'saved')
      setErrorKey(null)
      onSavedRef.current?.(saved)
    } catch (cause) {
      creatingRef.current = null
      dirtyRef.current = true
      setState('error')
      setErrorKey(apiErrorKey(cause, 'errors.saveFailed'))
    }
  }, [createOnce])

  /**
   * The note's id, creating it if the day is still blank.
   *
   * Needed to attach a file: the API attaches attachments to a note, and
   * dropping a file on a blank day is a perfectly legitimate action.
   */
  const ensureNoteId = useCallback(async (): Promise<string> => {
    if (noteIdRef.current) return noteIdRef.current

    const saved = await createOnce(draftRef.current)
    creatingRef.current = null
    noteIdRef.current = saved.id
    setNote(saved)
    // The day now exists: the calendar dot must light up, even though it was
    // a file, not text, that brought it into being.
    onSavedRef.current?.(saved)
    return saved.id
  }, [createOnce])

  // Keeps a stable reference to the latest `flush` for cleanups.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  // Loading, and flushing the pending save on day or project change: a note
  // in progress must not disappear just because someone clicked on August
  // 4th, and switching project must reload that same day within the new one.
  useEffect(() => {
    if (!currentProjectId) return

    let cancelled = false
    const previousFlush = flushRef.current
    void previousFlush()

    setState('loading')
    setErrorKey(null)
    noteIdRef.current = null
    creatingRef.current = null
    dirtyRef.current = false

    api.notes
      .byDate(date, currentProjectId)
      .then((found) => {
        if (cancelled) return
        noteIdRef.current = found?.id ?? null
        setNote(found)
        const next = { title: found?.title ?? '', content: found?.content ?? EMPTY_DOC }
        draftRef.current = next
        setDraft(next)
        setState('idle')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setState('error')
        setErrorKey(apiErrorKey(cause, 'errors.loadFailed'))
      })

    return () => {
      cancelled = true
    }
  }, [date, currentProjectId])

  // Last chance: on the component's full unmount.
  useEffect(() => () => void flushRef.current(), [])

  // Tab closed with pending changes.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const edit = useCallback(
    (patch: Partial<Draft>) => {
      const next = { ...draftRef.current, ...patch }
      draftRef.current = next
      setDraft(next)

      // Nothing to save as long as a blank day stays blank.
      if (!noteIdRef.current && !next.title && !(next.content.content?.length ?? 0)) return

      dirtyRef.current = true
      setState('dirty')

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS)
    },
    [],
  )

  return { note, draft, state, errorKey, edit, save: flush, ensureNoteId }
}
