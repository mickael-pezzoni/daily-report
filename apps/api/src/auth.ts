import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { hasAccount, pool } from './db/index.js'
import { env } from './env.js'

export const auth = betterAuth({
  // better-auth gère ses propres tables (`user`, `session`, `account`,
  // `verification`) via son adaptateur Kysely interne, sur le pool partagé.
  database: pool,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_URL],
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    /**
     * Espace mono-compte : l'inscription n'est ouverte qu'au premier
     * lancement. Une fois le compte créé, l'écran de création disparaît côté
     * web — ce verrou fait la même chose côté serveur, où ça compte.
     */
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email' && (await hasAccount())) {
        throw new APIError('FORBIDDEN', {
          code: 'SIGNUP_CLOSED',
          message: 'Un compte existe déjà sur cet espace.',
        })
      }
    }),
  },
})
