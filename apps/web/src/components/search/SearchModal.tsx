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
 * Écran 2c de la maquette — recherche globale, ouverte au Ctrl+K/⌘K.
 *
 * Les filtres sont ceux de la maquette et agissent pour de vrai, côté serveur :
 * `tout`/`texte`/`pièces jointes` deviennent le `scope` de `GET /api/notes`,
 * `cette année` sa borne `from`. Titre et contenu passent par `search_vector`
 * (plein texte, dans la langue du compte), les noms de fichiers par un `ILIKE`
 * servi par l'index trigramme.
 *
 * Un seul écart assumé avec la maquette : elle annonce que le **contenu des
 * PDF** est fouillé. Rien ne l'extrait aujourd'hui — la mention ne parle donc
 * que du nom de fichier, plutôt que de promettre ce que la recherche ne fait
 * pas.
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
   * `onDelete` agit sur l'état d'`AppShell` (derniers jours, calendrier) ; la
   * liste de résultats, elle, n'appartient qu'à cette modale — d'où le retrait
   * local en plus.
   */
  function handleDelete(note: NoteListItem) {
    setResults((items) => items.filter((item) => item.id !== note.id))
    onDelete(note)
  }

  return (
    // La confirmation de suppression est un <dialog> rendu par chaque carte,
    // donc imbriqué dans celui-ci. C'est valide — le contenu d'un <dialog> est
    // du flow content, dont <dialog> fait partie — et les deux s'empilent dans
    // la couche supérieure, la dernière ouverte au-dessus. Le clic sur son fond
    // ne referme pas la recherche : il a pour cible la modale de confirmation,
    // pas celle-ci.
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
