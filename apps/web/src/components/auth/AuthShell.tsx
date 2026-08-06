import type { ReactNode } from 'react'
import styles from './AuthShell.module.css'

interface AuthShellProps {
  /** Titre et accroche du bandeau mobile — l'identité du produit. */
  band: { title: string; subtitle: string }
  /** Titre et sous-titre de la carte bureau — l'intention de l'écran. */
  head: { title: string; subtitle?: string }
  children: ReactNode
  footnote?: ReactNode
}

/**
 * Cadre commun aux écrans 2d (connexion) et 2e (premier lancement).
 *
 * Bureau : carte centrée sur le fond crème. Mobile : bandeau d'identité, puis
 * une feuille aux coins hauts arrondis. Les deux variantes partagent le même
 * arbre — c'est la feuille de style qui échange le bandeau et l'en-tête au
 * point de rupture.
 */
export function AuthShell({ band, head, children, footnote }: AuthShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.band}>
        <div className={styles.logo} />
        <h1 className={styles.title}>{band.title}</h1>
        <p className={styles.subtitle}>{band.subtitle}</p>
      </header>

      <main className={styles.card}>
        <div className={styles.head}>
          <div className={styles.logo} />
          <h1 className={styles.title}>{head.title}</h1>
          {head.subtitle ? <p className={styles.subtitle}>{head.subtitle}</p> : null}
        </div>

        {children}

        {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
      </main>
    </div>
  )
}
