import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { signUp } from '../../api/auth-client'
import { api } from '../../api/client'
import { apiErrorKey, authErrorKeys } from '../../i18n/api-errors'
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from '../../i18n'
import { projectDotColor } from '../../lib/project-colors'
import { AuthShell } from './AuthShell'
import { PasswordField } from './PasswordField'
import { PasswordStrength } from './PasswordStrength'
import styles from './AuthForm.module.css'

/**
 * Écran 2e/10a de la maquette — premier lancement, projets compris.
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
  // Au moins un projet, comme le dit la maquette 10a.
  const [projectNames, setProjectNames] = useState<string[]>([''])
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

  function editProjectName(index: number, value: string) {
    setProjectNames((names) => names.map((current, i) => (i === index ? value : current)))
  }

  function addProjectField() {
    setProjectNames((names) => [...names, ''])
  }

  function removeProjectField(index: number) {
    setProjectNames((names) => names.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKeys(null)

    const names = projectNames.map((n) => n.trim()).filter((n) => n.length > 0)
    if (names.length === 0) {
      setErrorKeys(['auth.signup.projectsRequired'])
      return
    }

    setPending(true)

    const { error: signUpError } = await signUp.email({ name, email, password, language })
    if (signUpError) {
      setPending(false)
      setErrorKeys(authErrorKeys(signUpError, 'auth.errors.signUpFailed'))
      return
    }

    let createdIds: string[]
    try {
      // One after another: two or three projects typed once at sign-up don't
      // need a batch route.
      createdIds = []
      for (const projectName of names) {
        const project = await api.projects.create({ name: projectName })
        createdIds.push(project.id)
      }
    } catch (cause) {
      setPending(false)
      setErrorKeys([apiErrorKey(cause, 'auth.errors.signUpFailed')])
      return
    }

    setPending(false)

    // A single project opens directly. Several: nothing says which one to
    // write in today, so the selection screen decides.
    void navigate(createdIds.length === 1 ? `/projets/${createdIds[0]}` : '/projets', { replace: true })
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
          <label htmlFor="project-0">{t('auth.signup.projectsLabel')}</label>
          <div className={styles.project_list}>
            {projectNames.map((projectName, index) => (
              <div key={index} className={styles.project_row}>
                <span
                  className={styles.project_dot}
                  style={{ background: projectDotColor(index) }}
                  aria-hidden="true"
                />
                <input
                  id={`project-${index}`}
                  className="input"
                  type="text"
                  value={projectName}
                  onChange={(event) => editProjectName(index, event.target.value)}
                  placeholder={t('auth.signup.projectPlaceholder')}
                />
                {projectNames.length > 1 ? (
                  <button
                    type="button"
                    className={styles.project_remove}
                    onClick={() => removeProjectField(index)}
                    title={t('auth.signup.removeProject')}
                    aria-label={t('auth.signup.removeProject')}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className={`btn btn-secondary ${styles.add_project}`}
              onClick={addProjectField}
            >
              {t('auth.signup.addProject')}
            </button>
          </div>
        </div>

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
