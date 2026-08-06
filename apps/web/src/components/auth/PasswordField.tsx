import { useId, useState } from 'react'
import styles from './PasswordField.module.css'

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  children?: React.ReactNode
}

/**
 * Champ mot de passe avec la bascule « afficher / masquer » de la maquette,
 * commun aux deux écrans d'authentification.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  children,
}: PasswordFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={styles.wrapper}>
        <input
          id={id}
          className={`input ${styles.input}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
        >
          {visible ? 'masquer' : 'afficher'}
        </button>
      </div>
      {children}
    </div>
  )
}
