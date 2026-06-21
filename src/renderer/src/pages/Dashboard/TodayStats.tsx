import styles from './TodayStats.module.css'

const SEGMENTS = [
  { label: '룰렛', pct: 40, color: '#8B5CF6' },
  { label: '보스전', pct: 20, color: '#EC4899' },
  { label: '사다리타기', pct: 15, color: '#3B82F6' },
  { label: '퀴즈', pct: 10, color: '#10B981' },
  { label: '기타', pct: 15, color: '#F59E0B' },
]

function DonutChart() {
  const r = 50
  const cx = 70
  const cy = 70
  const strokeW = 22
  const circumference = 2 * Math.PI * r

  let offset = 0
  const slices = SEGMENTS.map(seg => {
    const dashLen = (seg.pct / 100) * circumference
    const slice = { ...seg, dashLen, offset }
    offset += dashLen
    return slice
  })

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--p50)" strokeWidth={strokeW} />
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeW}
          strokeDasharray={`${s.dashLen} ${circumference - s.dashLen}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s' }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text)" fontFamily="Inter,sans-serif">32</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="var(--text3)" fontFamily="Noto Sans KR,sans-serif">오늘 실행</text>
    </svg>
  )
}

export default function TodayStats() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>오늘의 통계</span>
      </div>
      <div className={styles.body}>
        <DonutChart />
        <div className={styles.legend}>
          {SEGMENTS.map(s => (
            <div key={s.label} className={styles.legendRow}>
              <span className={styles.dot} style={{ background: s.color }} />
              <span className={styles.legendLabel}>{s.label}</span>
              <span className={styles.legendPct}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
