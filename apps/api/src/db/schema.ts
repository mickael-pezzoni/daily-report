import type { ColumnType, Generated } from 'kysely'
import type { RichTextDoc } from '@daily-report/types'

/**
 * Interface Kysely des tables *applicatives*.
 *
 * ⚠️ Les tables de better-auth (`user`, `session`, `account`, `verification`)
 * n'y figurent volontairement pas : leurs colonnes sont en camelCase entre
 * guillemets ("emailVerified", "userId"), et le CamelCasePlugin monté sur
 * l'instance Kysely les réécrirait en snake_case. Pour les interroger, passer
 * par `pool.query()` (voir `src/db/index.ts`).
 *
 * ⚠️ Le CamelCasePlugin traduit aussi les **noms de tables** : la clé
 * `dailyNotes` ci-dessous vise bien la table `daily_notes`, et `noteDate` la
 * colonne `note_date`. Écrire les clés en snake_case ici produirait du
 * `daily__notes` en SQL.
 */
export interface Database {
  dailyNotes: DailyNotesTable
}

export interface DailyNotesTable {
  id: Generated<string>
  userId: string
  /**
   * `DATE` côté Postgres, chaîne `YYYY-MM-DD` côté TypeScript — le parseur posé
   * dans `src/db/index.ts` empêche `pg` d'en faire un objet `Date`.
   */
  noteDate: string
  title: string
  content: ColumnType<RichTextDoc, RichTextDoc, RichTextDoc>
  contentText: string
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
}
