/**
 * Le contrat de stockage des fichiers.
 *
 * Tout ce que l'application sait d'un fichier déposé, c'est une **clé opaque**
 * qu'elle a elle-même fabriquée. Comment cette clé devient un chemin sur disque
 * ou un objet dans un bucket ne regarde que le driver — aucune route, aucune
 * requête SQL ne doit contenir de `fs` ni de `S3Client`.
 *
 * C'est ce qui permet de passer d'un déploiement on-premise à S3, R2, MinIO ou
 * Backblaze en changeant une variable d'environnement.
 */
export interface StorageDriver {
  /** Nom du driver, pour les journaux et le diagnostic. */
  readonly name: string

  /**
   * Écrit un objet.
   *
   * Le corps est un `Uint8Array` et non un flux, volontairement : les pièces
   * jointes sont plafonnées (`MAX_UPLOAD_BYTES`), et travailler sur un tampon
   * déjà complet évite toute une famille de bugs de flux — longueur inconnue,
   * interruption en cours d'écriture, réessai impossible.
   */
  put(key: string, body: Uint8Array, meta: { contentType: string }): Promise<void>

  /**
   * Lit un objet. En flux, cette fois : une lecture se relaie telle quelle vers
   * la réponse HTTP sans jamais charger le fichier entier en mémoire.
   */
  get(key: string): Promise<ReadableStream<Uint8Array>>

  /** Supprime un objet. Ne doit pas échouer si la clé n'existe plus. */
  delete(key: string): Promise<void>

  /**
   * **Optionnel.** Une URL temporaire par laquelle le client télécharge en
   * direct, sans passer par l'API.
   *
   * C'est la charnière prévue au plan : la route de téléchargement redirige
   * quand le driver sait le faire, et relaie le flux sinon. Le driver local ne
   * l'implémente pas — il n'a pas de domaine public à signer.
   */
  getSignedUrl?(
    key: string,
    options: { expiresInSeconds: number; filename: string; contentType: string },
  ): Promise<string>
}
