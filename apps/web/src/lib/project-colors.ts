/**
 * A project's dot color, by the order it appears in (oldest created first).
 * No color is stored in the database: it's purely a visual distinction
 * between the projects in a given menu or grid, as in the mockup (10a, 10b,
 * 6a).
 */
const PROJECT_DOT_COLORS = ['var(--color-accent)', 'var(--color-accent-2)', 'var(--color-neutral-400)'] as const

export function projectDotColor(index: number): string {
  return PROJECT_DOT_COLORS[index % PROJECT_DOT_COLORS.length] ?? PROJECT_DOT_COLORS[0]
}
