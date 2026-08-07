import { env } from '../env.js'
import type { StorageDriver } from './driver.js'
import { LocalStorage } from './local.js'
import { S3Storage } from './s3.js'

export type { StorageDriver } from './driver.js'

/**
 * Le driver actif, choisi par `STORAGE_DRIVER`. C'est le seul endroit du dépôt
 * qui sait quels drivers existent : tout le reste ne voit qu'un
 * `StorageDriver`.
 */
export const storage: StorageDriver =
  env.STORAGE_DRIVER === 's3'
    ? new S3Storage({
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      })
    : new LocalStorage(env.STORAGE_LOCAL_DIR)
