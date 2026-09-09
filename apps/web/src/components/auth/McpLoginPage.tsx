import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { signIn, useSession } from '../../api/auth-client'
import { authErrorKeys } from '../../i18n/api-errors'
import { Splash } from '../ui/Splash'
import { AuthShell } from './AuthShell'
import { PasswordField } from './PasswordField'
import styles from './AuthForm.module.css'

/**
 * Resumes the authorization request in progress: `/mcp/authorize` redirected
 * a signed-out browser here with the whole request in the query (mcp
 * plugin's `loginPage`, see `apps/api/src/auth.ts`). We send it back as-is.
 */
function resumeAuthorizeUrl() {
  return `/api/auth/mcp/authorize${window.location.search}`
}

/**
 * Login page dedicated to the mcp plugin's OAuth rail — distinct from
 * `LoginPage` because success never leads into the SPA: it hands control
 * back to `/api/auth/mcp/authorize`, which resumes the OAuth flow where it
 * left off.
 */
export function McpLoginPage() {
  const { t } = useTranslation()
  const { data: session, isPending: sessionPending } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKeys, setErrorKeys] = useState<string[] | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    // Edge case (direct navigation, a tab left open): a session already
    // here has nothing to do — `/mcp/authorize` will find it on its own.
    if (session) window.location.assign(resumeAuthorizeUrl())
  }, [session])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKeys(null)
    setPending(true)

    const { error: signInError } = await signIn.email({ email, password, rememberMe: true })

    if (signInError) {
      setPending(false)
      setErrorKeys(authErrorKeys(signInError, 'auth.errors.signInFailed'))
      return
    }
    window.location.assign(resumeAuthorizeUrl())
  }

  if (sessionPending || session) return <Splash />

  return (
    <AuthShell
      band={{ title: t('auth.band.loginTitle'), subtitle: t('mcp.login.subtitle') }}
      head={{ title: t('auth.login.title'), subtitle: t('mcp.login.subtitle') }}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">{t('auth.fields.email')}</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('auth.fields.emailPlaceholder')}
            autoComplete="email"
            required
          />
        </div>

        <PasswordField
          label={t('auth.fields.password')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {errorKeys ? (
          <p className={styles.error} role="alert">
            {t(errorKeys)}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? t('auth.login.submitPending') : t('auth.login.submit')}
        </button>
      </form>
    </AuthShell>
  )
}
