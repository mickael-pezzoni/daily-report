import { env } from '../env.js'
import type { StorageDriver } from './driver.js'
import { LocalStorage } from './local.js'
import { S3Storage } from './s3.js'

export type { StorageDriver } from './driver.js'

/**
 * The active driver, chosen by `STORAGE_DRIVER`. This is the only place in
 * the repo that knows which drivers exist: everything else only ever sees a
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
