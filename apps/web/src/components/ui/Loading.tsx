import { useTranslation } from 'react-i18next'
import styles from './Loading.module.css'

/** Generic inline loading indicator — a small spinner, for a region that's still fetching its data. */
export function Loading() {
  const { t } = useTranslation()
  return (
    <div className={styles.loading} role="status" aria-label={t('app.loading')}>
      <span className={styles.spinner} aria-hidden="true" />
    </div>
  )
}
