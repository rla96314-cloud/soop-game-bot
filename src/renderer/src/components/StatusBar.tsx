// 상단 방송 상태 스트립: LIVE · 연결 · 시청자 · 오늘 실행 · 별풍선 · 최근 이벤트
import { useApp } from '../contexts/AppContext'
import { gameName } from '../games'
import styles from './StatusBar.module.css'

const fmtTime = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function StatusBar({ user }: { user?: { id: string; name: string } | null }) {
  const { connected, standby, lastError, stats, history, liveViewers } = useApp()
  const live = connected
  const label = connected ? '방송 연결됨' : (standby ? '방송 대기 중' : '연결 끊김')
  const recent = history.slice(0, 3)
  // 끊긴 이유를 마우스 올리면 볼 수 있게 — 채널 ID 오타·소켓 오류가 '연결 끊김'으로만 보이던 문제
  const title = connected ? undefined : (lastError ?? standby ?? undefined)

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.liveDot} style={{ background: connected ? 'var(--live)' : '#ff5f57' }} />
        <span className={`${styles.live} ${live ? styles.liveOn : styles.liveOff}`}>{live ? 'LIVE' : 'OFF'}</span>
        <span className={styles.conn} title={title}>{label}{!connected && lastError ? ' ⓘ' : ''}</span>
        {user && <span className={styles.user}>{user.name} <em>({user.id})</em></span>}
      </div>
      <span className={styles.sep} />
      <div className={styles.stat} title="현재 시청자 수 (방송국 API, 15초마다 갱신)"><span>시청자</span><b className="num">{liveViewers.toLocaleString()}</b></div>
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
