import { Navigate, Route, Routes } from 'react-router'
import { useSession } from './api/auth-client'
import { LoginPage } from './components/auth/LoginPage'
import { ProjectSelect } from './components/auth/ProjectSelect'
import { SignupPage } from './components/auth/SignupPage'
import { AppShell } from './components/layout/AppShell'
import { Splash } from './components/ui/Splash'
import { ProjectProvider, useProjects } from './contexts/ProjectContext'
import { useAuthState } from './hooks/useAuthState'
import { useLanguageSync } from './hooks/useLanguageSync'
import { getLastProjectId } from './lib/last-project'

/**
 * `/` never renders anything itself: it resolves to a project — the last one
 * visited (`localStorage`) if it still exists, otherwise the sole active
 * project if there's only one — and lands on its own page, with no note
 * pre-opened. Absent an obvious answer (several active projects, no valid
 * recent choice), `/projets` settles it.
 */
function RootRedirect() {
  const { projects, isPending } = useProjects()
  if (isPending) return <Splash />

  const stored = getLastProjectId()
  const active = projects.filter((project) => !project.archivedAt)
  const target =
    (stored && projects.some((project) => project.id === stored) ? stored : null) ??
    (active.length === 1 ? active[0]!.id : null)

  return <Navigate to={target ? `/projets/${target}` : '/projets'} replace />
}

/**
 * Two pieces of information drive all navigation:
 *   - is there a session? (better-auth)
 *   - does an account exist on this space? (GET /api/auth-state)
 *
 * While either is missing, nothing renders rather than redirecting to a
 * screen that would need correcting a moment later. The current project is
 * no longer resolved here: it comes from the URL (`/projets/:projectId/…`),
 * and it's `AppShell` that checks it still exists, via `useCurrentProject`.
 */
export function App() {
  const { data: session, isPending: sessionPending } = useSession()
  const { hasAccount, isPending: authStatePending } = useAuthState(session?.user.id ?? null)

  // Before the first `return`: a hook can't be conditional, and the account's
  // language must apply even during the waiting screen.
  useLanguageSync(session)

  if (sessionPending || authStatePending) return <Splash />

  const signedOutHome = hasAccount ? '/login' : '/signup'

  return (
    <ProjectProvider enabled={!!session}>
      <Routes>
        <Route
          path="/login"
          element={
            session ? <Navigate to="/" replace /> : hasAccount ? <LoginPage /> : <Navigate to="/signup" replace />
          }
        />
        <Route
          path="/signup"
          element={
            session ? <Navigate to="/" replace /> : hasAccount ? <Navigate to="/login" replace /> : <SignupPage />
          }
        />
        <Route path="/" element={session ? <RootRedirect /> : <Navigate to={signedOutHome} replace />} />
        {/* The "Manage projects" button in the user menu (6a) links here too;
            no guard on this route, or a missing project would loop back to it. */}
        <Route path="/projets" element={session ? <ProjectSelect /> : <Navigate to={signedOutHome} replace />} />
        <Route
          path="/projets/:projectId"
          element={session ? <AppShell /> : <Navigate to={signedOutHome} replace />}
        />
        <Route
          path="/projets/:projectId/notes/:date"
          element={session ? <AppShell /> : <Navigate to={signedOutHome} replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProjectProvider>
  )
}
