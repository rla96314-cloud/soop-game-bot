import { useState } from 'react'
import styles from './GameGrid.module.css'

interface Game {
  id: string
  icon: string
  name: string
  desc: string
  enabled: boolean
  color: string
}

const GAMES: Game[] = [
  { id: 'roulette', icon: '🎡', name: '룰렛', desc: '행운의 룰렛을 돌려\n당첨을 확인하세요!', enabled: true, color: '#8B5CF6' },
  { id: 'ladder', icon: '🪜', name: '사다리타기', desc: '참가자 중 행운의\n당첨자를 가립니다!', enabled: true, color: '#3B82F6' },
  { id: 'boss', icon: '👾', name: '보스전', desc: '모두의 힘을 모아\n보스를 클리어세요!', enabled: true, color: '#EF4444' },
  { id: 'gacha', icon: '🎁', name: '뽑기', desc: '다양한 등급의 아이템을\n뽑아보세요!', enabled: true, color: '#F59E0B' },
  { id: 'quiz', icon: '❓', name: '퀴즈', desc: '문제를 맞히고\n푸짐한 보상을!', enabled: false, color: '#10B981' },
  { id: 'slot', icon: '🎰', name: '슬롯머신', desc: '스릴 넘치는 슬롯!\n잭팟을 노려보세요!', enabled: false, color: '#8B5CF6' },
  { id: 'race', icon: '🏁', name: '경주', desc: '치열한 레이스에서\n우승자를 맞혀보세요!', enabled: false, color: '#6366F1' },
  { id: 'rps', icon: '✊', name: '가위바위보', desc: '스트리머와 시청자의\n한판 승부!', enabled: false, color: '#EC4899' },
  { id: 'fish', icon: '🎣', name: '낚시', desc: '낚시로 다양한 물고기를\n획득하세요!', enabled: false, color: '#14B8A6' },
  { id: 'lottery', icon: '🎟️', name: '복권', desc: '행운의 번호로\n큰 당첨의 기회를!', enabled: false, color: '#F97316' },
]

export default function GameGrid() {
  const [games, setGames] = useState(GAMES)

  const runGame = (id: string) => {
    console.log('Run game:', id)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>게임 목록</span>
      </div>
      <div className={styles.grid}>
        {games.map(g => (
          <div key={g.id} className={styles.card}>
            <div className={styles.iconWrap} style={{ background: `${g.color}18` }}>
              <span className={styles.icon}>{g.icon}</span>
            </div>
            <div className={styles.info}>
              <div className={styles.name}>{g.name}</div>
              <div className={styles.desc}>{g.desc}</div>
            </div>
            <div className={styles.actions}>
              <button className={styles.settingBtn}>
                ⚙️ 설정
              </button>
              <button
                className={styles.runBtn}
                style={{ background: g.color }}
                onClick={() => runGame(g.id)}
              >
                실행하기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
