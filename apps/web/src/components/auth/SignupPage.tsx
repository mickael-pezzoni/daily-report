import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signUp } from '../../api/auth-client'
import { authErrorKeys } from '../../i18n/api-errors'
import { todayISO } from '../../lib/dates'
import { AuthShell } from './AuthShell'
import { PasswordField } from './PasswordField'
import { PasswordStrength } from './PasswordStrength'
import styles from './AuthForm.module.css'

/**
 * Écran 2e de la maquette — premier lancement.
 *
 * N'est atteignable que tant qu'aucun compte n'existe : au-delà, `App` renvoie
 * vers la connexion et l'API refuse l'inscription (403 SIGNUP_CLOSED).
 */
export function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKeys, setErrorKeys] = useState<string[] | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKeys(null)
    setPending(true)

    const { error: signUpError } = await signUp.email({ name, email, password })

    setPending(false)
    if (signUpError) {
      setErrorKeys(authErrorKeys(signUpError, 'auth.errors.signUpFailed'))
      return
    }
    // « Ensuite, l'application ouvre directement la note du jour. » — maquette 2e.
    void navigate(`/notes/${todayISO()}`, { replace: true })
  }

  return (
    <AuthShell
      band={{
        title: t('auth.band.signupTitle'),
        subtitle: t('auth.band.signupSubtitle'),
      }}
      head={{
        title: t('auth.signup.title'),
        subtitle: t('auth.signup.subtitle'),
      }}
      footnote={t('auth.signup.footnote')}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">{t('auth.fields.name')}</label>
          <input
            id="name"
            className="input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('auth.fields.namePlaceholder')}
            autoComplete="given-name"
            required
          />
        </div>

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
          autoComplete="new-password"
        >
          <PasswordStrength password={password} />
        </PasswordField>

        {errorKeys ? (
          <p className={styles.error} role="alert">
            {t(errorKeys)}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? t('auth.signup.submitPending') : t('auth.signup.submit')}
        </button>
      </form>
    </AuthShell>
  )
}
