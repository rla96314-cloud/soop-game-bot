import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './contexts/AppContext'
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

type El = Record<string, (...args: never[]) => unknown>
const el = (window as unknown as { electron?: El }).electron

/** 메인 프로세스 알림 (포트 충돌·설정 파일 손상 등) — 상단 배너 */
function NoticeBar() {
  const { notices, dismissNotice } = useApp()
  if (!notices.length) return null
  return (
    <div className={styles.notices}>
      {notices.map(n => (
        <div key={n.id} className={`${styles.notice} ${styles[`notice_${n.level}`] ?? ''}`} role="alert">
          <span>{n.message}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => dismissNotice(n.id)} aria-label="닫기">✕</button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [page, setPage]         = useState<Page>('dashboard')
  const [gamesInitial, setGamesInitial] = useState<string>('roulette')
  const [user, setUser]         = useState<AuthUser | null>(null)
  const [ready, setReady]       = useState(false)
  const [authNote, setAuthNote] = useState<string | null>(null)

  const navigate = (p: Page, gameId?: string) => { if (gameId) setGamesInitial(gameId); setPage(p) }

  useEffect(() => {
    if (!el?.authGetUser) { setReady(true); return }
    // 로그인 판단은 메인 프로세스(auth:recheck)가 한다 — 저장된 사용자가 있으면 재검증, 네트워크 오류는 24시간 유예
    ;(el.authGetUser as () => Promise<AuthUser | null>)()
      .then(saved => {
        if (!saved?.id) { setReady(true); return }
        ;(el.authRecheck as () => Promise<{ ok: boolean; user?: AuthUser; error?: string; grace?: boolean }>)()
          .then(r => {
            if (r.ok && r.user) { setUser(r.user); if (r.grace) setAuthNote('허용 목록 서버에 연결할 수 없어 저장된 로그인으로 시작했습니다.') }
            else { setUser(null); if (r.error) setAuthNote(r.error) }
          })
          .catch(() => setUser(null))
          .finally(() => setReady(true))
      })
      .catch(() => setReady(true))
  }, [])

  const handleLogout = () => {
    if (el?.authLogout) (el.authLogout as () => Promise<unknown>)().catch(() => {})
    setUser(null)
  }

  if (!ready) {
    return <div className={styles.splash}><div className={styles.splashSpinner} /></div>
  }
  if (!user) {
    return <LoginScreen onSuccess={u => { setAuthNote(null); setUser(u) }} note={authNote} />
  }

  return (
    <AppProvider>
      <div className={styles.shell}>
        <TitleBar user={user} onLogout={handleLogout} onSettings={() => setPage('settings')} />
        <NoticeBar />
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
