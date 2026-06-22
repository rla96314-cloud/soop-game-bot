import { useEffect, useState, useCallback } from 'react'
import styles from './Schedule.module.css'

interface MemberSchedule {
  name:    string
  time:    string
  content: string
  isOff:   boolean
}

interface DaySchedule {
  weekRange: string
  dayName:   string
  date:      string
  members:   MemberSchedule[]
  fetchedAt: number
}

const MEMBER_COLORS: Record<string, string> = {
  여우연: '#F97316',
  설홍:  '#EC4899',
  나노:  '#3B82F6',
  눈요:  '#8B5CF6',
  최애리: '#10B981',
  루첼:  '#F59E0B',
}

function memberColor(name: string): string {
  const known = MEMBER_COLORS[name]
  if (known) return known
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const colors = ['#6366F1', '#14B8A6', '#EF4444', '#A855F7', '#22D3EE']
  return colors[Math.abs(hash) % colors.length]
}

function fmtTime(time: string): string {
  if (!time || time.toLowerCase() === 'x') return ''
  return time.toUpperCase()
}

export default function Schedule() {
  const [data,    setData]    = useState<DaySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const el = (window as unknown as Record<string, unknown>).electron as
    Record<string, (...args: unknown[]) => unknown>

  const load = useCallback(async (force = false) => {
    if (!el?.scheduleToday) return
    setLoading(true)
    setError('')
    try {
      const res = await (el.scheduleToday as (f: boolean) => Promise<{ ok: boolean; data?: DaySchedule; error?: string }>)(force)
      if (res.ok && res.data) {
        setData(res.data)
      } else {
        setError(res.error ?? '일정을 불러올 수 없습니다.')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const activeDayLabel = data ? `${data.dayName}요일 · ${data.date}` : ''

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>오늘 방송 일정</span>
        <div className={styles.headerRight}>
          {data && <span className={styles.dayBadge}>{activeDayLabel}</span>}
          <button
            className={styles.refreshBtn}
            onClick={() => load(true)}
            disabled={loading}
            title="새로고침"
          >
            {loading ? <span className={styles.spinner} /> : '↺'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <span>⚠</span> {error}
        </div>
      )}

      {loading && !data && (
        <div className={styles.skeleton}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      )}

      {data && (
        <div className={styles.list}>
          {data.members.map((m, i) => {
            const color = memberColor(m.name)
            return (
              <div key={i} className={`${styles.row} ${m.isOff ? styles.offRow : ''}`}>
                <div className={styles.avatar} style={{ background: `${color}22`, color }}>
                  {m.name[0]}
                </div>
                <div className={styles.info}>
                  <span className={styles.name} style={{ color: m.isOff ? 'var(--text3)' : 'var(--text)' }}>
                    {m.name}
                  </span>
                  {m.content && (
                    <span className={styles.content}>{m.content.replace(/\n/g, ' ')}</span>
                  )}
                </div>
                <div className={styles.timeWrap}>
                  {m.isOff ? (
                    <span className={styles.offBadge}>휴방</span>
                  ) : (
                    <span className={styles.time} style={{ color }}>
                      {fmtTime(m.time)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data && (
        <div className={styles.footer}>
          시트: {data.weekRange}
        </div>
      )}
    </div>
  )
}
