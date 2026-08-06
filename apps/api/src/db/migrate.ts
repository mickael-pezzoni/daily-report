import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

/**
 * Applique les migrations SQL de `migrations/` dans l'ordre alphabétique.
 * Chaque fichier passe dans sa propre transaction et n'est joué qu'une fois —
 * ne jamais rééditer un fichier déjà appliqué, en ajouter un nouveau.
 */
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const { rows } = await pool.query<{ name: string }>('SELECT name FROM _migrations')
  const applied = new Set(rows.map((row) => row.name))

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('Aucune migration en attente.')
    return
  }

  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`✓ ${file}`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`✗ ${file}`)
      throw error
    } finally {
      client.release()
    }
  }
}

try {
  await migrate()
} finally {
  await pool.end()
}
