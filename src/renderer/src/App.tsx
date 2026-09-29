import { useState, useEffect } from 'react'
import { AppProvider }  from './contexts/AppContext'
import LoginScreen      from './pages/Login'
import Sidebar          from './components/Sidebar'
import TitleBar         from './components/TitleBar'
import StatusBar        from './components/StatusBar'
import Dashboard        from './pages/Dashboard'
import Settings         from './pages/Settings'
import GamesPage        from './pages/Games'
import OverlayPage      from './pages/Overlay'
import HistoryPage      from './pages/History'
import HelpPage         from './pages/Help'
import styles           from './App.module.css'

export type Page = 'dashboard' | 'games' | 'overlay' | 'history' | 'settings' | 'help'

interface AuthUser { id: string; name: string }

const STRIP_PAGES: Page[] = ['dashboard', 'games', 'overlay', 'history']
const FILL_PAGES:  Page[] = ['dashboard', 'games', 'overlay', 'history']

export default function App() {
  const [page, setPage]         = useState<Page>('dashboard')
  const [gamesInitial, setGamesInitial] = useState<string>('roulette')
  const [user, setUser]         = useState<AuthUser | null>(null)
  const [ready, setReady]       = useState(false)

  const navigate = (p: Page, gameId?: string) => { if (gameId) setGamesInitial(gameId); setPage(p) }

  const el = (window as unknown as Record<string, unknown>).electron as Record<string, (...args: unknown[]) => unknown>

  useEffect(() => {
    if (!el?.authGetUser) { setReady(true); return }
    ;(el.authGetUser as () => Promise<AuthUser | null>)()
      .then(savedUser => {
        if (savedUser?.id) {
          ;(el.authRecheck as () => Promise<{ ok: boolean; user?: AuthUser; error?: string }>)()
            .then(r => {
              if (r.ok && r.user) setUser(r.user)
              // 목록에서 명시적으로 빠진 경우만 로그아웃. 서버 접속/응답 오류면 저장된 로그인 유지
              else if (r.error === '허용되지 않은 계정입니다.') setUser(null)
              else setUser(savedUser)
            })
            .catch(() => setUser(savedUser))
            .finally(() => setReady(true))
        } else {
          setReady(true)
        }
      })
      .catch(() => setReady(true))
  }, [])

  const handleLogout = () => {
    if (el?.authLogout) (el.authLogout as () => Promise<unknown>)()
    setUser(null)
  }

  if (!ready) {
    return <div className={styles.splash}><div className={styles.splashSpinner} /></div>
  }
  if (!user) {
    return <LoginScreen onSuccess={setUser} />
  }

  return (
    <AppProvider>
      <div className={styles.shell}>
        <TitleBar user={user} onLogout={handleLogout} onSettings={() => setPage('settings')} />
        <div className={styles.body}>
          <Sidebar current={page} onChange={setPage} user={user} />
          <main className={styles.main}>
            {STRIP_PAGES.includes(page) && <div className={styles.strip}><StatusBar user={user} /></div>}
            <div className={FILL_PAGES.includes(page) ? styles.pageFill : styles.page}>
              {page === 'dashboard' && <Dashboard onNavigate={navigate} user={user} />}
              {page === 'games'     && <GamesPage initialSelected={gamesInitial} onHelp={() => setPage('help')} />}
              {page === 'overlay'   && <OverlayPage />}
              {page === 'history'   && <HistoryPage />}
              {page === 'settings'  && <Settings user={user} />}
              {page === 'help'      && <HelpPage />}
            </div>
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
