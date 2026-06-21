import { EventEmitter } from 'events'
import WebSocket from 'ws'

/**
 * SOOP (구 아프리카TV) 채팅 WebSocket 클라이언트
 *
 * 실제 연결: SOOP 채팅 서버 (wss://chat.sooplive.co.kr:9820)
 * 시뮬레이션: 로컬에서 랜덤 이벤트 생성
 *
 * 이벤트:
 *   'connected'            - 연결 성공
 *   'disconnected'         - 연결 끊김
 *   'error'   (err)        - 에러
 *   'balloon' (username, amount) - 별풍선 수신
 *   'chat'    (username, message) - 채팅 메시지
 */
export class SoopClient extends EventEmitter {
  private ws:          WebSocket | null = null
  private simInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected   = false
  private simMode     = true

  // ── Connection ─────────────────────────────────────────────────────────────

  connect(opts: { channelId: string; userId: string; token: string; simulation: boolean }) {
    this.disconnect()
    this.simMode = opts.simulation || !opts.channelId

    if (this.simMode) {
      this.startSimulation()
      return
    }

    this.connectReal(opts)
  }

  disconnect() {
    if (this.simInterval) { clearInterval(this.simInterval);   this.simInterval   = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    if (this.connected) {
      this.connected = false
      this.emit('disconnected')
    }
  }

  isConnected() { return this.connected }
  isSimulation() { return this.simMode }

  // ── Real WebSocket ─────────────────────────────────────────────────────────

  private connectReal(opts: { channelId: string; userId: string; token: string }) {
    try {
      // SOOP chat WebSocket endpoint
      const url = `wss://chat.sooplive.co.kr:9820`
      this.ws   = new WebSocket(url, { handshakeTimeout: 10000 })

      this.ws.on('open', () => {
        // Send login packet
        // SOOP packet format: service(2B) + type(2B) + reserved(4B) + datalen(4B) + data
        this.sendPacket(this.ws!, 1, 0,
          `\x00${opts.channelId}\x0c${opts.userId}\x0c${opts.token}\x0c\x0c`)
        this.connected = true
        this.emit('connected')
      })

      this.ws.on('message', (raw: Buffer) => {
        this.parsePacket(raw)
      })

      this.ws.on('close', () => {
        this.connected = false
        this.emit('disconnected')
        // Auto-reconnect after 5s
        this.reconnectTimer = setTimeout(() => this.connectReal(opts), 5000)
      })

      this.ws.on('error', (err) => {
        this.emit('error', err.message)
        // Fall back to simulation after connection error
        this.startSimulation()
      })
    } catch (err) {
      this.emit('error', String(err))
      this.startSimulation()
    }
  }

  private sendPacket(ws: WebSocket, service: number, type: number, data: string) {
    const dataBuf = Buffer.from(data, 'utf-8')
    const header  = Buffer.alloc(12)
    header.writeUInt16BE(service, 0)
    header.writeUInt16BE(type,    2)
    header.writeUInt32BE(0,       4)
    header.writeUInt32BE(dataBuf.length, 8)
    const tail = Buffer.from([0x0d, 0x0a])
    ws.send(Buffer.concat([header, dataBuf, tail]))
  }

  private parsePacket(raw: Buffer) {
    if (raw.length < 12) return
    const service = raw.readUInt16BE(0)
    const type    = raw.readUInt16BE(2)
    const len     = raw.readUInt32BE(8)
    const data    = raw.slice(12, 12 + len).toString('utf-8')
    const fields  = data.split('\x0c')

    // SENDMSG (chat)
    if (service === 1 && type === 5) {
      const username = fields[0] ?? '알 수 없음'
      const message  = fields[1] ?? ''
      if (username && message) this.emit('chat', username, message)
    }
    // SENDBALLOON (별풍선)
    if (service === 1 && type === 18) {
      const username = fields[0] ?? '알 수 없음'
      const amount   = parseInt(fields[1] ?? '0', 10) || 0
      if (username && amount) this.emit('balloon', username, amount)
    }
  }

  // ── Simulation ────────────────────────────────────────────────────────────

  private readonly FAKE_USERS = [
    '도라이몽','별하늘','게임사랑','행운아','바다소년','랜더걸','치킨좋아',
    '하늘바람','달빛소녀','수박좋아','코딩왕자','마법사','핑크별','구름이',
    '불꽃이','달팽이','사탕발림','은하수','파란하늘','노을빛'
  ]

  private readonly CHAT_MSGS = [
    '!룰렛','!뽑기','!참가','!공격','!슬롯',
    '재밌다ㅋㅋ','오늘도 화이팅!','룰렛 해주세요!','저도 참가요!',
    '보스 잡자!','대박!!','와 진짜 재밌다','다음 게임은 퀴즈!',
  ]

  private startSimulation() {
    this.simMode   = true
    this.connected = true
    this.emit('connected')

    // Randomized events every 3-8 seconds
    const tick = () => {
      const roll = Math.random()

      if (roll < 0.25) {
        // 별풍선 이벤트 (25% 확률)
        const user   = this.FAKE_USERS[Math.floor(Math.random() * this.FAKE_USERS.length)]
        const amount = [10, 30, 50, 100, 200, 500, 1000][Math.floor(Math.random() * 7)]
        this.emit('balloon', user, amount)
        this.emit('chat', user, `별풍선 ${amount}개 후원!`)
      } else {
        // 채팅 이벤트
        const user = this.FAKE_USERS[Math.floor(Math.random() * this.FAKE_USERS.length)]
        const msg  = this.CHAT_MSGS[Math.floor(Math.random() * this.CHAT_MSGS.length)]
        this.emit('chat', user, msg)
      }

      // 다음 이벤트까지 3~8초 랜덤 대기
      this.simInterval = setTimeout(tick, 3000 + Math.random() * 5000) as unknown as ReturnType<typeof setInterval>
    }

    // 첫 이벤트는 1초 후
    this.simInterval = setTimeout(tick, 1000) as unknown as ReturnType<typeof setInterval>
  }
}

export const soopClient = new SoopClient()
