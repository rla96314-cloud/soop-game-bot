import styles from './GameShortcuts.module.css'

const GAMES = [
  { icon: '🎡', name: '룰렛' },
  { icon: '🪜', name: '사다리타기' },
  { icon: '👾', name: '보스전' },
  { icon: '🎁', name: '뽑기' },
  { icon: '❓', name: '퀴즈' },
  { icon: '🎰', name: '슬롯머신' },
  { icon: '🏁', name: '경주' },
  { icon: '✊', name: '가위바위보' },
]

export default function GameShortcuts() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>게임 바로가기</span>
        <button className={styles.arrow}>›</button>
      </div>
      <div className={styles.grid}>
        {GAMES.map(g => (
          <button key={g.name} className={styles.gameBtn}>
            <span className={styles.gameIcon}>{g.icon}</span>
            <span className={styles.gameName}>{g.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
