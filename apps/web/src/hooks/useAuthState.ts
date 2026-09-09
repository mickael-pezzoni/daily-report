import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Does an account exist on this space? Determines whether the app opens on
 * the sign-in screen or on the first-launch screen.
 *
 * `undefined` until the response arrives: routes wait instead of redirecting
 * to the wrong screen and then correcting themselves.
 *
 * `revalidateKey` must change on every session switch — otherwise, after the
 * very first account is created and then a sign-out, we'd keep a stale
 * `hasAccount: false` and redirect to a sign-up screen the server now refuses.
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
        // API unreachable: assume an account exists, so the sign-in screen —
        // that's where the network error will be visible and actionable.
        if (!cancelled) setHasAccount(true)
      })
    return () => {
      cancelled = true
    }
  }, [revalidateKey])

  return { hasAccount, isPending: hasAccount === undefined }
}
