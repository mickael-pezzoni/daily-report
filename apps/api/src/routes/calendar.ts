import type { CalendarMonth } from '@daily-report/types'
import { Hono } from 'hono'
import { sql } from 'kysely'
import { db } from '../db/index.js'
import { isValidMonth } from '../lib/validate.js'
import type { AuthedEnv } from '../middleware/require-auth.js'

const calendar = new Hono<AuthedEnv>()

/**
 * `GET /api/calendar/:month` — quels jours du mois portent une note.
 *
 * Modèle de lecture à part entière : « le calendrier d'août 2026 ». C'est ce
 * qui allume les pastilles sauge de la barre latérale.
 */
calendar.get('/:month', async (c) => {
  const month = c.req.param('month')
  if (!isValidMonth(month)) return c.json({ error: 'mois invalide, attendu YYYY-MM' }, 400)

  const rows = await db
    .selectFrom('dailyNotes')
    .select('noteDate')
    .where('userId', '=', c.get('userId'))
    // Borne haute exclusive : l'intervalle reste calculé par Postgres, et
    // l'index (user_id, note_date) est utilisable.
    .where('noteDate', '>=', sql<string>`${`${month}-01`}::date`)
    .where('noteDate', '<', sql<string>`${`${month}-01`}::date + interval '1 month'`)
    .orderBy('noteDate', 'asc')
    .execute()

  return c.json<CalendarMonth>({ month, daysWithNotes: rows.map((row) => row.noteDate) })
})

export default calendar
