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

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  WEB_URL: process.env.WEB_URL ?? 'http://localhost:5173',
  PORT: Number(process.env.PORT ?? 3001),
}
