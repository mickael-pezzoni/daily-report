import type { AuthState } from '@daily-report/types'
import { Hono } from 'hono'
import { hasAccount } from '../db/index.js'

/**
 * Public route, called by the web app before any session exists: it decides
 * whether to show the sign-in screen or the first-launch screen.
 */
const authState = new Hono()

authState.get('/', async (c) => {
  return c.json<AuthState>({ hasAccount: await hasAccount() })
})

export default authState
