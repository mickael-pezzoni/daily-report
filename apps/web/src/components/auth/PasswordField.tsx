import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './PasswordField.module.css'

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  children?: React.ReactNode
}

/**
 * Password field with the "show / hide" toggle from the mockup, shared by
 * both authentication screens.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  children,
}: PasswordFieldProps) {
  const { t } = useTranslation()
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
          {visible ? t('auth.fields.hide') : t('auth.fields.show')}
        </button>
      </div>
      {children}
    </div>
  )
}
