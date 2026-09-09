import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { env } from '../env.js'
import type { Database } from './schema.js'

const { Pool } = pg

/**
 * `pg` deserializes the `DATE` type (OID 1082) into a JS `Date` object by
 * default, which shifts the day by one as soon as the server's timezone
 * isn't UTC. We keep the `YYYY-MM-DD` string exactly as Postgres writes it:
 * it's the same value from the SQL all the way to the browser's URL.
 */
pg.types.setTypeParser(1082, (value) => value)

/**
 * The shared pool. Three consumers:
 *   - better-auth, which we pass it directly (`src/auth.ts`)
 *   - Kysely, via the dialect below
 *   - raw queries against better-auth's tables (see `hasAccount`)
 */
export const pool = new Pool({ connectionString: env.DATABASE_URL })

/**
 * Kysely instance for the application tables. The CamelCasePlugin bridges
 * snake_case in the database with camelCase in TypeScript — it must
 * therefore never touch better-auth's tables, which are already camelCase.
 */
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  plugins: [new CamelCasePlugin()],
})

/**
 * Does an account already exist on this space?
 *
 * Raw query assumed: the `user` table belongs to better-auth, it doesn't go
 * through Kysely. This is the single source of truth behind the first-launch
 * screen and the sign-up lock.
 */
export async function hasAccount(): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM "user" LIMIT 1')
  return (rowCount ?? 0) > 0
}
