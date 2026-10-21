import { useState, useEffect, useRef } from 'react'
import styles from './Games.module.css'
import NumberField from '../../components/NumberField'
import { useManualLadder, setManualLadder } from '../../lib/manualLadderStore'

// 게임별 설정 편집기·진행 패널 모음 (GameConfig / GamePreview 에서 조합)
// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouletteItem { name: string; probability: number }
export interface QuizQuestion { question: string; answer: string }
export interface Prize        { name: string; description: string }
export interface PickItem     { name: string; description: string; color: string; count: number }
export interface LotteryPrize { name: string; prob: number; color: string; detail?: string; isWin?: boolean }

export interface LadderRung { row: number; leftCol: number }
export interface LadderPath { cols: number[] }
export interface LadderData {
  rows: number; cols: number
  rungs: LadderRung[]; paths: LadderPath[]
  order: string[]; prizes: string[]
  results: Array<{ user: string; prize: string; startCol: number; endCol: number }>
}
export interface LadderState {
  participants: string[]; maxSlots: number; deadline: number
  prizes: string[]; ladderData?: LadderData
}

// ── List editors ──────────────────────────────────────────────────────────────

/** 룰렛 항목 편집 */
export function RouletteEditor({ items: init, onSave }: { items: RouletteItem[]; onSave: (v: RouletteItem[]) => void }) {
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
          <NumberField
            className={styles.listInput}
            style={{ width: 80, textAlign: 'right' }}
            min={0} max={100}
            value={it.probability}
            onCommit={v => commit(setField(i, 'probability', v))}
          />
          <button className={styles.delBtn} onClick={() => commit(items.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}

      {items.length === 0 && <div className={styles.listEmpty}>항목을 추가하세요</div>}
    </div>
  )
}

/** 복권 상품 편집 */
export function LotteryEditor({ prizes: init, onSave }: { prizes: LotteryPrize[]; onSave: (v: LotteryPrize[]) => void }) {
  const [prizes, setPrizes] = useState<LotteryPrize[]>(init)
  const commit = (next: LotteryPrize[]) => { setPrizes(next); onSave(next) }
  const setField = (i: number, key: keyof LotteryPrize, val: string | number | boolean) => {
    const next = prizes.map((p, idx) => idx === i ? { ...p, [key]: val } : p)
    setPrizes(next); return next
  }
  // 당첨 여부는 이름이 '꽝'인지가 아니라 체크박스로 — "꽝!"·"다음 기회에" 같은 이름도 꽝으로 둘 수 있게
  const isWin = (p: LotteryPrize) => typeof p.isWin === 'boolean' ? p.isWin : p.name.trim() !== '꽝'
  const total = prizes.reduce((s, p) => s + (p.prob || 0), 0)
  const DEFAULT: LotteryPrize[] = [
    { name: '꽝',           prob: 55, color: '#9CA3AF', detail: '다음엔 행운이!', isWin: false },
    { name: '별풍선 10개',  prob: 25, color: '#F97316', detail: '소소한 행운!' },
    { name: '별풍선 50개',  prob: 12, color: '#10B981', detail: '행운이 찾아왔어요!' },
    { name: '별풍선 200개', prob: 6,  color: '#8B5CF6', detail: '대박 행운!' },
    { name: '별풍선 500개', prob: 2,  color: '#EF4444', detail: '초대박!!!' },
  ]
  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>상품 목록</span>
        <span className={`${styles.totalBadge} ${total !== 100 ? styles.totalWarn : ''}`}>합계 {total}%</span>
        <button className={styles.addBtn} onClick={() => commit([...prizes, { name: '새 상품', prob: 5, color: '#6B7280', detail: '' }])}>+ 추가</button>
        {prizes.length === 0 && <button className={styles.addBtn} style={{ background: 'none', border: '1px dashed var(--border)', color: 'var(--p500)' }} onClick={() => commit(DEFAULT)}>기본값 불러오기</button>}
      </div>
      <div className={styles.listHead4}>
        <span style={{ width: 36 }}>색상</span>
        <span style={{ flex: 1 }}>상품명</span>
        <span style={{ width: 100 }}>설명</span>
        <span style={{ width: 70, textAlign: 'right' }}>확률(%)</span>
        <span style={{ width: 44, textAlign: 'center' }} title="체크하면 당첨 연출(반짝임)">당첨</span>
        <span style={{ width: 32 }} />
      </div>
      {prizes.map((p, i) => (
        <div key={i} className={styles.listRow}>
          <input type="color" className={styles.colorInput} value={p.color} onChange={e => commit(setField(i, 'color', e.target.value))} />
          <input className={styles.listInput} style={{ flex: 1 }} value={p.name} onChange={e => setField(i, 'name', e.target.value)} onBlur={() => onSave(prizes)} />
          <input className={styles.listInput} style={{ width: 100 }} placeholder="설명" value={p.detail ?? ''} onChange={e => setField(i, 'detail', e.target.value)} onBlur={() => onSave(prizes)} />
          <NumberField className={styles.listInput} style={{ width: 70, textAlign: 'right' }} min={0} max={100} value={p.prob} onCommit={v => commit(setField(i, 'prob', v))} />
          <input type="checkbox" style={{ width: 44 }} checked={isWin(p)} onChange={e => commit(setField(i, 'isWin', e.target.checked))} title="당첨 연출" />
          <button className={styles.delBtn} onClick={() => commit(prizes.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      {prizes.length === 0 && <div className={styles.listEmpty}>상품을 추가하거나 기본값을 불러오세요</div>}
    </div>
  )
}

/** 사다리타기 상품 편집 */
export function LadderEditor({ prizes: init, onSave }: { prizes: Prize[]; onSave: (v: Prize[]) => void }) {
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
export function QuizEditor({ questions: init, onSave }: { questions: QuizQuestion[]; onSave: (v: QuizQuestion[]) => void }) {
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

// ── PickBoard editor ──────────────────────────────────────────────────────────

export function PickBoardEditor({
  items: init, rows: initRows, cols: initCols,
  onSave, onSaveSize,
}: {
  items: PickItem[]
  rows: number
  cols: number
  onSave: (v: PickItem[]) => void
  onSaveSize: (rows: number, cols: number) => void
}) {
  const [items, setItems] = useState<PickItem[]>(init)
  const [rows, setRows]   = useState(initRows)
  const [cols, setCols]   = useState(initCols)

  const total = items.reduce((s, i) => s + i.count, 0)
  const cells = rows * cols

  const save = (next: PickItem[]) => { setItems(next); onSave(next) }

  return (
    <div className={styles.listEditor}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>뽑기판 설정</span>
        <div className={styles.pbSizeRow}>
          <label>크기</label>
          <NumberField className={styles.pbSizeInput} min={1} max={10}
            value={rows}
            onCommit={v => { setRows(v); onSaveSize(v, cols) }}
          />
          <span>×</span>
          <NumberField className={styles.pbSizeInput} min={1} max={10}
            value={cols}
            onCommit={v => { setCols(v); onSaveSize(rows, v) }}
          />
          <span className={`${styles.totalBadge} ${total !== cells ? styles.totalWarn : ''}`}>
            {total}/{cells}칸
          </span>
        </div>
      </div>

      <div className={styles.listHead4}>
        <span>색상</span><span>이름</span><span>설명</span><span>수량</span>
      </div>

      {items.map((item, i) => (
        <div key={i} className={styles.listRow}>
          <input
            type="color"
            className={styles.colorInput}
            value={item.color}
            onChange={e => {
              const next = items.map((x, j) => j === i ? { ...x, color: e.target.value } : x)
              save(next)
            }}
          />
          <input
            className={styles.listInput}
            value={item.name}
            placeholder="상품명"
            onChange={e => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            onBlur={() => onSave(items)}
          />
          <input
            className={styles.listInput}
            value={item.description}
            placeholder="설명"
            onChange={e => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
            onBlur={() => onSave(items)}
          />
          <NumberField
            min={0} max={100} style={{ width: 50 }}
            className={styles.listInput}
            value={item.count}
            onCommit={v => save(items.map((x, j) => j === i ? { ...x, count: v } : x))}
          />
          <button className={styles.delBtn} onClick={() => save(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}

      <button className={styles.addBtn} onClick={() => save([...items, { name: '새 상품', description: '', color: '#6B7280', count: 1 }])}>
        + 상품 추가
      </button>
    </div>
  )
}

// ── PickBoard panel ───────────────────────────────────────────────────────────
// 판 상태(섞인 칸·공개 여부)는 메인 프로세스(pickboard store)에 있다.
// 탭을 옮겨 패널이 다시 마운트돼도 진행 중인 판이 유지되고, 새 판이 OBS 로 송출되는 일이 없다.

interface Cell { prize: PickItem; revealed: boolean }
interface PickboardState { rows: number; cols: number; cells: Cell[]; lastResult: PickItem | null }

type El = Record<string, (...args: never[]) => unknown>
const electron = () => (window as unknown as { electron?: El }).electron

export function PickBoardPanel() {
  const [pb, setPb] = useState<PickboardState | null>(null)
  const el = electron()

  useEffect(() => {
    if (!el) return
    ;(el.pickboardGet as () => Promise<PickboardState>)().then(setPb).catch(() => {})
    const off = (el.onPickboardUpdate as (cb: (s: unknown) => void) => () => void)(s => setPb(s as PickboardState))
    return off
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = (idx: number) => { (el?.pickboardReveal as ((i: number) => Promise<unknown>) | undefined)?.(idx).catch(() => {}) }
  const reset  = () => { (el?.pickboardReset as (() => Promise<unknown>) | undefined)?.().catch(() => {}) }
  const show   = () => { (el?.pickboardShow as (() => Promise<unknown>) | undefined)?.().catch(() => {}) }

  if (!pb) return <div className={styles.pbPanel}><div className={styles.listEmpty}>뽑기판 불러오는 중…</div></div>
  const { rows, cols, cells, lastResult } = pb
  const revealedCount = cells.filter(c => c.revealed).length

  return (
    <div className={styles.pbPanel}>
      <div className={styles.pbHeader}>
        <span className={styles.pbTitle}>뽑기판</span>
        <span className={styles.pbCount}>{revealedCount}/{rows * cols} 오픈</span>
        <button className={styles.pbResetBtn} onClick={show}>오버레이 노출</button>
        <button className={styles.pbResetBtn} onClick={reset}>초기화</button>
      </div>

      {lastResult && (
        <div className={styles.pbResult} style={{ borderColor: lastResult.color + '80' }}>
          <span className={styles.pbResultIcon} style={{ background: lastResult.color }}>!</span>
          <div>
            <div className={styles.pbResultName} style={{ color: lastResult.color }}>{lastResult.name}</div>
            {lastResult.description && <div className={styles.pbResultDesc}>{lastResult.description}</div>}
          </div>
        </div>
      )}

      <div
        className={styles.pbGrid}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cells.map((cell, i) => (
          <button
            key={i}
            className={`${styles.pbCell} ${cell.revealed ? styles.pbCellRevealed : ''}`}
            style={cell.revealed ? { borderColor: cell.prize.color, background: cell.prize.color + '22' } : {}}
            onClick={() => reveal(i)}
          >
            {cell.revealed ? (
              <div className={styles.pbCellFront}>
                <div className={styles.pbCellName} style={{ color: cell.prize.color }}>{cell.prize.name}</div>
                {cell.prize.description && <div className={styles.pbCellDesc}>{cell.prize.description}</div>}
              </div>
            ) : (
              <span className={styles.pbCellNum}>{i + 1}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Ladder panel ─────────────────────────────────────────────────────────────

export const PLAYER_COLORS = [
  '#8B5CF6','#EC4899','#3B82F6','#10B981',
  '#F59E0B','#EF4444','#14B8A6','#6366F1',
]

export function LadderSVG({ data, animate }: { data: LadderData; animate: boolean }) {
  const COL_W  = 72
  const ROW_H  = 28
  const PAD_X  = 36
  const PAD_TOP = 40
  const PAD_BOT = 40
  const W = PAD_X * 2 + (data.cols - 1) * COL_W
  const H = PAD_TOP + data.rows * ROW_H + PAD_BOT

  const x = (c: number) => PAD_X + c * COL_W

  // Animate: draw dot moving along each path, with delay per participant
  const [step, setStep] = useState(animate ? 0 : data.rows + 1)
  useEffect(() => {
    if (!animate) { setStep(data.rows + 1); return }
    setStep(0)
    const id = setInterval(() => setStep(s => {
      if (s >= data.rows) { clearInterval(id); return s + 1 }
      return s + 1
    }), 60)
    return () => clearInterval(id)
  }, [animate, data])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.ladderSvg}>
      {/* Vertical rails */}
      {data.order.map((_, c) => (
        <line key={c}
          x1={x(c)} y1={PAD_TOP}
          x2={x(c)} y2={PAD_TOP + data.rows * ROW_H}
          stroke="rgba(255,255,255,0.15)" strokeWidth={2}
        />
      ))}

      {/* Rungs */}
      {data.rungs.map((rg, i) => (
        <line key={i}
          x1={x(rg.leftCol)} y1={PAD_TOP + rg.row * ROW_H}
          x2={x(rg.leftCol + 1)} y2={PAD_TOP + rg.row * ROW_H}
          stroke="rgba(255,255,255,0.35)" strokeWidth={2.5}
        />
      ))}

      {/* Animated paths (orthogonal right-angle segments) */}
      {data.paths.map((path, pi) => {
        const color = PLAYER_COLORS[pi % PLAYER_COLORS.length]
        const maxRow = Math.min(step, data.rows)
        const pts: string[] = [`${x(path.cols[0])},${PAD_TOP}`]
        for (let r = 0; r < maxRow; r++) {
          const curY = PAD_TOP + r * ROW_H
          const nxtY = PAD_TOP + (r + 1) * ROW_H
          if (path.cols[r + 1] !== path.cols[r]) pts.push(`${x(path.cols[r + 1])},${curY}`)
          pts.push(`${x(path.cols[r + 1])},${nxtY}`)
        }
        return (
          <polyline key={pi}
            points={pts.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.85}
          />
        )
      })}

      {/* Moving dots */}
      {step <= data.rows && data.paths.map((path, pi) => {
        const r     = Math.min(step, data.rows)
        const color = PLAYER_COLORS[pi % PLAYER_COLORS.length]
        return (
          <circle key={pi}
            cx={x(path.cols[r])} cy={PAD_TOP + r * ROW_H}
            r={5} fill={color}
          />
        )
      })}

      {/* Participant names (top) */}
      {data.order.map((name, c) => (
        <text key={c}
          x={x(c)} y={PAD_TOP - 8}
          textAnchor="middle"
          fontSize={11} fontWeight={700}
          fill={PLAYER_COLORS[c % PLAYER_COLORS.length]}
        >
          {name.length > 6 ? name.slice(0, 5) + '…' : name}
        </text>
      ))}

      {/* Prize names (bottom) */}
      {data.prizes.map((prize, c) => (
        <text key={c}
          x={x(c)} y={PAD_TOP + data.rows * ROW_H + 20}
          textAnchor="middle"
          fontSize={10} fontWeight={600}
          fill="rgba(255,255,255,0.6)"
        >
          {prize.length > 6 ? prize.slice(0, 5) + '…' : prize}
        </text>
      ))}

      {/* End dots (bottom of each column) */}
      {data.prizes.map((_, c) => (
        <circle key={c}
          cx={x(c)} cy={PAD_TOP + data.rows * ROW_H}
          r={4} fill="rgba(255,255,255,0.2)"
          stroke="rgba(255,255,255,0.4)" strokeWidth={1}
        />
      ))}
    </svg>
  )
}

// 엔진과 동일한 사다리 생성 로직 (수동 모드용)
export function buildLadderData(participants: string[], prizes: Prize[]): LadderData {
  const cols = participants.length
  const rows = Math.max(8, cols * 2)
  const rungs: LadderRung[] = []

  for (let r = 0; r < rows; r++) {
    const used = new Set<number>()
    for (let c = 0; c < cols - 1; c++) {
      if (!used.has(c) && !used.has(c + 1) && Math.random() < 0.35) {
        rungs.push({ row: r, leftCol: c })
        used.add(c); used.add(c + 1)
      }
    }
  }

  // 엔진(buildLadder)과 같은 규칙: 상위 순위부터 cols 개, 모자라면 "N등" 채움, Fisher-Yates 로 바닥 섞기
  const ranked = prizes.slice(0, cols).map((p, rank) => ({ name: p.name, rank }))
  while (ranked.length < cols) ranked.push({ name: `${ranked.length + 1}등`, rank: ranked.length })
  const bottom = ranked.slice()
  for (let i = bottom.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bottom[i], bottom[j]] = [bottom[j], bottom[i]] }
  const prizeOrder = bottom.map(b => b.name)

  const paths: LadderPath[] = participants.map((_, startCol) => {
    const colPath = [startCol]; let cur = startCol
    for (let r = 0; r < rows; r++) {
      if (rungs.some(rg => rg.row === r && rg.leftCol === cur)) cur++
      else if (rungs.some(rg => rg.row === r && rg.leftCol === cur - 1)) cur--
      colPath.push(cur)
    }
    return { cols: colPath }
  })

  const results = participants.map((user, i) => {
    const endCol = paths[i].cols[rows]
    return { user, prize: bottom[endCol].name, rank: bottom[endCol].rank, startCol: i, endCol }
  })
  results.sort((a, b) => a.rank - b.rank)

  return { rows, cols, rungs, paths, order: participants, prizes: prizeOrder,
           results: results.map(({ user, prize, startCol, endCol }) => ({ user, prize, startCol, endCol })) }
}

export function LadderPanel({ gSettings, gameStates }: {
  gSettings: Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
}) {
  const el = (window as unknown as Record<string, Record<string, unknown>>).electron

  const ladderGameState = gameStates['ladder']
  const status      = ladderGameState?.status as string ?? 'idle'
  const ladderState = ladderGameState?.ladder as LadderState | undefined
  const ladderData  = ladderState?.ladderData

  const isCollecting = status === 'collecting'
  const isResult     = status === 'showing_result'
  const prizes       = (gSettings.prizes as Prize[]) ?? []

  // ── 수동 모드 state (모듈 스토어 — 탭을 옮겨도 유지) ──
  const [manualMode, setManualMode]   = useState(false)
  const [manualInput, setManualInput] = useState('')
  const manual = useManualLadder()
  const manualParticipants = manual.participants
  const previewData        = manual.previewData
  const manualResult       = manual.result
  const manualAnimating    = manual.animating
  const revealedSet        = new Set(manual.revealed)
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (animTimer.current) clearTimeout(animTimer.current) }, [])

  const broadcast = (type: string, data: unknown) => {
    if (el?.overlayBroadcast)
      (el.overlayBroadcast as (t: string, d: unknown) => void)(type, data)
  }

  const addParticipant = () => {
    const name = manualInput.trim()
    if (!name || manualParticipants.includes(name)) return
    setManualLadder(s => ({ participants: [...s.participants, name], previewData: null, result: null, revealed: [] }))
    setManualInput('')
  }

  const removeParticipant = (i: number) => {
    setManualLadder(s => ({ participants: s.participants.filter((_, idx) => idx !== i), previewData: null, result: null, revealed: [] }))
  }

  const showOverlay = () => {
    if (manualParticipants.length < 2) return
    const data = buildLadderData(manualParticipants, prizes)
    setManualLadder({ previewData: data, result: null, revealed: [] })
    broadcast('game:state', { id: 'ladder', status: 'manual_preview', ladder: { ladderData: data } })
  }

  const revealParticipant = (idx: number) => {
    if (!previewData || revealedSet.has(idx)) return
    setManualLadder(s => ({ revealed: [...s.revealed, idx], result: previewData }))
    broadcast('game:ladder:reveal', { ladderData: previewData, revealIdx: idx })
  }

  const revealAll = () => {
    if (!previewData) return
    setManualLadder({ result: previewData, animating: true, revealed: manualParticipants.map((_, i) => i) })
    broadcast('game:state', { id: 'ladder', status: 'manual_running', ladder: { ladderData: previewData } })
    if (animTimer.current) clearTimeout(animTimer.current)
    animTimer.current = setTimeout(() => setManualLadder({ animating: false }), (previewData.rows + 2) * 60 + 500)
  }

  const resetManual = () => {
    setManualLadder({ previewData: null, result: null, revealed: [], animating: false })
    broadcast('game:state', { id: 'ladder', status: 'idle', ladder: null })
  }

  // ── 자동 모드 state ──
  const [animating, setAnimating] = useState(false)
  useEffect(() => {
    if (isResult && ladderData) {
      setAnimating(true)
      const id = setTimeout(() => setAnimating(false), (ladderData.rows + 2) * 60 + 500)
      return () => clearTimeout(id)
    }
  }, [isResult, ladderData])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!isCollecting) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isCollecting])
  void tick

  const participants = ladderState?.participants ?? []
  const maxSlots     = ladderState?.maxSlots ?? (gSettings.maxParticipants as number ?? 8)
  const deadline     = ladderState?.deadline ?? 0
  const joinMs       = (ladderState as (LadderState & { joinMs?: number }) | undefined)?.joinMs ?? ((gSettings.joinDuration as number ?? 30) * 1000)
  const pct          = deadline
    ? Math.max(0, Math.min(100, ((deadline - Date.now()) / joinMs) * 100))
    : 0

  return (
    <div className={styles.ladderPanel}>
      {/* ── 모드 토글 ── */}
      <div className={styles.ladderModeRow}>
        <button
          className={`${styles.ladderModeBtn} ${!manualMode ? styles.ladderModeBtnActive : ''}`}
          onClick={() => setManualMode(false)}
        >자동</button>
        <button
          className={`${styles.ladderModeBtn} ${manualMode ? styles.ladderModeBtnActive : ''}`}
          onClick={() => setManualMode(true)}
        >수동</button>
      </div>

      {/* ══ 수동 모드 ══ */}
      {manualMode && (
        <div className={styles.ladderManual}>
          {/* 참가자 입력 */}
          <div className={styles.ladderManualSection}>
            <span className={styles.ladderManualLabel}>참가자</span>
            <div className={styles.ladderManualInputRow}>
              <input
                className={styles.ladderManualInput}
                placeholder="이름 입력 후 Enter"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addParticipant()}
              />
              <button className={styles.ladderManualAddBtn} onClick={addParticipant}>추가</button>
            </div>
            <div className={styles.ladderManualChips}>
              {manualParticipants.map((p, i) => (
                <span key={i} className={styles.ladderManualChip}
                  style={{ borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length], color: PLAYER_COLORS[i % PLAYER_COLORS.length], background: PLAYER_COLORS[i % PLAYER_COLORS.length] + '22' }}>
                  {p}
                  <button className={styles.ladderManualChipDel} onClick={() => removeParticipant(i)}>×</button>
                </span>
              ))}
              {manualParticipants.length === 0 && <span className={styles.ladderEmptyHint}>참가자를 추가하세요 (최소 2명)</span>}
            </div>
          </div>

          {/* 상품 목록 표시 */}
          <div className={styles.ladderManualSection}>
            <span className={styles.ladderManualLabel}>상품 ({prizes.length > 0 ? prizes.map(p => p.name).join(', ') : '없음'})</span>
          </div>

          {/* 버튼 */}
          <div className={styles.ladderManualActions}>
            <button
              className={styles.ladderManualShowBtn}
              disabled={manualParticipants.length < 2 || !!previewData}
              onClick={showOverlay}
            >오버레이 노출</button>
            <button className={styles.ladderManualResetBtn} onClick={resetManual}>초기화</button>
          </div>

          {/* 참가자별 공개 버튼 */}
          {previewData && (
            <div className={styles.ladderRevealSection}>
              <div className={styles.ladderRevealLabel}>참가자별 공개</div>
              <div className={styles.ladderRevealBtns}>
                {manualParticipants.map((p, i) => (
                  <button
                    key={i}
                    className={`${styles.ladderRevealBtn} ${revealedSet.has(i) ? styles.ladderRevealBtnDone : ''}`}
                    style={{ borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length], color: revealedSet.has(i) ? '#fff' : PLAYER_COLORS[i % PLAYER_COLORS.length], background: revealedSet.has(i) ? PLAYER_COLORS[i % PLAYER_COLORS.length] : PLAYER_COLORS[i % PLAYER_COLORS.length] + '18' }}
                    disabled={revealedSet.has(i)}
                    onClick={() => revealParticipant(i)}
                  >{p}</button>
                ))}
                <button
                  className={styles.ladderManualStartBtn}
                  style={{ flex: 'none', padding: '6px 12px' }}
                  disabled={revealedSet.size === manualParticipants.length}
                  onClick={revealAll}
                >전체 공개</button>
              </div>
            </div>
          )}

          {/* 수동 결과 */}
          {manualResult && (
            <div className={styles.ladderResult}>
              <div className={styles.ladderSvgWrap}>
                <LadderSVG data={manualResult} animate={manualAnimating} />
              </div>
              <div className={styles.ladderResultList}>
                {manualResult.results.map((r, i) => (
                  <div key={i} className={styles.ladderResultRow}
                    style={{ borderLeftColor: PLAYER_COLORS[r.startCol % PLAYER_COLORS.length] }}>
                    <span className={styles.ladderResultUser}
                      style={{ color: PLAYER_COLORS[r.startCol % PLAYER_COLORS.length] }}>{r.user}</span>
                    <span className={styles.ladderResultArrow}>→</span>
                    <span className={styles.ladderResultPrize}>{r.prize}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ 자동 모드 ══ */}
      {!manualMode && (<>
        {/* ── Collecting phase ── */}
        {isCollecting && (
          <div className={styles.ladderCollect}>
            <div className={styles.ladderCollectHeader}>
              <span className={styles.ladderCollectTitle}>참가자 모집 중</span>
              <span className={styles.ladderCollectCount}>{participants.length}/{maxSlots}명</span>
              <span className={styles.ladderCollectTime}>{Math.max(0, Math.ceil((deadline - Date.now()) / 1000))}초</span>
            </div>
            <div className={styles.ladderTimerBar}>
              <div className={styles.ladderTimerFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.ladderParticipants}>
              {participants.map((p, i) => (
                <span key={i} className={styles.ladderChip}
                  style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] + '33',
                           borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length] + '88',
                           color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>
                  {p}
                </span>
              ))}
              {participants.length === 0 && (
                <span className={styles.ladderEmptyHint}>채팅 명령어로 참가 대기 중...</span>
              )}
            </div>
          </div>
        )}

        {/* ── Result + SVG ── */}
        {isResult && ladderData && (
          <div className={styles.ladderResult}>
            <div className={styles.ladderSvgWrap}>
              <LadderSVG data={ladderData} animate={animating} />
            </div>
            <div className={styles.ladderResultList}>
              {ladderData.results.map((r, i) => (
                <div key={i} className={styles.ladderResultRow}
                  style={{ borderLeftColor: PLAYER_COLORS[r.startCol % PLAYER_COLORS.length] }}>
                  <span className={styles.ladderResultUser}
                    style={{ color: PLAYER_COLORS[r.startCol % PLAYER_COLORS.length] }}>
                    {r.user}
                  </span>
                  <span className={styles.ladderResultArrow}>→</span>
                  <span className={styles.ladderResultPrize}>{r.prize}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Idle hint ── */}
        {!isCollecting && !isResult && (
          <div className={styles.ladderIdle}>
            <div className={styles.ladderIdleIcon} />
            <div>
              <div className={styles.ladderIdleText}>사다리타기 대기 중</div>
              <div className={styles.ladderIdleHint}>
                아래 ▶ 실행 버튼으로 참가자 모집을 시작하거나,<br/>
                별풍선 / 채팅 트리거로 자동 시작됩니다.<br/>
                등록된 상품: {prizes.length > 0 ? prizes.map(p => p.name).join(', ') : '없음'}
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}

// ── Quiz panel ────────────────────────────────────────────────────────────────

type QuizMode = 'manual' | 'list'

interface QuizStateData {
  question: string; answer: string; deadline: number; winner: string | null
}

export function QuizPanel({
  gSettings, gameStates, saveSetting,
}: {
  gSettings:  Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting: (key: string, value: unknown) => void
}) {
  const [mode, setMode]       = useState<QuizMode>('manual')
  const [manualQ, setManualQ] = useState('')
  const [manualA, setManualA] = useState('')
  const [manualSec, setManualSec] = useState(30)
  const [timeLeft, setTimeLeft]   = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const el = (window as unknown as Record<string, unknown>).electron as
    Record<string, (...args: unknown[]) => unknown>

  const quizGameState = gameStates['quiz']
  const isRunning     = quizGameState?.status === 'collecting'
  const isResult      = quizGameState?.status === 'showing_result'
  const quizData      = quizGameState?.quiz as QuizStateData | undefined
  const resultData    = quizGameState?.result as { result: string; detail: string } | undefined

  const questions     = (gSettings.questions as Array<{ question: string; answer: string }>) ?? []


  // Countdown ticker
  useEffect(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (isRunning && quizData?.deadline) {
      const update = () => {
        const left = Math.max(0, Math.ceil((quizData.deadline - Date.now()) / 1000))
        setTimeLeft(left)
        if (left === 0 && tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
      }
      update()
      tickRef.current = setInterval(update, 500)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [isRunning, quizData?.deadline])

  const startManual = async (q: string, a: string, sec: number) => {
    if (!q.trim() || !a.trim()) return
    await (el.quizStartManual as (o: { question: string; answer: string; timeLimit: number }) => Promise<unknown>)(
      { question: q.trim(), answer: a.trim(), timeLimit: sec }
    )
  }

  const pct = quizData
    ? Math.max(0, Math.min(100, (timeLeft / Math.max(1, Math.ceil((quizData.deadline - Date.now() + timeLeft * 1000) / 1000))) * 100))
    : 0
  const timerColor = timeLeft > 10 ? '#10B981' : '#EF4444'

  return (
    <div className={styles.qpPanel}>

      {/* ── Live status ── */}
      {(isRunning || isResult) && (
        <div className={`${styles.qpStatus} ${isResult ? styles.qpStatusResult : ''}`}>
          {isRunning && quizData && (<>
            <div className={styles.qpStatusLabel}>진행 중</div>
            <div className={styles.qpStatusQ}>{quizData.question}</div>
            <div className={styles.qpTimerRow}>
              <div className={styles.qpTimerBar}>
                <div className={styles.qpTimerFill} style={{ width: `${pct}%`, background: timerColor }} />
              </div>
              <span className={styles.qpTimerNum} style={{ color: timerColor }}>{timeLeft}초</span>
            </div>
            <div className={styles.qpAnswerHint}>정답: <strong>{quizData.answer}</strong></div>
          </>)}
          {isResult && resultData && (<>
            <div className={styles.qpStatusLabel}>결과</div>
            <div className={`${styles.qpStatusQ} ${resultData.result.includes('시간 초과') ? styles.qpTimeout : styles.qpWin}`}>
              {resultData.result}
            </div>
            <div className={styles.qpAnswerHint}>{resultData.detail}</div>
          </>)}
        </div>
      )}

      {/* ── Mode tabs ── */}
      <div className={styles.qpTabs}>
        {(['manual','list'] as QuizMode[]).map(m => (
          <button
            key={m}
            className={`${styles.qpTab} ${mode === m ? styles.qpTabActive : ''}`}
            onClick={() => setMode(m)}
          >
            {{ manual:'수동 출제', list:'문항 목록' }[m]}
          </button>
        ))}
      </div>

      {/* ── Tab: 수동 출제 ── */}
      {mode === 'manual' && (
        <div className={styles.qpTabContent}>
          <div className={styles.qpField}>
            <label>문제</label>
            <textarea
              className={styles.qpTextarea}
              rows={2}
              placeholder="문제를 입력하세요"
              value={manualQ}
              onChange={e => setManualQ(e.target.value)}
            />
          </div>
          <div className={styles.qpField}>
            <label>정답</label>
            <input
              className={styles.qpInput}
              placeholder="정답을 입력하세요 (대소문자 무시)"
              value={manualA}
              onChange={e => setManualA(e.target.value)}
            />
          </div>
          <div className={styles.qpField}>
            <label>제한 시간</label>
            <div className={styles.qpRow}>
              <NumberField
                className={styles.qpInput}
                min={5} max={600} style={{ width: 80 }}
                value={manualSec}
                onCommit={setManualSec}
              />
              <span className={styles.qpUnit}>초</span>
            </div>
          </div>
          <button
            className={styles.qpStartBtn}
            disabled={isRunning || !manualQ.trim() || !manualA.trim()}
            onClick={() => startManual(manualQ, manualA, manualSec)}
          >
            {isRunning ? '퀴즈 진행 중...' : '출제하기'}
          </button>
        </div>
      )}

      {/* ── Tab: 문항 목록 ── */}
      {mode === 'list' && (
        <div className={styles.qpTabContent}>
          {questions.length === 0 ? (
            <div className={styles.qpEmpty}>
              등록된 문항이 없습니다.<br/>
              <span>아래 문항 목록에서 먼저 추가하세요.</span>
            </div>
          ) : (
            <div className={styles.qpQList}>
              {questions.map((q, i) => (
                <div key={i} className={styles.qpQRow}>
                  <div className={styles.qpQContent}>
                    <span className={styles.qpQNum}>{i + 1}</span>
                    <div className={styles.qpQTexts}>
                      <div className={styles.qpQQ}>{q.question}</div>
                      <div className={styles.qpQA}>정답: {q.answer}</div>
                    </div>
                  </div>
                  <button
                    className={styles.qpPickBtn}
                    disabled={isRunning}
                    onClick={() => startManual(q.question, q.answer, (gSettings.timeLimit as number) ?? 30)}
                  >
                    출제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

// ── Slot Panel ────────────────────────────────────────────────────────────────

interface SlotSpinState { symbols: string[]; jackpot: boolean; twoKind: boolean; triggeredBy: string }

// 슬롯 기본 캐릭터 심볼 — 이름이 곧 심볼 문자열 (오버레이도 같은 이름으로 그림을 찾는다)
const SLOT_CHAR_FILES: Record<string, string> = { '나노': 'nano', '루첼': 'ruchel', '설홍': 'seolhong', '여우연': 'yeouyeon', '최애리': 'choiaeri', '눈요': 'nunyo' }
const slotCharPngs = import.meta.glob('../../assets/slot/*.png', { eager: true, import: 'default' }) as Record<string, string>
const slotCharUrl = (s: string) => SLOT_CHAR_FILES[s] ? slotCharPngs[`../../assets/slot/${SLOT_CHAR_FILES[s]}.png`] : undefined

export function SlotPanel({
  gSettings, gameStates, saveSetting,
}: {
  gSettings: Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting: (key: string, value: unknown) => void
}) {
  const state  = gameStates['slot']
  const status = (state?.status as string) ?? 'idle'
  const spin   = state?.slot as SlotSpinState | undefined

  const defaultSymbols = Object.keys(SLOT_CHAR_FILES)
  const [symbols, setSymbols] = useState<string[]>(
    (gSettings.symbols as string[]) ?? defaultSymbols
  )
  const [newSym, setNewSym]   = useState('')

  useEffect(() => {
    setSymbols((gSettings.symbols as string[]) ?? defaultSymbols)
  }, [gSettings.symbols])

  const removeSym = (i: number) => {
    if (symbols.length <= 3) return
    const next = symbols.filter((_, idx) => idx !== i)
    setSymbols(next); saveSetting('symbols', next)
  }
  const addSym = () => {
    const s = newSym.trim()
    if (!s || symbols.includes(s)) return
    const next = [...symbols, s]
    setSymbols(next); saveSetting('symbols', next)
    setNewSym('')
  }

  const isRunning = status === 'running'
  const isResult  = status === 'showing_result'

  const isUrl = (s: string) => s.startsWith('http') || s.startsWith('data:')

  const renderSymbol = (s: string, cls?: string) => {
    const src = slotCharUrl(s) ?? (isUrl(s) ? s : undefined)
    return src
      ? <img src={src} alt={s} title={s} className={cls ?? styles.slSymbolImg} />
      : <span>{s}</span>
  }

  return (
    <div className={styles.slPanel}>
      {/* 현재 상태 카드 */}
      {(isRunning || isResult) && spin && (
        <div className={`${styles.slResultCard} ${spin.jackpot ? styles.slJackpot : spin.twoKind ? styles.slTwoKind : ''}`}>
          <div className={styles.slReels}>
            {spin.symbols.map((sym, i) => (
              <div key={i} className={`${styles.slReel} ${isRunning ? styles.slSpinning : ''}`}>
                {renderSymbol(sym)}
              </div>
            ))}
          </div>
          <div className={styles.slResultLabel}>
            {isRunning ? '돌아가는 중...' :
             spin.jackpot  ? 'JACKPOT!' :
             spin.twoKind  ? '2개 일치!' : '꽝'}
          </div>
          {isResult && (
            <div className={styles.slTriggeredBy}>{spin.triggeredBy}님의 결과</div>
          )}
        </div>
      )}

      {!isRunning && !isResult && (
        <div className={styles.slIdle}>
          <div className={styles.slIdleReels}>
            {(symbols.slice(0,3)).map((s, i) => (
              <div key={i} className={styles.slReel}>{renderSymbol(s)}</div>
            ))}
          </div>
          <p className={styles.slIdleHint}>별풍선 후원으로 실행됩니다</p>
        </div>
      )}

      {/* 심볼 설정 */}
      <div className={styles.slSymbolSection}>
        <div className={styles.slSymbolTitle}>심볼 설정 <span className={styles.slSymbolCount}>({symbols.length}개)</span></div>
        <div className={styles.slSymbolGrid}>
          {symbols.map((s, i) => (
            <div key={i} className={styles.slSymbolItem}>
              <span className={styles.slSymbolEmoji}>{renderSymbol(s)}</span>
              <button
                className={styles.slSymbolRemove}
                onClick={() => removeSym(i)}
                disabled={symbols.length <= 3}
              >×</button>
            </div>
          ))}
        </div>
        <div className={styles.slAddRow}>
          <input
            className={styles.slAddInput}
            value={newSym}
            onChange={e => setNewSym(e.target.value)}
            placeholder="이모지·캐릭터 이름 또는 이미지 URL (http://...)"
            onKeyDown={e => e.key === 'Enter' && addSym()}
          />
          <button className={styles.slAddBtn} onClick={addSym}>추가</button>
          <button className="btn btn-sm" title="나노·루첼·설홍·여우연·최애리·눈요"
            onClick={() => { setSymbols(defaultSymbols); saveSetting('symbols', defaultSymbols) }}>기본 캐릭터로</button>
        </div>
        <p className={styles.slSymbolHint}>최소 3개 필요 · 이모지 또는 이미지 URL 지원</p>
      </div>

      {/* 스핀 시간 */}
      <div className={styles.slSpinRow}>
        <label className={styles.slSpinLabel}>스핀 시간</label>
        <NumberField
          className={styles.slSpinInput}
          value={(gSettings.spinDuration as number) ?? 3000}
          min={2000} max={8000} step={500}
          onCommit={v => saveSetting('spinDuration', v)}
        />
        <span className={styles.slSpinUnit}>ms</span>
      </div>
    </div>
  )
}

// ── Number Panel ─────────────────────────────────────────────────────────────

interface NumberPickState { min: number; max: number; count: number; result: number[]; triggeredBy: string; spinMs: number }

export function NumberPanel({
  gSettings, gameStates, saveSetting,
}: {
  gSettings: Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting: (key: string, value: unknown) => void
}) {
  const state   = gameStates['number']
  const running = state?.status === 'running'
  const numData = state?.number as NumberPickState | undefined

  const minNumber    = (gSettings.minNumber    as number)   ?? 1
  const maxNumber    = (gSettings.maxNumber    as number)   ?? 100
  const count        = (gSettings.count        as number)   ?? 1
  const spinDuration = (gSettings.spinDuration as number)   ?? 3000
  const excludeList  = (gSettings.excludeList  as number[]) ?? []
  const [excludeInput, setExcludeInput] = useState('')

  function addExclude() {
    const n = parseInt(excludeInput.trim(), 10)
    if (isNaN(n) || excludeList.includes(n)) { setExcludeInput(''); return }
    saveSetting('excludeList', [...excludeList, n].sort((a, b) => a - b))
    setExcludeInput('')
  }

  const rangeSize = Math.max(0, maxNumber - minNumber + 1 - excludeList.length)

  return (
    <div className={styles.listEditor}>

      {/* ── 추첨 설정 ── */}
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>추첨 설정</span>
        <span className={styles.totalBadge} style={{ background: rangeSize < count ? 'rgba(239,68,68,0.15)' : undefined, color: rangeSize < count ? '#EF4444' : undefined }}>
          풀 {rangeSize}개
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 0 4px' }}>
        <div>
          <div className={styles.nbLabel} style={{ marginBottom: 6 }}>추첨 범위</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NumberField className={styles.nbInput} style={{ width: 72, flex: 1 }} min={-1000000} max={1000000}
              value={minNumber} onCommit={v => saveSetting('minNumber', v)} />
            <span className={styles.nbSep}>~</span>
            <NumberField className={styles.nbInput} style={{ width: 72, flex: 1 }} min={-1000000} max={1000000}
              value={maxNumber} onCommit={v => saveSetting('maxNumber', v)} />
          </div>
        </div>
        <div>
          <div className={styles.nbLabel} style={{ marginBottom: 6 }}>추첨 개수</div>
          <NumberField min={1} max={100} className={styles.nbInput} style={{ width: '100%' }}
            value={count} onCommit={v => saveSetting('count', v)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div className={styles.nbLabel} style={{ marginBottom: 6 }}>애니메이션 시간 (ms)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1000} max={8000} step={500} style={{ flex: 1 }}
              value={spinDuration} onChange={e => saveSetting('spinDuration', Number(e.target.value))} />
            <span className={styles.nbInput} style={{ width: 72, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {spinDuration}
            </span>
          </div>
        </div>
      </div>

      {/* ── 제외 번호 ── */}
      <div className={styles.listHeader} style={{ marginTop: 8 }}>
        <span className={styles.listTitle}>제외 번호</span>
        {excludeList.length > 0 && (
          <button className={styles.nbClearBtn} onClick={() => saveSetting('excludeList', [])}>전체 삭제</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input type="number" className={styles.nbInput} placeholder="제외할 번호 입력" style={{ flex: 1 }}
          value={excludeInput} onChange={e => setExcludeInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addExclude()} />
        <button className={styles.nbAddBtn} onClick={addExclude}>추가</button>
      </div>
      <div className={styles.nbChips}>
        {excludeList.map(n => (
          <span key={n} className={styles.nbChip}>
            {n}
            <button className={styles.nbChipRemove} onClick={() => saveSetting('excludeList', excludeList.filter(x => x !== n))}>×</button>
          </span>
        ))}
        {excludeList.length === 0 && <span className={styles.nbEmpty}>제외 번호 없음</span>}
      </div>

      {/* ── 추첨 결과 ── */}
      {(running || numData) && (
        <div className={styles.nbResult}>
          <div className={styles.nbResultLabel}>{running ? '추첨 중...' : `추첨 결과 · ${numData?.triggeredBy ?? ''}님`}</div>
          <div className={styles.nbNumbers}>
            {running
              ? <div className={styles.nbNumberRolling}>?</div>
              : numData?.result.map((n, i) => <div key={i} className={styles.nbNumber}>{n}</div>)
            }
          </div>
          {!running && numData && (
            <div className={styles.nbResultMeta}>
              {numData.min} ~ {numData.max} 범위 / {numData.count}개 추첨
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  )
}
