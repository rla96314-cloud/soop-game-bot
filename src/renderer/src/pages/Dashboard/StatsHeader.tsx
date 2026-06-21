import { useState } from 'react'
import styles from './StatsHeader.module.css'

export default function StatsHeader() {
  const [darkMode, setDarkMode] = useState(false)

  return (
    <header className={styles.header}>
      {/* Connection */}
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
            <span className={styles.dot} />
            연결됨
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatCard
        label="오늘 실행 횟수"
        value="32"
        delta="+9%"
        icon={<BarIcon />}
      />
      <StatCard
        label="참여 시청자 수"
        value="289"
        delta="+11%"
        icon={<PeopleIcon />}
      />
      <StatCard
        label="소모 별풍선"
        value="12,450"
        delta="+7%"
        icon={<StarIcon />}
        valueColor="var(--gold)"
      />
      <StatCard
        label="누적 실행 횟수"
        value="987"
        icon={<CrownIcon />}
      />

      <div className={styles.actions}>
        <button className={styles.iconBtn} title="알림">
          🔔
          <span className={styles.notifDot} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => setDarkMode(d => !d)}
          title="다크모드"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className={styles.runBtn}>
          ▶ 수동 실행
        </button>
      </div>
    </header>
  )
}

function StatCard({
  label, value, delta, icon, valueColor
}: {
  label: string
  value: string
  delta?: string
  icon: React.ReactNode
  valueColor?: string
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
