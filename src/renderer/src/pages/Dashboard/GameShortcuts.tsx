import { useApp } from '../../contexts/AppContext'
import styles from './GameShortcuts.module.css'

const GAMES = [
  { id: 'roulette', icon: '🎡', name: '룰렛'     },
  { id: 'ladder',   icon: '🪜', name: '사다리타기' },
  { id: 'boss',     icon: '👾', name: '보스전'    },
  { id: 'gacha',    icon: '🎁', name: '뽑기'      },
  { id: 'quiz',     icon: '❓', name: '퀴즈'      },
  { id: 'slot',     icon: '🎰', name: '슬롯머신'  },
  { id: 'race',     icon: '🏁', name: '경주'      },
  { id: 'rps',      icon: '✊', name: '가위바위보' },
  { id: 'fish',     icon: '🎣', name: '낚시'      },
  { id: 'lottery',  icon: '🎟️', name: '복권'      },
  { id: 'number',   icon: '🔢', name: '숫자 추첨' },
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
              <span className={styles.gameIcon}>{g.icon}</span>
              <span className={styles.gameName}>{g.name}</span>
              {busy && <span className={styles.busyDot} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
