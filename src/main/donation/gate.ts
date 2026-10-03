// 후원 입력 게이트 — SOOP 채팅과 위플랩 두 경로로 들어오는 별풍선을 하나로 합친다.
//
//  - source 설정: 'soop' | 'weflab' | 'both'
//    both 일 때는 같은 후원이 두 경로로 들어오므로 (후원자, 개수) 키로 DEDUPE_MS 안의 중복을 버린다.
//  - 어느 경로를 쓰든 통계용 'raw' 이벤트는 그대로 내보내고, 게임 트리거용 'balloon' 만 거른다.
import { EventEmitter } from 'events'

export type DonationSource = 'soop' | 'weflab' | 'both'

export const DEDUPE_MS = 3000

export class DonationGate extends EventEmitter {
  private source: DonationSource = 'both'
  private recent: Array<{ key: string; ts: number }> = []

  setSource(src: DonationSource) { this.source = src }
  getSource() { return this.source }

  /** 후원 1건 입력. 통과하면 true (게임 트리거 대상), 중복/비활성 경로면 false */
  push(from: 'soop' | 'weflab', donor: string, amount: number, now = Date.now()): boolean {
    if (!(amount > 0)) return false
    if (this.source !== 'both' && this.source !== from) return false

    if (this.source === 'both') {
      const key = `${donor.trim().toLowerCase()}|${amount}`
      this.recent = this.recent.filter(r => now - r.ts < DEDUPE_MS)
      if (this.recent.some(r => r.key === key)) return false
      this.recent.push({ key, ts: now })
    }
    this.emit('balloon', donor, amount, from)
    return true
  }
}

export const donationGate = new DonationGate()
