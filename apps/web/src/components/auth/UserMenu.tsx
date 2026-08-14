import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signOut } from '../../api/auth-client'
import { LANGUAGES } from '../../i18n'
import styles from './UserMenu.module.css'

/**
 * L'écran 6a de la maquette : la pastille 👤 de la barre latérale et son menu
 * — langue, puis déconnexion.
 *
 * C'est la maquette qui place le choix de langue ici plutôt qu'en réglage à
 * part ; le bouton ⏻ autonome qui existait avant s'y range.
 */
export function UserMenu() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
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

  function chooseLanguage(code: string) {
    void i18n.changeLanguage(code)
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
        aria-label={t('auth.menu.open')}
      >
        👤
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
