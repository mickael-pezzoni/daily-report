import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useSession } from '../../api/auth-client'
import { api } from '../../api/client'
import { apiErrorKey } from '../../i18n/api-errors'
import { Splash } from '../ui/Splash'
import { AuthShell } from './AuthShell'
import formStyles from './AuthForm.module.css'
import styles from './McpConsentPage.module.css'

/**
 * Consent screen for the OAuth rail (mcp plugin): `/mcp/authorize` redirects
 * an already signed-in browser here, with `consent_code`/`client_id`/`scope`
 * in the query — never a human-readable client name, hence the call to
 * `GET /api/oauth-clients/:clientId`. The plugin only triggers this screen
 * if the OAuth client requested `prompt=consent` on its initial request —
 * see CLAUDE.md.
 */
export function McpConsentPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { data: session, isPending: sessionPending } = useSession()

  const consentCode = searchParams.get('consent_code')
  const clientId = searchParams.get('client_id')
  const scopes = (searchParams.get('scope') ?? '').split(' ').filter(Boolean)

  const [clientName, setClientName] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [pending, setPending] = useState<'accept' | 'deny' | null>(null)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    api.oauthClients
      .get(clientId)
      .then((info) => {
        if (!cancelled) setClientName(info.name)
      })
      // Falls back to the raw `client_id`, rendered further down — a client
      // with no readable name shouldn't block the screen.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clientId])

  async function respond(accept: boolean) {
    if (!consentCode) return
    setPending(accept ? 'accept' : 'deny')
    setErrorKey(null)
    try {
      const { redirectURI } = await api.mcp.consent({ accept, consentCode })
      window.location.assign(redirectURI)
    } catch (cause) {
      setPending(null)
      setErrorKey(apiErrorKey(cause, 'mcp.consent.errors.failed'))
    }
  }

  if (sessionPending) return <Splash />

  if (!session) {
    return (
      <AuthShell band={{ title: t('auth.band.loginTitle'), subtitle: '' }} head={{ title: t('mcp.consent.title') }}>
        <p className={formStyles.error} role="alert">
          {t('errors.unauthorized')}
        </p>
        <a className="btn btn-primary btn-block" href="/login">
          {t('auth.login.title')}
        </a>
      </AuthShell>
    )
  }

  if (!consentCode || !clientId) {
    return (
      <AuthShell band={{ title: t('auth.band.loginTitle'), subtitle: '' }} head={{ title: t('mcp.consent.title') }}>
        <p className={formStyles.error} role="alert">
          {t('mcp.consent.errors.invalidLink')}
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      band={{ title: t('auth.band.loginTitle'), subtitle: t('mcp.consent.subtitle') }}
      head={{
        title: t('mcp.consent.title'),
        subtitle: t('mcp.consent.prompt', { client: clientName ?? clientId }),
      }}
    >
      {scopes.length > 0 ? (
        <ul className={styles.scopes}>
          {scopes.map((scope) => (
            <li key={scope} className="tag tag-neutral">
              {scope}
            </li>
          ))}
        </ul>
      ) : null}

      {errorKey ? (
        <p className={formStyles.error} role="alert">
          {t(errorKey)}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-block"
          onClick={() => respond(false)}
          disabled={pending !== null}
        >
          {pending === 'deny' ? t('mcp.consent.denyPending') : t('mcp.consent.deny')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => respond(true)}
          disabled={pending !== null}
        >
          {pending === 'accept' ? t('mcp.consent.acceptPending') : t('mcp.consent.accept')}
        </button>
      </div>
    </AuthShell>
  )
}
