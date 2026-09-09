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

/** Required only when the chosen storage driver needs it. */
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

  /**
   * Root of the web build to serve (production image only), relative to the
   * process's working directory — `serveStatic` doesn't support absolute
   * paths. Empty in dev: Vite serves the web app on its own port.
   */
  WEB_DIST_DIR: process.env.WEB_DIST_DIR ?? '',

  // — Attachment storage —
  STORAGE_DRIVER,
  /** Maximum size of an uploaded file. 25 MiB by default. */
  MAX_UPLOAD_BYTES: integer('MAX_UPLOAD_BYTES', 25 * 1024 * 1024),

  // "local" driver
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR ?? './uploads',

  // "s3" driver — only checked when it's the active one, so an on-premise
  // deployment doesn't have to fill in variables that don't concern it.
  S3_BUCKET: usesS3 ? requiredFor(STORAGE_DRIVER, 'S3_BUCKET') : '',
  S3_REGION: process.env.S3_REGION ?? 'auto',
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? '',
  S3_ACCESS_KEY_ID: usesS3 ? requiredFor(STORAGE_DRIVER, 'S3_ACCESS_KEY_ID') : '',
  S3_SECRET_ACCESS_KEY: usesS3 ? requiredFor(STORAGE_DRIVER, 'S3_SECRET_ACCESS_KEY') : '',
  S3_FORCE_PATH_STYLE: boolean('S3_FORCE_PATH_STYLE', false),
  /** Validity duration of signed URLs, when the driver knows how to produce them. */
  SIGNED_URL_TTL_SECONDS: integer('SIGNED_URL_TTL_SECONDS', 300),
}
