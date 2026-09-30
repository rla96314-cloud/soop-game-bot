import type { Page } from '../App'
import { useApp } from '../contexts/AppContext'
import Icon, { type IconName } from './Icon'
import styles from './Sidebar.module.css'

interface NavItem { id: Page; label: string; icon: IconName }

const NAV: NavItem[] = [
  { id: 'dashboard', label: '대시보드',    icon: 'dashboard' },
  { id: 'games',     label: '게임',       icon: 'gamepad'   },
  { id: 'overlay',   label: 'OBS 오버레이', icon: 'monitor'  },
  { id: 'history',   label: '기록',       icon: 'chart'     },
  { id: 'settings',  label: '설정',       icon: 'settings'  },
  { id: 'help',      label: '도움말',      icon: 'help'      },
]

interface Props {
  current:  Page
  onChange: (p: Page) => void
  user?:    { id: string; name: string } | null
}

export default function Sidebar({ current, onChange, user }: Props) {
  const { connected, standby } = useApp()
  const connLabel = connected ? '방송 연결됨' : (standby ? '방송 대기 중' : '연결 끊김')
  const connColor = connected ? 'var(--live)' : (standby ? '#f2a600' : '#ff5f57')

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoTop}>SOOP</div>
        <div className={styles.logoSub}>GAME BOT</div>
        <div className={styles.logoTag}>방송 놀이도구</div>
      </div>

      <nav className={styles.nav}>
        {NAV.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${current === item.id ? styles.active : ''}`}
            onClick={() => onChange(item.id)}
          >
            <Icon name={item.icon} size={20} className={styles.navIcon} />
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.userCard}>
        <div className={styles.conn}>
          <span className={styles.connDot} style={{ background: connColor }} />
          <span>{connLabel}</span>
        </div>
        <button className={styles.user} onClick={() => onChange('settings')} title="설정으로 이동">
          <div className={styles.userText}>
            <div className={styles.userName}>{user?.name || '스트리머'}</div>
            <div className={styles.userId}>{user?.id || '-'}</div>
          </div>
          <Icon name="chevron-right" size={16} className={styles.userArrow} />
        </button>
      </div>
    </aside>
  )
}
