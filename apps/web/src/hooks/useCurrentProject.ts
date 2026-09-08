import { useEffect } from 'react'
import { useParams } from 'react-router'
import { useProjects } from '../contexts/ProjectContext'
import { setLastProjectId } from '../lib/last-project'

/**
 * The project from the current URL (`/projets/:projectId/…`), resolved
 * against the account's list. `project` stays `null` while the list is still
 * loading — but also if the id matches no project (deleted meanwhile, a link
 * copied from another account…): it's up to the caller to tell the two apart
 * via `isPending`.
 */
export function useCurrentProject() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, isPending } = useProjects()
  const project = projects.find((candidate) => candidate.id === projectId) ?? null

  // Remembered so `/` lands here next time instead of on the picker screen —
  // only once resolution actually succeeds.
  useEffect(() => {
    if (project) setLastProjectId(project.id)
  }, [project])

  return { project, isPending }
}
