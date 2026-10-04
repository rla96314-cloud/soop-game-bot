import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/soop-test' } }))

import {
  GameEngine, parseHand, rpsOutcome, buildRaceCurves, raceProgress, parseRacerPick,
} from '../src/main/games/engine'
import { FishLog } from '../src/main/games/fishlog'
import { DEFAULTS, sanitizeSettings } from '../src/main/store/settings'

const settings = () => {
  const s = sanitizeSettings(structuredClone(DEFAULTS))
  s.games.race.enabled = true; s.games.rps.enabled = true; s.games.fish.enabled = true
  return s
}

describe('가위바위보 규칙', () => {
  it('손 파싱 — 한글·별칭·이모지·영문', () => {
    expect(parseHand('가위')).toBe('scissors')
    expect(parseHand('찌')).toBe('scissors')
    expect(parseHand('주먹')).toBe('rock')
    expect(parseHand('✊')).toBe('rock')
    expect(parseHand('보자기')).toBe('paper')
    expect(parseHand('P')).toBe('paper')
    expect(parseHand('안녕')).toBeNull()
    expect(parseHand('')).toBeNull()
  })
  it('승패 판정 (시청자 기준)', () => {
    expect(rpsOutcome('rock', 'scissors')).toBe('win')
    expect(rpsOutcome('scissors', 'paper')).toBe('win')
    expect(rpsOutcome('paper', 'rock')).toBe('win')
    expect(rpsOutcome('rock', 'paper')).toBe('lose')
    expect(rpsOutcome('paper', 'paper')).toBe('draw')
  })
})

describe('경주 곡선', () => {
  it('도착 순서대로 먼저 1에 도달하고, 도착 전에는 1 미만', () => {
    for (let k = 0; k < 50; k++) {
      const { curves, order } = buildRaceCurves(6)
      expect(new Set(order).size).toBe(6)
      const finishes = order.map(i => curves[i].finish)
      for (let r = 1; r < finishes.length; r++) expect(finishes[r]).toBeGreaterThan(finishes[r - 1])
      for (const c of curves) {
        expect(raceProgress(c, 0)).toBe(0)
        expect(raceProgress(c, c.finish)).toBe(1)
        expect(raceProgress(c, c.finish * 0.99)).toBeLessThan(1)
        expect(raceProgress(c, 1)).toBe(1)
      }
    }
  })
  it('1등은 균등하게 분포 (공정성)', () => {
    const wins = [0, 0, 0, 0]
    for (let k = 0; k < 8000; k++) wins[buildRaceCurves(4).order[0]]++
    for (const w of wins) { expect(w / 8000).toBeGreaterThan(0.22); expect(w / 8000).toBeLessThan(0.28) }
  })
  it('예측 파싱 — 번호, 이름, 이모지', () => {
    const racers = [{ name: '말', emoji: '🐎' }, { name: '토끼', emoji: '🐇' }]
    expect(parseRacerPick('2', racers)).toBe(1)
    expect(parseRacerPick('1번', racers)).toBe(0)
    expect(parseRacerPick('토끼', racers)).toBe(1)
    expect(parseRacerPick('🐎', racers)).toBe(0)
    expect(parseRacerPick('3', racers)).toBeNull()
    expect(parseRacerPick('', racers)).toBeNull()
  })
})

describe('엔진 — 새 게임 흐름', () => {
  let eng: GameEngine
  beforeEach(() => { vi.useFakeTimers(); eng = new GameEngine(); eng.init(settings()) })
  afterEach(() => vi.useRealTimers())

  it('가위바위보: 채팅 명령으로 시작·참가하고, 마감 후 결과에 승/무/패가 집계된다', () => {
    const results: Array<{ result: string }> = []
    eng.on('game:result', (_id, r) => results.push(r))
    eng.onChat('a', '!묵찌빠 가위')          // 대기 중 → 시작 + a 참가
    expect(eng.getState('rps').status).toBe('collecting')
    eng.onChat('b', '!묵찌빠 바위')
    eng.onChat('c', '!묵찌빠 보')
    eng.onChat('c', '!묵찌빠 가위')          // 마감 전 변경 허용
    eng.onChat('d', '!묵찌빠 뭐지')          // 잘못된 손은 무시
    expect(Object.keys(eng.getState('rps').rps!.picks)).toEqual(['a', 'b', 'c'])
    expect(eng.getState('rps').rps!.picks.c).toBe('scissors')

    vi.advanceTimersByTime(15_000)
    const st = eng.getState('rps')
    expect(st.status).toBe('running')
    const r = st.rps!
    expect(r.winners!.length + r.draws!.length + r.losers!.length).toBe(3)
    vi.advanceTimersByTime(2_200)
    expect(results[0].result).toMatch(/^스트리머 .+ — 승 \d+ · 무 \d+ · 패 \d+$/)
  })

  it('가위바위보: 참가자 없이 끝나도 결과가 나온다', () => {
    eng.trigger('rps', '스트리머', 0)
    vi.advanceTimersByTime(15_000 + 2_200)
    expect(eng.getState('rps').result!.result).toMatch(/참가자 없음/)
  })

  it('경주: 예측 접수 → 경주 → 1등과 적중자 발표', () => {
    eng.trigger('race', '스트리머', 0)
    expect(eng.getState('race').status).toBe('collecting')
    eng.onChat('a', '!경주 1'); eng.onChat('b', '!경주 토끼'); eng.onChat('c', '!경주 99')
    expect(eng.getState('race').race!.bets).toEqual({ a: 0, b: 1 })
    vi.advanceTimersByTime(20_000)
    const st = eng.getState('race')
    expect(st.status).toBe('running')
    expect(st.race!.curves).toHaveLength(6)
    expect(st.race!.startedAt).toBeTypeOf('number')
    vi.advanceTimersByTime(8_600)
    const res = eng.getState('race').result!
    const w = st.race!.racers[st.race!.order![0]]
    expect(res.result).toBe(`${w.emoji} ${w.name} 1등!`)
    expect(res.detail).toMatch(/적중 \d\/2명/)
  })

  it('경주: 진행 중에는 예측을 받지 않는다', () => {
    eng.trigger('race', 's', 0)
    vi.advanceTimersByTime(20_000)
    eng.onChat('late', '!경주 1')
    expect(eng.getState('race').race!.bets).toEqual({})
  })

  it('낚시: 기록 저장소가 호출되고 결과에 누적이 표시된다', () => {
    const rec = vi.fn(() => ({ count: 3, totalPoints: 42 }))
    eng.setFishRecorder(rec)
    eng.trigger('fish', 'kim', 0)
    expect(rec).toHaveBeenCalledOnce()
    expect(eng.getState('fish').fish!.count).toBe(3)
    vi.advanceTimersByTime(4_000)
    expect(eng.getState('fish').result!.detail).toMatch(/누적 3마리 · 총 42점/)
  })

  it('낚시: 확률 합 0 이면 실행 거부', () => {
    const s = settings(); s.games.fish.fishes = [{ name: 'x', emoji: '🐟', probability: 0, rarity: 'common', points: 1 }]
    eng.updateSettings(s)
    expect(eng.trigger('fish', 'kim', 0)).toBe('rejected')
    expect(eng.todayRuns).toBe(0)
  })
})

describe('FishLog', () => {
  it('시청자별 누적·최고 기록·랭킹, 파일로 유지', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fishlog-'))
    const log = new FishLog(() => dir)
    const small = { name: '고등어', emoji: '🐟', probability: 1, rarity: 'common' as const, points: 1 }
    const big   = { name: '황금어', emoji: '🐉', probability: 1, rarity: 'legendary' as const, points: 50 }
    expect(log.record('Kim', small)).toEqual({ count: 1, totalPoints: 1 })
    expect(log.record('kim', small)).toEqual({ count: 2, totalPoints: 2 })   // 대소문자 무시
    log.record('lee', big)
    const again = new FishLog(() => dir)                                     // 다시 읽어도 유지
    const rank = again.ranking()
    expect(rank.map(r => r.user)).toEqual(['lee', 'kim'])
    expect(rank[0].best!.name).toBe('황금어')
    again.reset()
    expect(new FishLog(() => dir).ranking()).toEqual([])
  })
})

describe('설정 검증 — 새 게임', () => {
  it('경주 주자 2명 미만이면 기본값, 8명 초과는 자름', () => {
    expect(sanitizeSettings({ games: { race: { racers: [{ name: 'a', emoji: '' }] } } } as never).games.race.racers).toHaveLength(6)
    const many = Array.from({ length: 12 }, (_, i) => ({ name: 'r' + i, emoji: '' }))
    const s = sanitizeSettings({ games: { race: { racers: many } } } as never)
    expect(s.games.race.racers).toHaveLength(8)
    expect((s.games.race.racers as Array<{ emoji: string }>)[0].emoji).toBe('🏃')
  })
  it('낚시 등급은 4종만, 시간 범위 고정', () => {
    const s = sanitizeSettings({ games: { fish: { castDuration: 1, fishes: [{ name: 'x', rarity: 'mythic', probability: -1, points: 5 }] } } } as never)
    expect(s.games.fish.castDuration).toBe(2000)
    expect(s.games.fish.fishes).toEqual([{ name: 'x', emoji: '🐟', probability: 0, rarity: 'common', points: 5 }])
  })
})
