import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { env } from '../env.js'
import type { Database } from './schema.js'

const { Pool } = pg

/**
 * Le pool partagé. Trois consommateurs :
 *   - better-auth, à qui on le passe directement (`src/auth.ts`)
 *   - Kysely, via le dialecte ci-dessous
 *   - les requêtes brutes sur les tables better-auth (voir `hasAccount`)
 */
export const pool = new Pool({ connectionString: env.DATABASE_URL })

/**
 * Instance Kysely des tables applicatives. Le CamelCasePlugin fait le pont
 * entre le snake_case en base et le camelCase en TypeScript — il ne doit
 * donc jamais toucher aux tables de better-auth, qui sont déjà en camelCase.
 */
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  plugins: [new CamelCasePlugin()],
})

/**
 * Un compte existe-t-il déjà sur cet espace ?
 *
 * Requête brute assumée : la table `user` appartient à better-auth, elle ne
 * passe pas par Kysely. C'est le seul point de vérité derrière l'écran de
 * premier lancement et derrière le verrou d'inscription.
 */
export async function hasAccount(): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM "user" LIMIT 1')
  return (rowCount ?? 0) > 0
}
