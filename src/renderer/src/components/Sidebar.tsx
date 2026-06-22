import type { Page } from '../App'
import styles from './Sidebar.module.css'

interface NavItem {
  id: Page
  icon: string
  label: string
}

const NAV: NavItem[] = [
  { id: 'dashboard', icon: '⊞',  label: '대시보드'    },
  { id: 'games',     icon: '🎮', label: '게임 관리'   },
  { id: 'boss',      icon: '👾', label: '보스전'       },
  { id: 'overlay',   icon: '📺', label: 'OBS 오버레이' },
  { id: 'history',   icon: '📊', label: '기록 / 통계' },
  { id: 'settings',  icon: '⚙️', label: '설정'        },
  { id: 'help',      icon: '❓', label: '도움말'       },
]

interface Props {
  current: Page
  onChange: (p: Page) => void
}

export default function Sidebar({ current, onChange }: Props) {
  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="9" r="4" stroke="#fff" strokeWidth="1.8"/>
            <circle cx="7" cy="16" r="2.5" stroke="#fff" strokeWidth="1.6"/>
            <circle cx="17" cy="16" r="2.5" stroke="#fff" strokeWidth="1.6"/>
            <line x1="9" y1="10.5" x2="7" y2="13.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="15" y1="10.5" x2="17" y2="13.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className={styles.logoText}>SOOP</div>
          <div className={styles.logoSub}>GAME BOT</div>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${current === item.id ? styles.active : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {current === item.id && <span className={styles.activeArrow}>›</span>}
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      {/* User */}
      <div className={styles.user}>
        <div className={styles.avatar}>라</div>
        <div className={styles.userText}>
          <div className={styles.userName}>스트리머_마스터</div>
          <div className={styles.userRole}>스트리머</div>
        </div>
        <span className={styles.userArrow}>›</span>
      </div>
    </aside>
  )
}
