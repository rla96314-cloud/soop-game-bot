import { EventEmitter } from 'events'
import WebSocket from 'ws'

/**
 * SOOP (구 아프리카TV) 채팅 WebSocket 클라이언트
 *
 * 실제 연결 (읽기 전용 게스트 — 채널 ID만 있으면 됨):
 *   1. player_live_api 로 채팅 서버 정보(CHDOMAIN/CHPT/CHATNO) 조회
 *   2. wss://{CHDOMAIN}:{CHPT+1}/Websocket/{채널ID} 접속 (subprotocol 'chat')
 *   3. LOGIN(0001) → JOIN(0002, CHATNO) → PING(0000) 주기 전송
 *   방송 중이 아니면 30초마다 재확인, 끊기면 5초 후 재접속.
 *   ※ 연결 실패 시 시뮬레이션으로 폴백하지 않음 (명시적으로 켠 경우만 시뮬레이션)
 *
 * 이벤트:
 *   'connected'            - 연결 성공
 *   'disconnected'         - 연결 끊김
 *   'standby' (msg)        - 방송 대기/재접속 중 (오프라인 등)
 *   'resolved' (id)        - 닉네임 입력을 채널 아이디로 자동 변환함
 *   'error'   (err)        - 에러 메시지
 *   'balloon' (username, amount) - 별풍선 수신
 *   'chat'    (username, message) - 채팅 메시지
 *   'enter'   (userId, userNick)  - 시청자 입장
 */

const F   = '\x0c'
const ESC = '\x1b\t'

// SOOP 채팅 서비스 코드
const SVC_KEEPALIVE = 0
const SVC_LOGIN     = 1
const SVC_JOIN      = 2
const SVC_CHUSER    = 4   // 입장/퇴장
const SVC_CHAT      = 5
const SVC_BALLOON   = 18  // 별풍선

const PING_MS          = 20000
const OFFLINE_RETRY_MS = 30000
const RECONNECT_MS     = 5000

interface ChannelInfo { chdomain: string; chpt: number; chatno: string; bjnick: string }

// ESC + SVC(4자리) + 바디길이(6자리) + '00' + 바디
function makePacket(svc: number, body: string): string {
  const len = Buffer.byteLength(body, 'utf-8')
  return ESC + String(svc).padStart(4, '0') + String(len).padStart(6, '0') + '00' + body
}

export class SoopClient extends EventEmitter {
  private ws:             WebSocket | null = null
  private simInterval:    ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout>  | null = null
  private pingTimer:      ReturnType<typeof setInterval> | null = null
  private connected  = false
  private simMode    = true
  private session    = 0   // connect/disconnect 세대 — 늦게 도착한 비동기 응답 무시용
  private resolvedId: string | null = null   // 닉네임 입력 시 자동 해석된 채널 아이디

  // ── Connection ─────────────────────────────────────────────────────────────

  connect(opts: { channelId: string; userId: string; token: string; simulation: boolean }) {
    this.disconnect()
    const channelId = (opts.channelId ?? '').trim()
    this.simMode = opts.simulation || !channelId

    if (this.simMode) {
      if (!opts.simulation && !channelId) {
        this.emit('error', '채널 ID가 비어 있어 시뮬레이션 모드로 시작합니다 — 설정에서 채널 ID를 입력하세요')
      }
      this.startSimulation()
      return
    }

    this.resolvedId = null
    this.connectReal(channelId, this.session)
  }

  disconnect() {
    this.session++
    this._clearTimers()
    if (this.ws) {
      this.ws.removeAllListeners()
      try { this.ws.close() } catch {}
      this.ws = null
    }
    if (this.connected) {
      this.connected = false
      this.emit('disconnected')
    }
  }

  isConnected()  { return this.connected }
  isSimulation() { return this.simMode }

  private _clearTimers() {
    if (this.simInterval)    { clearInterval(this.simInterval);    this.simInterval    = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer);  this.reconnectTimer = null }
    if (this.pingTimer)      { clearInterval(this.pingTimer);      this.pingTimer      = null }
  }

  // ── Real connection ─────────────────────────────────────────────────────────

  // 방송 정보 조회 → 방송 중이면 채팅 서버 접속 정보 반환, 아니면 null
  private async fetchChannelInfo(channelId: string): Promise<ChannelInfo | null> {
    const res = await fetch(
      `https://live.sooplive.co.kr/afreeca/player_live_api.php?bjid=${encodeURIComponent(channelId)}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `bid=${encodeURIComponent(channelId)}&type=live&player_type=html5`,
      },
    )
    if (!res.ok) throw new Error(`player_live_api HTTP ${res.status}`)
    const json = await res.json() as { CHANNEL?: Record<string, unknown> }
    const ch = json.CHANNEL
    if (!ch || Number(ch.RESULT) !== 1 || !ch.CHDOMAIN || !ch.CHATNO) return null
    return {
      chdomain: String(ch.CHDOMAIN).toLowerCase(),
      chpt:     Number(ch.CHPT) || 0,
      chatno:   String(ch.CHATNO),
      bjnick:   String(ch.BJNICK ?? ''),
    }
  }

  // 닉네임/스테이션명 입력 대비: SOOP 검색 API로 채널 아이디 해석
  private async resolveByNick(keyword: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://sch.sooplive.co.kr/api.php?m=bjSearch&v=1.0&c=UTF-8&szKeyword=${encodeURIComponent(keyword)}&nPageNo=1&nListCnt=5`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      )
      if (!res.ok) return null
      const json = await res.json() as { DATA?: Array<Record<string, unknown>> }
      const list = json.DATA ?? []
      if (!list.length) return null
      const kw = keyword.toLowerCase()
      const exact = list.find(d =>
        String(d.user_nick ?? '').toLowerCase() === kw ||
        String(d.user_id   ?? '').toLowerCase() === kw)
      const id = String((exact ?? list[0]).user_id ?? '')
      return id || null
    } catch { return null }
  }

  private async connectReal(channelId: string, session: number) {
    let bj = this.resolvedId ?? channelId
    let info: ChannelInfo | null = null
    try {
      info = await this.fetchChannelInfo(bj)
    } catch (err) {
      if (session !== this.session) return
      this.emit('error', `방송 정보 조회 실패: ${String(err)}`)
      this.emit('standby', `방송 정보 조회 실패 — ${OFFLINE_RETRY_MS / 1000}초 후 재시도`)
      this._scheduleReal(channelId, session, OFFLINE_RETRY_MS)
      return
    }
    if (session !== this.session) return

    // 방송 정보가 없으면 입력값이 닉네임일 수 있음 → 아이디 해석 후 1회 재시도
    if (!info && !this.resolvedId) {
      const found = await this.resolveByNick(channelId)
      if (session !== this.session) return
      if (found) {
        this.resolvedId = found
        if (found.toLowerCase() !== channelId.toLowerCase()) {
          this.emit('error', `'${channelId}'은(는) 닉네임입니다 — 채널 아이디 '${found}'(으)로 연결합니다`)
          this.emit('resolved', found)
        }
        bj = found
        try { info = await this.fetchChannelInfo(found) } catch {}
        if (session !== this.session) return
      }
    }

    if (!info) {
      this.emit('standby', `'${bj}' 방송 대기 중 — ${OFFLINE_RETRY_MS / 1000}초마다 재확인`)
      this._scheduleReal(channelId, session, OFFLINE_RETRY_MS)
      return
    }

    const url = `wss://${info.chdomain}:${info.chpt + 1}/Websocket/${bj}`
    const ws  = new WebSocket(url, ['chat'], { handshakeTimeout: 10000 })
    this.ws   = ws

    ws.on('open', () => {
      if (session !== this.session) return
      ws.send(makePacket(SVC_LOGIN, F.repeat(3) + '16' + F))   // 게스트 로그인
    })

    ws.on('message', (raw: Buffer) => {
      if (session !== this.session) return
      this.parsePacket(raw.toString('utf-8'), ws, info!)
    })

    ws.on('close', () => {
      if (session !== this.session) return
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
      if (this.connected) {
        this.connected = false
        this.emit('disconnected')
      }
      this.emit('standby', `연결이 끊겼습니다 — ${RECONNECT_MS / 1000}초 후 재접속`)
      this._scheduleReal(channelId, session, RECONNECT_MS)
    })

    ws.on('error', (err) => {
      if (session !== this.session) return
      this.emit('error', `채팅 서버 오류: ${err.message}`)
      // close 이벤트가 이어서 재접속을 처리
    })
  }

  private _scheduleReal(channelId: string, session: number, delay: number) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      if (session === this.session) this.connectReal(channelId, session)
    }, delay)
  }

  private parsePacket(str: string, ws: WebSocket, info: ChannelInfo) {
    if (str.length < 14) return
    const svc   = parseInt(str.substring(2, 6), 10)
    const parts = str.split(F)

    if (process.env.SOOP_DEBUG === '1') {
      console.log(`[PKT] svc=${svc} parts=${JSON.stringify(parts.slice(0, 8))}`)
    }

    switch (svc) {
      case SVC_LOGIN: {
        // 로그인 응답 → 채팅방 입장 + 킵얼라이브 시작
        ws.send(makePacket(SVC_JOIN, F + info.chatno + F.repeat(5)))
        if (this.pingTimer) clearInterval(this.pingTimer)
        this.pingTimer = setInterval(() => {
          try { ws.send(makePacket(SVC_KEEPALIVE, F)) } catch {}
        }, PING_MS)
        if (!this.connected) {
          this.connected = true
          this.emit('connected')
        }
        break
      }

      case SVC_CHAT: {
        // parts[1]=메시지, parts[2]=유저ID, parts[6]=닉네임
        const message = parts[1] ?? ''
        const userId  = parts[2] ?? ''
        const nick    = parts[6] || userId
        if (nick && message) this.emit('chat', nick, message)
        break
      }

      case SVC_BALLOON: {
        // parts[1]=방송자ID, parts[2]=후원자ID, parts[3]=후원자닉, parts[4]=개수
        const nick  = parts[3] || parts[2] || '알 수 없음'
        let amount  = parseInt(parts[4] ?? '', 10)
        if (!isFinite(amount) || amount <= 0) {
          // 필드 위치가 다른 변형 대비: 후원자 뒤 첫 숫자 필드 사용
          for (let i = 3; i < Math.min(parts.length, 9); i++) {
            const n = parseInt(parts[i], 10)
            if (isFinite(n) && n > 0 && String(n) === parts[i]) { amount = n; break }
          }
        }
        if (amount > 0) this.emit('balloon', nick, amount)
        break
      }

      case SVC_CHUSER: {
        // 입장 알림 — parts[1]='1'(입장), 이후 (유저ID, 닉네임, 플래그) 3개씩 반복
        // 실측: ["hdr","1","id1","닉1","65540|33554432","id2","닉2","플래그2",...]
        if (parts[1] === '1') {
          for (let i = 2; i + 1 < parts.length; i += 3) {
            const userId = (parts[i] ?? '').replace(/\(\d+\)$/, '')   // "id(2)" 세션 접미사 제거
            const nick   = parts[i + 1] || userId
            if (userId && userId.length > 1) this.emit('enter', userId, nick)
          }
        }
        break
      }
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
