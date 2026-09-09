import { SEARCH_SCOPES, type NoteListItem, type SearchScope } from '@daily-report/types'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../../api/client'
import { apiErrorKey } from '../../i18n/api-errors'
import { todayISO } from '../../lib/dates'
import { shortcutHint } from '../../lib/platform'
import { NoteResultCard } from '../notes/NoteResultCard'
import styles from './SearchModal.module.css'

interface SearchModalProps {
  onNavigate: (date: string) => void
  onClose: () => void
  onDelete: (note: NoteListItem) => void
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

const DEBOUNCE_MS = 250

/**
 * Mockup screen 2c — global search, opened with Ctrl+K/⌘K.
 *
 * The filters are the mockup's and act for real, server-side:
 * `all`/`text`/`attachments` become the `scope` of `GET /api/notes`,
 * `this year` its `from` bound. Title and content go through `search_vector`
 * (full text, in the account's language), file names through an `ILIKE`
 * served by the trigram index.
 *
 * One deliberate gap with the mockup: it states that **PDF content** is
 * searched. Nothing extracts it today — the note therefore only mentions
 * the file name, rather than promising what the search doesn't do.
 */
export function SearchModal({ onNavigate, onClose, onDelete }: SearchModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef<(HTMLDivElement | null)[]>([])

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [thisYear, setThisYear] = useState(false)
  const [results, setResults] = useState<NoteListItem[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    dialogRef.current?.showModal()
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      setStatus('idle')
      return
    }

    setStatus('loading')
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api.notes
        .search(term, {
          scope,
          from: thisYear ? `${todayISO().slice(0, 4)}-01-01` : undefined,
          signal: controller.signal,
        })
        .then((items) => {
          setResults(items)
          setSelected(0)
          setStatus('ready')
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          setResults([])
          setErrorKey(apiErrorKey(error as ApiError, 'errors.loadFailed'))
          setStatus('error')
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, scope, thisYear])

  useEffect(() => {
    resultRefs.current[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const note = results[selected]
      if (note) onNavigate(note.date)
    }
  }

  /**
   * `onDelete` acts on `AppShell`'s state (recent days, calendar); the
   * results list, meanwhile, belongs only to this modal — hence the extra
   * local removal.
   */
  function handleDelete(note: NoteListItem) {
    setResults((items) => items.filter((item) => item.id !== note.id))
    onDelete(note)
  }

  return (
    // The delete confirmation is a <dialog> rendered by each card, so it's
    // nested inside this one. That's valid — a <dialog>'s content is flow
    // content, which <dialog> is part of — and the two stack in the top
    // layer, the most recently opened on top. Clicking its backdrop doesn't
    // close the search: its target is the confirmation modal, not this one.
    <dialog
      ref={dialogRef}
      className={`dialog ${styles.dialog}`}
      aria-label={t('search.title')}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className={`card elev-lg ${styles.panel}`}>
        <div className={styles.header}>
          <div className={styles.input_wrapper}>
            <span className={styles.icon} aria-hidden="true">
              ⌕
            </span>
            <input
              ref={inputRef}
              type="text"
              className={`input ${styles.input}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              autoComplete="off"
            />
            <span className={styles.shortcut} aria-hidden="true">
              {shortcutHint()}
            </span>
          </div>

          <div className={styles.filters} role="group" aria-label={t('search.filtersLabel')}>
            {SEARCH_SCOPES.map((value) => (
              <button
                key={value}
                type="button"
                className={`tag ${scope === value ? 'tag-accent' : 'tag-outline'} ${styles.filter}`}
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
              >
                {t(`search.scope.${value}`)}
              </button>
            ))}
            <button
              type="button"
              className={`tag ${thisYear ? 'tag-accent' : 'tag-outline'} ${styles.filter}`}
              aria-pressed={thisYear}
              onClick={() => setThisYear((on) => !on)}
            >
              {t('search.thisYear')}
            </button>

            <span className={styles.spacer} />

            {status === 'ready' ? (
              <span className={styles.count}>
                {t('search.resultCount', { count: results.length })}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.results}>
          {status === 'idle' ? <p className={styles.hint}>{t('search.idle')}</p> : null}
          {status === 'error' && errorKey ? <p className={styles.hint}>{t(errorKey)}</p> : null}
          {status === 'ready' && results.length === 0 ? (
            <p className={styles.hint}>{t('search.noResults')}</p>
          ) : null}

          {results.map((note, index) => (
            <NoteResultCard
              key={note.id}
              ref={(element) => {
                resultRefs.current[index] = element
              }}
              note={note}
              query={query}
              selected={index === selected}
              onOpen={onNavigate}
              onDelete={handleDelete}
              onMouseEnter={() => setSelected(index)}
            />
          ))}
        </div>

        <div className={styles.footer}>
          <p className={styles.footer_hint}>{t('search.attachmentsHint')}</p>
          <p className={`${styles.footer_hint} ${styles.footer_hint_centered}`}>
            {t('search.keyboardHint')}
          </p>
        </div>
      </div>
    </dialog>
  )
}
