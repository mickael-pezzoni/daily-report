import { useTranslation } from 'react-i18next'
import type { SaveState } from '../../hooks/useNote'
import styles from './SaveStatus.module.css'

/**
 * The "tag + button" pair from header 2a.
 *
 * There's no notion of a draft in the database: what this component shows
 * is the state of autosave, nothing else.
 *
 * `errorKey` is a translation key, not a message: the tooltip must follow
 * the language even if the failure predates the language change.
 */
export function SaveStatus({ state, errorKey }: { state: SaveState; errorKey: string | null }) {
  const { t } = useTranslation()

  if (state === 'loading' || state === 'idle') return null

  if (state === 'error') {
    return (
      <span className={styles.error} role="alert" title={errorKey ? t(errorKey) : undefined}>
        {t('note.save.failed')}
      </span>
    )
  }

  if (state === 'saved') {
    return <span className={`tag tag-accent-2 ${styles.tag}`}>{t('note.save.saved')}</span>
  }

  return (
    <span className={`tag tag-neutral ${styles.tag}`}>
      {state === 'saving' ? t('note.save.saving') : t('note.save.dirty')}
    </span>
  )
}
