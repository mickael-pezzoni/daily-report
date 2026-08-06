import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Un compte existe-t-il sur cet espace ? Détermine si l'application ouvre sur
 * l'écran de connexion ou sur celui de premier lancement.
 *
 * `undefined` tant que la réponse n'est pas arrivée : les routes attendent
 * plutôt que de rediriger vers le mauvais écran puis de se corriger.
 *
 * `revalidateKey` doit changer à chaque bascule de session — sans quoi, après
 * la création du tout premier compte puis une déconnexion, on garderait un
 * `hasAccount: false` périmé et on renverrait vers un écran d'inscription que
 * le serveur refuse désormais.
 */
export function useAuthState(revalidateKey?: string | null) {
  const [hasAccount, setHasAccount] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    api
      .authState()
      .then((state) => {
        if (!cancelled) setHasAccount(state.hasAccount)
      })
      .catch(() => {
        // API injoignable : on suppose qu'un compte existe, donc écran de
        // connexion — c'est là que l'erreur réseau sera visible et actionnable.
        if (!cancelled) setHasAccount(true)
      })
    return () => {
      cancelled = true
    }
  }, [revalidateKey])

  return { hasAccount, isPending: hasAccount === undefined }
}
