import { LANGUAGE_CODES } from '@daily-report/types'
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
  user: {
    additionalFields: {
      /**
       * La langue de l'interface, rattachée au compte plutôt qu'au navigateur.
       *
       * Le type est la liste littérale des codes plutôt que `'string'` : c'est
       * ce qui donne au client le type `'fr' | 'en'`. ⚠️ Ça ne vaut pas
       * validation — better-auth traduit un type en liste littérale par un
       * `z.any()` (`dist/db/to-zod.mjs`). C'est le hook `before` ci-dessous qui
       * refuse les codes inconnus.
       *
       * Nullable (`required: false`) : un compte qui n'a jamais choisi laisse
       * le navigateur décider.
       */
      language: { type: [...LANGUAGE_CODES], required: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      /**
       * Espace mono-compte : l'inscription n'est ouverte qu'au premier
       * lancement. Une fois le compte créé, l'écran de création disparaît côté
       * web — ce verrou fait la même chose côté serveur, où ça compte.
       */
      if (ctx.path === '/sign-up/email' && (await hasAccount())) {
        throw new APIError('FORBIDDEN', {
          code: 'SIGNUP_CLOSED',
          message: 'Un compte existe déjà sur cet espace.',
        })
      }

      /**
       * La seule validation de `user.language` : `additionalFields` n'en fait
       * aucune sur un type en liste littérale. Sans ce garde, n'importe quel
       * client déposerait n'importe quoi dans la colonne, et l'interface
       * retomberait silencieusement sur sa langue de repli à chaque démarrage.
       */
      if (ctx.path === '/sign-up/email' || ctx.path === '/update-user') {
        const { language } = (ctx.body ?? {}) as { language?: unknown }
        if (language != null && !(LANGUAGE_CODES as readonly unknown[]).includes(language)) {
          throw new APIError('BAD_REQUEST', {
            code: 'UNKNOWN_LANGUAGE',
            message: 'Unknown language code.',
          })
        }
      }
    }),
  },
})
