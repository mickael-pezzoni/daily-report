const KEY = 'daily-report.lastProjectId'

/** The last visited project — so `/` lands there instead of the picker screen. */
export function getLastProjectId(): string | null {
  return localStorage.getItem(KEY)
}

export function setLastProjectId(id: string): void {
  localStorage.setItem(KEY, id)
}
