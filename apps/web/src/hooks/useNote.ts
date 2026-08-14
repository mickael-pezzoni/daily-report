import type { DailyNote, RichTextDoc } from '@daily-report/types'
import { useCallback, useEffect, useRef, useState } from 'react'
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
 * Charge la note d'un jour et l'enregistre toute seule.
 *
 * L'écriture est en deux temps, puisque la note n'existe pas tant que rien n'a
 * été écrit : `POST` à la première sauvegarde d'un jour vierge, `PATCH` ensuite.
 *
 * En cas d'échec, le hook expose une **clé de traduction** et non un message :
 * l'API répond en anglais technique, et un message figé ne suivrait pas un
 * changement de langue.
 */
export function useNote(date: string, onSaved?: (note: DailyNote) => void) {
  const [note, setNote] = useState<DailyNote | null>(null)
  const [draft, setDraft] = useState<Draft>({ title: '', content: EMPTY_DOC })
  const [state, setState] = useState<SaveState>('loading')
  const [errorKey, setErrorKey] = useState<string | null>(null)

  // Refs, et non state : le minuteur d'enregistrement doit lire les valeurs
  // courantes sans se relancer à chaque frappe.
  const draftRef = useRef(draft)
  const noteIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  /** Création en vol — évite deux POST sur un même jour vierge. */
  const creatingRef = useRef<Promise<DailyNote> | null>(null)
  const onSavedRef = useRef(onSaved)

  useEffect(() => {
    onSavedRef.current = onSaved
  })

  /**
   * Crée la note du jour, une seule fois.
   *
   * Deux appels rapprochés sur un jour vierge — typiquement une frappe et un
   * dépôt de fichier — partagent la même promesse au lieu de partir en deux
   * `POST` concurrents.
   */
  const createOnce = useCallback(
    (payload: Draft): Promise<DailyNote> => {
      const currentDate = date
      creatingRef.current ??= api.notes
        .create({ date: currentDate, ...payload })
        .catch(async (cause) => {
          // 409 : la note existe déjà (autre onglet, requête rejouée). Ce n'est
          // pas une erreur à montrer — on récupère et on continue.
          if (cause instanceof ApiError && cause.status === 409) {
            const existing = await api.notes.byDate(currentDate)
            if (existing) return api.notes.update(existing.id, payload)
          }
          throw cause
        })
      return creatingRef.current
    },
    [date],
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
   * L'identifiant de la note, en la créant si le jour est encore vierge.
   *
   * Nécessaire pour joindre un fichier : l'API rattache les pièces jointes à
   * une note, or déposer un fichier sur une journée blanche est un geste
   * parfaitement légitime.
   */
  const ensureNoteId = useCallback(async (): Promise<string> => {
    if (noteIdRef.current) return noteIdRef.current

    const saved = await createOnce(draftRef.current)
    creatingRef.current = null
    noteIdRef.current = saved.id
    setNote(saved)
    // La journée existe désormais : la pastille du calendrier doit s'allumer,
    // même si c'est un fichier et non du texte qui l'a fait naître.
    onSavedRef.current?.(saved)
    return saved.id
  }, [createOnce])

  // Garde une référence stable vers le dernier `flush` pour les nettoyages.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  // Chargement, et vidage de la file d'attente au changement de jour : une note
  // en cours ne doit pas disparaître parce qu'on a cliqué sur le 4 août.
  useEffect(() => {
    let cancelled = false
    const previousFlush = flushRef.current
    void previousFlush()

    setState('loading')
    setErrorKey(null)
    noteIdRef.current = null
    creatingRef.current = null
    dirtyRef.current = false

    api.notes
      .byDate(date)
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
  }, [date])

  // Dernière chance : au démontage complet du composant.
  useEffect(() => () => void flushRef.current(), [])

  // Fermeture d'onglet avec des modifications en attente.
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

      // Rien à enregistrer tant qu'un jour vierge le reste.
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
