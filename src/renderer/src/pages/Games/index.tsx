import { useState, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Games.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouletteItem { name: string; probability: number }
interface GachaGrade   { name: string; probability: number; color: string }
interface QuizQuestion { question: string; answer: string }
interface Prize        { name: string; description: string }

// ── Game list ─────────────────────────────────────────────────────────────────

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

// ── List editors ──────────────────────────────────────────────────────────────

/** 룰렛 항목 편집 */
function RouletteEditor({ items: init, onSave }: { items: RouletteItem[]; onSave: (v: RouletteItem[]) => void }) {
  const [items, setItems] = useState<RouletteItem[]>(init)

  const commit = (next: RouletteItem[]) => { setItems(next); onSave(next) }

  const setField = (i: number, key: keyof RouletteItem, val: string | number) => {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it)
    setItems(next)
    return next
  }

  const total = items.reduce((s, it) => s + (it.probability || 0), 0)

  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>룰렛 항목</span>
        <span className={`${styles.totalBadge} ${total !== 100 ? styles.totalWarn : ''}`}>
          합계 {total}%
        </span>
        <button
          className={styles.addBtn}
          onClick={() => commit([...items, { name: '새 항목', probability: 10 }])}
        >
          + 항목 추가
        </button>
      </div>

      <div className={styles.listHead3}>
        <span style={{ flex: 1 }}>이름</span>
        <span style={{ width: 80, textAlign: 'right' }}>확률 (%)</span>
        <span style={{ width: 32 }} />
      </div>

      {items.map((it, i) => (
        <div key={i} className={styles.listRow}>
          <input
            className={styles.listInput}
            style={{ flex: 1 }}
            value={it.name}
            onChange={e => setField(i, 'name', e.target.value)}
            onBlur={() => onSave(items)}
          />
          <input
            className={styles.listInput}
            style={{ width: 80, textAlign: 'right' }}
            type="number" min={0} max={100}
            value={it.probability}
            onChange={e => commit(setField(i, 'probability', Number(e.target.value)))}
          />
          <button className={styles.delBtn} onClick={() => commit(items.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}

      {items.length === 0 && <div className={styles.listEmpty}>항목을 추가하세요</div>}
    </div>
  )
}

/** 뽑기 등급 편집 */
function GachaEditor({ grades: init, onSave }: { grades: GachaGrade[]; onSave: (v: GachaGrade[]) => void }) {
  const [grades, setGrades] = useState<GachaGrade[]>(init)

  const commit = (next: GachaGrade[]) => { setGrades(next); onSave(next) }

  const setField = (i: number, key: keyof GachaGrade, val: string | number) => {
    const next = grades.map((g, idx) => idx === i ? { ...g, [key]: val } : g)
    setGrades(next)
    return next
  }

  const total = grades.reduce((s, g) => s + (g.probability || 0), 0)

  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>등급 설정</span>
        <span className={`${styles.totalBadge} ${total !== 100 ? styles.totalWarn : ''}`}>
          합계 {total}%
        </span>
        <button
          className={styles.addBtn}
          onClick={() => commit([...grades, { name: '새 등급', probability: 5, color: '#6B7280' }])}
        >
          + 등급 추가
        </button>
      </div>

      <div className={styles.listHead4}>
        <span style={{ width: 36 }}>색상</span>
        <span style={{ flex: 1 }}>이름</span>
        <span style={{ width: 80, textAlign: 'right' }}>확률 (%)</span>
        <span style={{ width: 32 }} />
      </div>

      {grades.map((g, i) => (
        <div key={i} className={styles.listRow}>
          <input
            type="color"
            className={styles.colorInput}
            value={g.color}
            onChange={e => commit(setField(i, 'color', e.target.value))}
          />
          <input
            className={styles.listInput}
            style={{ flex: 1 }}
            value={g.name}
            onChange={e => setField(i, 'name', e.target.value)}
            onBlur={() => onSave(grades)}
          />
          <input
            className={styles.listInput}
            style={{ width: 80, textAlign: 'right' }}
            type="number" min={0} max={100}
            value={g.probability}
            onChange={e => commit(setField(i, 'probability', Number(e.target.value)))}
          />
          <button className={styles.delBtn} onClick={() => commit(grades.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}

      {grades.length === 0 && <div className={styles.listEmpty}>등급을 추가하세요</div>}
    </div>
  )
}

/** 사다리타기 상품 편집 */
function LadderEditor({ prizes: init, onSave }: { prizes: Prize[]; onSave: (v: Prize[]) => void }) {
  const [prizes, setPrizes] = useState<Prize[]>(init)

  const commit = (next: Prize[]) => { setPrizes(next); onSave(next) }

  const setField = (i: number, key: keyof Prize, val: string) => {
    const next = prizes.map((p, idx) => idx === i ? { ...p, [key]: val } : p)
    setPrizes(next)
    return next
  }

  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>상품 목록</span>
        <button
          className={styles.addBtn}
          onClick={() => commit([...prizes, { name: `${prizes.length + 1}등`, description: '' }])}
        >
          + 상품 추가
        </button>
      </div>

      <div className={styles.listHead3}>
        <span style={{ width: 100 }}>등수/이름</span>
        <span style={{ flex: 1 }}>설명</span>
        <span style={{ width: 32 }} />
      </div>

      {prizes.map((p, i) => (
        <div key={i} className={styles.listRow}>
          <input
            className={styles.listInput}
            style={{ width: 100 }}
            value={p.name}
            onChange={e => setField(i, 'name', e.target.value)}
            onBlur={() => onSave(prizes)}
          />
          <input
            className={styles.listInput}
            style={{ flex: 1 }}
            value={p.description}
            placeholder="(없으면 비워두세요)"
            onChange={e => setField(i, 'description', e.target.value)}
            onBlur={() => onSave(prizes)}
          />
          <button className={styles.delBtn} onClick={() => commit(prizes.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}

      {prizes.length === 0 && <div className={styles.listEmpty}>상품을 추가하세요</div>}
    </div>
  )
}

/** 퀴즈 문항 편집 */
function QuizEditor({ questions: init, onSave }: { questions: QuizQuestion[]; onSave: (v: QuizQuestion[]) => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(init)

  const commit = (next: QuizQuestion[]) => { setQuestions(next); onSave(next) }

  const setField = (i: number, key: keyof QuizQuestion, val: string) => {
    const next = questions.map((q, idx) => idx === i ? { ...q, [key]: val } : q)
    setQuestions(next)
    return next
  }

  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>퀴즈 문항</span>
        <button
          className={styles.addBtn}
          onClick={() => commit([...questions, { question: '', answer: '' }])}
        >
          + 문항 추가
        </button>
      </div>

      {questions.map((q, i) => (
        <div key={i} className={styles.quizRow}>
          <div className={styles.quizFields}>
            <div className={styles.quizField}>
              <span className={styles.quizLabel}>Q</span>
              <input
                className={styles.listInput}
                style={{ flex: 1 }}
                value={q.question}
                placeholder="질문을 입력하세요"
                onChange={e => setField(i, 'question', e.target.value)}
                onBlur={() => onSave(questions)}
              />
            </div>
            <div className={styles.quizField}>
              <span className={styles.quizLabel}>A</span>
              <input
                className={styles.listInput}
                style={{ flex: 1 }}
                value={q.answer}
                placeholder="정답을 입력하세요"
                onChange={e => setField(i, 'answer', e.target.value)}
                onBlur={() => onSave(questions)}
              />
            </div>
          </div>
          <button className={styles.delBtn} style={{ alignSelf: 'center' }} onClick={() => commit(questions.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}

      {questions.length === 0 && <div className={styles.listEmpty}>문항을 추가하세요</div>}
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamesPage() {
  const { settings, patchSettings, triggerGame, gameStates } = useApp()
  const [selected, setSelected] = useState<string>('roulette')

  const game      = GAMES.find(g => g.id === selected)!
  const gSettings = (settings?.games as Record<string, Record<string, unknown>> | undefined)?.[game.settingKey] ?? {}
  const gState    = gameStates[selected]
  const busy      = gState?.status === 'running' || gState?.status === 'collecting'

  const saveSetting = (key: string, value: unknown) => {
    patchSettings({ games: { [game.settingKey]: { [key]: value } } })
  }

  return (
    <div className={styles.layout}>

      {/* ── Left sidebar ── */}
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
              style={{
                background: gameStates[g.id]?.status === 'running' || gameStates[g.id]?.status === 'collecting'
                  ? '#10B981' : 'transparent',
                border: '2px solid #D1D5DB',
              }}
            />
          </button>
        ))}
      </aside>

      {/* ── Right panel ── */}
      <main className={styles.panel}>

        {/* Header */}
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

        {/* ── Common fields ── */}
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

          {/* Boss */}
          {game.id === 'boss' && (<>
            <Field label="보스 최대 HP">
              <input
                type="number" min={100}
                value={(gSettings.maxHp as number) ?? 10000}
                onChange={e => saveSetting('maxHp', Number(e.target.value))}
              />
            </Field>
            <Field label="별풍선당 데미지">
              <input
                type="number" min={1}
                value={(gSettings.damagePerBalloon as number) ?? 10}
                onChange={e => saveSetting('damagePerBalloon', Number(e.target.value))}
              />
            </Field>
            <Field label="채팅당 데미지">
              <input
                type="number" min={0}
                value={(gSettings.damagePerChat as number) ?? 1}
                onChange={e => saveSetting('damagePerChat', Number(e.target.value))}
              />
            </Field>
          </>)}

          {/* Ladder */}
          {game.id === 'ladder' && (<>
            <Field label="참가 시간 (초)">
              <input
                type="number" min={5}
                value={(gSettings.joinDuration as number) ?? 30}
                onChange={e => saveSetting('joinDuration', Number(e.target.value))}
              />
            </Field>
            <Field label="최대 참가 인원">
              <input
                type="number" min={2}
                value={(gSettings.maxParticipants as number) ?? 8}
                onChange={e => saveSetting('maxParticipants', Number(e.target.value))}
              />
            </Field>
          </>)}

          {/* Quiz */}
          {game.id === 'quiz' && (
            <Field label="답변 시간 (초)">
              <input
                type="number" min={5}
                value={(gSettings.timeLimit as number) ?? 30}
                onChange={e => saveSetting('timeLimit', Number(e.target.value))}
              />
            </Field>
          )}

          {/* Roulette */}
          {game.id === 'roulette' && (
            <Field label="회전 시간 (ms)">
              <input
                type="number" min={1000} step={500}
                value={(gSettings.spinDuration as number) ?? 3000}
                onChange={e => saveSetting('spinDuration', Number(e.target.value))}
              />
            </Field>
          )}
        </div>

        {/* ── List editors ── */}

        {game.id === 'roulette' && (
          <RouletteEditor
            key={selected}
            items={(gSettings.items as RouletteItem[]) ?? []}
            onSave={v => saveSetting('items', v)}
          />
        )}

        {game.id === 'gacha' && (
          <GachaEditor
            key={selected}
            grades={(gSettings.grades as GachaGrade[]) ?? []}
            onSave={v => saveSetting('grades', v)}
          />
        )}

        {game.id === 'ladder' && (
          <LadderEditor
            key={selected}
            prizes={(gSettings.prizes as Prize[]) ?? []}
            onSave={v => saveSetting('prizes', v)}
          />
        )}

        {game.id === 'quiz' && (
          <QuizEditor
            key={selected}
            questions={(gSettings.questions as QuizQuestion[]) ?? []}
            onSave={v => saveSetting('questions', v)}
          />
        )}

      </main>
    </div>
  )
}
