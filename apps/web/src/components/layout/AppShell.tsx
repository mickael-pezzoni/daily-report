import { useSession } from '../../api/auth-client'
import { SignOutButton } from '../auth/SignOutButton'
import styles from './AppShell.module.css'

/**
 * Emplacement du futur écran principal (2a : calendrier permanent à gauche,
 * éditeur à droite). Pour l'instant, il ne prouve qu'une chose — la session
 * tient — et porte la sortie de session.
 */
export function AppShell() {
  const { data: session } = useSession()

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>Mon journal</span>
        <span className={styles.spacer} />
        <span className={styles.user}>{session?.user.name}</span>
        <SignOutButton />
      </header>

      <main className={styles.main}>
        <p className={styles.placeholder}>
          Connecté en tant que <strong>{session?.user.email}</strong>.
        </p>
        <p className={styles.hint}>
          L'écran du journal — calendrier et éditeur — vient s'installer ici.
        </p>
      </main>
    </div>
  )
}
