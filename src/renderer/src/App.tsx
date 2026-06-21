import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Dashboard from './pages/Dashboard'
import styles from './App.module.css'

export type Page = 'dashboard' | 'chat' | 'games' | 'overlay' | 'history' | 'settings' | 'help'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.body}>
        <Sidebar current={page} onChange={setPage} />
        <main className={styles.main}>
          {page === 'dashboard' && <Dashboard />}
          {page !== 'dashboard' && (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon}>🚧</span>
              <p>준비 중인 페이지입니다</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
