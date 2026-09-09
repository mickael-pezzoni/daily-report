import type { ReactNode } from 'react'
import styles from './AuthShell.module.css'

interface AuthShellProps {
  /** Title and tagline of the mobile band — the product's identity. */
  band: { title: string; subtitle: string }
  /** Title and subtitle of the desktop card — the screen's intent. */
  head: { title: string; subtitle?: string }
  children: ReactNode
  footnote?: ReactNode
}

/**
 * Frame common to screens 2d (login) and 2e (first launch).
 *
 * Desktop: card centered on the cream background. Mobile: identity band,
 * then a sheet with rounded top corners. Both variants share the same
 * tree — it's the stylesheet that swaps the band and the header at the
 * breakpoint.
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
