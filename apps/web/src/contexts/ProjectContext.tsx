import type { Project } from '@daily-report/types'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'

interface ProjectContextValue {
  projects: Project[]
  isPending: boolean
  /** Reloads the list — after creating a project, for instance. */
  refresh: () => Promise<Project[]>
  /** Archives or unarchives — a round trip, not a deletion. */
  archiveProject: (id: string, archived: boolean) => Promise<void>
  /** Deletes the project, its notes, and their attachments, for good. */
  removeProject: (id: string) => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

/**
 * Holds the account's project list — nothing more. The **current** project
 * is no longer a separate notion here: it comes from the URL
 * (`/projets/:projectId/…`), read via `useCurrentProject`.
 *
 * `enabled` must follow the session: without a signed-in account,
 * `GET /api/projects` would answer 401, and there's nothing to resolve before
 * the sign-in screen anyway.
 */
export function ProjectProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isPending, setIsPending] = useState(true)

  const refresh = useCallback(() => api.projects.list().then((list) => {
    setProjects(list)
    return list
  }), [])

  useEffect(() => {
    if (!enabled) {
      setProjects([])
      setIsPending(false)
      return
    }

    let cancelled = false
    setIsPending(true)
    refresh()
      .catch(() => {
        if (!cancelled) setProjects([])
      })
      .finally(() => {
        if (!cancelled) setIsPending(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, refresh])

  const archiveProject = useCallback(
    async (id: string, archived: boolean) => {
      await api.projects.archive(id, { archived })
      await refresh()
    },
    [refresh],
  )

  const removeProject = useCallback(
    async (id: string) => {
      await api.projects.remove(id)
      await refresh()
    },
    [refresh],
  )

  return (
    <ProjectContext.Provider value={{ projects, isPending, refresh, archiveProject, removeProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects(): ProjectContextValue {
  const value = useContext(ProjectContext)
  if (!value) throw new Error('useProjects must be used within a ProjectProvider')
  return value
}
