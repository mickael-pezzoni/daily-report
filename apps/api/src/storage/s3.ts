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
   * Point d'entrée du service. Vide pour AWS S3 ; renseigné pour tout le reste
   * — R2 (`https://<account>.r2.cloudflarestorage.com`), MinIO, Backblaze,
   * Scaleway, Garage…
   */
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
  /**
   * Chemin plutôt que sous-domaine (`/bucket/clé` au lieu de `bucket.host/clé`).
   * Nécessaire pour MinIO et la plupart des serveurs auto-hébergés, inutile
   * pour AWS et R2.
   */
  forcePathStyle: boolean
}

/**
 * Stockage compatible S3.
 *
 * Un seul driver couvre S3, R2, MinIO, Backblaze B2, Scaleway et les autres :
 * ils parlent tous le même protocole, seuls `endpoint` et `forcePathStyle`
 * changent.
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
    // S3 répond 204 même si la clé n'existe pas : rien à traiter côté absence.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    )
  }

  /**
   * Le driver sait signer : la route de téléchargement redirigera vers cette
   * URL au lieu de relayer le flux, et la bande passante ne traverse plus l'API.
   */
  async getSignedUrl(
    key: string,
    options: { expiresInSeconds: number; filename: string; contentType: string },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      // Le nom d'origine et le type sont portés par l'URL signée : le stockage
      // ne connaît que des clés opaques, c'est ici qu'on rhabille le fichier.
      ResponseContentDisposition: contentDisposition(options.filename, options.contentType),
      ResponseContentType: options.contentType,
    })
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds })
  }
}

/** Repris de `lib/attachments.ts` pour garder ce module autonome. */
function contentDisposition(filename: string, contentType: string): string {
  const inline = contentType.startsWith('image/') || contentType === 'application/pdf'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
