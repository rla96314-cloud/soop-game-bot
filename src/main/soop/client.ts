import { EventEmitter } from 'events'
import WebSocket from 'ws'

/**
 * SOOP (구 아프리카TV) 채팅 WebSocket 클라이언트
 *
 * 실제 연결: 채널ID만으로 익명 접속해서 채팅/별풍선을 읽는다. (로그인/토큰 불필요)
 *   1) player_live_api.php 로 방송 접속정보(CHDOMAIN/CHPT/CHATNO) 획득
 *   2) wss://{CHDOMAIN}:{CHPT+1}/Websocket/{채널ID} 접속 (subprotocol: chat)
 *   3) CONNECT → JOIN 패킷 전송 후 채팅/별풍선 수신
 * 시뮬레이션: 로컬에서 랜덤 이벤트 생성 (설정에서 켰을 때만)
 *
 * 이벤트:
 *   'connected'                  - 연결 성공
 *   'disconnected'               - 연결 끊김
 *   'error'   (msg)              - 에러/안내 메시지
 *   'balloon' (username, amount) - 별풍선 수신
 *   'chat'    (username, message)- 채팅 메시지
 *   'enter'   (userId, userNick) - 입장 (현 프로토콜상 미발생 — 호환용)
 */

// ── 패킷 프로토콜 상수 ─────────────────────────────────────────────────────────
const STARTER = '\x1b\t'   // 패킷 시작 (ESC + TAB)
const SEP     = '\x0c'     // 필드 구분자

const CT = {
  PING:          '0000',
  CONNECT:       '0001',
  JOIN:          '0002',   // ENTER_CHAT_ROOM
  USER:          '0004',   // 입장/퇴장 (fields[1]='1' 입장, '-1' 퇴장)
  CHAT:          '0005',
  VIEWER:        '0127',   // 시청자 목록 + 팬클럽 등급(fw)
  TEXT_DONATION: '0018',   // 별풍선
  AD_BALLOON:    '0087',   // 광고 별풍선
  VIDEO_DONATION:'0105',   // 영상풍선
  EMOTICON:      '0109',
} as const

const LIVE_API_BASE = 'https://live.sooplive.co.kr'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

interface ChannelDetail {
  RESULT:   number
  CHDOMAIN: string
  CHPT:     string | number
  CHATNO:   string | number
  BJNICK?:  string
}

export class SoopClient extends EventEmitter {
  private ws:             WebSocket | null = null
  private simInterval:    ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer:      ReturnType<typeof setInterval> | null = null
  private joinTimer:      ReturnType<typeof setTimeout> | null = null
  private connected   = false
  private simMode     = false
  private channelId   = ''
  private chatNo      = ''
  private joined      = false
  private recvBuf:    Buffer = Buffer.alloc(0)
  private nickMap     = new Map<string, string>()   // userId → nick (입장 패킷에서 수집)

  // ── Connection ─────────────────────────────────────────────────────────────

  connect(opts: { channelId: string; userId: string; token: string; simulation: boolean }) {
    this.disconnect()
    this.simMode = !!opts.simulation

    if (this.simMode) {
      this.startSimulation()
      return
    }

    // 시뮬레이션이 꺼져 있으면 시뮬레이션으로 폴백하지 않음.
    // 채널 정보가 없으면 가짜 데이터를 만들지 말고 '연결 끊김' 상태를 유지한다.
    if (!opts.channelId) {
      this.emit('disconnected')
      return
    }

    this.channelId = opts.channelId.trim().toLowerCase()
    this.connectReal()
  }

  disconnect() {
    this.joined  = false
    this.recvBuf = Buffer.alloc(0)
    this.nickMap.clear()
    if (this.simInterval)    { clearTimeout(this.simInterval);      this.simInterval    = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer);   this.reconnectTimer = null }
    if (this.pingTimer)      { clearInterval(this.pingTimer);       this.pingTimer      = null }
    if (this.joinTimer)      { clearTimeout(this.joinTimer);        this.joinTimer      = null }
    if (this.ws) {
      try { this.ws.removeAllListeners(); this.ws.close() } catch {}
      this.ws = null
    }
    if (this.connected) {
      this.connected = false
      this.emit('disconnected')
    }
  }

  isConnected()  { return this.connected }
  isSimulation() { return this.simMode }

  // ── Real WebSocket ─────────────────────────────────────────────────────────

  private scheduleReconnect(delayMs = 15000) {
    if (this.simMode) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const jitter = Math.floor(Math.random() * 3000)   // API 과다호출 방지용 지터
    this.reconnectTimer = setTimeout(() => { if (!this.simMode) this.connectReal() }, delayMs + jitter)
  }

  private async fetchChannelDetail(): Promise<ChannelDetail | null> {
    const url  = `${LIVE_API_BASE}/afreeca/player_live_api.php?bjid=${this.channelId}`
    const body = new URLSearchParams({
      bid:         this.channelId,
      type:        'live',
      pwd:         '',
      player_type: 'html5',
      stream_type: 'common',
      quality:     'HD',
      mode:        'landing',
      from_api:    '0',
      is_revive:   'false',
    })
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':   UA,
        'Referer':      'https://play.sooplive.co.kr/',
      },
      body,
    })
    if (!res.ok) throw new Error(`라이브 API ${res.status}`)
    const json = await res.json() as { CHANNEL?: ChannelDetail }
    return json.CHANNEL ?? null
  }

  private async connectReal() {
    try {
      const ch = await this.fetchChannelDetail()
      if (!ch) {
        this.emit('error', '방송 정보를 가져오지 못했습니다 — 채널 ID를 확인하세요')
        this.scheduleReconnect()
        return
      }
      // RESULT: 1 = 방송 중. 그 외(0/-6 등)는 오프라인.
      if (Number(ch.RESULT) !== 1) {
        this.emit('error', '현재 방송 중이 아닙니다 — 방송 시작 시 자동 연결됩니다')
        this.scheduleReconnect()
        return
      }
      if (!ch.CHDOMAIN || !ch.CHPT || ch.CHATNO == null) {
        this.emit('error', '채팅 서버 정보를 가져오지 못했습니다 — 잠시 후 재시도')
        this.scheduleReconnect()
        return
      }

      this.chatNo = String(ch.CHATNO)
      const wsPort = Number(ch.CHPT) + 1
      const url    = `wss://${ch.CHDOMAIN.toLowerCase()}:${wsPort}/Websocket/${this.channelId}`

      this.ws = new WebSocket(url, ['chat'], {
        handshakeTimeout: 10000,
        headers: { 'User-Agent': UA, 'Origin': 'https://play.sooplive.co.kr' },
      })

      this.ws.on('open', () => {
        this.connected = true
        this.joined    = false
        this.recvBuf   = Buffer.alloc(0)
        this.nickMap.clear()
        this.emit('connected')
        this.send(this.makePacket(CT.CONNECT, `${SEP.repeat(3)}16${SEP}`))
        // 보통 CONNECT 응답을 받고 JOIN 하지만, 응답이 안 와도 입장하도록 폴백
        if (this.joinTimer) clearTimeout(this.joinTimer)
        this.joinTimer = setTimeout(() => this.sendJoin(), 2500)
        // keep-alive ping (60초)
        if (this.pingTimer) clearInterval(this.pingTimer)
        this.pingTimer = setInterval(() => this.send(this.makePacket(CT.PING, SEP)), 60000)
      })

      this.ws.on('message', (raw: Buffer) => this.onMessage(raw))

      this.ws.on('close', () => {
        if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
        const was = this.connected
        this.connected = false
        this.joined    = false
        if (was) this.emit('disconnected')
        this.scheduleReconnect(5000)
      })

      this.ws.on('error', (err) => {
        this.emit('error', err.message)
        // 'close'가 뒤이어 발생하며 재연결을 처리한다. 시뮬레이션 폴백 없음.
      })
    } catch (err) {
      this.emit('error', String(err instanceof Error ? err.message : err))
      this.scheduleReconnect()
    }
  }

  private send(packet: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(Buffer.from(packet, 'utf-8')) } catch {}
    }
  }

  private makePacket(type: string, payload: string): string {
    const len = Buffer.byteLength(payload, 'utf-8').toString().padStart(6, '0')
    return `${STARTER}${type}${len}00${payload}`
  }

  private sendJoin() {
    if (this.joinTimer) { clearTimeout(this.joinTimer); this.joinTimer = null }
    if (this.joined) return
    this.joined = true
    // 익명 입장: SEP + CHATNO + SEP*5
    this.send(this.makePacket(CT.JOIN, `${SEP}${this.chatNo}${SEP.repeat(5)}`))
  }

  /**
   * 길이 기반 프레이밍 — WS 프레임 경계가 패킷 경계와 일치하지 않을 수 있으므로
   * 누적 버퍼에서 완성된 패킷(STARTER + type4 + len6 + "00" + payload[len바이트])만 잘라 처리.
   */
  private onMessage(raw: Buffer) {
    this.recvBuf = this.recvBuf.length ? Buffer.concat([this.recvBuf, raw]) : raw

    while (this.recvBuf.length >= 14) {
      // STARTER(0x1b 0x09) 정렬 확인
      if (this.recvBuf[0] !== 0x1b || this.recvBuf[1] !== 0x09) {
        const idx = this.recvBuf.indexOf(0x1b, 1)
        if (idx === -1) { this.recvBuf = Buffer.alloc(0); return }
        this.recvBuf = this.recvBuf.subarray(idx)
        continue
      }
      const payloadLen = parseInt(this.recvBuf.toString('ascii', 6, 12), 10)
      if (Number.isNaN(payloadLen)) { this.recvBuf = this.recvBuf.subarray(1); continue }
      const total = 14 + payloadLen
      if (this.recvBuf.length < total) break          // 더 받을 때까지 대기
      const packet = this.recvBuf.subarray(0, total)
      this.recvBuf = this.recvBuf.subarray(total)
      this.handlePacket(packet)
    }
  }

  private handlePacket(packet: Buffer) {
    const type   = packet.toString('ascii', 2, 6)         // type 4글자는 ASCII 숫자
    const fields = packet.toString('utf-8').split(SEP)     // fields[0]=헤더, [1]부터 페이로드

    if (process.env.SOOP_DEBUG === '1') {
      console.log(`[PKT] type=${type} fields=${JSON.stringify(fields.slice(0, 8))}`)
    }

    switch (type) {
      case CT.CONNECT: {
        this.sendJoin()   // CONNECT 응답 → 채팅방 입장
        break
      }
      case CT.CHAT: {
        const message  = fields[1] ?? ''
        const userId   = fields[2] ?? ''
        const username = fields[6] || userId
        if (username && message && !message.startsWith('|')) {
          this.emit('chat', username, message, userId)
        }
        break
      }
      case CT.TEXT_DONATION: {
        // [1]=받는BJ, [2]=후원자ID, [3]=후원자닉, [4]=개수
        const donorNick = fields[3] || fields[2] || '익명'
        const amount    = parseInt(fields[4] ?? '0', 10) || 0
        if (amount > 0) this.emit('balloon', donorNick, amount)
        break
      }
      case CT.VIDEO_DONATION: {
        // 영상풍선은 인덱스가 +1 시프트: [3]=후원자ID, [4]=후원자닉, [5]=개수
        const donorNick = fields[4] || fields[3] || '익명'
        const amount    = parseInt(fields[5] ?? '0', 10) || 0
        if (amount > 0) this.emit('balloon', donorNick, amount)
        break
      }
      case CT.AD_BALLOON: {
        // 광고 별풍선: [4]=후원자닉, [10]=개수
        const donorNick = fields[4] || '익명'
        const amount    = parseInt(fields[10] ?? '0', 10) || 0
        if (amount > 0) this.emit('balloon', donorNick, amount)
        break
      }
      case CT.USER: {
        // 입장(fields[1]='1') — [2]부터 (아이디, 닉, 플래그) 반복. 퇴장('-1')은 무시.
        if (fields[1] === '1') {
          for (let i = 2; i + 1 < fields.length; i += 3) {
            const id   = this.stripDup(fields[i])
            const nick = this.stripDup(fields[i + 1]) || id
            if (!id) continue
            this.nickMap.set(id, nick)
            this.emit('enter', id, nick)
          }
          if (this.nickMap.size > 3000) this.nickMap.clear()   // 메모리 가드
        }
        break
      }
      case CT.VIEWER: {
        // 시청자 목록 + 팬클럽 등급: [1]=아이디, [2]='fw=N&afw=M', [3]=아이디, ...
        for (let i = 1; i + 1 < fields.length; i += 2) {
          const id = this.stripDup(fields[i])
          const m  = /fw=(-?\d+)/.exec(fields[i + 1] ?? '')
          const fw = m ? parseInt(m[1], 10) : -1
          if (id && fw >= 1) this.emit('fanclub', id, this.nickMap.get(id) || id, fw)
        }
        break
      }
      default:
        break
    }
  }

  // 중복 접속 표시 "(2)" 등을 제거해 실제 아이디/닉을 얻는다.
  private stripDup(s?: string): string {
    return (s ?? '').replace(/\(\d+\)$/, '').trim()
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
