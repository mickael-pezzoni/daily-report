import { createReadStream } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import type { StorageDriver } from './driver.js'

/**
 * Stockage sur le disque local — le mode on-premise.
 *
 * N'implémente volontairement pas `getSignedUrl` : sans domaine public ni
 * mécanisme de signature, l'API reste le seul chemin d'accès aux fichiers, ce
 * qui est exactement ce qu'on veut ici.
 */
export class LocalStorage implements StorageDriver {
  readonly name = 'local'

  constructor(private readonly root: string) {}

  /**
   * Résout une clé en chemin, et **refuse toute sortie du répertoire racine**.
   *
   * Les clés sont fabriquées par l'application à partir d'UUID, donc sûres par
   * construction ; cette garde existe pour que ça reste vrai le jour où une clé
   * viendra d'ailleurs. Une traversée de chemin ici donnerait la lecture et
   * l'écriture de n'importe quel fichier du serveur.
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
    // `force` : supprimer deux fois, ou supprimer un fichier déjà disparu du
    // disque, n'est pas une erreur — la ligne en base fait foi.
    await rm(this.pathFor(key), { force: true })
  }

  /** Le répertoire racine, exposé pour le message de démarrage. */
  get location(): string {
    return join(resolve(this.root))
  }
}
