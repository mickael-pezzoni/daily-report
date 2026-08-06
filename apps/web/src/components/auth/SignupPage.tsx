import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { signUp } from '../../api/auth-client'
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
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const { error: signUpError } = await signUp.email({ name, email, password })

    setPending(false)
    if (signUpError) {
      setError(signUpError.message ?? 'La création du compte a échoué.')
      return
    }
    void navigate('/', { replace: true })
  }

  return (
    <AuthShell
      band={{
        title: 'Bienvenue — créons votre compte',
        subtitle: 'Une seule fois, au premier lancement.',
      }}
      head={{
        title: 'Créer votre compte',
        subtitle: "Aucun compte sur cet espace — cet écran ne s'affichera plus ensuite.",
      }}
      footnote="Vos notes restent sur cet espace."
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Prénom</label>
          <input
            id="name"
            className="input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Camille"
            autoComplete="given-name"
            required
          />
        </div>

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
          autoComplete="new-password"
        >
          <PasswordStrength password={password} />
        </PasswordField>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthShell>
  )
}
