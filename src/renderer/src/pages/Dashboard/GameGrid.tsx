import { useApp } from '../../contexts/AppContext'
import styles from './GameGrid.module.css'

const GAMES = [
  { id: 'roulette', name: '룰렛',     color: '#8B5CF6' },
  { id: 'ladder',   name: '사다리타기', color: '#3B82F6' },
  { id: 'boss',     name: '보스전',    color: '#EF4444' },
  { id: 'quiz',     name: '퀴즈',     color: '#10B981' },
  { id: 'slot',     name: '슬롯머신',  color: '#8B5CF6' },
  { id: 'race',     name: '경주',     color: '#6366F1' },
  { id: 'rps',      name: '가위바위보', color: '#EC4899' },
  { id: 'fish',     name: '낚시',     color: '#14B8A6' },
  { id: 'lottery',  name: '복권',     color: '#F97316' },
]

function GameIcon({ id, color }: { id: string; color: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (id) {
    case 'roulette': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <circle cx={22} cy={22} r={16} {...s} />
        <circle cx={22} cy={22} r={9}  {...s} />
        <circle cx={22} cy={22} r={3}  fill={color} stroke="none" />
        <line x1={22} y1={6}  x2={22} y2={10} {...s} />
        <line x1={22} y1={34} x2={22} y2={38} {...s} />
        <line x1={6}  y1={22} x2={10} y2={22} {...s} />
        <line x1={34} y1={22} x2={38} y2={22} {...s} />
      </svg>
    )
    case 'ladder': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <line x1={13} y1={4}  x2={13} y2={40} {...s} />
        <line x1={31} y1={4}  x2={31} y2={40} {...s} />
        <line x1={13} y1={14} x2={31} y2={14} {...s} />
        <line x1={13} y1={24} x2={31} y2={24} {...s} />
        <line x1={13} y1={34} x2={31} y2={34} {...s} />
      </svg>
    )
    case 'boss': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <path d="M8 34 L10 16 L18 24 L22 10 L26 24 L34 16 L36 34 Z" {...s} />
        <rect x={8} y={34} width={28} height={5} rx={2.5} {...s} />
      </svg>
    )
    case 'quiz': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <path d="M6 8 Q6 4 10 4 H34 Q38 4 38 8 V26 Q38 30 34 30 H24 L15 39 V30 H10 Q6 30 6 26 Z" {...s} />
        <text x={22} y={24} textAnchor="middle" fontSize={16} fontWeight="bold" fill={color} stroke="none" fontFamily="sans-serif">?</text>
      </svg>
    )
    case 'slot': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <rect x={5} y={10} width={34} height={26} rx={4} {...s} />
        <rect x={10} y={15} width={7}  height={12} rx={2} {...s} />
        <rect x={18} y={15} width={8}  height={12} rx={2} {...s} />
        <rect x={27} y={15} width={7}  height={12} rx={2} {...s} />
        <line x1={5} y1={36} x2={39} y2={36} {...s} />
        <line x1={32} y1={6}  x2={32} y2={10} {...s} />
        <line x1={28} y1={8}  x2={36} y2={8}  {...s} />
      </svg>
    )
    case 'race': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <line x1={18} y1={4} x2={18} y2={36} {...s} />
        <rect x={18} y={4}  width={7} height={6} fill={color} stroke="none" rx={1} />
        <rect x={25} y={10} width={7} height={6} fill={color} stroke="none" rx={1} />
        <rect x={18} y={16} width={7} height={6} fill="none" stroke={color} strokeWidth={1.5} rx={1} />
        <rect x={25} y={22} width={7} height={6} fill={color} stroke="none" rx={1} />
        <rect x={18} y={28} width={7} height={6} fill="none" stroke={color} strokeWidth={1.5} rx={1} />
        <path d="M6 40 Q12 36 18 40 Q24 44 30 40" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </svg>
    )
    case 'rps': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <path d="M10 32 C10 24 8 16 15 16 L19 16 L19 8 C19 6 21 6 22 8 L22 18" {...s} />
        <path d="M22 16 C22 14 25 14 25 16 L25 20" {...s} />
        <path d="M25 18 C25 16 28 16 28 18 L28 23" {...s} />
        <path d="M28 21 C28 19 31 19 31 21 L31 28 C31 33 27 37 21 37 L17 37 C13 37 10 33 10 32" {...s} />
      </svg>
    )
    case 'fish': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <path d="M12 6 Q16 6 16 12 L16 32" {...s} />
        <circle cx={12} cy={6} r={2.5} {...s} />
        <path d="M16 28 Q26 38 34 34 Q40 30 36 38" {...s} />
        <circle cx={36} cy={38} r={3} {...s} />
        <line x1={16} y1={12} x2={26} y2={22} stroke={color} strokeWidth={1.5} strokeDasharray="2 3" fill="none" />
      </svg>
    )
    case 'lottery': return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <rect x={4} y={12} width={36} height={22} rx={4} {...s} />
        <line x1={16} y1={12} x2={16} y2={34} stroke={color} strokeWidth={2} strokeDasharray="3 3" />
        <circle cx={28} cy={23} r={6} {...s} />
        <circle cx={28} cy={23} r={2.5} fill={color} stroke="none" />
      </svg>
    )
    default: return (
      <svg viewBox="0 0 44 44" width={44} height={44}>
        <circle cx={22} cy={22} r={16} {...s} />
      </svg>
    )
  }
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  idle:    { text: '대기',   color: '#9CA3AF' },
  running: { text: '진행 중', color: '#10B981' },
  waiting: { text: '모집 중', color: '#F59E0B' },
  ended:   { text: '종료',   color: '#8B5CF6' },
}

export default function GameGrid({ onNavigateToGame }: { onNavigateToGame: (id: string) => void }) {
  const { gameStates } = useApp()

  return (
    <div className={styles.grid}>
      {GAMES.map(g => {
        const state  = gameStates[g.id]
        const status = state?.status as string ?? 'idle'
        const sl     = STATUS_LABEL[status] ?? STATUS_LABEL.idle
        const busy   = status === 'running' || status === 'waiting'

        return (
          <div key={g.id} className={styles.card} onClick={() => onNavigateToGame(g.id)} style={{ cursor: 'pointer' }}>
            <div className={styles.iconWrap} style={{ background: `${g.color}18` }}>
              <GameIcon id={g.id} color={g.color} />
            </div>
            <div className={styles.name}>{g.name}</div>
            <div className={styles.status} style={{ color: sl.color }}>{sl.text}</div>
            <button
              className={styles.runBtn}
              style={{ background: busy ? '#10B981' : g.color }}
              onClick={e => { e.stopPropagation(); onNavigateToGame(g.id) }}
            >
              {busy ? '진행중' : '설정'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
