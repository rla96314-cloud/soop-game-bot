import { describe, it, expect } from 'vitest'
import { DonationGate, DEDUPE_MS } from '../src/main/donation/gate'

describe('DonationGate', () => {
  it('both: 같은 후원자·개수가 3초 안에 두 경로로 오면 한 번만 통과', () => {
    const g = new DonationGate()
    g.setSource('both')
    const t = 1_000_000
    expect(g.push('soop',   'kim', 100, t)).toBe(true)
    expect(g.push('weflab', 'kim', 100, t + 500)).toBe(false)
    expect(g.push('weflab', 'kim', 100, t + DEDUPE_MS + 1)).toBe(true)   // 시간 지나면 새 후원
  })

  it('both: 같은 경로에서 같은 후원자가 같은 개수를 연달아 쏘면 전부 통과 (짝은 다른 경로끼리만)', () => {
    const g = new DonationGate()
    const t = 0
    expect(g.push('weflab', 'kim', 100, t)).toBe(true)
    expect(g.push('weflab', 'kim', 100, t + 300)).toBe(true)
    expect(g.push('weflab', 'kim', 100, t + 600)).toBe(true)
    // 뒤늦게 SOOP 로 같은 3건이 오면 각각 짝지어 버려진다
    expect(g.push('soop', 'kim', 100, t + 700)).toBe(false)
    expect(g.push('soop', 'kim', 100, t + 800)).toBe(false)
    expect(g.push('soop', 'kim', 100, t + 900)).toBe(false)
    expect(g.push('soop', 'kim', 100, t + 1000)).toBe(true)   // 4번째는 짝이 없는 새 후원
  })

  it('both: 두 경로가 번갈아 와도 1:1 로만 짝지어진다', () => {
    const g = new DonationGate()
    expect(g.push('soop',   'kim', 100, 0)).toBe(true)
    expect(g.push('weflab', 'kim', 100, 100)).toBe(false)
    expect(g.push('soop',   'kim', 100, 1000)).toBe(true)    // 두 번째 실제 후원
    expect(g.push('weflab', 'kim', 100, 1100)).toBe(false)
  })

  it('both: 다른 개수·다른 후원자는 중복이 아님', () => {
    const g = new DonationGate()
    const t = 0
    expect(g.push('soop',   'kim', 100, t)).toBe(true)
    expect(g.push('weflab', 'kim', 200, t)).toBe(true)
    expect(g.push('weflab', 'lee', 100, t)).toBe(true)
  })

  it('소스가 하나로 고정되면 다른 경로는 버림 (중복 제거 없이 전부 통과)', () => {
    const g = new DonationGate()
    g.setSource('soop')
    expect(g.push('weflab', 'kim', 100, 0)).toBe(false)
    expect(g.push('soop',   'kim', 100, 0)).toBe(true)
    expect(g.push('soop',   'kim', 100, 10)).toBe(true)   // 같은 사람이 연속 후원 — 단일 소스면 그대로
  })

  it('0 이하 개수는 버림, 이벤트는 통과한 것만', () => {
    const g = new DonationGate()
    const seen: Array<[string, number]> = []
    g.on('balloon', (d: string, a: number) => seen.push([d, a]))
    expect(g.push('soop', 'kim', 0, 0)).toBe(false)
    g.push('soop', 'kim', 5, 0)
    expect(seen).toEqual([['kim', 5]])
  })
})
