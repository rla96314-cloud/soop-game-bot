import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameEngine, buildLadder, weightedRandom, normalizeAnswer, shuffle, isLotteryWin } from '../src/main/games/engine'
import { DEFAULTS, sanitizeSettings } from '../src/main/store/settings'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/soop-test' } }))

const settings = () => sanitizeSettings(structuredClone(DEFAULTS))

// ─── 순수 함수 ────────────────────────────────────────────────────────────────

describe('buildLadder', () => {
  it('참가자가 상품보다 많으면 1등 당첨자가 results[0]', () => {
    for (let n = 0; n < 50; n++) {
      const ld = buildLadder(['a', 'b', 'c', 'd', 'e'], ['1등', '2등', '꽝'])
      expect(ld.results).toHaveLength(5)
      expect(ld.results[0].prize).toBe('1등')
      expect(ld.results[1].prize).toBe('2등')
      expect(ld.results[2].prize).toBe('꽝')
      // 채움 칸은 뒤로
      expect(ld.results.slice(3).map(r => r.prize).sort()).toEqual(['4등', '5등'])
      // 바닥에는 상품이 참가자 수만큼
      expect(ld.prizes).toHaveLength(5)
    }
  })

  it('상품이 참가자보다 많으면 앞 순위부터 남긴다 (1등은 절대 빠지지 않음)', () => {
    for (let n = 0; n < 50; n++) {
      const ld = buildLadder(['a', 'b'], ['1등', '2등', '3등', '꽝'])
      expect(ld.prizes.sort()).toEqual(['1등', '2등'])
      expect(ld.results[0].prize).toBe('1등')
    }
  })

  it('참가자 1명도 동작', () => {
    const ld = buildLadder(['solo'], ['1등'])
    expect(ld.results[0]).toMatchObject({ user: 'solo', prize: '1등', endCol: 0 })
  })

  it('경로는 가로줄을 따라 이동하고 각 참가자는 서로 다른 칸에 도착', () => {
    for (let n = 0; n < 30; n++) {
      const ld = buildLadder(['a', 'b', 'c', 'd'], ['1', '2', '3', '4'])
      const ends = ld.paths.map(p => p.cols[ld.rows])
      expect(new Set(ends).size).toBe(4)
    }
  })
})

describe('weightedRandom', () => {
  it('확률 합이 0이면 null', () => {
    expect(weightedRandom([{ probability: 0 }, { probability: 0 }])).toBeNull()
    expect(weightedRandom([])).toBeNull()
  })
  it('확률 0 항목은 절대 뽑히지 않음', () => {
    const items = [{ name: 'a', probability: 0 }, { name: 'b', probability: 10 }]
    for (let i = 0; i < 200; i++) expect(weightedRandom(items)!.name).toBe('b')
  })
  it('분포가 가중치에 비례', () => {
    const items = [{ name: 'a', probability: 75 }, { name: 'b', probability: 25 }]
    let a = 0
    const N = 20000
    for (let i = 0; i < N; i++) if (weightedRandom(items)!.name === 'a') a++
    expect(a / N).toBeGreaterThan(0.72)
    expect(a / N).toBeLessThan(0.78)
  })
})

describe('shuffle', () => {
  it('원본을 바꾸지 않고 같은 원소를 가진다', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('normalizeAnswer', () => {
  it('공백·대소문자·NFC 차이를 무시', () => {
    expect(normalizeAnswer(' 아프리카TV ')).toBe(normalizeAnswer('아프리카tv'))
    expect(normalizeAnswer('아이 유')).toBe(normalizeAnswer('아이유'))
    expect(normalizeAnswer('한글'.normalize('NFD'))).toBe(normalizeAnswer('한글'))
  })
})

describe('isLotteryWin', () => {
  it('isWin 이 없으면 이름이 꽝인지로, 있으면 그 값으로', () => {
    expect(isLotteryWin({ name: '꽝', prob: 1, color: '#000' })).toBe(false)
    expect(isLotteryWin({ name: '꽝!', prob: 1, color: '#000' })).toBe(true)
    expect(isLotteryWin({ name: '꽝!', prob: 1, color: '#000', isWin: false })).toBe(false)
  })
})

// ─── 엔진 ─────────────────────────────────────────────────────────────────────

describe('GameEngine', () => {
  let eng: GameEngine
  beforeEach(() => {
    vi.useFakeTimers()
    eng = new GameEngine()
    const s = settings()
    s.games.roulette.spinDuration = 1000
    eng.init(s)
  })
  afterEach(() => vi.useRealTimers())

  it('진행 중인 게임에 들어온 트리거는 대기열에 들어가고 끝나면 이어서 실행된다', () => {
    expect(eng.trigger('roulette', 'A', 50)).toBe('started')
    expect(eng.trigger('roulette', 'B', 50)).toBe('queued')
    expect(eng.trigger('roulette', 'C', 50)).toBe('queued')
    expect(eng.getState('roulette').queued).toBe(2)
    expect(eng.todayRuns).toBe(1)

    vi.advanceTimersByTime(1000)      // spin 끝 → showing_result
    expect(eng.getState('roulette').status).toBe('showing_result')
    vi.advanceTimersByTime(5000)      // idle → 대기열 B 시작
    expect(eng.getState('roulette').status).toBe('running')
    expect(eng.getState('roulette').queued).toBe(1)
    expect(eng.todayRuns).toBe(2)

    vi.advanceTimersByTime(6000)
    expect(eng.todayRuns).toBe(3)
    vi.advanceTimersByTime(6000)
    expect(eng.getState('roulette').status).toBe('idle')
    expect(eng.todayRuns).toBe(3)
  })

  it('별풍선 후원은 임계값의 몇 배인지만큼 실행된다 (상한 적용)', () => {
    const results: string[] = []
    eng.on('game:result', (_id, r) => results.push(r.triggeredBy))
    eng.onBalloon('rich', 500)   // 룰렛 임계값 50 → 10회
    expect(eng.getState('roulette').status).toBe('running')
    expect(eng.getState('roulette').queued).toBe(9)
    vi.advanceTimersByTime(6000 * 10)
    expect(results).toHaveLength(10)
    expect(eng.todayRuns).toBe(10)
  })

  it('multiRun 이 꺼져 있으면 1회만', () => {
    const s = settings(); s.soop.multiRun = false; s.games.roulette.spinDuration = 1000
    eng.updateSettings(s)
    eng.onBalloon('rich', 500)
    expect(eng.getState('roulette').queued).toBe(0)
  })

  it('진행 중이라고 다른 게임으로 넘기지 않는다', () => {
    const s = settings(); s.games.slot.enabled = true; s.games.slot.balloonThreshold = 100; s.games.roulette.spinDuration = 1000
    eng.updateSettings(s)
    eng.onBalloon('A', 100)   // 슬롯(100) > 룰렛(50) → 슬롯
    expect(eng.getState('slot').status).toBe('running')
    eng.onBalloon('B', 100)   // 슬롯 진행 중 → 룰렛으로 가지 않고 슬롯 대기열
    expect(eng.getState('roulette').status).toBe('idle')
    expect(eng.getState('slot').queued).toBe(1)
  })

  it('룰렛 항목이 비어 있으면 실행 횟수가 올라가지 않는다', () => {
    const s = settings(); s.games.roulette.items = []
    eng.updateSettings(s)
    expect(eng.trigger('roulette', 'A', 0)).toBe('rejected')
    expect(eng.todayRuns).toBe(0)
  })

  it('사다리: 별풍선 시작은 후원자가 참가, 스트리머 버튼 시작은 빈 목록', () => {
    eng.trigger('ladder', '스트리머', 0)
    expect(eng.getState('ladder').ladder!.participants).toEqual([])
    vi.advanceTimersByTime(60_000)   // 참가자 없음 → idle
    expect(eng.getState('ladder').status).toBe('idle')

    eng.trigger('ladder', 'donor', 100)
    expect(eng.getState('ladder').ladder!.participants).toEqual(['donor'])
    expect(eng.getState('ladder').ladder!.joinMs).toBe(30_000)
  })

  it('사다리: 채팅 명령으로 참가하고 1등이 결과 맨 앞', () => {
    eng.trigger('ladder', 'donor', 100)
    eng.onChat('v1', '!참가'); eng.onChat('v2', '!참가'); eng.onChat('v3', '!참가'); eng.onChat('v4', '!참가')
    eng.onChat('v1', '!참가')   // 중복 무시
    expect(eng.getState('ladder').ladder!.participants).toHaveLength(5)
    vi.advanceTimersByTime(30_000)
    const st = eng.getState('ladder')
    expect(st.status).toBe('showing_result')
    expect(st.result!.result).toMatch(/\(1등\)$/)
  })

  it('퀴즈: 공백·대소문자 차이가 있어도 정답 처리, 표시용 정답은 원문', () => {
    const results: Array<{ result: string; detail: string }> = []
    eng.on('game:result', (_id, r) => results.push(r))
    expect(eng.startManualQuiz('이름?', ' 아프리카TV ', 30)).toBe(true)
    eng.onChat('v', '!퀴즈 아프리카 tv')
    expect(results[0].result).toBe('v 정답!')
    expect(results[0].detail).toBe('정답: 아프리카TV')
  })

  it('퀴즈: 자동 출제도 trim 된 정답으로 비교', () => {
    const s = settings(); s.games.quiz.enabled = true
    s.games.quiz.questions = [{ question: 'q', answer: '정답 ' }]
    eng.updateSettings(s)
    expect(eng.trigger('quiz', 'A', 0)).toBe('started')
    eng.onChat('v', '!퀴즈정답')
    expect(eng.getState('quiz').quiz!.winner).toBe('v')
  })

  it('기록은 1000건까지만', () => {
    const s = settings(); s.games.roulette.spinDuration = 1000
    eng.updateSettings(s)
    for (let i = 0; i < 1100; i++) {
      eng.trigger('roulette', `u${i}`, 0)
      vi.advanceTimersByTime(6000)
    }
    expect(eng.getHistory(2000)).toHaveLength(1000)
  })
})
