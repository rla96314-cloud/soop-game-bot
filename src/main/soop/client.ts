import { EventEmitter } from 'events'
import WebSocket from 'ws'

/**
 * SOOP (구 아프리카TV) 채팅 WebSocket 클라이언트
 *
 * 실제 연결 (읽기 전용 게스트 — 채널 ID만 있으면 됨):
 *   1. player_live_api 로 채팅 서버 정보(CHDOMAIN/CHPT/CHATNO) 조회
 *   2. wss://{CHDOMAIN}:{CHPT+1}/Websocket/{채널ID} 접속 (subprotocol 'chat')
 *   3. LOGIN(0001) → JOIN(0002, CHATNO) → PING(0000) 주기 전송
 *   방송 중이 아니면 30초마다 재확인, 끊기면 지수 백오프(5s→60s)로 재접속.
 *   마지막 수신 후 STALE_MS 가 지나면 반쯤 끊긴 연결로 보고 강제 종료 → 재접속.
 *   ※ 채널 ID가 비어 있으면 대기(standby)만 하고 시뮬레이션은 돌리지 않는다.
 *     시뮬레이션은 opts.simulation 을 명시적으로 켠 경우(개발용)만.
 *
 * 이벤트:
 *   'connected'            - 연결 성공
 *   'disconnected'         - 연결 끊김
 *   'standby' (msg)        - 방송 대기/재접속 중 (오프라인 등)
 *   'resolved' (id)        - 닉네임 입력을 채널 아이디로 자동 변환함 (정확히 일치할 때만)
 *   'error'   (err)        - 에러 메시지
 *   'balloon' (username, amount) - 별풍선 수신
 *   'chat'    (username, message) - 채팅 메시지
 *   'enter'   (userId, userNick)  - 시청자 입장
 *   'viewers' (count)             - 현재 시청자 수 (chapi station API 15초 폴링)
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
const STALE_MS         = 60000   // 이 시간 동안 아무 패킷도 없으면 끊긴 것으로 간주
const OFFLINE_RETRY_MS = 30000
const RECONNECT_BASE   = 5000
const RECONNECT_MAX    = 60000
const VIEWER_POLL_MS   = 15000
const FETCH_TIMEOUT_MS = 10000

interface ChannelInfo { chdomain: string; chpt: number; chatno: string; bjnick: string }

// ESC + SVC(4자리) + 바디길이(6자리) + '00' + 바디
function makePacket(svc: number, body: string): string {
  const len = Buffer.byteLength(body, 'utf-8')
  return ESC + String(svc).padStart(4, '0') + String(len).padStart(6, '0') + '00' + body
}

/** 별풍선 패킷 필드 → (닉네임, 개수). 테스트용으로 분리 */
export function parseBalloonParts(parts: string[]): { nick: string; amount: number } | null {
  // parts[1]=방송자ID, parts[2]=후원자ID, parts[3]=후원자닉, parts[4]=개수
  const nick  = parts[3] || parts[2] || '알 수 없음'
  let amount  = parseInt(parts[4] ?? '', 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    // 필드 위치가 다른 변형 대비: 닉네임(3) 뒤의 첫 숫자 필드. 숫자만으로 된 닉네임("1004")을 개수로 읽지 않게 4부터
    amount = 0
    for (let i = 4; i < Math.min(parts.length, 9); i++) {
      const n = parseInt(parts[i], 10)
      if (Number.isFinite(n) && n > 0 && String(n) === parts[i]) { amount = n; break }
    }
  }
  return amount > 0 ? { nick, amount } : null
}

export class SoopClient extends EventEmitter {
  private ws:             WebSocket | null = null
  private simInterval:    ReturnType<typeof setTimeout>  | null = null
  private reconnectTimer: ReturnType<typeof setTimeout>  | null = null
  private pingTimer:      ReturnType<typeof setInterval> | null = null
  private viewerTimer:    ReturnType<typeof setInterval> | null = null
  private currentBj       = ''
  private connected  = false
  private simMode    = false
  private session    = 0   // connect/disconnect 세대 — 늦게 도착한 비동기 응답 무시용
  private resolvedId: string | null = null   // 닉네임 입력 시 자동 해석된 채널 아이디
  private reconnectAttempt = 0
  private lastRecvAt = 0

  // ── Connection ─────────────────────────────────────────────────────────────

  connect(opts: { channelId: string; userId: string; token: string; simulation: boolean }) {
    this.disconnect()
    const channelId = (opts.channelId ?? '').trim()

    if (opts.simulation) { this.startSimulation(); return }
    this.simMode = false

    if (!channelId) {
      // 가짜 별풍선이 실제 오버레이를 돌리면 안 된다 — 채널 ID 없으면 그냥 대기
      this.emit('standby', '채널 ID가 비어 있습니다 — 설정에서 방송자 ID를 입력하거나 SOOP 로그인을 하세요')
      return
    }

    this.resolvedId = null
    this.reconnectAttempt = 0
    this.connectReal(channelId, this.session)
  }

  disconnect() {
    this.session++
    this._clearTimers()
    if (this.ws) {
      this.ws.removeAllListeners()
      try { this.ws.terminate() } catch {}
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
    if (this.simInterval)    { clearTimeout(this.simInterval);     this.simInterval    = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer);  this.reconnectTimer = null }
    if (this.pingTimer)      { clearInterval(this.pingTimer);      this.pingTimer      = null }
    this._stopViewerPoll()
  }

  private _stopViewerPoll() {
    if (this.viewerTimer) { clearInterval(this.viewerTimer); this.viewerTimer = null }
  }

  private fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<T>
    })
  }

  // 방송국 API로 현재 시청자 수 조회 (방송 중이 아니면 broad = null)
  private async fetchViewers(bj: string): Promise<number | null> {
    try {
      const j = await this.fetchJson<{ broad?: { current_sum_viewer?: number } | null }>(
        `https://chapi.sooplive.co.kr/api/${encodeURIComponent(bj)}/station`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const n = j.broad?.current_sum_viewer
      return typeof n === 'number' ? n : null
    } catch { return null }
  }

  private startViewerPoll(bj: string) {
    this._stopViewerPoll()
    const tick = async () => { const n = await this.fetchViewers(bj); if (n !== null) this.emit('viewers', n) }
    tick()
    this.viewerTimer = setInterval(tick, VIEWER_POLL_MS)
  }

  // ── Real connection ─────────────────────────────────────────────────────────

  // 방송 정보 조회 → 방송 중이면 채팅 서버 접속 정보 반환, 아니면 null
  private async fetchChannelInfo(channelId: string): Promise<ChannelInfo | null> {
    const json = await this.fetchJson<{ CHANNEL?: Record<string, unknown> }>(
      `https://live.sooplive.co.kr/afreeca/player_live_api.php?bjid=${encodeURIComponent(channelId)}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `bid=${encodeURIComponent(channelId)}&type=live&player_type=html5`,
      },
    )
    const ch = json.CHANNEL
    if (!ch || Number(ch.RESULT) !== 1 || !ch.CHDOMAIN || !ch.CHATNO) return null
    return {
      chdomain: String(ch.CHDOMAIN).toLowerCase(),
      chpt:     Number(ch.CHPT) || 0,
      chatno:   String(ch.CHATNO),
      bjnick:   String(ch.BJNICK ?? ''),
    }
  }

  // 닉네임/스테이션명 입력 대비: SOOP 검색 API로 채널 아이디 해석.
  // 정확히 일치하는 결과만 채택 — 1순위 검색 결과를 쓰면 방송 전에 다른 BJ 채널로 붙어버린다.
  private async resolveByNick(keyword: string): Promise<string | null> {
    try {
      const json = await this.fetchJson<{ DATA?: Array<Record<string, unknown>> }>(
        `https://sch.sooplive.co.kr/api.php?m=bjSearch&v=1.0&c=UTF-8&szKeyword=${encodeURIComponent(keyword)}&nPageNo=1&nListCnt=10`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const kw = keyword.toLowerCase()
      const exact = (json.DATA ?? []).find(d =>
        String(d.user_nick ?? '').toLowerCase() === kw ||
        String(d.user_id   ?? '').toLowerCase() === kw)
      const id = String(exact?.user_id ?? '')
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
      this.emit('error', `방송 정보 조회 실패: ${String((err as Error).message ?? err)}`)
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

    this.currentBj = bj
    const url = `wss://${info.chdomain}:${info.chpt + 1}/Websocket/${bj}`
    const ws  = new WebSocket(url, ['chat'], { handshakeTimeout: 10000 })
    this.ws   = ws
    this.lastRecvAt = Date.now()

    ws.on('open', () => {
      if (session !== this.session) return
      ws.send(makePacket(SVC_LOGIN, F.repeat(3) + '16' + F))   // 게스트 로그인
    })

    ws.on('message', (raw: Buffer) => {
      if (session !== this.session) return
      this.lastRecvAt = Date.now()
      this.parsePacket(raw.toString('utf-8'), ws, info!)
    })

    ws.on('close', () => {
      if (session !== this.session) return
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
      this._stopViewerPoll()
      if (this.connected) {
        this.connected = false
        this.emit('disconnected')
      }
      const delay = Math.min(RECONNECT_MAX, RECONNECT_BASE * 2 ** this.reconnectAttempt)
      this.reconnectAttempt++
      this.emit('standby', `연결이 끊겼습니다 — ${Math.round(delay / 1000)}초 후 재접속`)
      this._scheduleReal(channelId, session, delay)
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
          // 핑은 보내기만 하고 응답을 확인하지 않으므로, 수신이 끊긴 지 오래면 반쯤 죽은 연결로 보고 끊는다
          if (Date.now() - this.lastRecvAt > STALE_MS) {
            this.emit('error', `${STALE_MS / 1000}초간 수신 없음 — 연결을 끊고 다시 붙습니다`)
            try { ws.terminate() } catch {}
            return
          }
          try { ws.send(makePacket(SVC_KEEPALIVE, F)) } catch {}
        }, PING_MS)
        if (!this.connected) {
          this.connected = true
          this.reconnectAttempt = 0
          this.emit('connected')
        }
        this.startViewerPoll(this.currentBj)
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
        const b = parseBalloonParts(parts)
        if (b) this.emit('balloon', b.nick, b.amount)
        break
      }

      case SVC_CHUSER: {
        // 입장 알림 — parts[1]='1'(입장), 이후 (유저ID, 닉네임, 플래그) 3개씩 반복
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

  // ── Simulation (개발용 — opts.simulation 을 명시적으로 켰을 때만) ──────────

  private readonly FAKE_USERS = [
    '도라이몽','별하늘','게임사랑','행운아','바다소년','랜더걸','치킨좋아',
    '하늘바람','달빛소녀','수박좋아','코딩왕자','마법사','핑크별','구름이',
  ]
  private readonly CHAT_MSGS = ['!룰렛','!참가','!슬롯','재밌다ㅋㅋ','오늘도 화이팅!','룰렛 해주세요!','저도 참가요!','대박!!']

  private startSimulation() {
    this.simMode   = true
    this.connected = true
    this.emit('connected')

    const tick = () => {
      const user = this.FAKE_USERS[Math.floor(Math.random() * this.FAKE_USERS.length)]
      if (Math.random() < 0.25) {
        const amount = [10, 30, 50, 100, 200, 500, 1000][Math.floor(Math.random() * 7)]
        this.emit('balloon', user, amount)
        this.emit('chat', user, `별풍선 ${amount}개 후원!`)
      } else {
        this.emit('chat', user, this.CHAT_MSGS[Math.floor(Math.random() * this.CHAT_MSGS.length)])
      }
      this.simInterval = setTimeout(tick, 3000 + Math.random() * 5000)
    }
    this.simInterval = setTimeout(tick, 1000)
    this.viewerTimer = setInterval(() => this.emit('viewers', 80 + Math.floor(Math.random() * 40)), VIEWER_POLL_MS)
    this.emit('viewers', 97)
  }
}

export const soopClient = new SoopClient()
