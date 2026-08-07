import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { signIn } from '../../api/auth-client'
import { todayISO } from '../../lib/dates'
import { AuthShell } from './AuthShell'
import { PasswordField } from './PasswordField'
import styles from './AuthForm.module.css'

/** Écran 2d de la maquette. */
export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const { error: signInError } = await signIn.email({ email, password, rememberMe })

    setPending(false)
    if (signInError) {
      setError(
        signInError.message ?? 'Connexion impossible. Vérifiez votre e-mail et votre mot de passe.',
      )
      return
    }
    // L'application ouvre directement sur la note du jour.
    void navigate(`/notes/${todayISO()}`, { replace: true })
  }

  return (
    <AuthShell
      band={{
        title: 'Mon journal de travail',
        subtitle: 'Notez votre journée en une minute.',
      }}
      head={{ title: 'Se connecter' }}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@exemple.fr"
            autoComplete="email"
            required
          />
        </div>

        <PasswordField
          label="Mot de passe"
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
            Rester connecté
          </label>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthShell>
  )
}
