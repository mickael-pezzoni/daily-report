import { LANGUAGE_CODES } from '@daily-report/types'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Requêtes relatives : le proxy de Vite (`/api` → :3001 en dev) et le reverse
 * proxy en production les envoient à l'API, sans CORS ni URL à configurer.
 *
 * `inferAdditionalFields` est déclaré par son schéma plutôt qu'en
 * `inferAdditionalFields<typeof auth>()` : le web ne dépend que de
 * `@daily-report/types`, il n'atteint pas les types d'`apps/api`. C'est lui qui
 * fait exister `session.user.language` et `updateUser({ language })`.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  // Le champ est déclaré comme côté serveur, `required: false` compris : sans
  // ça le type promettrait une langue là où un compte neuf a `null`.
  plugins: [
    inferAdditionalFields({
      user: { language: { type: [...LANGUAGE_CODES], required: false } },
    }),
  ],
})

export const { signIn, signUp, signOut, updateUser, useSession } = authClient
