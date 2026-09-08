import { auth } from '../auth.js'
import { DEV_EMAIL, DEV_NAME, DEV_PASSWORD, DEV_PROJECT_NAME } from './dev-account.js'
import { db, hasAccount, pool } from './index.js'

/**
 * Dev-only shortcut: creates the account through better-auth (so the
 * password goes through the real hasher, same as a real sign-up) plus its
 * first project, skipping the sign-up screen entirely.
 */
async function seedAccount() {
  if (await hasAccount()) {
    console.log('An account already exists on this space — nothing to do.')
    return
  }

  const { user } = await auth.api.signUpEmail({
    body: { name: DEV_NAME, email: DEV_EMAIL, password: DEV_PASSWORD },
  })

  await db.insertInto('projects').values({ userId: user.id, name: DEV_PROJECT_NAME }).execute()

  console.log(`✓ Dev account ready — ${DEV_EMAIL} / ${DEV_PASSWORD}`)
}

try {
  await seedAccount()
} finally {
  await pool.end()
}
