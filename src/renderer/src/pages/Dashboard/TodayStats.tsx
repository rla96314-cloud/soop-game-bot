import { useMemo } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './TodayStats.module.css'

const GAME_COLORS: Record<string, string> = {
  roulette: '#8B5CF6', ladder: '#3B82F6', boss: '#EC4899',
  quiz: '#10B981', slot: '#6366F1',
  race: '#14B8A6', rps: '#EF4444', fish: '#22D3EE', lottery: '#F97316',
}
const GAME_NAMES: Record<string, string> = {
  roulette: '룰렛', ladder: '사다리타기', boss: '보스전',
  quiz: '퀴즈', slot: '슬롯머신',
  race: '경주', rps: '가위바위보', fish: '낚시', lottery: '복권',
}

export default function TodayStats() {
  const { history, stats } = useApp()

  const segments = useMemo(() => {
    if (history.length === 0) return []
    const counts: Record<string, number> = {}
    for (const h of history) {
      counts[h.gameId] = (counts[h.gameId] ?? 0) + 1
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        label: GAME_NAMES[id] ?? id,
        pct: Math.round((count / total) * 100),
        color: GAME_COLORS[id] ?? '#9CA3AF',
      }))
  }, [history])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>오늘의 통계</span>
      </div>
      <div className={styles.body}>
        <DonutChart segments={segments} totalRuns={stats.todayRuns} />
        <div className={styles.legend}>
          {segments.length === 0
            ? <div className={styles.empty}>데이터 없음</div>
            : segments.map(s => (
              <div key={s.label} className={styles.legendRow}>
                <span className={styles.dot} style={{ background: s.color }} />
                <span className={styles.legendLabel}>{s.label}</span>
                <span className={styles.legendPct}>{s.pct}%</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

function DonutChart({ segments, totalRuns }: { segments: { label: string; pct: number; color: string }[]; totalRuns: number }) {
  const r = 50, cx = 70, cy = 70, strokeW = 22
  const circumference = 2 * Math.PI * r

  let offset = 0
  const slices = segments.map(seg => {
    const dashLen = (seg.pct / 100) * circumference
    const slice = { ...seg, dashLen, offset }
    offset += dashLen
    return slice
  })

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--p50)" strokeWidth={strokeW} />
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={s.color} strokeWidth={strokeW}
          strokeDasharray={`${s.dashLen} ${circumference - s.dashLen}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s' }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text)" fontFamily="Inter,sans-serif">
        {totalRuns}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="var(--text3)" fontFamily="Noto Sans KR,sans-serif">오늘 실행</text>
    </svg>
  )
}
