import { useTranslation } from 'react-i18next'
import type { SaveState } from '../../hooks/useNote'
import styles from './SaveStatus.module.css'

/**
 * Le couple « tag + bouton » de l'en-tête 2a.
 *
 * Il n'y a pas de notion de brouillon en base : ce que montre ce composant est
 * l'état de l'enregistrement automatique, rien d'autre.
 *
 * `errorKey` est une clé de traduction, pas un message : l'infobulle doit
 * suivre la langue même si l'échec date d'avant le changement.
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
