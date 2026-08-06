import { useState } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '../../api/auth-client'

/**
 * Ajout hors maquette : celle-ci ne prévoit aucune sortie de session, ni dans
 * l'en-tête bureau (2a) ni derrière le menu « ⋯ » mobile (2b).
 *
 * Composant autonome exprès, pour pouvoir être déplacé tel quel dans l'en-tête
 * réel quand l'écran 2a arrivera, sans rien réécrire.
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
      className="btn btn-secondary"
      onClick={handleSignOut}
      disabled={pending}
    >
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  )
}
