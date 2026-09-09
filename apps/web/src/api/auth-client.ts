import { LANGUAGE_CODES } from '@daily-report/types'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Relative requests: Vite's proxy (`/api` → :3001 in dev) and the production
 * reverse proxy send them to the API, with no CORS or URL to configure.
 *
 * `inferAdditionalFields` is declared via its schema rather than
 * `inferAdditionalFields<typeof auth>()`: the web only depends on
 * `@daily-report/types`, it doesn't reach `apps/api`'s types. This is what
 * makes `session.user.language` and `updateUser({ language })` exist.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  // The field is declared the same way as on the server, `required: false`
  // included: without it the type would promise a language where a new
  // account has `null`.
  plugins: [
    inferAdditionalFields({
      user: { language: { type: [...LANGUAGE_CODES], required: false } },
    }),
  ],
})

export const { signIn, signUp, signOut, updateUser, useSession } = authClient
