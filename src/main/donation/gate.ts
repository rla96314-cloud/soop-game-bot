// 후원 입력 게이트 — SOOP 채팅과 위플랩 두 경로로 들어오는 별풍선을 하나로 합친다.
//
//  - source 설정: 'soop' | 'weflab' | 'both'
//    both 일 때는 같은 후원이 두 경로로 들어오므로, (후원자, 개수) 가 같은 건을 DEDUPE_MS 안에서
//    **다른 경로** 의 미짝 건과 1:1 로 짝지어 두 번째를 버린다. 같은 경로에서 같은 후원자가 같은 개수를
//    연달아 쏘는 건(실제로 흔함)은 짝이 없으므로 그대로 통과한다.
//  - 어느 경로를 쓰든 통계용 'raw' 이벤트는 그대로 내보내고, 게임 트리거용 'balloon' 만 거른다.
import { EventEmitter } from 'events'

export type DonationSource = 'soop' | 'weflab' | 'both'

export const DEDUPE_MS = 3000

export class DonationGate extends EventEmitter {
  private source: DonationSource = 'both'
  /** 아직 다른 경로의 짝을 못 만난 건들 */
  private pending: Array<{ key: string; from: 'soop' | 'weflab'; ts: number }> = []

  setSource(src: DonationSource) { this.source = src }
  getSource() { return this.source }

  /** 후원 1건 입력. 통과하면 true (게임 트리거 대상), 중복/비활성 경로면 false */
  push(from: 'soop' | 'weflab', donor: string, amount: number, now = Date.now()): boolean {
    if (!(amount > 0)) return false
    if (this.source !== 'both' && this.source !== from) return false

    if (this.source === 'both') {
      const key = `${donor.trim().toLowerCase()}|${amount}`
      this.pending = this.pending.filter(r => now - r.ts < DEDUPE_MS)
      const mate = this.pending.findIndex(r => r.key === key && r.from !== from)
      if (mate >= 0) { this.pending.splice(mate, 1); return false }   // 다른 경로로 이미 받은 같은 후원
      this.pending.push({ key, from, ts: now })
    }
    this.emit('balloon', donor, amount, from)
    return true
  }
}

export const donationGate = new DonationGate()
