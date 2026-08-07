import type { SaveState } from '../../hooks/useNote'
import styles from './SaveStatus.module.css'

/**
 * Le couple « tag + bouton » de l'en-tête 2a.
 *
 * Il n'y a pas de notion de brouillon en base : ce que montre ce composant est
 * l'état de l'enregistrement automatique, rien d'autre.
 */
export function SaveStatus({ state, error }: { state: SaveState; error: string | null }) {
  if (state === 'loading' || state === 'idle') return null

  if (state === 'error') {
    return (
      <span className={styles.error} role="alert" title={error ?? undefined}>
        Enregistrement impossible
      </span>
    )
  }

  if (state === 'saved') {
    return <span className={`tag tag-accent-2 ${styles.tag}`}>✓ Enregistré</span>
  }

  return (
    <span className={`tag tag-neutral ${styles.tag}`}>
      {state === 'saving' ? 'Enregistrement…' : 'Modifications non enregistrées'}
    </span>
  )
}
