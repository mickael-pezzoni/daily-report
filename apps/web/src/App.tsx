import { Navigate, Route, Routes } from 'react-router'
import { useSession } from './api/auth-client'
import { LoginPage } from './components/auth/LoginPage'
import { SignupPage } from './components/auth/SignupPage'
import { AppShell } from './components/layout/AppShell'
import { useAuthState } from './hooks/useAuthState'

function Splash() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100dvh',
        color: 'var(--app-text-muted)',
      }}
    >
      Chargement…
    </div>
  )
}

/**
 * Deux informations pilotent toute la navigation :
 *   - y a-t-il une session ? (better-auth)
 *   - un compte existe-t-il sur cet espace ? (GET /api/auth-state)
 *
 * Tant que l'une des deux manque, on n'affiche rien plutôt que de rediriger
 * vers un écran qu'il faudrait corriger une seconde plus tard.
 */
export function App() {
  const { data: session, isPending: sessionPending } = useSession()
  const { hasAccount, isPending: authStatePending } = useAuthState(session?.user.id ?? null)

  if (sessionPending || authStatePending) return <Splash />

  const signedOutHome = hasAccount ? '/login' : '/signup'

  return (
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
      <Route
        path="/"
        element={session ? <AppShell /> : <Navigate to={signedOutHome} replace />}
      />
      <Route
        path="/notes/:date"
        element={session ? <AppShell /> : <Navigate to={signedOutHome} replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
