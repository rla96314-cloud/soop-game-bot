import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Games.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouletteItem { name: string; probability: number }
interface GachaGrade   { name: string; probability: number; color: string }
interface QuizQuestion { question: string; answer: string }
interface Prize        { name: string; description: string }
interface PickItem     { name: string; description: string; color: string; count: number }
interface BossLootItem { name: string; description: string }

interface BossParticipant { totalDamage: number; attackCount: number; critCount: number; pendingBalloons: number }
interface BossRollResult  { user: string; roll: number; damage: number; isCritical: boolean; ts: number }
interface BossLootResult  { user: string; item: BossLootItem; contributionRate: number }
interface BossStateData   {
  alive: boolean; maxHp: number; currentHp: number
  bossName: string; damagePerDot: number; critChance: number; critEnabled: boolean; critMultiplier: number
  balloonThreshold: number; participants: Record<string, BossParticipant>
  lastRoll?: BossRollResult; lootResults?: BossLootResult[]
}

interface LadderRung { row: number; leftCol: number }
interface LadderPath { cols: number[] }
interface LadderData {
  rows: number; cols: number
  rungs: LadderRung[]; paths: LadderPath[]
  order: string[]; prizes: string[]
  results: Array<{ user: string; prize: string; startCol: number; endCol: number }>
}
interface LadderState {
  participants: string[]; maxSlots: number; deadline: number
  prizes: string[]; ladderData?: LadderData
}

// ── Game list ─────────────────────────────────────────────────────────────────

const GAMES = [
  { id: 'roulette',  name: '룰렛',     color: '#8B5CF6', settingKey: 'roulette'  },
  { id: 'ladder',    name: '사다리타기', color: '#3B82F6', settingKey: 'ladder'    },
  { id: 'pickboard', name: '뽑기판',    color: '#EC4899', settingKey: 'pickboard' },
  { id: 'quiz',      name: '퀴즈',     color: '#10B981', settingKey: 'quiz'      },
  { id: 'slot',      name: '슬롯머신',  color: '#8B5CF6', settingKey: 'slot'      },
  { id: 'race',      name: '경주',     color: '#6366F1', settingKey: 'race'      },
  { id: 'rps',       name: '가위바위보', color: '#EC4899', settingKey: 'rps'       },
  { id: 'fish',      name: '낚시',     color: '#14B8A6', settingKey: 'fish'      },
  { id: 'lottery',   name: '복권',     color: '#F97316', settingKey: 'lottery'   },
  { id: 'number',    name: '숫자 추첨', color: '#06B6D4', settingKey: 'number'    },
]

const OVERLAY_PORT = 3939  // used for OBS URL copy

// ── OBS URL copy button ───────────────────────────────────────────────────────

function ObsUrlBtn({ gameId, port }: { gameId: string; port: number }) {
  const [copied, setCopied] = useState(false)
  const url = `http://localhost:${port}/overlay/${gameId}`
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      className={`${styles.obsUrlBtn} ${copied ? styles.obsUrlBtnCopied : ''}`}
      onClick={copy}
      title={url}
    >
      {copied ? '복사됨' : 'OBS URL'}
    </button>
  )
}

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

// ── Roulette panel ────────────────────────────────────────────────────────────

interface RouletteSpinState {
  winner: string; winnerIdx: number
  items: Array<{ name: string; probability: number }>
  spinMs: number; animType: 'wheel' | 'text'
}



function RouletteWheelPreview({ items }: { items: Array<{ name: string; probability: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const COLORS = ['#8B5CF6','#EC4899','#3B82F6','#10B981','#F59E0B','#EF4444','#14B8A6','#6366F1']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !items.length) return
    const ctx = canvas.getContext('2d')!
    const cx = 80, cy = 80, r = 74
    const total = items.reduce((s, i) => s + i.probability, 0)
    let start = -Math.PI / 2
    ctx.clearRect(0, 0, 160, 160)
    items.forEach((item, i) => {
      const sweep = (item.probability / total) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, start + sweep); ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke()
      const mid = start + sweep / 2
      ctx.save(); ctx.translate(cx + Math.cos(mid) * r * 0.65, cy + Math.sin(mid) * r * 0.65)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'
      const label = item.name.length > 5 ? item.name.slice(0,4)+'…' : item.name
      ctx.fillText(label, 0, 0); ctx.restore()
      start += sweep
    })
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2)
    ctx.fillStyle = '#0a0623'; ctx.fill()
  }, [items])

  return <canvas ref={canvasRef} width={160} height={160} className={styles.rwPreviewCanvas} />
}

function RoulettePanel({ gSettings, gameStates, saveSetting }: {
  gSettings:  Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting:(key: string, value: unknown) => void
}) {
  const animType  = (gSettings.animType as 'wheel' | 'text') ?? 'wheel'
  const items     = (gSettings.items as Array<{ name: string; probability: number }>) ?? []
  const spinState = (gameStates['roulette']?.roulette) as RouletteSpinState | undefined
  const status    = gameStates['roulette']?.status as string ?? 'idle'
  const isSpinning= status === 'running'
  const isResult  = status === 'showing_result'

  return (
    <div className={styles.rwPanel}>

      {/* ── Live status ── */}
      {(isSpinning || isResult) && (
        <div className={`${styles.rwStatus} ${isResult ? styles.rwStatusResult : ''}`}>
          {isSpinning && spinState && (
            <>
              <div className={styles.rwStatusLabel}>돌아가는 중...</div>
              <div className={styles.rwStatusWinner}>
                결과: <strong>{spinState.winner}</strong>
              </div>
            </>
          )}
          {isResult && (
            <div className={styles.rwStatusLabel}>
              결과: <strong>{(gameStates['roulette']?.result as { result: string } | null)?.result}</strong>
            </div>
          )}
        </div>
      )}

      {/* ── Animation type ── */}
      <div className={styles.rwSection}>
        <div className={styles.rwSectionTitle}>애니메이션 타입</div>
        <div className={styles.rwAnimRow}>
          {(['wheel','text'] as const).map(t => (
            <button key={t}
              className={`${styles.rwAnimBtn} ${animType === t ? styles.rwAnimBtnActive : ''}`}
              onClick={() => saveSetting('animType', t)}
            >
              {t === 'wheel' ? '원형 룰렛' : '텍스트 슬롯'}
            </button>
          ))}
        </div>

        {/* Wheel preview */}
        {animType === 'wheel' && items.length > 0 && (
          <div className={styles.rwPreviewWrap}>
            <div className={styles.rwPreviewPointer}>▼</div>
            <RouletteWheelPreview items={items} />
          </div>
        )}

        {/* Text slot preview */}
        {animType === 'text' && items.length > 0 && (
          <div className={styles.rwTextPreview}>
            {items.slice(0, 4).map((item, i) => (
              <div key={i} className={styles.rwTextItem}>{item.name}</div>
            ))}
            {items.length > 4 && <div className={styles.rwTextMore}>+{items.length - 4}개</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PickBoard editor ──────────────────────────────────────────────────────────

function PickBoardEditor({
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
          <input className={styles.pbSizeInput} type="number" min={1} max={10}
            value={rows}
            onChange={e => { const v = Number(e.target.value); setRows(v); onSaveSize(v, cols) }}
          />
          <span>×</span>
          <input className={styles.pbSizeInput} type="number" min={1} max={10}
            value={cols}
            onChange={e => { const v = Number(e.target.value); setCols(v); onSaveSize(rows, v) }}
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
          <input
            type="number" min={0} style={{ width: 50 }}
            className={styles.listInput}
            value={item.count}
            onChange={e => {
              const next = items.map((x, j) => j === i ? { ...x, count: Number(e.target.value) } : x)
              save(next)
            }}
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

interface Cell { prize: PickItem; revealed: boolean }

function buildCells(rows: number, cols: number, items: PickItem[]): Cell[] {
  const total = rows * cols
  const prizes: PickItem[] = []
  for (const item of items) {
    for (let k = 0; k < item.count && prizes.length < total; k++) prizes.push(item)
  }
  while (prizes.length < total) {
    prizes.push({ name: '꽝', description: '', color: '#6B7280', count: 1 })
  }
  // Fisher-Yates shuffle
  for (let i = prizes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[prizes[i], prizes[j]] = [prizes[j], prizes[i]]
  }
  return prizes.slice(0, total).map(prize => ({ prize, revealed: false }))
}

function PickBoardPanel({ rows, cols, items }: { rows: number; cols: number; items: PickItem[] }) {
  const [cells, setCells] = useState<Cell[]>(() => buildCells(rows, cols, items))
  const [lastResult, setLastResult] = useState<PickItem | null>(null)
  const el = (window as unknown as Record<string, Record<string, unknown>>).electron

  const broadcastState = (nextCells: Cell[], r: number, c: number) => {
    if (el?.overlayBroadcast) {
      (el.overlayBroadcast as (type: string, data: unknown) => void)(
        'pickboard:state',
        { cells: nextCells.map(cell => ({ revealed: cell.revealed, name: cell.prize.name, description: cell.prize.description, color: cell.prize.color })), rows: r, cols: c }
      )
    }
  }

  // Rebuild when size/items change
  useEffect(() => {
    const next = buildCells(rows, cols, items)
    setCells(next)
    setLastResult(null)
    broadcastState(next, rows, cols)
  }, [rows, cols, JSON.stringify(items)])

  const reveal = (idx: number) => {
    if (cells[idx].revealed) return
    const next = cells.map((c, i) => i === idx ? { ...c, revealed: true } : c)
    setCells(next)
    setLastResult(cells[idx].prize)
    broadcastState(next, rows, cols)
  }

  const reset = () => {
    const next = buildCells(rows, cols, items)
    setCells(next)
    setLastResult(null)
    broadcastState(next, rows, cols)
  }

  const revealedCount = cells.filter(c => c.revealed).length

  return (
    <div className={styles.pbPanel}>
      <div className={styles.pbHeader}>
        <span className={styles.pbTitle}>뽑기판</span>
        <span className={styles.pbCount}>{revealedCount}/{rows * cols} 오픈</span>
        <button className={styles.pbResetBtn} onClick={() => broadcastState(cells, rows, cols)}>오버레이 노출</button>
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

const PLAYER_COLORS = [
  '#8B5CF6','#EC4899','#3B82F6','#10B981',
  '#F59E0B','#EF4444','#14B8A6','#6366F1',
]

function LadderSVG({ data, animate }: { data: LadderData; animate: boolean }) {
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
function buildLadderData(participants: string[], prizes: Prize[]): LadderData {
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

  const prizeNames = prizes.map(p => p.name)
  while (prizeNames.length < cols) prizeNames.push(`${prizeNames.length + 1}등`)
  const prizeOrder = [...prizeNames].sort(() => Math.random() - 0.5).slice(0, cols)

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
    return { user, prize: prizeOrder[endCol] ?? `${endCol + 1}등`, startCol: i, endCol }
  })

  return { rows, cols, rungs, paths, order: participants, prizes: prizeOrder, results }
}

function LadderPanel({ gSettings, gameStates }: {
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

  // ── 수동 모드 state ──
  const [manualMode, setManualMode]           = useState(false)
  const [manualInput, setManualInput]         = useState('')
  const [manualParticipants, setManualParticipants] = useState<string[]>([])
  const [previewData, setPreviewData]         = useState<LadderData | null>(null)
  const [manualResult, setManualResult]       = useState<LadderData | null>(null)
  const [manualAnimating, setManualAnimating] = useState(false)

  const broadcast = (type: string, data: unknown) => {
    if (el?.overlayBroadcast)
      (el.overlayBroadcast as (t: string, d: unknown) => void)(type, data)
  }

  const addParticipant = () => {
    const name = manualInput.trim()
    if (!name || manualParticipants.includes(name)) return
    setManualParticipants(prev => [...prev, name])
    setManualInput('')
    setPreviewData(null); setManualResult(null)
  }

  const removeParticipant = (i: number) => {
    setManualParticipants(prev => prev.filter((_, idx) => idx !== i))
    setPreviewData(null); setManualResult(null)
  }

  const showOverlay = () => {
    if (manualParticipants.length < 2) return
    const data = buildLadderData(manualParticipants, prizes)
    setPreviewData(data); setManualResult(null)
    broadcast('game:state', { id: 'ladder', status: 'manual_preview', ladder: { ladderData: data } })
  }

  const startLadder = () => {
    if (!previewData) return
    setManualResult(previewData); setManualAnimating(true)
    broadcast('game:state', { id: 'ladder', status: 'manual_running', ladder: { ladderData: previewData } })
    setTimeout(() => setManualAnimating(false), (previewData.rows + 2) * 60 + 500)
  }

  const resetManual = () => {
    setPreviewData(null); setManualResult(null)
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
  const pct          = deadline
    ? Math.max(0, Math.min(100, ((deadline - Date.now()) / ((gSettings.joinDuration as number ?? 30) * 1000)) * 100))
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
            <button
              className={styles.ladderManualStartBtn}
              disabled={!previewData || !!manualResult}
              onClick={startLadder}
            >사다리 타기</button>
            <button className={styles.ladderManualResetBtn} onClick={resetManual}>초기화</button>
          </div>

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
                상단 ▶ 수동 실행으로 참가자 모집을 시작하거나,<br/>
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

function QuizPanel({
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
              <input
                className={styles.qpInput}
                type="number" min={5} max={300} style={{ width: 80 }}
                value={manualSec}
                onChange={e => setManualSec(Number(e.target.value))}
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

function SlotPanel({
  gSettings, gameStates, saveSetting,
}: {
  gSettings: Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting: (key: string, value: unknown) => void
}) {
  const state  = gameStates['slot']
  const status = (state?.status as string) ?? 'idle'
  const spin   = state?.slot as SlotSpinState | undefined

  const defaultSymbols = ['🍒', '🍋', '🍊', '⭐', '🎰', '💎', '7️⃣', '🔔']
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

  const renderSymbol = (s: string, cls?: string) =>
    isUrl(s)
      ? <img src={s} alt="심볼" className={cls ?? styles.slSymbolImg} />
      : <span>{s}</span>

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
              <span className={styles.slSymbolEmoji}>
                {isUrl(s)
                  ? <img src={s} alt="심볼" className={styles.slSymbolImg} />
                  : s}
              </span>
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
            placeholder="이모지 또는 이미지 URL (http://...)"
            onKeyDown={e => e.key === 'Enter' && addSym()}
          />
          <button className={styles.slAddBtn} onClick={addSym}>추가</button>
        </div>
        <p className={styles.slSymbolHint}>최소 3개 필요 · 이모지 또는 이미지 URL 지원</p>
      </div>

      {/* 스핀 시간 */}
      <div className={styles.slSpinRow}>
        <label className={styles.slSpinLabel}>스핀 시간</label>
        <input
          type="number" className={styles.slSpinInput}
          value={(gSettings.spinDuration as number) ?? 3000}
          min={2000} max={6000} step={500}
          onChange={e => saveSetting('spinDuration', Number(e.target.value))}
        />
        <span className={styles.slSpinUnit}>ms</span>
      </div>
    </div>
  )
}

// ── Number Panel ─────────────────────────────────────────────────────────────

interface NumberPickState { min: number; max: number; count: number; result: number[]; triggeredBy: string; spinMs: number }

function NumberPanel({
  gSettings, gameStates, saveSetting,
}: {
  gSettings: Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting: (key: string, value: unknown) => void
}) {
  const state   = gameStates['number']
  const running = state?.status === 'running'
  const numData = state?.number as NumberPickState | undefined

  const minNumber   = (gSettings.minNumber   as number)   ?? 1
  const maxNumber   = (gSettings.maxNumber   as number)   ?? 100
  const count       = (gSettings.count       as number)   ?? 1
  const spinDuration= (gSettings.spinDuration as number)  ?? 3000
  const excludeList = (gSettings.excludeList  as number[]) ?? []

  const [excludeInput, setExcludeInput] = useState('')

  function addExclude() {
    const n = parseInt(excludeInput.trim(), 10)
    if (isNaN(n)) return
    if (excludeList.includes(n)) { setExcludeInput(''); return }
    saveSetting('excludeList', [...excludeList, n].sort((a,b) => a - b))
    setExcludeInput('')
  }
  function removeExclude(n: number) {
    saveSetting('excludeList', excludeList.filter(x => x !== n))
  }
  function clearExclude() {
    saveSetting('excludeList', [])
  }

  return (
    <div className={styles.nbWrap}>
      {/* Settings */}
      <div className={styles.nbSettings}>
        <div className={styles.nbRow}>
          <span className={styles.nbLabel}>범위</span>
          <input type="number" className={styles.nbInput} value={minNumber}
            onChange={e => saveSetting('minNumber', Number(e.target.value))} style={{ width: 80 }} />
          <span className={styles.nbSep}>~</span>
          <input type="number" className={styles.nbInput} value={maxNumber}
            onChange={e => saveSetting('maxNumber', Number(e.target.value))} style={{ width: 80 }} />
        </div>
        <div className={styles.nbRow}>
          <span className={styles.nbLabel}>추첨 개수</span>
          <input type="number" min={1} className={styles.nbInput} value={count}
            onChange={e => saveSetting('count', Number(e.target.value))} style={{ width: 80 }} />
          <span className={styles.nbLabel} style={{ marginLeft: 24 }}>애니메이션(ms)</span>
          <input type="number" step={500} className={styles.nbInput} value={spinDuration}
            onChange={e => saveSetting('spinDuration', Number(e.target.value))} style={{ width: 90 }} />
        </div>
      </div>

      {/* Exclude list */}
      <div className={styles.nbExclude}>
        <div className={styles.nbExcludeHeader}>
          <span className={styles.nbLabel}>제외 번호</span>
          {excludeList.length > 0 && (
            <button className={styles.nbClearBtn} onClick={clearExclude}>전체 삭제</button>
          )}
        </div>
        <div className={styles.nbExcludeAdd}>
          <input type="number" className={styles.nbInput} placeholder="제외할 번호"
            value={excludeInput} onChange={e => setExcludeInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExclude()} style={{ width: 120 }} />
          <button className={styles.nbAddBtn} onClick={addExclude}>추가</button>
        </div>
        <div className={styles.nbChips}>
          {excludeList.map(n => (
            <span key={n} className={styles.nbChip}>
              {n}
              <button className={styles.nbChipRemove} onClick={() => removeExclude(n)}>×</button>
            </span>
          ))}
          {excludeList.length === 0 && <span className={styles.nbEmpty}>제외 번호 없음</span>}
        </div>
      </div>

      {/* Result */}
      {(running || numData) && (
        <div className={styles.nbResult}>
          <div className={styles.nbResultLabel}>{running ? '추첨 중...' : '추첨 결과'}</div>
          <div className={styles.nbNumbers}>
            {running
              ? <div className={styles.nbNumberRolling}>?</div>
              : numData?.result.map((n, i) => (
                  <div key={i} className={styles.nbNumber}>{n}</div>
                ))
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

// ── Boss Panel ────────────────────────────────────────────────────────────────

function BossLootEditor({
  items, onSave,
}: { items: BossLootItem[]; onSave: (v: BossLootItem[]) => void }) {
  const [list, setList] = useState<BossLootItem[]>(items)

  const update = (i: number, field: keyof BossLootItem, val: string) => {
    const next = list.map((x, idx) => idx === i ? { ...x, [field]: val } : x)
    setList(next); onSave(next)
  }
  const add    = () => { const n = [...list, { name: '상품', description: '' }]; setList(n); onSave(n) }
  const remove = (i: number) => { const n = list.filter((_, idx) => idx !== i); setList(n); onSave(n) }

  return (
    <div className={styles.brLootEditor}>
      <div className={styles.brLootHeader}>
        <span className={styles.brLootTitle}>전리품 목록</span>
        <button className={styles.brAddBtn} onClick={add}>+ 추가</button>
      </div>
      {list.map((item, i) => (
        <div key={i} className={styles.brLootRow}>
          <span className={styles.brLootNum}>{i + 1}</span>
          <input
            className={styles.brInput}
            value={item.name}
            onChange={e => update(i, 'name', e.target.value)}
            placeholder="상품명"
            style={{ flex: 1 }}
          />
          <input
            className={styles.brInput}
            value={item.description}
            onChange={e => update(i, 'description', e.target.value)}
            placeholder="설명"
            style={{ flex: 1.5 }}
          />
          <button className={styles.brRemoveBtn} onClick={() => remove(i)}>×</button>
        </div>
      ))}
      {list.length === 0 && <p className={styles.brEmpty}>전리품을 추가하세요.</p>}
    </div>
  )
}

function BossPanel({
  gSettings, gameStates, saveSetting,
}: {
  gSettings: Record<string, unknown>
  gameStates: Record<string, { status: string; [k: string]: unknown }>
  saveSetting: (key: string, value: unknown) => void
}) {
  const el    = (window as unknown as Record<string, Record<string, unknown>>).electron
  const state = gameStates['boss']
  const boss  = state?.boss as BossStateData | undefined
  const status = (state?.status as string) ?? 'idle'

  // Settings form state (used in idle mode)
  const [bossName,    setBossName]    = useState((gSettings.bossName        as string)  ?? '보스')
  const [maxHp,       setMaxHp]       = useState((gSettings.maxHp           as number)  ?? 100000)
  const [dmgPerDot,   setDmgPerDot]   = useState((gSettings.damagePerDot    as number)  ?? 100)
  const [threshold,   setThreshold]   = useState((gSettings.balloonThreshold as number) ?? 100)
  const [critEnabled, setCritEnabled] = useState((gSettings.critEnabled      as boolean) !== false)
  const [critChance,  setCritChance]  = useState(Math.round(((gSettings.critChance as number) ?? 0.15) * 100))
  const [critMult,    setCritMult]    = useState((gSettings.critMultiplier   as number)  ?? 2)
  const [lootItems,   setLootItems]   = useState<BossLootItem[]>((gSettings.lootItems as BossLootItem[]) ?? [])

  // Sync settings form from gSettings when props update
  useEffect(() => {
    setBossName(   (gSettings.bossName         as string)  ?? '보스')
    setMaxHp(      (gSettings.maxHp            as number)  ?? 100000)
    setDmgPerDot(  (gSettings.damagePerDot     as number)  ?? 100)
    setThreshold(  (gSettings.balloonThreshold  as number)  ?? 100)
    setCritEnabled((gSettings.critEnabled       as boolean) !== false)
    setCritChance( Math.round(((gSettings.critChance as number) ?? 0.15) * 100))
    setCritMult(   (gSettings.critMultiplier    as number)  ?? 2)
    setLootItems(  (gSettings.lootItems         as BossLootItem[]) ?? [])
  }, [gSettings])

  // Last roll animation state
  const [animRoll, setAnimRoll] = useState<BossRollResult | null>(null)
  const lastRollRef = useRef<number>(0)
  useEffect(() => {
    if (!boss?.lastRoll) return
    if (boss.lastRoll.ts !== lastRollRef.current) {
      lastRollRef.current = boss.lastRoll.ts
      setAnimRoll(boss.lastRoll)
      const t = setTimeout(() => setAnimRoll(null), 4000)
      return () => clearTimeout(t)
    }
  }, [boss?.lastRoll])

  const saveAll = () => {
    saveSetting('bossName',         bossName)
    saveSetting('maxHp',            maxHp)
    saveSetting('damagePerDot',     dmgPerDot)
    saveSetting('balloonThreshold', threshold)
    saveSetting('critEnabled',      critEnabled)
    saveSetting('critChance',       critChance / 100)
    saveSetting('critMultiplier',   critMult)
    saveSetting('lootItems',        lootItems)
  }

  const start = () => { saveAll(); (el.bossStart as () => void)() }
  const reset = () => (el.bossReset as () => void)()

  const hpPct = boss ? Math.max(0, (boss.currentHp / boss.maxHp) * 100) : 100

  // ── Showing result (boss defeated) ────────────────────────────────────────
  if (status === 'showing_result' && boss) {
    const totalDmg = Object.values(boss.participants).reduce((s, p) => s + p.totalDamage, 0)
    const sorted   = Object.entries(boss.participants)
      .sort((a, b) => b[1].totalDamage - a[1].totalDamage)

    return (
      <div className={styles.brDefeated}>
        <div className={styles.brDefeatTitle}>👑 보스 처치!</div>
        <div className={styles.brDefeatStats}>
          총 데미지: <strong>{totalDmg.toLocaleString()}</strong> &nbsp;|&nbsp;
          참여자: <strong>{sorted.length}명</strong>
        </div>

        {boss.lootResults && boss.lootResults.length > 0 && (
          <div className={styles.brLootResults}>
            <div className={styles.brLootResultsTitle}>전리품 분배 결과</div>
            {boss.lootResults.map((r, i) => (
              <div key={i} className={styles.brLootResultRow}>
                <span className={styles.brLootIdx}>{i + 1}</span>
                <span className={styles.brLootWinner}>{r.user}</span>
                <span className={styles.brLootItemName}>{r.item.name}</span>
                {r.item.description && (
                  <span className={styles.brLootDesc}>{r.item.description}</span>
                )}
                <span className={styles.brLootPct}>{r.contributionRate.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.brDmgTable}>
          <div className={styles.brDmgTableTitle}>데미지 시트</div>
          <div className={styles.brDmgHeader}>
            <span>참여자</span><span>공격</span><span>크리티컬</span><span>총 데미지</span><span>기여도</span>
          </div>
          {sorted.map(([user, p]) => (
            <div key={user} className={styles.brDmgRow}>
              <span>{user}</span>
              <span>{p.attackCount}회</span>
              <span>{p.critCount}회</span>
              <span>{p.totalDamage.toLocaleString()}</span>
              <span>{totalDmg > 0 ? (p.totalDamage / totalDmg * 100).toFixed(1) : 0}%</span>
            </div>
          ))}
        </div>

        <button className={styles.brResetBtn} onClick={reset}>다음 레이드 준비</button>
      </div>
    )
  }

  // ── Running (raid active) ─────────────────────────────────────────────────
  if (status === 'running' && boss) {
    const totalDmg = Object.values(boss.participants).reduce((s, p) => s + p.totalDamage, 0)
    const sorted   = Object.entries(boss.participants)
      .sort((a, b) => b[1].totalDamage - a[1].totalDamage)

    return (
      <div className={styles.brRunning}>
        {/* HP Bar */}
        <div className={styles.brHpCard}>
          <div className={styles.brBossNameRow}>
            <span className={styles.brBossIcon}>💀</span>
            <span className={styles.brBossName}>{boss.bossName}</span>
            <span className={styles.brHpBadge}>BOSS HP</span>
          </div>
          <div className={styles.brHpNumbers}>
            <span>{boss.currentHp.toLocaleString()}</span>
            <span className={styles.brHpSep}>/</span>
            <span className={styles.brHpMax}>{boss.maxHp.toLocaleString()}</span>
          </div>
          <div className={styles.brHpBarBg}>
            <div
              className={styles.brHpBarFill}
              style={{ width: `${hpPct}%`, background: hpPct > 50 ? '#EF4444' : hpPct > 25 ? '#F97316' : '#FBBF24' }}
            />
          </div>
          <div className={styles.brHpPct}>{hpPct.toFixed(1)}% 남음</div>
        </div>

        {/* Last roll animation */}
        {animRoll && (
          <div className={`${styles.brDiceCard} ${styles.brDiceShow}`}>
            <div className={styles.brDiceUser}>{animRoll.user}님의 공격!</div>
            <div className={`${styles.brDiceFace} ${styles.brDiceSpin}`}>{animRoll.roll}</div>
            <div className={`${styles.brDmgPill} ${animRoll.isCritical ? styles.brDmgCrit : ''}`}>
              {animRoll.isCritical ? '💥 ' : ''}{animRoll.damage.toLocaleString()} DMG
            </div>
            {animRoll.isCritical && <div className={styles.brCritBadge}>CRITICAL HIT!</div>}
          </div>
        )}

        {/* Config summary */}
        <div className={styles.brConfigRow}>
          <span>별풍선 {boss.balloonThreshold}개 → 주사위 1회</span>
          <span>1면당 {boss.damagePerDot.toLocaleString()} 데미지</span>
          {boss.critEnabled && <span>크리티컬 {Math.round(boss.critChance * 100)}% (×{boss.critMultiplier})</span>}
        </div>

        {/* Damage table */}
        {sorted.length > 0 ? (
          <div className={styles.brDmgTable}>
            <div className={styles.brDmgTableTitle}>
              데미지 시트 &nbsp;<span className={styles.brDmgTotal}>총 {totalDmg.toLocaleString()}</span>
            </div>
            <div className={styles.brDmgHeader}>
              <span>참여자</span><span>공격</span><span>크리티컬</span><span>총 데미지</span><span>기여도</span>
            </div>
            {sorted.map(([user, p]) => (
              <div key={user} className={styles.brDmgRow}>
                <span>{user}</span>
                <span>{p.attackCount}회</span>
                <span>{p.critCount > 0 ? `${p.critCount}회` : '-'}</span>
                <span>{p.totalDamage.toLocaleString()}</span>
                <span>{totalDmg > 0 ? (p.totalDamage / totalDmg * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.brWaiting}>
            별풍선 {boss.balloonThreshold}개를 후원하면 공격이 시작됩니다!
          </div>
        )}

        <button className={styles.brResetBtn} style={{ marginTop: 8 }} onClick={reset}>레이드 초기화</button>
      </div>
    )
  }

  // ── Idle (setup form) ─────────────────────────────────────────────────────
  return (
    <div className={styles.brSetup}>
      <div className={styles.brSection}>
        <div className={styles.brSectionTitle}>보스 설정</div>
        <div className={styles.brRow}>
          <label className={styles.brLabel}>보스 이름</label>
          <input className={styles.brInput} value={bossName} onChange={e => setBossName(e.target.value)} />
        </div>
        <div className={styles.brRow}>
          <label className={styles.brLabel}>최대 HP</label>
          <input type="number" className={styles.brInput} value={maxHp} min={100}
            onChange={e => setMaxHp(Number(e.target.value))} />
        </div>
        <div className={styles.brRow}>
          <label className={styles.brLabel}>1면당 데미지</label>
          <input type="number" className={styles.brInput} value={dmgPerDot} min={1}
            onChange={e => setDmgPerDot(Number(e.target.value))} />
          <span className={styles.brHint}>주사위 6 × {dmgPerDot} = {(6 * dmgPerDot).toLocaleString()} 데미지</span>
        </div>
        <div className={styles.brRow}>
          <label className={styles.brLabel}>트리거 별풍선</label>
          <input type="number" className={styles.brInput} value={threshold} min={1}
            onChange={e => setThreshold(Number(e.target.value))} />
          <span className={styles.brHint}>개 후원 시 주사위 1회</span>
        </div>
      </div>

      <div className={styles.brSection}>
        <div className={styles.brSectionTitle}>크리티컬 설정</div>
        <div className={styles.brRow}>
          <label className={styles.brLabel}>
            <input type="checkbox" checked={critEnabled} onChange={e => setCritEnabled(e.target.checked)}
              style={{ marginRight: 6 }} />
            크리티컬 활성화
          </label>
        </div>
        {critEnabled && (<>
          <div className={styles.brRow}>
            <label className={styles.brLabel}>크리티컬 확률</label>
            <input type="number" className={styles.brInput} value={critChance} min={1} max={99}
              onChange={e => setCritChance(Number(e.target.value))} />
            <span className={styles.brHint}>%</span>
          </div>
          <div className={styles.brRow}>
            <label className={styles.brLabel}>크리티컬 배율</label>
            <input type="number" className={styles.brInput} value={critMult} min={1.5} step={0.5}
              onChange={e => setCritMult(Number(e.target.value))} />
            <span className={styles.brHint}>× (데미지 {critMult}배)</span>
          </div>
        </>)}
      </div>

      <BossLootEditor
        items={lootItems}
        onSave={v => { setLootItems(v); saveSetting('lootItems', v) }}
      />

      <button className={styles.brStartBtn} onClick={start}>
        레이드 시작
      </button>
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
            <span className={styles.gameIcon} style={{ background: g.color }} />
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
          <span className={styles.panelIcon} style={{ background: game.color }} />
          <h1 className={styles.panelTitle}>{game.name}</h1>
          <div className={styles.panelHeaderRight}>
            {/* Enabled toggle */}
            <label className={styles.toggleWrap} title={gSettings.enabled ? '활성화됨' : '비활성화됨'}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={(gSettings.enabled as boolean) ?? true}
                onChange={e => saveSetting('enabled', e.target.checked)}
              />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
              <span className={styles.toggleLabel}>
                {(gSettings.enabled as boolean) ?? true ? '활성' : '비활성'}
              </span>
            </label>
            {/* OBS URL copy */}
            <ObsUrlBtn gameId={game.id} port={OVERLAY_PORT} />
            {/* Manual run */}
            {game.id !== 'pickboard' && (
              <button
                className={styles.runBtn}
                style={{ background: busy ? '#6B7280' : game.color }}
                disabled={busy}
                onClick={() => triggerGame(game.id)}
              >
                {busy ? '진행 중...' : '▶ 수동 실행'}
              </button>
            )}
          </div>
        </div>

        {/* ── Common fields ── */}
        {game.id !== 'pickboard' && (
        <div className={styles.fields}>
          <Field label="별풍선 트리거 (0=비활성)">
            <input
              type="number" min={0}
              value={(gSettings.balloonThreshold as number) ?? 0}
              onChange={e => saveSetting('balloonThreshold', Number(e.target.value))}
            />
          </Field>


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

          {/* Quiz */}
          {game.id === 'quiz' && (
            <Field label="자동 출제 제한 시간 (초)">
              <input
                type="number" min={5} max={300}
                value={(gSettings.timeLimit as number) ?? 30}
                onChange={e => saveSetting('timeLimit', Number(e.target.value))}
              />
            </Field>
          )}
        </div>
        )}

        {/* ── List editors ── */}

        {game.id === 'roulette' && (
          <RoulettePanel
            key={`${selected}-panel`}
            gSettings={gSettings}
            gameStates={gameStates}
            saveSetting={saveSetting}
          />
        )}

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
          <LadderPanel
            key={`${selected}-panel`}
            gSettings={gSettings}
            gameStates={gameStates}
          />
        )}

        {game.id === 'ladder' && (
          <LadderEditor
            key={selected}
            prizes={(gSettings.prizes as Prize[]) ?? []}
            onSave={v => saveSetting('prizes', v)}
          />
        )}

        {game.id === 'slot' && (
          <SlotPanel
            key={`${selected}-panel`}
            gSettings={gSettings}
            gameStates={gameStates}
            saveSetting={saveSetting}
          />
        )}

        {game.id === 'boss' && (
          <BossPanel
            key={`${selected}-panel`}
            gSettings={gSettings}
            gameStates={gameStates}
            saveSetting={saveSetting}
          />
        )}

        {game.id === 'number' && (
          <NumberPanel
            key={`${selected}-panel`}
            gSettings={gSettings}
            gameStates={gameStates}
            saveSetting={saveSetting}
          />
        )}

        {game.id === 'pickboard' && (
          <PickBoardPanel
            key={selected}
            rows={(gSettings.pickRows as number) ?? 4}
            cols={(gSettings.pickCols as number) ?? 5}
            items={(gSettings.pickItems as PickItem[]) ?? []}
          />
        )}

        {game.id === 'quiz' && (
          <QuizPanel
            key={selected}
            gSettings={gSettings}
            gameStates={gameStates}
            saveSetting={saveSetting}
          />
        )}

        {game.id === 'pickboard' && (
          <PickBoardEditor
            key={`${selected}-editor`}
            items={(gSettings.pickItems as PickItem[]) ?? []}
            rows={(gSettings.pickRows as number) ?? 4}
            cols={(gSettings.pickCols as number) ?? 5}
            onSave={v => saveSetting('pickItems', v)}
            onSaveSize={(r, c) => { saveSetting('pickRows', r); saveSetting('pickCols', c) }}
          />
        )}

        {game.id === 'quiz' && (
          <QuizEditor
            key={`${selected}-editor`}
            questions={(gSettings.questions as QuizQuestion[]) ?? []}
            onSave={v => saveSetting('questions', v)}
          />
        )}

      </main>
    </div>
  )
}
