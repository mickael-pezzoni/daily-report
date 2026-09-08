/**
 * Couleur de la pastille d'un projet, dans l'ordre où il apparaît (le plus
 * ancien créé d'abord). Aucune couleur n'est stockée en base : c'est purement
 * une distinction visuelle entre les projets d'un même menu ou d'une même
 * grille, comme dans la maquette (10a, 10b, 6a).
 */
const PROJECT_DOT_COLORS = ['var(--color-accent)', 'var(--color-accent-2)', 'var(--color-neutral-400)'] as const

export function projectDotColor(index: number): string {
  return PROJECT_DOT_COLORS[index % PROJECT_DOT_COLORS.length] ?? PROJECT_DOT_COLORS[0]
}
