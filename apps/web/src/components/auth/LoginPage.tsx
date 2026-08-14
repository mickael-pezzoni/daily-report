import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signIn } from '../../api/auth-client'
import { authErrorKeys } from '../../i18n/api-errors'
import { todayISO } from '../../lib/dates'
import { AuthShell } from './AuthShell'
import { PasswordField } from './PasswordField'
import styles from './AuthForm.module.css'

/** Écran 2d de la maquette. */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  // La clé, pas le texte : changer de langue doit aussi retraduire l'erreur
  // déjà affichée.
  const [errorKeys, setErrorKeys] = useState<string[] | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKeys(null)
    setPending(true)

    const { error: signInError } = await signIn.email({ email, password, rememberMe })

    setPending(false)
    if (signInError) {
      setErrorKeys(authErrorKeys(signInError, 'auth.errors.signInFailed'))
      return
    }
    // L'application ouvre directement sur la note du jour.
    void navigate(`/notes/${todayISO()}`, { replace: true })
  }

  return (
    <AuthShell
      band={{
        title: t('auth.band.loginTitle'),
        subtitle: t('auth.band.loginSubtitle'),
      }}
      head={{ title: t('auth.login.title') }}
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

        <div className={styles.row}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span className={styles.box} />
            {t('auth.login.rememberMe')}
          </label>
        </div>

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
