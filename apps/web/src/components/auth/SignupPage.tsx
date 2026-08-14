import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signUp } from '../../api/auth-client'
import { authErrorKeys } from '../../i18n/api-errors'
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from '../../i18n'
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // La langue choisie ici est celle du compte qui n'existe pas encore : il n'y
  // a pas de session pour la porter, contrairement à `UserMenu`. Elle part de
  // la langue déjà affichée — celle que `localStorage`/le navigateur ont
  // choisie avant que ce compte existe.
  const [language, setLanguage] = useState<LanguageCode>(
    LANGUAGES.find((entry) => entry.code === i18n.resolvedLanguage)?.code ?? DEFAULT_LANGUAGE,
  )
  const [errorKeys, setErrorKeys] = useState<string[] | null>(null)
  const [pending, setPending] = useState(false)

  function chooseLanguage(code: LanguageCode) {
    setLanguage(code)
    // Change l'écran tout de suite : choisir « English » ici doit se voir
    // avant même de valider le formulaire, comme dans le menu utilisateur.
    void i18n.changeLanguage(code)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKeys(null)
    setPending(true)

    const { error: signUpError } = await signUp.email({ name, email, password, language })

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

        <div className="field">
          <label htmlFor="language">{t('auth.fields.language')}</label>
          <select
            id="language"
            className="input"
            value={language}
            onChange={(event) => chooseLanguage(event.target.value as LanguageCode)}
          >
            {LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

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
