// 수동 사다리 진행 상태 — 패널이 탭 이동으로 언마운트돼도 유지되도록 컴포넌트 밖(모듈)에 둔다.
// 오버레이에는 이미 'manual_preview' 상태가 나가 있는데 패널만 초기화되면 다시 맞출 방법이 없었다.
import { useSyncExternalStore } from 'react'
import type { LadderData } from '../pages/Games/panels'

export interface ManualLadderState {
  participants: string[]
  previewData:  LadderData | null
  result:       LadderData | null
  revealed:     number[]
  animating:    boolean
}

const EMPTY: ManualLadderState = { participants: [], previewData: null, result: null, revealed: [], animating: false }

let state: ManualLadderState = EMPTY
const listeners = new Set<() => void>()

export function setManualLadder(patch: Partial<ManualLadderState> | ((s: ManualLadderState) => Partial<ManualLadderState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  listeners.forEach(l => l())
}
export function resetManualLadder() { setManualLadder(EMPTY) }

export function useManualLadder(): ManualLadderState {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => state,
  )
}
