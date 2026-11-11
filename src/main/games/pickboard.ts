// 뽑기판 상태 — 메인 프로세스가 들고 있다.
// 렌더러 패널이 탭 이동으로 언마운트돼도 공개 상태가 남고, OBS 소스를 새로고침해도 같은 판을 다시 받는다.
import { EventEmitter } from 'events'
import type { PickItem, Settings } from '../store/settings'
import { shuffle } from './engine'

export interface PickCell { prize: PickItem; revealed: boolean; lose: boolean }

export interface PickboardState {
  rows:  number
  cols:  number
  cells: PickCell[]
  lastResult: PickItem | null
  /** OBS 오버레이에 판을 보일지 — 스트리머가 토글. 칸이 열리면 자동으로 다시 보인다 */
  visible: boolean
}

/** 오버레이로 보내는 축약 형태 */
export interface PickboardWire {
  rows: number
  cols: number
  visible: boolean
  cells: Array<{ revealed: boolean; name: string; description: string; color: string; lose: boolean }>
}

const FILLER_COLOR = '#6B7280'

/** 꽝 판정 — 꽝 문구를 바꿨어도 '꽝'이라고 쓴 상품은 여전히 꽝 */
export const isLoseName = (name: string, loseText = '꽝') => {
  const n = String(name ?? '').trim()
  return n === '꽝' || n === String(loseText ?? '').trim()
}

export function buildCells(rows: number, cols: number, items: PickItem[], loseText = '꽝'): PickCell[] {
  const total = rows * cols
  const filler: PickItem = { name: loseText || '꽝', description: '', color: FILLER_COLOR, count: 1 }
  const prizes: PickItem[] = []
  for (const item of items) {
    // 상품 이름이 '꽝'이면 바꾼 꽝 문구로 보여 준다 (설정의 꽝 문구가 한 곳에서 먹히게)
    const p = item.name.trim() === '꽝' && loseText && loseText !== '꽝' ? { ...item, name: loseText } : item
    for (let k = 0; k < item.count && prizes.length < total; k++) prizes.push(p)
  }
  while (prizes.length < total) prizes.push(filler)
  return shuffle(prizes).slice(0, total).map(prize => ({ prize, revealed: false, lose: isLoseName(prize.name, loseText) }))
}

export class PickboardStore extends EventEmitter {
  private state: PickboardState = { rows: 0, cols: 0, cells: [], lastResult: null, visible: true }
  private configKey = ''

  /** 설정이 바뀌면(크기·상품) 새 판, 아니면 그대로 유지 */
  syncFromSettings(s: Settings) {
    const g = s.games.pickboard ?? {}
    const rows  = Number(g.pickRows) || 4
    const cols  = Number(g.pickCols) || 5
    const items = (g.pickItems as PickItem[] | undefined) ?? []
    const loseText = String(g.loseText ?? '꽝').trim() || '꽝'
    const key = JSON.stringify({ rows, cols, items, loseText })
    if (key === this.configKey && this.state.cells.length) return
    this.configKey = key
    this.state = { rows, cols, cells: buildCells(rows, cols, items, loseText), lastResult: null, visible: this.state.visible }
    this.emit('update', this.state)
  }

  get(): PickboardState { return this.state }

  /** 칸 수 */
  total(): number { return this.state.cells.length }

  /** 아직 안 연 칸의 인덱스 (판 순서대로) */
  closedIndices(): number[] {
    return this.state.cells.map((c, i) => (c.revealed ? -1 : i)).filter(i => i >= 0)
  }

  toWire(): PickboardWire {
    return {
      rows: this.state.rows, cols: this.state.cols, visible: this.state.visible,
      cells: this.state.cells.map(c => ({ revealed: c.revealed, name: c.prize.name, description: c.prize.description, color: c.prize.color, lose: c.lose })),
    }
  }

  reveal(idx: number): PickItem | null {
    const cell = this.state.cells[idx]
    if (!cell || cell.revealed) return null
    cell.revealed = true
    this.state.lastResult = cell.prize
    this.state.visible = true   // 숨겨 둔 상태에서 칸이 열리면 시청자가 봐야 하므로 다시 보인다
    this.emit('update', this.state)
    return cell.prize
  }

  /** 오버레이 노출 켜기/끄기 — 값을 안 주면 반대로 */
  setVisible(v?: boolean): boolean {
    const next = typeof v === 'boolean' ? v : !this.state.visible
    if (next !== this.state.visible) { this.state.visible = next; this.emit('update', this.state) }
    return this.state.visible
  }

  /** 새 판 (같은 설정으로 다시 섞기) */
  reset(s: Settings) {
    this.configKey = ''
    this.state = { ...this.state, lastResult: null, cells: [] }
    this.syncFromSettings(s)
  }
}

export const pickboardStore = new PickboardStore()

/**
 * 뽑기 결과를 외부 앱(예: weflab-amaran-fx 의 /api/event/pickboard)으로 POST.
 * 실패해도 게임 진행은 막지 않는다 — 알림만 남김. 2초 타임아웃.
 */
export function notifyPickResult(url: string | undefined, prize: PickItem, onError?: (msg: string) => void) {
  const u = String(url ?? '').trim()
  if (!/^https?:\/\//i.test(u)) return
  const body = JSON.stringify({ source: 'soop-game-bot', game: 'pickboard', name: prize.name, description: prize.description, color: prize.color, ts: Date.now() })
  fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(2000) })
    .then(r => { if (!r.ok) onError?.(`뽑기 결과 전송 실패 (${r.status}) — ${u}`) })
    .catch(e => onError?.(`뽑기 결과 전송 실패: ${(e as Error).message} — ${u}`))
}
