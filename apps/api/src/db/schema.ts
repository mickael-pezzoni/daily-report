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
  attachments: AttachmentsTable
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
  /**
   * Nom de config `regconfig` (`french`/`english`), figé à la création par un
   * déclencheur SQL depuis la langue du compte — jamais écrit par le code
   * applicatif.
   */
  searchLanguage: Generated<string>
  /** Colonne générée par Postgres à partir de `title`/`contentText` — lecture seule. */
  searchVector: ColumnType<string, never, never>
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
}

export interface AttachmentsTable {
  id: Generated<string>
  noteId: string
  /** Clé opaque dans le stockage — voir `src/storage/driver.ts`. */
  storageKey: string
  filename: string
  mimeType: string
  /**
   * `BIGINT` côté Postgres : `pg` le rend en chaîne pour ne pas perdre de
   * précision. On le reconvertit à la frontière HTTP.
   */
  sizeBytes: ColumnType<string, number, number>
  createdAt: Generated<Date>
}
