import { LANGUAGE_CODES } from '@daily-report/types'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { mcp } from 'better-auth/plugins'
import { hasAccount, pool } from './db/index.js'
import { env } from './env.js'

export const auth = betterAuth({
  // better-auth manages its own tables (`user`, `session`, `account`,
  // `verification`) via its internal Kysely adapter, on the shared pool.
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
       * The interface language, tied to the account rather than the browser.
       *
       * The type is the literal list of codes rather than `'string'`: that's
       * what gives the client the `'fr' | 'en'` type. ⚠️ This isn't
       * validation — better-auth turns a literal-list type into a
       * `z.any()` (`dist/db/to-zod.mjs`). It's the `before` hook below that
       * rejects unknown codes.
       *
       * Nullable (`required: false`): an account that never chose leaves it
       * to the browser to decide.
       */
      language: { type: [...LANGUAGE_CODES], required: false },
    },
  },
  plugins: [
    // OAuth rail for external MCP clients — see CLAUDE.md. `loginPage` and
    // `consentPage` are absolute web URLs, not API routes: this is where
    // better-auth redirects a browser to.
    mcp({
      loginPage: `${env.WEB_URL}/mcp/login`,
      resource: env.BETTER_AUTH_URL,
      oidcConfig: {
        // Redundant with `loginPage` above: `oidcConfig` has its own type
        // (`OIDCOptions`), which requires it too.
        loginPage: `${env.WEB_URL}/mcp/login`,
        consentPage: `${env.WEB_URL}/mcp/consent`,
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      /**
       * Single-account space: sign-up is only open on first launch. Once the
       * account is created, the sign-up screen disappears client-side — this
       * lock does the same thing server-side, where it actually matters.
       */
      if (ctx.path === '/sign-up/email' && (await hasAccount())) {
        throw new APIError('FORBIDDEN', {
          code: 'SIGNUP_CLOSED',
          message: 'Un compte existe déjà sur cet espace.',
        })
      }

      /**
       * The only validation of `user.language`: `additionalFields` does none
       * on a literal-list type. Without this guard, any client could drop
       * anything into the column, and the interface would silently fall back
       * to its default language on every startup.
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
