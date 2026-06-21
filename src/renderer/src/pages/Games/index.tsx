import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Games.module.css'

const GAMES = [
  { id: 'roulette', icon: '🎡', name: '룰렛',     color: '#8B5CF6', settingKey: 'roulette' },
  { id: 'ladder',   icon: '🪜', name: '사다리타기', color: '#3B82F6', settingKey: 'ladder'   },
  { id: 'boss',     icon: '👾', name: '보스전',    color: '#EF4444', settingKey: 'boss'     },
  { id: 'gacha',    icon: '🎁', name: '뽑기',     color: '#F59E0B', settingKey: 'gacha'    },
  { id: 'quiz',     icon: '❓', name: '퀴즈',     color: '#10B981', settingKey: 'quiz'     },
  { id: 'slot',     icon: '🎰', name: '슬롯머신',  color: '#8B5CF6', settingKey: 'slot'     },
  { id: 'race',     icon: '🏁', name: '경주',     color: '#6366F1', settingKey: 'race'     },
  { id: 'rps',      icon: '✊', name: '가위바위보', color: '#EC4899', settingKey: 'rps'      },
  { id: 'fish',     icon: '🎣', name: '낚시',     color: '#14B8A6', settingKey: 'fish'     },
  { id: 'lottery',  icon: '🎟️', name: '복권',     color: '#F97316', settingKey: 'lottery'  },
]

export default function GamesPage() {
  const { settings, patchSettings, triggerGame, gameStates } = useApp()
  const [selected, setSelected] = useState<string>('roulette')

  const game      = GAMES.find(g => g.id === selected)!
  const gSettings = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.[game.settingKey] ?? {}
  const gState    = gameStates[selected]
  const busy      = gState?.status === 'running' || gState?.status === 'waiting'

  const saveSetting = (key: string, value: unknown) => {
    patchSettings({ games: { [game.settingKey]: { [key]: value } } })
  }

  return (
    <div className={styles.layout}>
      {/* Left: Game list */}
      <aside className={styles.sidebar}>
        <h2 className={styles.sideTitle}>게임 관리</h2>
        {GAMES.map(g => (
          <button
            key={g.id}
            className={`${styles.gameBtn} ${selected === g.id ? styles.active : ''}`}
            onClick={() => setSelected(g.id)}
          >
            <span className={styles.gameIcon}>{g.icon}</span>
            <span className={styles.gameName}>{g.name}</span>
            <span
              className={styles.statusDot}
              style={{ background: gameStates[g.id]?.status === 'running' ? '#10B981' : 'transparent', border: '2px solid #D1D5DB' }}
            />
          </button>
        ))}
      </aside>

      {/* Right: Settings panel */}
      <main className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelIcon}>{game.icon}</span>
          <h1 className={styles.panelTitle}>{game.name} 설정</h1>
          <button
            className={styles.runBtn}
            style={{ background: busy ? '#9CA3AF' : game.color }}
            disabled={busy}
            onClick={() => triggerGame(game.id)}
          >
            {busy ? '진행 중...' : '▶ 수동 실행'}
          </button>
        </div>

        <div className={styles.fields}>
          <Field label="별풍선 트리거 (0=비활성)">
            <input
              type="number" min={0}
              value={(gSettings.balloonThreshold as number) ?? 0}
              onChange={e => saveSetting('balloonThreshold', Number(e.target.value))}
            />
          </Field>
          <Field label="채팅 명령어">
            <input
              type="text"
              value={(gSettings.chatCommand as string) ?? ''}
              onChange={e => saveSetting('chatCommand', e.target.value)}
            />
          </Field>
          <Field label="최대 동시 진행">
            <input
              type="number" min={1}
              value={(gSettings.maxConcurrent as number) ?? 1}
              onChange={e => saveSetting('maxConcurrent', Number(e.target.value))}
            />
          </Field>

          {/* 보스전 전용 */}
          {game.id === 'boss' && (
            <>
              <Field label="보스 HP">
                <input
                  type="number" min={100}
                  value={(gSettings.bossHp as number) ?? 10000}
                  onChange={e => saveSetting('bossHp', Number(e.target.value))}
                />
              </Field>
              <Field label="별풍선당 데미지">
                <input
                  type="number" min={1}
                  value={(gSettings.damagePerBalloon as number) ?? 1}
                  onChange={e => saveSetting('damagePerBalloon', Number(e.target.value))}
                />
              </Field>
            </>
          )}

          {/* 사다리타기 전용 */}
          {game.id === 'ladder' && (
            <Field label="참가 시간 (초)">
              <input
                type="number" min={5}
                value={(gSettings.joinDuration as number) ?? 30}
                onChange={e => saveSetting('joinDuration', Number(e.target.value))}
              />
            </Field>
          )}

          {/* 퀴즈 전용 */}
          {game.id === 'quiz' && (
            <Field label="답변 시간 (초)">
              <input
                type="number" min={5}
                value={(gSettings.timeLimit as number) ?? 30}
                onChange={e => saveSetting('timeLimit', Number(e.target.value))}
              />
            </Field>
          )}
        </div>

        {/* 현재 상태 */}
        {gState && (
          <div className={styles.stateBox}>
            <h3 className={styles.stateTitle}>현재 상태</h3>
            <pre className={styles.stateJson}>{JSON.stringify(gState, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  )
}
