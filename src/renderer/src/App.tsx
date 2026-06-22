import { useState, useEffect } from 'react'
import { AppProvider }  from './contexts/AppContext'
import LoginScreen      from './pages/Login'
import Sidebar          from './components/Sidebar'
import TitleBar         from './components/TitleBar'
import Dashboard        from './pages/Dashboard'
import Settings         from './pages/Settings'
import GamesPage        from './pages/Games'
import OverlayPage      from './pages/Overlay'
import HistoryPage      from './pages/History'
import styles           from './App.module.css'

export type Page = 'dashboard' | 'chat' | 'games' | 'overlay' | 'history' | 'settings' | 'help'

interface AuthUser { id: string; name: string }

export default function App() {
  const [page, setPage]   = useState<Page>('dashboard')
  const [user, setUser]   = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  const el = (window as unknown as Record<string, unknown>).electron as Record<string, (...args: unknown[]) => unknown>

  // On mount: check if a user is already saved
  useEffect(() => {
    if (!el?.authGetUser) { setReady(true); return }

    ;(el.authGetUser as () => Promise<AuthUser | null>)()
      .then(savedUser => {
        if (savedUser?.id) {
          // Re-verify in background (silently)
          ;(el.authRecheck as () => Promise<{ ok: boolean; user?: AuthUser }>)()
            .then(r => {
              if (r.ok && r.user) setUser(r.user)
              else { setUser(null) }
            })
            .catch(() => {
              // Network error → still allow if was saved
              setUser(savedUser)
            })
            .finally(() => setReady(true))
        } else {
          setReady(true)
        }
      })
      .catch(() => setReady(true))
  }, [])

  const handleLogin = (loggedUser: AuthUser) => setUser(loggedUser)

  const handleLogout = () => {
    if (el?.authLogout) (el.authLogout as () => Promise<unknown>)()
    setUser(null)
  }

  // Splash while checking saved session
  if (!ready) {
    return (
      <div className={styles.splash}>
        <div className={styles.splashSpinner} />
      </div>
    )
  }

  // Not authenticated → login screen
  if (!user) {
    return <LoginScreen onSuccess={handleLogin} />
  }

  // Authenticated → main app
  return (
    <AppProvider>
      <div className={styles.shell}>
        <TitleBar user={user} onLogout={handleLogout} />
        <div className={styles.body}>
          <Sidebar current={page} onChange={setPage} />
          <main className={styles.main}>
            {page === 'dashboard' && <Dashboard />}
            {page === 'games'     && <GamesPage />}
            {page === 'overlay'   && <OverlayPage />}
            {page === 'settings'  && <Settings />}
            {page === 'history'   && <HistoryPage />}
            {(page === 'chat' || page === 'help') && (
              <div className={styles.placeholder}>
                <span className={styles.placeholderIcon}>🚧</span>
                <p>준비 중인 페이지입니다</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
