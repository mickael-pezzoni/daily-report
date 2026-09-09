import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { updateUser } from '../api/auth-client'
import { isLanguageCode, type LanguageCode } from '../i18n'

/** The minimal shape expected of `useSession().data`. */
type SyncableSession = { user: { language?: LanguageCode | null } } | null | undefined

/**
 * Aligns the interface language with the account's.
 *
 * i18next initializes before any session — from `localStorage`, then the
 * browser. That's the right fallback while we don't yet know who's looking at
 * the screen: this hook just takes over as soon as the session arrives, so
 * signing in from another browser restores the chosen language.
 *
 * `changeLanguage()` rewrites `localStorage` along the way (the detector's
 * `caches`): the local cache thus ends up reflecting the account, and the next
 * startup already begins in the right language, even before the session.
 */
export function useLanguageSync(session: SyncableSession) {
  const { i18n } = useTranslation()
  // The last account value we applied. Without it, an effect re-run with a
  // still-stale session would switch back the language the user just chose
  // in the menu.
  const appliedRef = useRef<LanguageCode | null>(null)

  const signedIn = Boolean(session)
  const accountLanguage = session?.user.language ?? null

  useEffect(() => {
    if (!signedIn) {
      // Outside a session, the browser is in charge. Forget what we applied:
      // the next sign-in must be able to reimpose its language, even if it's
      // the same one.
      appliedRef.current = null
      return
    }

    const local = i18n.resolvedLanguage ?? i18n.language

    if (!accountLanguage) {
      // Account with no preference: the very first launch, or an account
      // created before the column existed. Seed it with the current language
      // rather than leaving the column empty — otherwise nothing would ever
      // fill it as long as the user keeps a language that already suits them.
      if (isLanguageCode(local)) void updateUser({ language: local }).catch(() => {})
      return
    }

    if (appliedRef.current === accountLanguage) return
    appliedRef.current = accountLanguage
    if (accountLanguage !== local) void i18n.changeLanguage(accountLanguage)
  }, [signedIn, accountLanguage, i18n])
}
