import type { CalendarMonth } from '@daily-report/types'
import { Hono } from 'hono'
import { sql } from 'kysely'
import { db } from '../db/index.js'
import { isUuid, isValidMonth } from '../lib/validate.js'
import type { AuthedEnv } from '../middleware/require-auth.js'

const calendar = new Hono<AuthedEnv>()

/**
 * `GET /api/calendar/:month?projectId=…` — which days of the month carry a
 * note in this project.
 *
 * A read model in its own right: "the calendar for August 2026". It's what
 * lights up the sage dots in the sidebar.
 */
calendar.get('/:month', async (c) => {
  const month = c.req.param('month')
  if (!isValidMonth(month)) return c.json({ error: 'invalid month, expected YYYY-MM' }, 400)

  const projectId = c.req.query('projectId')
  if (projectId !== undefined && !isUuid(projectId)) {
    return c.json({ error: 'invalid projectId' }, 400)
  }

  let query = db
    .selectFrom('dailyNotes')
    .select('noteDate')
    .where('userId', '=', c.get('userId'))
    // Exclusive upper bound: the interval stays computed by Postgres, and
    // the (user_id, note_date) index remains usable.
    .where('noteDate', '>=', sql<string>`${`${month}-01`}::date`)
    .where('noteDate', '<', sql<string>`${`${month}-01`}::date + interval '1 month'`)

  if (projectId !== undefined) query = query.where('projectId', '=', projectId)

  const rows = await query.orderBy('noteDate', 'asc').execute()

  return c.json<CalendarMonth>({ month, daysWithNotes: rows.map((row) => row.noteDate) })
})

export default calendar
