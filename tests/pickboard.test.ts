import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/soop-test' } }))

import { GameEngine, PICK_REVEAL_MS, PICK_RESULT_MS, type GameResult } from '../src/main/games/engine'
import { PickboardStore, buildCells, isLoseName } from '../src/main/games/pickboard'
import { DEFAULTS, sanitizeSettings, type Settings, type PickMode } from '../src/main/store/settings'

// 4×5 = 20칸, 상품은 전부 '꽝'이 아닌 것으로 채워 결과 이름을 예측하기 쉽게
function settings(over: Partial<{ pickMode: PickMode; balloonThreshold: number; pickMax: number; pickStartNo: number; pickDupPolicy: 'random' | 'skip'; pickChatWaitSec: number; loseText: string }> = {}): Settings {
  const s = sanitizeSettings(structuredClone(DEFAULTS))
  for (const g of Object.values(s.games)) g.enabled = false
  Object.assign(s.games.pickboard, {
    enabled: true, balloonThreshold: 1, pickMode: 'random', pickMax: 0, pickStartNo: 1, pickDupPolicy: 'random', pickChatWaitSec: 10,
    pickRows: 4, pickCols: 5,
    pickItems: [{ name: '상품', description: '', color: '#3B82F6', count: 20 }],
  }, over)
  return sanitizeSettings(s)
}

function setup(over: Parameters<typeof settings>[0] = {}) {
  const s = settings(over)
  const store = new PickboardStore()
  store.syncFromSettings(s)
  const eng = new GameEngine()
  eng.init(s)
  eng.setPickboard({
    total: () => store.total(),
    closedIndices: () => store.closedIndices(),
    reveal: (idx) => { const p = store.reveal(idx); return p ? { ...p, lose: !!store.get().cells[idx]?.lose } : null },
  })
  const results: GameResult[] = []
  eng.on('game:result', (_id: string, r: GameResult) => results.push(r))
  const opened = () => store.get().cells.map((c, i) => (c.revealed ? i : -1)).filter(i => i >= 0)
  return { s, store, eng, results, opened }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('뽑기판 칸 구성', () => {
  it('꽝 문구를 바꾸면 채움 칸과 "꽝" 상품이 그 문구로 보이고 lose 플래그가 선다', () => {
    const cells = buildCells(2, 2, [{ name: '꽝', description: '', color: '#000000', count: 1 }, { name: '상품', description: '', color: '#000000', count: 1 }], '다음 기회')
    expect(cells).toHaveLength(4)
    expect(cells.filter(c => c.lose)).toHaveLength(3)
    expect(cells.filter(c => c.lose).every(c => c.prize.name === '다음 기회')).toBe(true)
    expect(cells.find(c => !c.lose)!.prize.name).toBe('상품')
    expect(isLoseName('꽝', '다음 기회')).toBe(true)
    expect(isLoseName('상품', '다음 기회')).toBe(false)
  })
})

describe('뽑기판 오버레이 노출 토글', () => {
  it('끄고 켤 수 있고, 숨긴 상태에서 칸이 열리면 다시 보인다', () => {
    const { store } = setup()
    expect(store.toWire().visible).toBe(true)
    expect(store.setVisible()).toBe(false)
    expect(store.toWire().visible).toBe(false)
    expect(store.setVisible(true)).toBe(true)
    store.setVisible(false)
    store.reveal(0)
    expect(store.toWire().visible).toBe(true)
  })
  it('숨긴 채로 판을 초기화해도 숨김 유지', () => {
    const { store, s } = setup()
    store.setVisible(false)
    store.reset(s)
    expect(store.toWire().visible).toBe(false)
  })
})

describe('뽑기판 자동 뽑기', () => {
  it('별풍 번호: 후원 개수가 곧 칸 번호 (시작 번호 반영)', () => {
    const { eng, opened, results } = setup({ pickMode: 'balloon' })
    eng.onBalloon('철수', 12)
    expect(opened()).toEqual([11])
    expect(eng.getState('pickboard').status).toBe('running')
    vi.advanceTimersByTime(PICK_REVEAL_MS)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ gameId: 'pickboard', triggeredBy: '철수', balloon: 12, result: '상품' })
    expect(results[0].detail).toContain('12번')
    vi.advanceTimersByTime(PICK_RESULT_MS)
    expect(eng.getState('pickboard').status).toBe('idle')
  })

  it('별풍 번호 + 시작 번호 100: 112개 → 13번째 칸', () => {
    const { eng, opened } = setup({ pickMode: 'balloon', pickStartNo: 100, balloonThreshold: 100 })
    eng.onBalloon('철수', 112)
    expect(opened()).toEqual([12])
  })

  it('번호 칸이 이미 열렸으면 랜덤 대체, 건너뜀 설정이면 열지 않고 기록만', () => {
    const a = setup({ pickMode: 'balloon' })
    a.eng.onBalloon('철수', 3); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    a.eng.onBalloon('영희', 3); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(a.opened()).toHaveLength(2)
    expect(a.results[1].detail).toContain('이미 열린 칸')

    const b = setup({ pickMode: 'balloon', pickDupPolicy: 'skip' })
    b.eng.onBalloon('철수', 3); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    b.eng.onBalloon('영희', 3); vi.advanceTimersByTime(3000)
    expect(b.opened()).toEqual([2])
    expect(b.results[1]).toMatchObject({ result: '건너뜀', triggeredBy: '영희' })
    expect(b.eng.getState('pickboard').status).toBe('idle')
  })

  it('판 밖 번호(999)는 랜덤 대체', () => {
    const { eng, opened, results } = setup({ pickMode: 'balloon' })
    eng.onBalloon('철수', 999); vi.advanceTimersByTime(PICK_REVEAL_MS)
    expect(opened()).toHaveLength(1)
    expect(results[0].detail).toContain('판 밖')
  })

  it('최소~최대 범위 밖 후원은 무시', () => {
    const { eng, opened } = setup({ pickMode: 'random', balloonThreshold: 100, pickMax: 200 })
    eng.onBalloon('a', 99);  expect(opened()).toHaveLength(0)
    eng.onBalloon('b', 201); expect(opened()).toHaveLength(0)
    eng.onBalloon('c', 150); expect(opened()).toHaveLength(1)
  })

  it('후원 1건은 뽑기 1번 — 배수 반복 안 함', () => {
    const { eng, opened } = setup({ pickMode: 'random', balloonThreshold: 100 })
    eng.onBalloon('a', 1000)
    vi.advanceTimersByTime(60000)
    expect(opened()).toHaveLength(1)
    expect(eng.getStageQueue()).toHaveLength(0)
  })

  it('순차: 빈칸을 번호 순서대로', () => {
    const { eng, opened } = setup({ pickMode: 'order' })
    eng.onBalloon('a', 5); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    eng.onBalloon('b', 7); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(opened()).toEqual([0, 1])
  })

  it('직접 뽑기: 후원·채팅으로는 열리지 않고 버튼 실행은 랜덤으로 연다', () => {
    const { eng, opened } = setup({ pickMode: 'manual' })
    eng.onBalloon('a', 5)
    eng.onChat('b', '!뽑기 3')
    expect(opened()).toHaveLength(0)
    expect(eng.trigger('pickboard', '스트리머', 0)).toBe('started')
    expect(opened()).toHaveLength(1)
  })

  it('채팅 명령 "!뽑기 7" 은 7번 칸, "!뽑기" 는 랜덤', () => {
    const { eng, opened } = setup({ pickMode: 'random' })
    eng.onChat('a', '!뽑기 7'); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(opened()).toEqual([6])
    eng.onChat('b', '!뽑기'); vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(opened()).toHaveLength(2)
  })

  it('후원이 몰리면 무대 한 줄로 차례대로 (겹치지 않음)', () => {
    const { eng, opened } = setup({ pickMode: 'random' })
    eng.onBalloon('a', 1); eng.onBalloon('b', 1); eng.onBalloon('c', 1)
    expect(opened()).toHaveLength(1)
    expect(eng.getStageQueue()).toHaveLength(2)
    vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(opened()).toHaveLength(2)
    vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(opened()).toHaveLength(3)
    expect(eng.getStageQueue()).toHaveLength(0)
  })

  it('칸이 다 열리면 실행이 거부되고 안내 로그', () => {
    const { eng, store } = setup({ pickMode: 'random' })
    for (let i = 0; i < 20; i++) store.reveal(i)
    const logs: string[] = []
    eng.on('log', (m: string) => logs.push(m))
    expect(eng.trigger('pickboard', '스트리머', 0)).toBe('rejected')
    expect(logs.join(' ')).toContain('모두 열렸습니다')
  })

  it('직접 누른 칸도 기록에 남는다', () => {
    const { eng, results } = setup()
    eng.logPickboardManual(4, { name: '상품', description: '치킨', color: '#000000', lose: false })
    expect(results).toHaveLength(1)
    expect(results[0].detail).toContain('5번')
    expect(results[0].detail).toContain('직접 선택')
    expect(eng.todayRuns).toBe(1)
  })
})

describe('뽑기판 채팅 번호 방식', () => {
  it('후원자가 채팅으로 번호를 보내면 그 칸, 다른 사람 채팅은 무시', () => {
    const { eng, opened } = setup({ pickMode: 'chat' })
    eng.onBalloon('철수', 50)
    expect(eng.getState('pickboard').status).toBe('collecting')
    expect(eng.getState('pickboard').pickboard?.triggeredBy).toBe('철수')
    eng.onChat('영희', '5')
    expect(opened()).toHaveLength(0)
    eng.onChat('철수', '5번')
    expect(opened()).toEqual([4])
    expect(eng.getState('pickboard').status).toBe('running')
    vi.advanceTimersByTime(PICK_REVEAL_MS + PICK_RESULT_MS)
    expect(eng.getState('pickboard').status).toBe('idle')
  })

  it('"!뽑기 12" 형식과 "랜덤" 도 받고, 시간이 지나면 랜덤으로 연다', () => {
    const a = setup({ pickMode: 'chat' })
    a.eng.onBalloon('철수', 50)
    a.eng.onChat('철수', '!뽑기 12')
    expect(a.opened()).toEqual([11])

    const b = setup({ pickMode: 'chat' })
    b.eng.onBalloon('철수', 50)
    b.eng.onChat('철수', '랜덤')
    expect(b.opened()).toHaveLength(1)

    const c = setup({ pickMode: 'chat', pickChatWaitSec: 10 })
    c.eng.onBalloon('철수', 50)
    c.eng.onChat('철수', 'ㅋㅋ 뭐 고르지')   // 숫자가 아니면 그냥 채팅
    expect(c.opened()).toHaveLength(0)
    vi.advanceTimersByTime(10000)
    expect(c.opened()).toHaveLength(1)
    vi.advanceTimersByTime(PICK_REVEAL_MS)
    expect(c.results[0].detail).toContain('번호 없음')
  })

  it('기다리는 동안 다른 게임은 줄을 선다', () => {
    const { eng, s } = setup({ pickMode: 'chat' })
    s.games.roulette.enabled = true
    eng.updateSettings(s)
    eng.onBalloon('철수', 50)
    expect(eng.trigger('roulette', '스트리머', 0)).toBe('queued')
  })
})
