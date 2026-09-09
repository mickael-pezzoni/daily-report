import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageDriver } from './driver.js'

export interface S3StorageConfig {
  bucket: string
  region: string
  /**
   * Service endpoint. Empty for AWS S3; filled in for everything else — R2
   * (`https://<account>.r2.cloudflarestorage.com`), MinIO, Backblaze,
   * Scaleway, Garage…
   */
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
  /**
   * Path style rather than subdomain (`/bucket/key` instead of
   * `bucket.host/key`). Needed for MinIO and most self-hosted servers,
   * unnecessary for AWS and R2.
   */
  forcePathStyle: boolean
}

/**
 * S3-compatible storage.
 *
 * A single driver covers S3, R2, MinIO, Backblaze B2, Scaleway, and others:
 * they all speak the same protocol, only `endpoint` and `forcePathStyle`
 * change.
 */
export class S3Storage implements StorageDriver {
  readonly name = 's3'

  private readonly client: S3Client

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  async put(key: string, body: Uint8Array, meta: { contentType: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: meta.contentType,
        ContentLength: body.byteLength,
      }),
    )
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    )
    if (!response.Body) throw new Error(`Objet vide ou introuvable : ${key}`)
    return response.Body.transformToWebStream() as ReadableStream<Uint8Array>
  }

  async delete(key: string): Promise<void> {
    // S3 responds 204 even if the key doesn't exist: nothing to handle for
    // the absent case.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    )
  }

  /**
   * The driver knows how to sign: the download route will redirect to this
   * URL instead of relaying the stream, and bandwidth no longer flows
   * through the API.
   */
  async getSignedUrl(
    key: string,
    options: { expiresInSeconds: number; filename: string; contentType: string },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      // The original name and type are carried by the signed URL: storage
      // only knows opaque keys, this is where the file gets dressed back up.
      ResponseContentDisposition: contentDisposition(options.filename, options.contentType),
      ResponseContentType: options.contentType,
    })
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds })
  }
}

/** Duplicated from `lib/attachments.ts` to keep this module self-contained. */
function contentDisposition(filename: string, contentType: string): string {
  const inline = contentType.startsWith('image/') || contentType === 'application/pdf'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
