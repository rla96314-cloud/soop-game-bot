import { useApp } from '../../contexts/AppContext'
import styles from './FanAlert.module.css'

const fmtTime = (ts: number) => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export default function FanAlert() {
  const { connected, fanAlerts } = useApp()

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={`${styles.dot} ${connected ? styles.connected : ''}`} />
          <span className={styles.title}>🔥 열혈팬 입장</span>
        </div>
        <span className={styles.count}>{fanAlerts.length}명</span>
      </div>

      <div className={styles.list}>
        {fanAlerts.length === 0 ? (
          <div className={styles.empty}>
            {connected ? '열혈팬 대기 중...' : 'SOOP 연결 대기 중...'}
          </div>
        ) : (
          fanAlerts.map((a, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.fireIcon}>🔥</span>
              <div className={styles.info}>
                <div className={styles.nick}>{a.userNick}</div>
                <div className={styles.broadcasts}>
                  {a.broadcasts.slice(0, 3).map((b, j) => (
                    <span key={j} className={styles.badge}>
                      {b.name} #{b.rank}
                    </span>
                  ))}
                </div>
              </div>
              <span className={styles.time}>{fmtTime(a.ts)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
