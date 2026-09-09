/** What views can read from an attachment without downloading its content. */

/**
 * An image the browser can display as a thumbnail.
 *
 * `image/svg+xml` is excluded — same as on the server: an SVG uploaded by a
 * third party would execute its script within the application's origin, so
 * the API serves it as a download, never inline.
 */
export function isPreviewableImage(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') && mimeType !== 'image/svg+xml' && !mimeType.startsWith('image/x-')
  )
}

/**
 * `capture-1.png` → `PNG`, for the badge of files that can't be previewed.
 *
 * `null` when the name has no usable extension: the fallback label is a word,
 * hence translatable, and it's up to the caller to provide it.
 */
export function extensionLabel(filename: string): string | null {
  const match = /\.([a-z0-9]{1,5})$/i.exec(filename)
  return match?.[1]?.toUpperCase() ?? null
}
