import { useApp } from '../../contexts/AppContext'
import styles from './GameGrid.module.css'

const GAMES = [
  { id: 'roulette', name: '룰렛',     color: '#8B5CF6' },
  { id: 'ladder',   name: '사다리타기', color: '#3B82F6' },
  { id: 'boss',     name: '보스전',    color: '#EF4444' },
  { id: 'gacha',    name: '뽑기',     color: '#F59E0B' },
  { id: 'quiz',     name: '퀴즈',     color: '#10B981' },
  { id: 'slot',     name: '슬롯머신',  color: '#8B5CF6' },
  { id: 'race',     name: '경주',     color: '#6366F1' },
  { id: 'rps',      name: '가위바위보', color: '#EC4899' },
  { id: 'fish',     name: '낚시',     color: '#14B8A6' },
  { id: 'lottery',  name: '복권',     color: '#F97316' },
]

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  idle:    { text: '대기',   color: '#9CA3AF' },
  running: { text: '진행 중', color: '#10B981' },
  waiting: { text: '모집 중', color: '#F59E0B' },
  ended:   { text: '종료',   color: '#8B5CF6' },
}

export default function GameGrid() {
  const { gameStates, triggerGame } = useApp()

  return (
    <div className={styles.grid}>
      {GAMES.map(g => {
        const state  = gameStates[g.id]
        const status = state?.status as string ?? 'idle'
        const sl     = STATUS_LABEL[status] ?? STATUS_LABEL.idle
        const busy   = status === 'running' || status === 'waiting'

        return (
          <div key={g.id} className={styles.card}>
            <div className={styles.iconWrap} style={{ background: `${g.color}18` }}>
              <span className={styles.icon} style={{ background: g.color }}>
                {g.name.charAt(0)}
              </span>
            </div>
            <div className={styles.name}>{g.name}</div>
            <div className={styles.status} style={{ color: sl.color }}>{sl.text}</div>
            <button
              className={styles.runBtn}
              style={{ background: busy ? '#9CA3AF' : g.color }}
              onClick={() => !busy && triggerGame(g.id)}
              disabled={busy}
            >
              {busy ? '진행중' : '실행'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
