import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './StatsHeader.module.css'

const GAMES = [
  { id: 'roulette', icon: '🎡', name: '룰렛'     },
  { id: 'ladder',   icon: '🪜', name: '사다리타기' },
  { id: 'boss',     icon: '👾', name: '보스전'    },
  { id: 'gacha',    icon: '🎁', name: '뽑기'      },
  { id: 'quiz',     icon: '❓', name: '퀴즈'      },
  { id: 'slot',     icon: '🎰', name: '슬롯머신'  },
  { id: 'race',     icon: '🏁', name: '경주'      },
  { id: 'rps',      icon: '✊', name: '가위바위보' },
  { id: 'fish',     icon: '🎣', name: '낚시'      },
  { id: 'lottery',  icon: '🎟️', name: '복권'      },
  { id: 'number',   icon: '🔢', name: '숫자 추첨' },
]

export default function StatsHeader() {
  const { connected, simulation, stats, triggerGame, gameStates } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const isBusy = (id: string) => {
    const s = gameStates[id]?.status
    return s === 'running' || s === 'collecting'
  }

  const handleTrigger = (id: string) => {
    if (!isBusy(id)) triggerGame(id)
    setMenuOpen(false)
  }

  return (
    <header className={styles.header}>
      {/* Connection status */}
      <div className={styles.connCard}>
        <div className={styles.connIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.5" stroke="#fff" strokeWidth="1.8"/>
            <circle cx="6.5" cy="16" r="2.2" stroke="#fff" strokeWidth="1.6"/>
            <circle cx="17.5" cy="16" r="2.2" stroke="#fff" strokeWidth="1.6"/>
            <line x1="9" y1="10" x2="6.5" y2="13.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="15" y1="10" x2="17.5" y2="13.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className={styles.connLabel}>SOOP 연동 상태</div>
          <div className={styles.connStatus}>
            <span className={styles.dot} style={{ background: connected ? '#10B981' : '#EF4444' }} />
            {connected ? (simulation ? '시뮬레이션 중' : '연결됨') : '연결 끊김'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatCard label="오늘 실행 횟수"  value={stats.todayRuns.toLocaleString()}      delta={undefined} icon={<BarIcon />} />
      <StatCard label="참여 시청자 수"  value={stats.todayViewers.toLocaleString()}    delta={undefined} icon={<PeopleIcon />} />
      <StatCard label="소모 별풍선"     value={stats.todayBalloons.toLocaleString()}   delta={undefined} icon={<StarIcon />} valueColor="var(--gold)" />
      <StatCard label="진행중인 게임"   value={String(Object.values(gameStates).filter(s => s?.status === 'running' || s?.status === 'collecting').length)} delta={undefined} icon={<CrownIcon />} />

      <div className={styles.actions}>
        <div className={styles.runWrap}>
          <button
            ref={btnRef}
            className={styles.runBtn}
            onClick={() => setMenuOpen(o => !o)}
          >
            ▶ 수동 실행
          </button>
          {menuOpen && (
            <div ref={menuRef} className={styles.gameMenu}>
              {GAMES.map(g => {
                const busy = isBusy(g.id)
                return (
                  <button
                    key={g.id}
                    className={`${styles.gameMenuItem} ${busy ? styles.gameMenuBusy : ''}`}
                    onClick={() => handleTrigger(g.id)}
                  >
                    <span className={styles.gameMenuIcon}>{g.icon}</span>
                    <span className={styles.gameMenuName}>{g.name}</span>
                    {busy && <span className={styles.busyBadge}>진행중</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function StatCard({ label, value, delta, icon, valueColor }: {
  label: string; value: string; delta?: string; icon: React.ReactNode; valueColor?: string
}) {
  return (
    <div className={styles.stat}>
      <div className={styles.statContent}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statRow}>
          <span className={styles.statValue} style={{ color: valueColor }}>{value}</span>
          {delta && <span className={styles.delta}>{delta}</span>}
        </div>
      </div>
      <div className={styles.statIcon}>{icon}</div>
    </div>
  )
}

function BarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="12" width="4" height="9" rx="1" fill="var(--p300)" opacity=".5"/>
      <rect x="10" y="7" width="4" height="14" rx="1" fill="var(--p400)"/>
      <rect x="17" y="3" width="4" height="18" rx="1" fill="var(--p500)"/>
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3" fill="var(--p300)"/>
      <path d="M3 18c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="var(--p400)" strokeWidth="1.8"/>
      <circle cx="17" cy="7" r="2.5" fill="var(--p400)" opacity=".7"/>
      <path d="M15 18c0-2.5 1.5-4.5 4-4.5" stroke="var(--p300)" strokeWidth="1.8"/>
    </svg>
  )
}
function StarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.9 6.2L22 9.3l-5 5.1 1.2 7.2L12 18l-6.2 3.6L7 14.4 2 9.3l7.1-1.1L12 2z"
        fill="#FCD34D" stroke="#F59E0B" strokeWidth="1"/>
    </svg>
  )
}
function CrownIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M3 17l2-8 4 4 3-6 3 6 4-4 2 8H3z" fill="var(--p200)" stroke="var(--p500)" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="3" y="17" width="18" height="3" rx="1" fill="var(--p400)"/>
    </svg>
  )
}
