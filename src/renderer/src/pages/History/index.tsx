import { useState, useMemo } from 'react'
import { useApp, type HistoryItem } from '../../contexts/AppContext'
import styles from './History.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const GAME_FILTERS = [
  { id: 'all',      name: '전체'     },
  { id: 'roulette', name: '룰렛'     },
  { id: 'ladder',   name: '사다리타기' },
  { id: 'boss',     name: '보스전'    },
  { id: 'gacha',    name: '뽑기'     },
  { id: 'quiz',     name: '퀴즈'     },
  { id: 'slot',     name: '슬롯머신'  },
  { id: 'race',     name: '경주'     },
  { id: 'rps',      name: '가위바위보' },
  { id: 'fish',     name: '낚시'     },
  { id: 'lottery',  name: '복권'     },
  { id: 'number',   name: '숫자 추첨' },
]

const GAME_COLORS: Record<string, string> = {
  roulette: '#8B5CF6', ladder: '#3B82F6', boss: '#EF4444',
  gacha:    '#F59E0B', quiz:   '#10B981', slot: '#6366F1',
  race:     '#14B8A6', rps:    '#EC4899', fish: '#22D3EE',
  lottery:  '#F97316', number: '#06B6D4',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSpecial(result: string) {
  return result.includes('JACKPOT') || result.includes('레전드') ||
         result.includes('클리어')  || result.includes('정답')
}

function resultColor(result: string) {
  if (result.includes('JACKPOT') || result.includes('레전드')) return '#F59E0B'
  if (result.includes('클리어')  || result.includes('정답'))    return '#10B981'
  if (result.includes('당첨'))                                    return '#8B5CF6'
  return 'var(--text2)'
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{item.gameName}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <Row label="결과">
            <span style={{ color: resultColor(item.result), fontWeight: 700 }}>
              {item.result}
            </span>
          </Row>
          <Row label="상세"><span className={styles.detailText}>{item.detail}</span></Row>
          <Row label="트리거">{item.triggeredBy}</Row>
          {item.balloon > 0 && (
            <Row label="별풍선">
              <span className={styles.balloonVal}>{item.balloon.toLocaleString()}개</span>
            </Row>
          )}
          <Row label="시간">{fmtTime(item.ts)}</Row>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.modalRow}>
      <span className={styles.modalLabel}>{label}</span>
      <span className={styles.modalValue}>{children}</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { history } = useApp()

  const [filter,   setFilter]   = useState('all')
  const [sort,     setSort]     = useState<'newest' | 'oldest'>('newest')
  const [selected, setSelected] = useState<HistoryItem | null>(null)

  const filtered = useMemo(() => {
    const list = filter === 'all' ? history : history.filter(h => h.gameId === filter)
    return sort === 'newest' ? list : [...list].reverse()
  }, [history, filter, sort])

  // sidebar: run counts per game, sorted descending
  const gameCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const h of history) counts[h.gameId] = (counts[h.gameId] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [history])

  const maxCount     = gameCounts[0]?.[1] ?? 1
  const specialCount = useMemo(() => history.filter(h => isSpecial(h.result)).length, [history])
  const totalBalloon = useMemo(() => history.reduce((s, h) => s + h.balloon, 0), [history])

  return (
    <div className={styles.layout}>

      {/* ── Main table ── */}
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>게임 기록</h1>
            <span className={styles.badge}>{filtered.length}건</span>
          </div>
          <div className={styles.controls}>
            <select
              className={styles.select}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              {GAME_FILTERS.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={sort}
              onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>게임</th>
                <th>트리거</th>
                <th>별풍선</th>
                <th>결과</th>
                <th>시간</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {history.length === 0 ? '아직 게임 기록이 없습니다.' : '해당 게임 기록 없음'}
                  </td>
                </tr>
              ) : (
                filtered.map((h, i) => (
                  <tr
                    key={i}
                    className={`${styles.row} ${isSpecial(h.result) ? styles.specialRow : ''}`}
                    onClick={() => setSelected(h)}
                  >
                    <td>
                      <div className={styles.gameCell}>
                        <span className={styles.gameIcon} style={{ background: GAME_COLORS[h.gameId] ?? '#9CA3AF' }} />
                        <span>{h.gameName}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.userCell}>
                        <span className={styles.userDot} />
                        {h.triggeredBy}
                      </div>
                    </td>
                    <td>
                      {h.balloon > 0 && (
                        <span className={styles.balloon}>
                          {h.balloon.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: resultColor(h.result), fontWeight: isSpecial(h.result) ? 700 : 400 }}>
                        {h.result}
                      </span>
                    </td>
                    <td className={styles.timeCell}>{fmtTime(h.ts)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>

        {/* Summary */}
        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>오늘 요약</div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNum}>{history.length}</span>
              <span className={styles.summaryLabel}>총 실행</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNum} style={{ color: '#F59E0B' }}>
                {specialCount}
              </span>
              <span className={styles.summaryLabel}>특수 결과</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNum} style={{ color: '#F59E0B' }}>
                {totalBalloon.toLocaleString()}
              </span>
              <span className={styles.summaryLabel}>소모 별풍선</span>
            </div>
          </div>
        </div>

        {/* Per-game counts */}
        <div className={styles.sideCard}>
          <div className={styles.sideTitle}>게임별 실행 횟수</div>
          {gameCounts.length === 0 ? (
            <div className={styles.sideEmpty}>데이터 없음</div>
          ) : (
            <div className={styles.statList}>
              {gameCounts.map(([gameId, count]) => {
                const meta  = GAME_FILTERS.find(g => g.id === gameId)
                const color = GAME_COLORS[gameId] ?? '#9CA3AF'
                const pct   = Math.round((count / maxCount) * 100)
                return (
                  <div
                    key={gameId}
                    className={`${styles.statRow} ${filter === gameId ? styles.statRowActive : ''}`}
                    onClick={() => setFilter(gameId === filter ? 'all' : gameId)}
                  >
                    <span className={styles.statIcon} style={{ background: color }} />
                    <div className={styles.statBarWrap}>
                      <div className={styles.statLabel}>{meta?.name ?? gameId}</div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                    <span className={styles.statCount}>{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </aside>

      {/* ── Detail modal ── */}
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
