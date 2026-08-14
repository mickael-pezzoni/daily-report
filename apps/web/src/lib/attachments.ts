/** Ce que les vues savent lire d'une pièce jointe sans en télécharger le contenu. */

/**
 * Une image que le navigateur peut afficher en vignette.
 *
 * `image/svg+xml` en est exclu — comme côté serveur : un SVG déposé par un
 * tiers exécuterait son script dans l'origine de l'application, et l'API le
 * sert donc en téléchargement, jamais en ligne.
 */
export function isPreviewableImage(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') && mimeType !== 'image/svg+xml' && !mimeType.startsWith('image/x-')
  )
}

/**
 * `capture-1.png` → `PNG`, pour la pastille des fichiers non prévisualisables.
 *
 * `null` quand le nom n'a pas d'extension exploitable : l'étiquette de repli
 * est un mot, donc traduisible, et c'est à l'appelant de la fournir.
 */
export function extensionLabel(filename: string): string | null {
  const match = /\.([a-z0-9]{1,5})$/i.exec(filename)
  return match?.[1]?.toUpperCase() ?? null
}
