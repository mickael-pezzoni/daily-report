import { useTranslation } from 'react-i18next'
import styles from './PasswordStrength.module.css'

/**
 * Les trois barres de la maquette 2e. Indication visuelle seulement : la règle
 * qui fait foi est celle du serveur (better-auth impose 8 caractères minimum).
 */
function score(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) return password.length === 0 ? 0 : 1
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(password)).length
  if (password.length >= 12 && variety >= 3) return 3
  return 2
}

const LABEL_KEYS = ['', 'auth.strength.weak', 'auth.strength.fair', 'auth.strength.strong'] as const

export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation()
  const level = score(password)
  if (level === 0) return null

  return (
    <div className={styles.meter}>
      {[1, 2, 3].map((step) => (
        <span key={step} className={step <= level ? styles.barFilled : styles.bar} />
      ))}
      <span className={styles.label}>{t(LABEL_KEYS[level])}</span>
    </div>
  )
}
