import { useState } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '../../api/auth-client'
import styles from './SignOutButton.module.css'

/**
 * Le bouton ⏻ de la barre latérale, à droite de « Mon journal ».
 *
 * La maquette n'a longtemps prévu aucune sortie de session ; elle en spécifie
 * une depuis sa révision du 7 août, à cet emplacement précis.
 */
export function SignOutButton() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  async function handleSignOut() {
    setPending(true)
    await signOut()
    setPending(false)
    void navigate('/login', { replace: true })
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleSignOut}
      disabled={pending}
      title="Se déconnecter"
      aria-label="Se déconnecter"
    >
      ⏻
    </button>
  )
}
