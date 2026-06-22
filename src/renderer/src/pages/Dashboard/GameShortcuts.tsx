import { useApp } from '../../contexts/AppContext'
import styles from './GameShortcuts.module.css'

const GAMES = [
  { id: 'roulette', name: '룰렛',     color: '#8B5CF6' },
  { id: 'ladder',   name: '사다리타기', color: '#3B82F6' },
  { id: 'boss',     name: '보스전',    color: '#EF4444' },
  { id: 'gacha',    name: '뽑기',     color: '#F59E0B' },
  { id: 'quiz',     name: '퀴즈',     color: '#10B981' },
  { id: 'slot',     name: '슬롯머신',  color: '#6366F1' },
  { id: 'race',     name: '경주',     color: '#6366F1' },
  { id: 'rps',      name: '가위바위보', color: '#EC4899' },
  { id: 'fish',     name: '낚시',     color: '#14B8A6' },
  { id: 'lottery',  name: '복권',     color: '#F97316' },
  { id: 'number',   name: '숫자 추첨', color: '#06B6D4' },
]

export default function GameShortcuts() {
  const { triggerGame, gameStates } = useApp()

  const isBusy = (id: string) => {
    const s = gameStates[id]?.status
    return s === 'running' || s === 'collecting'
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>게임 바로가기</span>
      </div>
      <div className={styles.grid}>
        {GAMES.map(g => {
          const busy = isBusy(g.id)
          return (
            <button
              key={g.id}
              className={`${styles.gameBtn} ${busy ? styles.gameBtnBusy : ''}`}
              onClick={() => !busy && triggerGame(g.id)}
              title={busy ? '게임 진행 중' : `${g.name} 수동 실행`}
            >
              <span className={styles.gameIcon} style={{ background: g.color }} />
              <span className={styles.gameName}>{g.name}</span>
              {busy && <span className={styles.busyDot} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
