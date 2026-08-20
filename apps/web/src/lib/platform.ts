/** Mac ou iOS : c'est ⌘K qu'on montre, pas Ctrl+K. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

export function shortcutHint(): string {
  return IS_MAC ? '⌘K' : 'Ctrl+K'
}
