import { useTranslation } from 'react-i18next'

/** The waiting screen: shown while some piece of information that drives navigation is missing. */
export function Splash() {
  const { t } = useTranslation()
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100dvh',
        color: 'var(--app-text-muted)',
      }}
    >
      {t('app.loading')}
    </div>
  )
}
