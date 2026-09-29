// 상단 방송 상태 스트립: LIVE · 연결 · 시청자 · 오늘 실행 · 별풍선 · 최근 이벤트
import { useApp } from '../contexts/AppContext'
import { gameName } from '../games'
import styles from './StatusBar.module.css'

const fmtTime = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function StatusBar({ user }: { user?: { id: string; name: string } | null }) {
  const { connected, simulation, standby, stats, history } = useApp()
  const live = connected && !simulation
  const label = connected ? (simulation ? '시뮬레이션 중' : '방송 연결됨') : (standby ?? '연결 끊김')
  const recent = history.slice(0, 3)

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.liveDot} style={{ background: connected ? 'var(--live)' : '#ff5f57' }} />
        <span className={`${styles.live} ${live ? styles.liveOn : styles.liveOff}`}>{live ? 'LIVE' : (simulation && connected ? 'SIM' : 'OFF')}</span>
        <span className={styles.conn}>{label}</span>
        {user && <span className={styles.user}>{user.name} <em>({user.id})</em></span>}
      </div>
      <span className={styles.sep} />
      <div className={styles.stat}><span>시청자</span><b className="num">{stats.todayViewers.toLocaleString()}</b></div>
      <span className={styles.sep} />
      <div className={styles.stat}><span>오늘 실행</span><b className="num">{stats.todayRuns.toLocaleString()}</b></div>
      <span className={styles.sep} />
      <div className={styles.stat}><span>누적 소모 별풍선</span><b className={`num ${styles.orange}`}>{stats.todayBalloons.toLocaleString()}</b></div>
      <span className={styles.sep} />
      <div className={styles.events}>
        <span className={styles.evLabel}>최근 이벤트</span>
        {recent.length === 0 && <span className={styles.evEmpty}>아직 실행된 게임이 없습니다</span>}
        {recent.map((h, i) => (
          <span key={i} className={styles.ev}>
            <span className={`num ${styles.evTime}`}>{fmtTime(h.ts)}</span>
            <span className={styles.evGame}>{gameName(h.gameId)}</span>
            <span className={styles.evResult}>{h.result}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
