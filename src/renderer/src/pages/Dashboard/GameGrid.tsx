import { useApp } from '../../contexts/AppContext'
import styles from './GameGrid.module.css'

const GAMES = [
  { id: 'roulette', name: '룰렛',     desc: '행운의 룰렛을 돌려\n당첨을 확인하세요!', color: '#8B5CF6' },
  { id: 'ladder',   name: '사다리타기', desc: '참가자 중 행운의\n당첨자를 가립니다!', color: '#3B82F6' },
  { id: 'boss',     name: '보스전',    desc: '모두의 힘을 모아\n보스를 클리어하세요!', color: '#EF4444' },
  { id: 'gacha',    name: '뽑기',     desc: '다양한 등급의 아이템을\n뽑아보세요!', color: '#F59E0B' },
  { id: 'quiz',     name: '퀴즈',     desc: '문제를 맞히고\n푸짐한 보상을!', color: '#10B981' },
  { id: 'slot',     name: '슬롯머신',  desc: '스릴 넘치는 슬롯!\n잭팟을 노려보세요!', color: '#8B5CF6' },
  { id: 'race',     name: '경주',     desc: '치열한 레이스에서\n우승자를 맞혀보세요!', color: '#6366F1' },
  { id: 'rps',      name: '가위바위보', desc: '스트리머와 시청자의\n한판 승부!', color: '#EC4899' },
  { id: 'fish',     name: '낚시',     desc: '낚시로 다양한 물고기를\n획득하세요!', color: '#14B8A6' },
  { id: 'lottery',  name: '복권',     desc: '행운의 번호로\n큰 당첨의 기회를!', color: '#F97316' },
]

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  idle:    { text: '대기 중',  color: '#6B7280' },
  running: { text: '진행 중',  color: '#10B981' },
  waiting: { text: '참가 모집', color: '#F59E0B' },
  ended:   { text: '종료',     color: '#8B5CF6' },
}

export default function GameGrid() {
  const { gameStates, triggerGame } = useApp()

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>게임 목록</span>
      </div>
      <div className={styles.grid}>
        {GAMES.map(g => {
          const state  = gameStates[g.id]
          const status = state?.status as string ?? 'idle'
          const sl     = STATUS_LABEL[status] ?? STATUS_LABEL.idle
          const busy   = status === 'running' || status === 'waiting'

          return (
            <div key={g.id} className={styles.card}>
              <div className={styles.iconWrap} style={{ background: `${g.color}18` }}>
                <span className={styles.icon} style={{ background: g.color, color: '#fff', fontSize: 13, fontWeight: 800 }}>
                  {g.name.charAt(0)}
                </span>
              </div>
              <div className={styles.info}>
                <div className={styles.name}>{g.name}</div>
                <div className={styles.desc}>{g.desc}</div>
                <div className={styles.statusBadge} style={{ color: sl.color }}>
                  {sl.text}
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.runBtn}
                  style={{ background: busy ? '#9CA3AF' : g.color, cursor: busy ? 'not-allowed' : 'pointer' }}
                  onClick={() => !busy && triggerGame(g.id)}
                  disabled={busy}
                >
                  {busy ? '진행 중...' : '실행하기'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
