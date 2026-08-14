import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { updateUser } from '../api/auth-client'
import { isLanguageCode, type LanguageCode } from '../i18n'

/** La forme minimale attendue de `useSession().data`. */
type SyncableSession = { user: { language?: LanguageCode | null } } | null | undefined

/**
 * Accorde la langue de l'interface sur celle du compte.
 *
 * i18next s'initialise avant toute session — sur `localStorage` puis le
 * navigateur. C'est le bon repli tant qu'on ne sait pas qui regarde l'écran :
 * ce hook ne fait que reprendre la main dès que la session arrive, pour que se
 * connecter depuis un autre navigateur restitue la langue choisie.
 *
 * `changeLanguage()` réécrit `localStorage` au passage (`caches` de la
 * détection) : le cache local finit donc par refléter le compte, et le prochain
 * démarrage part déjà dans la bonne langue, avant même la session.
 */
export function useLanguageSync(session: SyncableSession) {
  const { i18n } = useTranslation()
  // La dernière valeur de compte qu'on a appliquée. Sans elle, un effet rejoué
  // avec une session encore périmée rebasculerait la langue que l'utilisateur
  // vient de choisir dans le menu.
  const appliedRef = useRef<LanguageCode | null>(null)

  const signedIn = Boolean(session)
  const accountLanguage = session?.user.language ?? null

  useEffect(() => {
    if (!signedIn) {
      // Hors session, le navigateur gouverne. On oublie ce qu'on a appliqué :
      // la prochaine connexion doit pouvoir réimposer sa langue, fût-ce la même.
      appliedRef.current = null
      return
    }

    const local = i18n.resolvedLanguage ?? i18n.language

    if (!accountLanguage) {
      // Compte sans préférence : le tout premier lancement, ou un compte créé
      // avant que la colonne existe. On y sème la langue courante plutôt que de
      // laisser la colonne vide — sinon rien ne la remplirait jamais tant que
      // l'utilisateur garde la langue qui lui convient déjà.
      if (isLanguageCode(local)) void updateUser({ language: local }).catch(() => {})
      return
    }

    if (appliedRef.current === accountLanguage) return
    appliedRef.current = accountLanguage
    if (accountLanguage !== local) void i18n.changeLanguage(accountLanguage)
  }, [signedIn, accountLanguage, i18n])
}
