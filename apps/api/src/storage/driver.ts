/**
 * The file storage contract.
 *
 * All the application knows about an uploaded file is an **opaque key** it
 * built itself. How that key becomes a path on disk or an object in a
 * bucket is the driver's business alone — no route, no SQL query should
 * ever contain `fs` or `S3Client`.
 *
 * This is what makes it possible to move from an on-premise deployment to
 * S3, R2, MinIO, or Backblaze by changing one environment variable.
 */
export interface StorageDriver {
  /** Driver name, for logs and diagnostics. */
  readonly name: string

  /**
   * Writes an object.
   *
   * The body is a `Uint8Array`, not a stream, deliberately: attachments are
   * capped (`MAX_UPLOAD_BYTES`), and working on an already-complete buffer
   * avoids a whole family of streaming bugs — unknown length, interruption
   * mid-write, no possible retry.
   */
  put(key: string, body: Uint8Array, meta: { contentType: string }): Promise<void>

  /**
   * Reads an object. As a stream this time: a read is relayed as-is to the
   * HTTP response without ever loading the whole file into memory.
   */
  get(key: string): Promise<ReadableStream<Uint8Array>>

  /** Deletes an object. Must not fail if the key no longer exists. */
  delete(key: string): Promise<void>

  /**
   * **Optional.** A temporary URL through which the client downloads
   * directly, without going through the API.
   *
   * This is the hinge planned from the start: the download route redirects
   * when the driver knows how, and relays the stream otherwise. The local
   * driver doesn't implement it — it has no public domain to sign against.
   */
  getSignedUrl?(
    key: string,
    options: { expiresInSeconds: number; filename: string; contentType: string },
  ): Promise<string>
}
