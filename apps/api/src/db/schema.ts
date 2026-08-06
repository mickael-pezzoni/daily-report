/**
 * Interface Kysely des tables *applicatives*.
 *
 * ⚠️ Les tables de better-auth (`user`, `session`, `account`, `verification`)
 * n'y figurent volontairement pas : leurs colonnes sont en camelCase entre
 * guillemets ("emailVerified", "userId"), et le CamelCasePlugin monté sur
 * l'instance Kysely les réécrirait en snake_case. Pour les interroger, passer
 * par `pool.query()` (voir `src/db/index.ts`).
 *
 * Les tables des notes, pièces jointes, etc. viendront ici, en snake_case.
 */
export interface Database {}
