// ============================================================
//  위플랩 감시기 — CDP 기반 (weflab-obs-trigger / weflab-vmix-slot 검증 로직 이식)
//
//  감지 경로 2개:
//   1) socket.io WebSocket 프레임 캡처 (webContents.debugger/CDP)
//      → 후원 이벤트(별풍선·금액·후원자·메시지) 파싱 → 'donation' 이벤트
//      → 최근 후원자 닉네임을 룰렛 결과에 붙임
//   2) 페이지에 MutationObserver 주입
//      → 새 룰렛(.roulette_wrap) 등장 = 새 스핀 단위로 발화 (연속 같은 결과도 매번 감지)
//      → 장식 요소(눈송이 등)·회전 띠(roulette_list) 제외하고 당첨칸 텍스트만 추출
//      → 'result' (text, nick) 이벤트
//
//  이벤트:
//   'result'   (text, nick) - 룰렛 당첨 결과
//   'donation' (WeflabDonation) - 후원 수신
//   'loaded'   - 페이지 로드 완료
//   'retrying' (msg) - 재연결 시도 중
//   'error'    (msg) - 오류
// ============================================================
import { BrowserWindow } from 'electron'
import { EventEmitter }   from 'events'

const SETTLE_MS       = 1200    // 스핀 멈춘 뒤 결과 확정까지 디바운스
const RETRY_MS        = 5000    // 로드 실패 시 재시도 간격
const IDLE_RESTART_MS = 120000  // WS 프레임이 이 시간 동안 없으면 새로고침
const DONOR_WINDOW_MS = 60000   // 룰렛 결과에 붙일 최근 후원자 유효 시간

export interface WeflabDonation {
  ts:       number
  event:    string   // 예: 'SENDBALLOON'
  donor:    string
  balloons: number
  amount:   number
  message:  string
}

// 별풍선으로 취급할 후원 type 문자열 (weflab-obs-trigger/parse.js와 동일)
const BALLOON_TYPES = ['sendballoon', 'balloon', '별풍선', 'star', 'adballoon']

/** 허용하는 위플랩 URL — 임의 URL 을 숨김 창에서 열지 않는다 */
export function isAllowedWeflabUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname === 'weflab.com' || u.hostname.endsWith('.weflab.com'))
  } catch { return false }
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[, ]/g, '').replace(/원|개|won|krw/gi, '')
    const n = Number(cleaned)
    if (isFinite(n) && cleaned !== '') return n
  }
  return 0
}

// socket.io 텍스트 프레임 → 후원 이벤트 | null
// weflab 표준 형태: 42["msg",{ type:"donation", data:{ platform, type, value, uname, uid, msg } }]
export function parseDonationFrame(raw: string): WeflabDonation | null {
  if (!/^4[0-9]/.test(raw)) return null
  const i = raw.indexOf('[')
  if (i < 0) return null
  try {
    const arr = JSON.parse(raw.slice(i))
    if (!Array.isArray(arr) || arr.length < 2) return null
    const payload = arr.length > 2 ? arr.slice(1) : arr[1]
    const body    = Array.isArray(payload) ? payload[0] : payload
    if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') return null
    if (!String(body.type ?? '').toLowerCase().includes('donation')) return null // 채팅/시스템 무시
    const d     = body.data
    const dType = String(d.type ?? '')
    const val   = toNum(d.value)
    const isBalloon = BALLOON_TYPES.some(t => dType.toLowerCase().includes(t))
    return {
      ts:       Date.now(),
      event:    dType || String(body.type),
      donor:    String(d.uname ?? d.uid ?? d.nickname ?? '').trim(),
      balloons: isBalloon ? val : 0,
      amount:   isBalloon ? 0 : val,
      message:  String(d.msg ?? d.message ?? '').trim(),
    }
  } catch { return null }
}

// 페이지에 주입할 감지 스크립트 (weflab-vmix-slot/detector.js pageObserver 이식)
//  - 결과는 CDP 바인딩 __weflabEmit 으로 전달, 없으면 __weflabQueue 에 적재(폴백)
const OBSERVER_SCRIPT = `(function(){
  if (window.__wfActive) return 'already';
  window.__wfActive = true;

  // CPU 절약: 끊임없이 도는 장식 애니메이션 제거 (감지와 무관)
  try {
    if (!document.getElementById('__wfNoDecor')) {
      var st = document.createElement('style');
      st.id = '__wfNoDecor';
      st.textContent = '.snow_effect,.snow_effect_box,.wave_particle,.leaf,.dot{display:none!important}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

  var clean = function(s){ return (s || '').replace(/\\s+/g, ' ').trim(); };

  // 장식 + 휠 전체(roulette_list=회전 띠)는 결과 아님 → 제외. 당첨칸은 .roulette.result
  var DECOR = /\\b(snow_effect|snow_effect_box|wave_particle|leaf|dot|frame_box|inner_bg|btns|view_box|icon_platform|toggle_box|roulette_list)\\b/;
  function isDecor(el){
    for (var c = el; c && c.nodeType === 1; c = c.parentElement) {
      if (DECOR.test(String(c.className || ''))) return true;
    }
    return false;
  }
  function textExcluding(el){
    if (!el) return '';
    var s = '';
    el.childNodes.forEach(function(n){
      if (n.nodeType === 3) s += n.textContent;
      else if (n.nodeType === 1 && !DECOR.test(String(n.className || ''))) s += textExcluding(n);
    });
    return s;
  }
  function readResultText(){
    var win = document.querySelector('.roulette_area .roulette.result, .roulette.result, .roulette_result');
    return clean(win && textExcluding(win));
  }

  // 닉네임 DOM 폴백 (메인은 WS uname 사용). 애니메이션 중복("닉 닉님") 정리.
  function dedupHalf(s){
    s = (s || '').trim();
    if (s.length >= 2 && s.length % 2 === 0) {
      var h = s.slice(0, s.length / 2);
      if (h === s.slice(s.length / 2)) return h.trim();
    }
    var w = s.split(/\\s+/);
    if (w.length >= 2 && w.length % 2 === 0) {
      var half = w.length / 2;
      if (w.slice(0, half).join(' ') === w.slice(half).join(' ')) return w.slice(0, half).join(' ');
    }
    return s;
  }
  function readNick(){
    var dw = document.querySelector('.page_area.alert .donation_wrap');
    if (!dw) return '';
    var nameEl = dw.querySelector('.name');
    if (nameEl) { var t = clean(textExcluding(nameEl)); if (t) return dedupHalf(t); }
    var valEl = dw.querySelector('.text.val') || dw.querySelector('.val');
    if (valEl) {
      var tv = clean(textExcluding(valEl));
      var m = tv.match(/^(.+?)\\s+\\1님/);
      if (m) return m[1];
      var m2 = tv.match(/^(.+?)님/);
      if (m2) return dedupHalf(m2[1].trim());
    }
    return '';
  }

  function send(text, nick){
    var msg = JSON.stringify({ text: text, nick: nick });
    if (typeof window.__weflabEmit === 'function') window.__weflabEmit(msg);
    else (window.__weflabQueue = window.__weflabQueue || []).push(msg);
  }

  // 스핀 단위 디바운스: 변화가 멈추면 확정, 새 스핀이면 다시 발화
  var settleTimer = null;
  var roundFired = true;
  function scheduleSettle(){
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function(){
      if (roundFired) return;
      var t = readResultText();
      if (!t) return;
      roundFired = true;
      send(t, readNick());
    }, ${SETTLE_MS});
  }

  var root = document.querySelector('.page_area.alert') || document.body;
  var observer = new MutationObserver(function(mutations){
    var relevant = false;
    for (var i = 0; i < mutations.length; i++) {
      var mut = mutations[i];
      if (isDecor(mut.target)) continue;
      if (mut.addedNodes) mut.addedNodes.forEach(function(node){
        if (!node || node.nodeType !== 1 || isDecor(node)) return;
        relevant = true;
        var cls = String(node.className || '');
        // 새 룰렛/결과 추가 = 새 스핀 → 발화 가능 상태로 리셋 (연속 같은 칸도 매번)
        if (/roulette_wrap/.test(cls) ||
            (node.querySelector && node.querySelector('.roulette_wrap, .roulette.result'))) {
          roundFired = false;
        }
      });
      if (mut.type === 'characterData' || mut.type === 'attributes') relevant = true;
    }
    if (relevant) scheduleSettle();
  });
  observer.observe(root, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'style'],
  });
  return 'ok';
})()`

export class WeflabWatcher extends EventEmitter {
  private win:           BrowserWindow | null = null
  private retryTimer:    ReturnType<typeof setTimeout>  | null = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private queueTimer:    ReturnType<typeof setInterval> | null = null
  private _url           = ''
  private _active        = false  // stop()이 명시적으로 호출됐는지 여부
  private cdpOk          = false
  private lastActivityAt = 0
  private lastDonor: { uname: string; time: number } | null = null

  get url()       { return this._url }
  get isRunning() { return this._active && this.win !== null && !this.win.isDestroyed() }

  /** 반환: 시작했으면 null, 거부했으면 이유 */
  start(url: string): string | null {
    if (!isAllowedWeflabUrl(url)) return '위플랩 URL 은 https://weflab.com/... 형식만 사용할 수 있습니다'
    this.stop()
    this._url    = url
    this._active = true
    this.lastDonor = null
    this._launch()
    return null
  }

  stop() {
    this._active = false
    this._url    = ''
    this._clearTimers()
    this._destroyWin()
  }

  private _destroyWin() {
    const w = this.win
    this.win = null
    if (w && !w.isDestroyed()) {
      // destroy() 도 'closed' 를 발생시킨다 — 우리가 닫는 창의 closed 가 재시도를 예약하지 않게 리스너를 먼저 뗀다
      w.removeAllListeners('closed')
      try { w.webContents.debugger.detach() } catch {}
      w.destroy()
    }
  }

  private _launch() {
    if (!this._active) return
    this._clearRetry()
    this._destroyWin()

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration:     false,
        contextIsolation:    true,
        sandbox:             true,
        javascript:          true,
        backgroundThrottling: false,   // 숨김 창에서도 타이머/애니메이션 유지
        partition:           'persist:weflab',   // 메인 창(SOOP 로그인 쿠키)과 세션 분리
      },
    })
    this.win = win
    const wc = win.webContents
    // 이 창의 이벤트인지 확인 — 이전 창의 늦은 이벤트가 새 창 상태를 덮어쓰지 않게
    const mine = () => this.win === win

    wc.setWindowOpenHandler(() => ({ action: 'deny' }))

    // CDP: socket.io 웹소켓 프레임 캡처 + 결과 바인딩
    this.cdpOk = false
    try {
      wc.debugger.attach('1.3')
      wc.debugger.sendCommand('Network.enable').catch(() => {})
      wc.debugger.sendCommand('Runtime.enable').catch(() => {})
      wc.debugger.sendCommand('Runtime.addBinding', { name: '__weflabEmit' }).catch(() => {})
      wc.debugger.on('message', (_e, method, params: Record<string, any>) => {
        if (!mine()) return
        if (method === 'Network.webSocketFrameReceived') {
          this._handleFrame(String(params?.response?.payloadData ?? ''))
        } else if (method === 'Runtime.bindingCalled' && params?.name === '__weflabEmit') {
          this._handleResultMessage(String(params?.payload ?? ''))
        }
      })
      this.cdpOk = true
    } catch (e) {
      // CDP 실패 시 큐 폴링 폴백으로 동작
      this.emit('error', `CDP 연결 실패 (${String(e)}) — 폴백 모드로 동작`)
    }

    wc.on('did-finish-load', () => {
      if (!mine()) return
      this.emit('loaded')
      this.lastActivityAt = Date.now()
      wc.executeJavaScript(OBSERVER_SCRIPT, true).catch(() => {})
      if (!this.cdpOk) this._startQueuePoll()
    })

    wc.on('did-fail-load', (_e, code, desc, _validatedUrl, isMainFrame) => {
      if (!mine()) return
      // -3 = aborted (탐색 중 새 요청으로 취소) → 무시. 서브프레임(iframe) 실패도 무시.
      if (code === -3 || !isMainFrame) return
      this.emit('error', `페이지 로드 실패: ${desc} (${code}) — ${RETRY_MS / 1000}초 후 재시도`)
      this._scheduleRetry()
    })

    // 렌더러 크래시 복구
    wc.on('render-process-gone', (_e, details) => {
      if (!mine() || !this._active) return
      this.emit('error', `렌더러 종료 (${details.reason}) — 재시도`)
      this._scheduleRetry()
    })

    // 창이 예기치않게 닫혔을 때 재연결 (우리가 destroy 하는 경우는 _destroyWin 에서 리스너를 떼므로 오지 않음)
    win.on('closed', () => {
      if (!mine()) return
      this.win = null
      if (this._active) {
        this.emit('error', '창이 닫혔습니다 — 재연결 시도 중')
        this._scheduleRetry()
      }
    })

    win.loadURL(this._url).catch(err => {
      if (!mine()) return
      this.emit('error', String(err))
      this._scheduleRetry()
    })

    this._startWatchdog()
  }

  // ── 수신 처리 ──────────────────────────────────────────────

  private _handleFrame(raw: string) {
    if (!raw) return
    // engine.io 핑/퐁('2'/'3')도 살아있다는 신호 — 조용한 시간대에 워치독이 멀쩡한 페이지를 새로고침하지 않게
    this.lastActivityAt = Date.now()
    if (!/^4[0-9]/.test(raw)) return
    const don = parseDonationFrame(raw)
    if (!don) return
    if (don.donor) this.lastDonor = { uname: don.donor, time: Date.now() }
    if (don.balloons || don.amount || don.donor) this.emit('donation', don)
  }

  private _handleResultMessage(msg: string) {
    try {
      const { text, nick } = JSON.parse(msg) as { text: string; nick: string }
      const t = String(text ?? '').trim()
      if (!t) return
      this.lastActivityAt = Date.now()
      // 닉네임: WS 후원자(깨끗함) 우선, 없으면 DOM 파싱값
      const wsNick = this.lastDonor && Date.now() - this.lastDonor.time < DONOR_WINDOW_MS
        ? this.lastDonor.uname : ''
      this.emit('result', t, wsNick || String(nick ?? '').trim())
    } catch {}
  }

  // ── CDP 실패 시 폴백: 큐 폴링 ─────────────────────────────

  private _startQueuePoll() {
    this._stopQueuePoll()
    this.queueTimer = setInterval(async () => {
      if (!this.win || this.win.isDestroyed()) return
      try {
        const items: string[] = await this.win.webContents.executeJavaScript(
          '(function(){ var q = window.__weflabQueue || []; window.__weflabQueue = []; return q; })()', true)
        items.forEach(m => this._handleResultMessage(m))
      } catch {}
    }, 500)
  }

  private _stopQueuePoll() {
    if (this.queueTimer) { clearInterval(this.queueTimer); this.queueTimer = null }
  }

  // ── 워치독: WS 프레임이 오래 끊기면 새로고침 ─────────────

  private _startWatchdog() {
    this._stopWatchdog()
    this.watchdogTimer = setInterval(() => {
      if (!this._active || !this.win || this.win.isDestroyed()) return
      if (Date.now() - this.lastActivityAt >= IDLE_RESTART_MS) {
        this.lastActivityAt = Date.now()
        this.emit('retrying', `${IDLE_RESTART_MS / 1000}초간 수신 없음 — 페이지 새로고침`)
        try { this.win.webContents.reload() } catch {}
      }
    }, 30000)
  }

  private _stopWatchdog() {
    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null }
  }

  // ── 재시도/타이머 ─────────────────────────────────────────

  private _scheduleRetry() {
    if (!this._active) return
    this._clearRetry()
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this._active) {
        this.emit('retrying', '재연결 시도 중')
        this._launch()
      }
    }, RETRY_MS)
  }

  private _clearRetry() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
  }

  private _clearTimers() {
    this._clearRetry()
    this._stopWatchdog()
    this._stopQueuePoll()
  }
}

export const weflabWatcher = new WeflabWatcher()
