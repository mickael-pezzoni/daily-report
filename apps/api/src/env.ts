import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copiez apps/api/.env.example vers apps/api/.env.`,
    )
  }
  return value
}

/** Requis seulement quand le driver de stockage choisi en a besoin. */
function requiredFor(driver: string, name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name} (obligatoire avec STORAGE_DRIVER=${driver}).`,
    )
  }
  return value
}

function boolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  return value === 'true' || value === '1'
}

function integer(name: string, fallback: number): number {
  const value = process.env[name]
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variable d'environnement invalide : ${name} doit être un entier positif.`)
  }
  return parsed
}

const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'local'
if (STORAGE_DRIVER !== 'local' && STORAGE_DRIVER !== 's3') {
  throw new Error(`STORAGE_DRIVER inconnu : ${STORAGE_DRIVER}. Attendu « local » ou « s3 ».`)
}
const usesS3 = STORAGE_DRIVER === 's3'

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  WEB_URL: process.env.WEB_URL ?? 'http://localhost:5173',
  PORT: Number(process.env.PORT ?? 3001),

  // — Stockage des pièces jointes —
  STORAGE_DRIVER,
  /** Taille maximale d'un fichier déposé. 25 Mio par défaut. */
  MAX_UPLOAD_BYTES: integer('MAX_UPLOAD_BYTES', 25 * 1024 * 1024),

  // Driver « local »
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR ?? './uploads',

  // Driver « s3 » — vérifiés seulement s'il est actif, pour qu'un déploiement
  // on-premise n'ait pas à renseigner des variables qui ne le concernent pas.
  S3_BUCKET: usesS3 ? requiredFor(STORAGE_DRIVER, 'S3_BUCKET') : '',
  S3_REGION: process.env.S3_REGION ?? 'auto',
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? '',
  S3_ACCESS_KEY_ID: usesS3 ? requiredFor(STORAGE_DRIVER, 'S3_ACCESS_KEY_ID') : '',
  S3_SECRET_ACCESS_KEY: usesS3 ? requiredFor(STORAGE_DRIVER, 'S3_SECRET_ACCESS_KEY') : '',
  S3_FORCE_PATH_STYLE: boolean('S3_FORCE_PATH_STYLE', false),
  /** Durée de validité des URL signées, quand le driver sait en produire. */
  SIGNED_URL_TTL_SECONDS: integer('SIGNED_URL_TTL_SECONDS', 300),
}
