import { createReadStream } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import type { StorageDriver } from './driver.js'

/**
 * Local disk storage — the on-premise mode.
 *
 * Deliberately doesn't implement `getSignedUrl`: with no public domain or
 * signing mechanism, the API remains the only access path to the files,
 * which is exactly what we want here.
 */
export class LocalStorage implements StorageDriver {
  readonly name = 'local'

  constructor(private readonly root: string) {}

  /**
   * Resolves a key to a path, and **refuses any escape from the root
   * directory**.
   *
   * Keys are built by the application from UUIDs, so they're safe by
   * construction; this guard exists so that stays true the day a key comes
   * from somewhere else. A path traversal here would grant read and write
   * access to any file on the server.
   */
  private pathFor(key: string): string {
    const root = resolve(this.root)
    const target = resolve(root, key)
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`Clé de stockage hors du répertoire racine : ${key}`)
    }
    return target
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const stream = createReadStream(this.pathFor(key))
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>
  }

  async delete(key: string): Promise<void> {
    // `force`: deleting twice, or deleting a file already gone from disk,
    // is not an error — the database row is authoritative.
    await rm(this.pathFor(key), { force: true })
  }

  /** The root directory, exposed for the startup message. */
  get location(): string {
    return join(resolve(this.root))
  }
}
