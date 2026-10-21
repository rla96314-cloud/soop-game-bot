// 뽑기판 상태 — 메인 프로세스가 들고 있다.
// 렌더러 패널이 탭 이동으로 언마운트돼도 공개 상태가 남고, OBS 소스를 새로고침해도 같은 판을 다시 받는다.
import { EventEmitter } from 'events'
import type { PickItem, Settings } from '../store/settings'
import { shuffle } from './engine'

export interface PickCell { prize: PickItem; revealed: boolean }

export interface PickboardState {
  rows:  number
  cols:  number
  cells: PickCell[]
  lastResult: PickItem | null
}

/** 오버레이로 보내는 축약 형태 */
export interface PickboardWire {
  rows: number
  cols: number
  cells: Array<{ revealed: boolean; name: string; description: string; color: string }>
}

const FILLER: PickItem = { name: '꽝', description: '', color: '#6B7280', count: 1 }

export function buildCells(rows: number, cols: number, items: PickItem[]): PickCell[] {
  const total = rows * cols
  const prizes: PickItem[] = []
  for (const item of items) {
    for (let k = 0; k < item.count && prizes.length < total; k++) prizes.push(item)
  }
  while (prizes.length < total) prizes.push(FILLER)
  return shuffle(prizes).slice(0, total).map(prize => ({ prize, revealed: false }))
}

export class PickboardStore extends EventEmitter {
  private state: PickboardState = { rows: 0, cols: 0, cells: [], lastResult: null }
  private configKey = ''

  /** 설정이 바뀌면(크기·상품) 새 판, 아니면 그대로 유지 */
  syncFromSettings(s: Settings) {
    const g = s.games.pickboard ?? {}
    const rows  = Number(g.pickRows) || 4
    const cols  = Number(g.pickCols) || 5
    const items = (g.pickItems as PickItem[] | undefined) ?? []
    const key = JSON.stringify({ rows, cols, items })
    if (key === this.configKey && this.state.cells.length) return
    this.configKey = key
    this.state = { rows, cols, cells: buildCells(rows, cols, items), lastResult: null }
    this.emit('update', this.state)
  }

  get(): PickboardState { return this.state }

  toWire(): PickboardWire {
    return {
      rows: this.state.rows, cols: this.state.cols,
      cells: this.state.cells.map(c => ({ revealed: c.revealed, name: c.prize.name, description: c.prize.description, color: c.prize.color })),
    }
  }

  reveal(idx: number): PickItem | null {
    const cell = this.state.cells[idx]
    if (!cell || cell.revealed) return null
    cell.revealed = true
    this.state.lastResult = cell.prize
    this.emit('update', this.state)
    return cell.prize
  }

  /** 새 판 (같은 설정으로 다시 섞기) */
  reset(s: Settings) {
    this.configKey = ''
    this.state = { ...this.state, lastResult: null, cells: [] }
    this.syncFromSettings(s)
  }
}

export const pickboardStore = new PickboardStore()
