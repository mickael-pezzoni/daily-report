import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signOut, updateUser, useSession } from '../../api/auth-client'
import { LANGUAGES, type LanguageCode } from '../../i18n'
import styles from './UserMenu.module.css'

/**
 * L'écran 6a de la maquette : la puce « 👤 Prénom » de l'en-tête et son menu
 * — langue, puis déconnexion.
 *
 * C'est la maquette qui place le choix de langue ici plutôt qu'en réglage à
 * part ; le bouton ⏻ autonome qui existait avant s'y range.
 */
export function UserMenu() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // Le prénom vient de la session, pas d'un appel à part : better-auth le
  // porte déjà (colonne `name` de la table `user`), comme la langue.
  const { data: session } = useSession()
  const name = session?.user.name ?? ''
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [languagesOpen, setLanguagesOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const current = LANGUAGES.find((language) => language.code === i18n.resolvedLanguage)

  // Referme au clic ailleurs et à Échap : sans ça le menu resterait ouvert
  // par-dessus le calendrier pendant qu'on travaille.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Le sous-menu des langues ne survit pas à la fermeture du menu : le rouvrir
  // doit repartir de l'état de la maquette, replié.
  useEffect(() => {
    if (!open) setLanguagesOpen(false)
  }, [open])

  async function handleSignOut() {
    setPending(true)
    await signOut()
    setPending(false)
    setOpen(false)
    void navigate('/login', { replace: true })
  }

  function chooseLanguage(code: LanguageCode) {
    void i18n.changeLanguage(code)
    // La langue est une préférence du compte, pas du navigateur : on l'y écrit
    // sans faire attendre le menu. Un échec réseau n'annule rien — le choix
    // tient déjà en local, et la maquette 6a n'offre aucune place pour le dire.
    void updateUser({ language: code }).catch(() => {})
    setLanguagesOpen(false)
    setOpen(false)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.avatar}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('auth.menu.open')}
        // Le prénom visible devient le nom accessible du bouton ; un
        // `aria-label` fixe le masquerait, et dirait autre chose que ce qui est
        // écrit. Il ne sert donc qu'au repli, quand il n'y a rien à lire.
        aria-label={name ? undefined : t('auth.menu.open')}
      >
        <span className={styles.avatarDot} aria-hidden="true">
          👤
        </span>
        {name ? <span className={styles.name}>{name}</span> : null}
      </button>

      {open ? (
        <div className={`card elev-lg ${styles.menu}`} role="menu">
          <button
            type="button"
            className={styles.item}
            onClick={() => setLanguagesOpen((value) => !value)}
            aria-expanded={languagesOpen}
          >
            <span aria-hidden="true">🌐</span>
            {t('auth.menu.language')}
            <span className={styles.spacer} />
            <span className={styles.value}>
              {current?.label} {languagesOpen ? '▴' : '▾'}
            </span>
          </button>

          {languagesOpen ? (
            <div className={styles.languages}>
              {LANGUAGES.map((language) => (
                <button
                  type="button"
                  key={language.code}
                  className={styles.item}
                  onClick={() => chooseLanguage(language.code)}
                  aria-current={language.code === current?.code}
                >
                  <span className={styles.check} aria-hidden="true">
                    {language.code === current?.code ? '✓' : ''}
                  </span>
                  {/* Chaque langue s'écrit dans sa propre langue : « English »
                      reste « English » pour qui lit l'interface en français. */}
                  <span lang={language.code}>{language.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className={`${styles.item} ${styles.signOut}`}
            onClick={handleSignOut}
            disabled={pending}
          >
            <span aria-hidden="true">⏻</span>
            {t('auth.signOut')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
