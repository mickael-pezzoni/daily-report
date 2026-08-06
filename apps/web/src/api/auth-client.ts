import { createAuthClient } from 'better-auth/react'

/**
 * Requêtes relatives : le proxy de Vite (`/api` → :3001 en dev) et le reverse
 * proxy en production les envoient à l'API, sans CORS ni URL à configurer.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
})

export const { signIn, signUp, signOut, useSession } = authClient
