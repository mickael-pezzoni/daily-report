import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signOut, updateUser, useSession } from '../../api/auth-client'
import { LANGUAGES, type LanguageCode } from '../../i18n'
import styles from './UserMenu.module.css'

/**
 * Screen 6a of the mockup: the "👤 First name" chip in the header and its
 * menu — change project, then language, then sign out.
 *
 * It's the mockup that places the language choice here rather than in a
 * separate setting; the standalone ⏻ button that used to exist fits in
 * there too. "Change project" only opens `/projects` (screen 10b) — the
 * list, switching, and creating a project all live over there, not in this
 * menu.
 */
export function UserMenu() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // The first name comes from the session, not a separate call: better-auth
  // already carries it (the `name` column of the `user` table), like the language.
  const { data: session } = useSession()
  const name = session?.user.name ?? ''
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [languagesOpen, setLanguagesOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const current = LANGUAGES.find((language) => language.code === i18n.resolvedLanguage)

  // Closes on an outside click or Escape: without this, the menu would stay
  // open over the calendar while working.
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

  // The language submenu doesn't survive the menu closing: reopening it
  // must start over from the mockup's state, collapsed.
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
    // The language is an account preference, not a browser one: we write it
    // there without making the menu wait. A network failure cancels nothing —
    // the choice already holds locally, and mockup 6a offers no place to say so.
    void updateUser({ language: code }).catch(() => {})
    setLanguagesOpen(false)
    setOpen(false)
  }

  function handleChangeProject() {
    setOpen(false)
    void navigate('/projets')
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
        // The visible first name becomes the button's accessible name; a
        // fixed `aria-label` would mask it and say something other than
        // what's written. So it only serves as a fallback, when there's
        // nothing to read.
        aria-label={name ? undefined : t('auth.menu.open')}
      >
        <span className={styles.avatar_dot} aria-hidden="true">
          👤
        </span>
        {name ? <span className={styles.name}>{name}</span> : null}
      </button>

      {open ? (
        <div className={`card elev-lg ${styles.menu}`} role="menu">
          <button type="button" className={styles.item} onClick={handleChangeProject}>
            <span aria-hidden="true">⇄</span>
            {t('auth.menu.manageProjects')}
          </button>

          <div className={styles.divider} />

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
                  {/* Each language is written in its own language: "English"
                      stays "English" for someone reading the interface in French. */}
                  <span lang={language.code}>{language.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className={`${styles.item} ${styles.sign_out}`}
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
