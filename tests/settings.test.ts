import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/soop-test' } }))

import { sanitizeSettings, DEFAULTS, clampNum, LIMITS } from '../src/main/store/settings'
import { parseBalloonParts } from '../src/main/soop/client'
import { isAllowedWeflabUrl, parseDonationFrame } from '../src/main/weflab/watcher'

describe('sanitizeSettings', () => {
  it('포트 0·범위 밖은 기본값/경계로', () => {
    expect(sanitizeSettings({ overlay: { port: 0 } } as never).overlay.port).toBe(3939)
    expect(sanitizeSettings({ overlay: { port: 70000 } } as never).overlay.port).toBe(3939)
    expect(sanitizeSettings({ overlay: { port: 4000 } } as never).overlay.port).toBe(4000)
    expect(sanitizeSettings({ overlay: { port: 'abc' } } as never).overlay.port).toBe(3939)
  })

  it('게임 숫자 설정은 최소값 아래로 내려가지 않는다', () => {
    const s = sanitizeSettings({ games: {
      ladder:    { joinDuration: 0, maxParticipants: 0 },
      quiz:      { timeLimit: 0 },
      pickboard: { pickRows: 100, pickCols: 0 },
      number:    { minNumber: 50, maxNumber: 10, count: 0 },
    } } as never)
    expect(s.games.ladder.joinDuration).toBe(LIMITS.joinDuration.min)
    expect(s.games.ladder.maxParticipants).toBe(LIMITS.maxParticipants.min)
    expect(s.games.quiz.timeLimit).toBe(LIMITS.timeLimit.min)
    expect(s.games.pickboard.pickRows).toBe(10)
    expect(s.games.pickboard.pickCols).toBe(1)
    expect(s.games.number.minNumber).toBe(10)   // 뒤바뀐 범위는 정렬
    expect(s.games.number.maxNumber).toBe(50)
    expect(s.games.number.count).toBe(1)
  })

  it('음수 확률은 0으로, 이름은 trim', () => {
    const s = sanitizeSettings({ games: { roulette: { items: [{ name: ' a ', probability: -5 }] } } } as never)
    expect(s.games.roulette.items).toEqual([{ name: 'a', probability: 0 }])
  })

  it('복권 상품에 isWin 이 없으면 이름으로 채움', () => {
    const s = sanitizeSettings({ games: { lottery: { prizes: [{ name: '꽝', prob: 1, color: '#000000' }, { name: '당첨', prob: 1, color: '#000000' }] } } } as never)
    const p = s.games.lottery.prizes as unknown as Array<{ isWin: boolean }>
    expect(p.map(x => x.isWin)).toEqual([false, true])
  })

  it('알 수 없는 donationSource 는 both', () => {
    expect(sanitizeSettings({ soop: { donationSource: 'x' } } as never).soop.donationSource).toBe('both')
  })

  it('user 는 id 가 있어야만 유지되고 verifiedAt 은 숫자만', () => {
    expect(sanitizeSettings({ user: { id: '', name: 'x' } } as never).user).toBeNull()
    expect(sanitizeSettings({ user: { id: 'a', name: 'x', verifiedAt: 'now' } } as never).user).toEqual({ id: 'a', name: 'x', verifiedAt: undefined })
  })

  it('기본값은 그대로 통과', () => {
    const s = sanitizeSettings(structuredClone(DEFAULTS))
    expect(s.games.roulette.items).toEqual(DEFAULTS.games.roulette.items)
    expect(s.overlay.port).toBe(3939)
  })
})

describe('clampNum', () => {
  it('NaN·빈 문자열은 fallback', () => {
    expect(clampNum('', { min: 0, max: 10 }, 5)).toBe(0)   // Number('') = 0 → 범위 안
    expect(clampNum('abc', { min: 0, max: 10 }, 5)).toBe(5)
    expect(clampNum(undefined, { min: 0, max: 10 }, 5)).toBe(5)
    expect(clampNum(3.9, { min: 0, max: 10 }, 5)).toBe(3)
  })
})

describe('parseBalloonParts', () => {
  it('표준 위치(4)에서 개수를 읽는다', () => {
    expect(parseBalloonParts(['h', 'bj', 'uid', '닉', '100', 'x'])).toEqual({ nick: '닉', amount: 100 })
  })
  it('숫자만으로 된 닉네임을 개수로 오인하지 않는다', () => {
    expect(parseBalloonParts(['h', 'bj', 'uid', '1004', '', '77'])).toEqual({ nick: '1004', amount: 77 })
    expect(parseBalloonParts(['h', 'bj', 'uid', '1004', '', ''])).toBeNull()
  })
})

describe('weflab', () => {
  it('허용 URL 은 https weflab.com 만', () => {
    expect(isAllowedWeflabUrl('https://weflab.com/page/abc')).toBe(true)
    expect(isAllowedWeflabUrl('https://sub.weflab.com/x')).toBe(true)
    expect(isAllowedWeflabUrl('http://weflab.com/x')).toBe(false)
    expect(isAllowedWeflabUrl('https://evil.com/weflab.com')).toBe(false)
    expect(isAllowedWeflabUrl('file:///C:/x')).toBe(false)
    expect(isAllowedWeflabUrl('not a url')).toBe(false)
  })
  it('후원 프레임 파싱', () => {
    const d = parseDonationFrame('42["msg",{"type":"donation","data":{"type":"SENDBALLOON","value":"1,000","uname":"kim","msg":"hi"}}]')
    expect(d).toMatchObject({ donor: 'kim', balloons: 1000, amount: 0, message: 'hi' })
    expect(parseDonationFrame('2')).toBeNull()
    expect(parseDonationFrame('42["msg",{"type":"chat","data":{}}]')).toBeNull()
  })
})
