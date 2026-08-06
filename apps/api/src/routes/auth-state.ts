import type { AuthState } from '@daily-report/types'
import { Hono } from 'hono'
import { hasAccount } from '../db/index.js'

/**
 * Route publique, appelée par le web avant toute session : elle décide si on
 * montre l'écran de connexion ou celui du premier lancement.
 */
const authState = new Hono()

authState.get('/', async (c) => {
  return c.json<AuthState>({ hasAccount: await hasAccount() })
})

export default authState
