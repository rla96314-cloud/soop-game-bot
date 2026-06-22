import type { Page } from '../App'
import styles from './Sidebar.module.css'

/* ── SVG icons ──────────────────────────────────────────────────────────── */

const DashIcon = () => (
  <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="6" height="6" rx="1.5"/>
    <rect x="10" y="2" width="6" height="6" rx="1.5"/>
    <rect x="2" y="10" width="6" height="6" rx="1.5"/>
    <rect x="10" y="10" width="6" height="6" rx="1.5"/>
  </svg>
)
const GamesIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="16" height="9" rx="2"/>
    <line x1="7" y1="8" x2="7" y2="13"/>
    <line x1="4.5" y1="10.5" x2="9.5" y2="10.5"/>
    <circle cx="13" cy="9.5" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="15.5" cy="11.5" r=".8" fill="currentColor" stroke="none"/>
  </svg>
)
const BossIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L4 7v5c0 3 2.5 5 6 5s6-2 6-5V7L10 2z"/>
    <line x1="7" y1="13" x2="7" y2="15"/>
    <line x1="10" y1="13" x2="10" y2="15"/>
    <line x1="13" y1="13" x2="13" y2="15"/>
  </svg>
)
const OverlayIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="16" height="11" rx="2"/>
    <path d="M7 17h6"/>
    <line x1="10" y1="14" x2="10" y2="17"/>
  </svg>
)
const HistoryIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10" width="3" height="7" rx="1"/>
    <rect x="8.5" y="7" width="3" height="10" rx="1"/>
    <rect x="14" y="4" width="3" height="13" rx="1"/>
  </svg>
)
const SettingsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="10" cy="10" r="2.8"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/>
  </svg>
)
const HelpIcon = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8"/>
    <path d="M8 8a2 2 0 114 0c0 1.5-2 2-2 3"/>
    <circle cx="10" cy="15" r=".7" fill="currentColor" stroke="none"/>
  </svg>
)

const ICONS: Record<string, () => JSX.Element> = {
  dashboard: DashIcon,
  games:     GamesIcon,
  boss:      BossIcon,
  overlay:   OverlayIcon,
  history:   HistoryIcon,
  settings:  SettingsIcon,
  help:      HelpIcon,
}

/* ── Nav data ───────────────────────────────────────────────────────────── */

interface NavItem { id: Page; label: string }

const NAV: NavItem[] = [
  { id: 'dashboard', label: '대시보드'    },
  { id: 'games',     label: '게임 관리'   },
  { id: 'boss',      label: '보스전'       },
  { id: 'overlay',   label: 'OBS 오버레이' },
  { id: 'history',   label: '기록 / 통계' },
  { id: 'settings',  label: '설정'        },
  { id: 'help',      label: '도움말'       },
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
        {NAV.map(item => {
          const Icon = ICONS[item.id]
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${current === item.id ? styles.active : ''}`}
              onClick={() => onChange(item.id)}
            >
              <span className={styles.navIcon}>{Icon && <Icon />}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {current === item.id && <span className={styles.activeArrow}>›</span>}
            </button>
          )
        })}
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
