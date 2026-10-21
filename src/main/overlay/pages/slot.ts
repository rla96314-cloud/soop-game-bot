// OBS 오버레이 페이지: slot (HTML 템플릿 문자열)
import { FX_SCRIPT } from './_fx'
export const SLOT_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root { --navy:#172437; --orange:#FF5B17; --cream:#F5F3EF; --mint:#00CB84; --yellow:#FFC61A; --orange-dk:#C8451A; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #slot-wrap {
    position: fixed; bottom: 60px; left: 50%;
    transform: translateX(-50%) translateY(200px); opacity: 0;
    transition: transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
  }
  #slot-wrap.show { transform: translateX(-50%) translateY(0); opacity: 1; }

  /* ── Machine body ── */
  .machine {
    position: relative; width: 440px;
    background: var(--orange);
    border: 5px solid var(--navy);
    border-radius: 30px;
    padding: 14px 18px 16px;
    box-shadow: -12px 12px 0 var(--navy), 0 26px 60px rgba(23,36,55,0.45);
  }
  .machine::before {
    content: ''; position: absolute; inset: 6px;
    border-radius: 20px; border: 2px solid rgba(255,255,255,0.28); pointer-events: none;
  }

  /* ── Title display ── */
  .title-panel {
    position: relative;
    background: var(--cream);
    border: 3px solid #FFC9AE; border-radius: 18px;
    padding: 10px 16px 9px; text-align: center; margin-bottom: 12px;
    box-shadow: 0 3px 0 rgba(23,36,55,0.25);
  }
  .title-dots { display: flex; justify-content: center; gap: 8px; margin-bottom: 4px; }
  .tdot {
    width: 9px; height: 9px; border-radius: 50%;
    background: var(--orange); border: 1.5px solid #D24A12;
    transition: background 0.25s, box-shadow 0.25s;
  }
  .tdot.lit { background: var(--yellow); border-color: #E0A800; box-shadow: 0 0 8px rgba(255,198,26,0.9); }
  .title-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .title-star { color: var(--orange); font-size: 20px; line-height: 1; }
  .title-text { font-size: 30px; font-weight: 900; color: var(--navy); letter-spacing: -0.02em; line-height: 1.1; }
  .spk { width: 22px; height: 30px; flex-shrink: 0; }
  .spk line { stroke: var(--mint); stroke-width: 3.5; stroke-linecap: round; }
  .spk.r { transform: scaleX(-1); }

  /* ── Reels frame ── */
  .reels-frame {
    position: relative;
    background: var(--navy);
    border-radius: 16px; padding: 9px;
    margin-bottom: 8px;
  }
  .reels-row { display: flex; gap: 9px; }
  .reel {
    flex: 1; height: 108px; background: var(--cream);
    border-radius: 12px; border: 3px solid var(--navy);
    overflow: hidden; position: relative;
    box-shadow: inset 0 0 0 2px #FFD9C4;
    transition: box-shadow 0.3s;
  }
  .reel.lit { box-shadow: inset 0 0 0 2px var(--yellow), 0 0 16px rgba(255,198,26,0.75); }
  .reel-inner { display: flex; flex-direction: column; align-items: center; transition: transform 0s; }
  .reel-cell { width: 100%; height: 108px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 50px; background: var(--cream); }
  .reel-cell img { width: 68px; height: 68px; object-fit: contain; }
  .reel::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(to bottom, rgba(245,243,239,0.9) 0%, transparent 22%, transparent 78%, rgba(245,243,239,0.9) 100%);
    z-index: 2; pointer-events: none; border-radius: 9px;
  }
  .rs { position: absolute; z-index: 3; color: var(--orange); font-size: 11px; line-height: 1; pointer-events: none; animation: rsTw 1.6s ease-in-out infinite; }
  .rs.a { top: 8px; left: 9px; }
  .rs.b { top: 8px; right: 9px; animation-delay: 0.4s; }
  .rs.c { bottom: 8px; left: 9px; animation-delay: 0.8s; }
  .rs.d { bottom: 8px; right: 9px; animation-delay: 1.2s; }
  @keyframes rsTw { 0%,100% { opacity: 0.45; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }

  /* whiskers outside cabinet */
  .whisk { position: absolute; top: 50%; width: 34px; height: 60px; transform: translateY(-50%); pointer-events: none; }
  .whisk line { stroke: var(--orange); stroke-width: 5; stroke-linecap: round; }
  .whisk.l { left: -66px; }
  .whisk.r { right: -66px; transform: translateY(-50%) scaleX(-1); }

  /* ── Lever ── */
  .lever {
    position: absolute; right: -50px; top: 42px;
    display: flex; flex-direction: column; align-items: center;
  }
  .lever-knob {
    width: 34px; height: 34px; border-radius: 50%;
    background: radial-gradient(circle at 35% 32%, #FFA274 0%, var(--orange) 45%, #E04B0E 100%);
    border: 3px solid var(--navy);
    box-shadow: 0 3px 0 rgba(23,36,55,0.25);
    transition: transform 0.18s ease; position: relative; z-index: 2;
  }
  .lever-knob::after { content: ''; position: absolute; top: 4px; left: 7px; width: 8px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.7); }
  .lever-knob.pulled { transform: translateY(58px); }
  .lever-rod {
    width: 12px; height: 72px; margin-top: -4px;
    background: linear-gradient(to right, #D9D6D0, var(--cream) 50%, #CFCBC3);
    border: 2.5px solid var(--navy);
    border-radius: 4px;
  }
  .lever-base {
    width: 28px; height: 14px; margin-top: -2px;
    background: var(--cream);
    border: 3px solid var(--navy);
    border-radius: 4px;
  }

  /* ── Result band ── */
  .result-bar {
    height: 44px; display: flex; align-items: center; justify-content: center; gap: 10px;
    font-size: 36px; font-weight: 900; color: var(--cream);
    opacity: 0; transition: opacity 0.4s;
    text-shadow: 0 3px 0 rgba(23,36,55,0.55); margin-bottom: 8px;
    letter-spacing: 0.02em; line-height: 1;
  }
  .result-bar.show    { opacity: 1; }
  .result-bar .rb-star { font-size: 22px; color: var(--cream); opacity: 0; transition: opacity 0.3s; }
  .result-bar .rb-spk  { width: 14px; height: 22px; opacity: 0; transition: opacity 0.3s; }
  .result-bar .rb-spk line { stroke: var(--mint); stroke-width: 3; stroke-linecap: round; }
  .result-bar.jackpot .rb-star, .result-bar.jackpot .rb-spk { opacity: 1; }
  .result-bar.jackpot .rb-text { animation: jackpotPulse 0.55s ease infinite alternate; }
  .result-bar.twoKind .rb-text { font-size: 26px; color: var(--yellow); }
  .result-bar.miss .rb-text { font-size: 26px; color: var(--navy); text-shadow: none; }

  /* ── START bar ── */
  .start-btn {
    width: 100%; height: 42px;
    background: var(--cream);
    border: none; border-radius: 22px;
    font-size: 19px; font-weight: 900; color: var(--navy);
    letter-spacing: 0.12em; cursor: default; font-family: inherit;
    box-shadow: 0 4px 0 var(--orange-dk);
    transition: transform 0.1s, box-shadow 0.1s;
    position: relative; display: flex; align-items: center; justify-content: center; gap: 46px;
  }
  .start-btn .chev { color: var(--orange); font-size: 26px; letter-spacing: -0.15em; line-height: 1; font-weight: 900; transform: translateY(-2px); }
  .start-btn.active { transform: translateY(3px); box-shadow: 0 1px 0 var(--orange-dk); }

  @keyframes jackpotPulse { from { text-shadow: 0 3px 0 rgba(23,36,55,0.55), 0 0 14px rgba(255,198,26,0.6); } to { text-shadow: 0 3px 0 rgba(23,36,55,0.55), 0 0 30px rgba(255,198,26,1), 0 0 60px rgba(255,91,23,0.8); } }

  /* ── FX: 릴 정지 바운스 ── */
  @keyframes reelBounce { 0% { transform: translateY(0); } 35% { transform: translateY(7px); } 70% { transform: translateY(-3px); } 100% { transform: translateY(0); } }
  .reel.bounce { animation: reelBounce 0.36s cubic-bezier(0.2,0.8,0.3,1); }
  /* ── FX: 리치 (앞 두 릴 일치) — 캐비닛 테두리 펄스 + 3번째 릴 강조 ── */
  @keyframes richPulse {
    from { border-color: var(--navy); box-shadow: -12px 12px 0 var(--navy), 0 0 0 0 rgba(255,198,26,0), 0 26px 60px rgba(23,36,55,0.45); }
    to   { border-color: var(--yellow); box-shadow: -12px 12px 0 var(--navy), 0 0 0 8px rgba(255,198,26,0.85), 0 0 50px rgba(255,198,26,0.8), 0 26px 60px rgba(23,36,55,0.45); }
  }
  .machine.rich { animation: richPulse 0.38s ease-in-out infinite alternate; }
  @keyframes reelSlow { from { box-shadow: inset 0 0 0 2px #FFD9C4; } to { box-shadow: inset 0 0 0 3px var(--yellow), 0 0 18px rgba(255,198,26,0.9); } }
  .reel.slow { animation: reelSlow 0.3s ease-in-out infinite alternate; }
  /* ── FX: 꽝 흔들림 ── */
  @keyframes cabShake { 0%,100% { transform: translateX(0); } 15% { transform: translateX(-10px) rotate(-0.6deg); } 35% { transform: translateX(9px) rotate(0.5deg); } 55% { transform: translateX(-6px); } 75% { transform: translateX(4px); } }
  .machine.shake { animation: cabShake 0.5s ease-out; }
  /* ── FX: JACKPOT 밴드 점멸 ── */
  @keyframes bandFlash { 0%,100% { background: rgba(255,255,255,0); } 50% { background: rgba(255,255,255,0.42); } }
  .result-bar { border-radius: 12px; }
  .result-bar.jackpot { animation: bandFlash 0.3s steps(1,end) 8; }
</style>
</head>
<body>
<div id="slot-wrap">
  <div class="machine">
    <!-- Lever -->
    <div class="lever">
      <div class="lever-knob" id="lever-knob"></div>
      <div class="lever-rod"></div>
      <div class="lever-base"></div>
    </div>

    <!-- Title -->
    <div class="title-panel">
      <div class="title-dots">
        <div class="tdot" id="td0"></div>
        <div class="tdot lit" id="td1"></div>
        <div class="tdot" id="td2"></div>
        <div class="tdot lit" id="td3"></div>
        <div class="tdot" id="td4"></div>
      </div>
      <div class="title-inner">
        <svg class="spk" viewBox="0 0 22 30"><line x1="4" y1="6" x2="12" y2="12"/><line x1="4" y1="24" x2="12" y2="18"/></svg>
        <span class="title-star">&#9733;</span>
        <span class="title-text">슬롯머신</span>
        <span class="title-star">&#9733;</span>
        <svg class="spk r" viewBox="0 0 22 30"><line x1="4" y1="6" x2="12" y2="12"/><line x1="4" y1="24" x2="12" y2="18"/></svg>
      </div>
    </div>

    <!-- Reels -->
    <div class="reels-frame">
      <svg class="whisk l" viewBox="0 0 34 60"><line x1="4" y1="8" x2="30" y2="20"/><line x1="4" y1="30" x2="30" y2="30"/><line x1="4" y1="52" x2="30" y2="40"/></svg>
      <svg class="whisk r" viewBox="0 0 34 60"><line x1="4" y1="8" x2="30" y2="20"/><line x1="4" y1="30" x2="30" y2="30"/><line x1="4" y1="52" x2="30" y2="40"/></svg>
      <div class="reels-row">
        <div class="reel" id="reel0"><div class="reel-inner" id="inner0"></div><span class="rs a">&#10022;</span><span class="rs b">&#10022;</span><span class="rs c">&#10022;</span><span class="rs d">&#10022;</span></div>
        <div class="reel" id="reel1"><div class="reel-inner" id="inner1"></div><span class="rs a">&#10022;</span><span class="rs b">&#10022;</span><span class="rs c">&#10022;</span><span class="rs d">&#10022;</span></div>
        <div class="reel" id="reel2"><div class="reel-inner" id="inner2"></div><span class="rs a">&#10022;</span><span class="rs b">&#10022;</span><span class="rs c">&#10022;</span><span class="rs d">&#10022;</span></div>
      </div>
    </div>

    <!-- Result + START -->
    <div class="result-bar" id="result-bar">
      <span class="rb-star">&#9733;</span>
      <svg class="rb-spk" viewBox="0 0 14 22"><line x1="3" y1="4" x2="9" y2="9"/><line x1="3" y1="18" x2="9" y2="13"/></svg>
      <span class="rb-text" id="rb-text"></span>
      <svg class="rb-spk" viewBox="0 0 14 22" style="transform:scaleX(-1)"><line x1="3" y1="4" x2="9" y2="9"/><line x1="3" y1="18" x2="9" y2="13"/></svg>
      <span class="rb-star">&#9733;</span>
    </div>
    <button class="start-btn" id="start-btn"><span class="chev">&raquo;</span><span>START</span><span class="chev">&raquo;</span></button>
  </div>
</div>
<script>${FX_SCRIPT}<\/script>
<script>
const wrap      = document.getElementById('slot-wrap')
const resultBar = document.getElementById('result-bar')
const rbText    = document.getElementById('rb-text')
const startBtn  = document.getElementById('start-btn')
const leverKnob = document.getElementById('lever-knob')
const machine   = document.querySelector('.machine')
const reelsEl   = document.querySelector('.reels-frame')
let spinning = false
let lastRunId = null
let timers = []            // 진행 중 연출 타이머 — 새 판이 오면 전부 취소
function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t }
function cancelAll() { timers.forEach(clearTimeout); timers = [] }
// 리치 연출: 3번째 릴이 느리게 추가로 도는 시간 / 최종 정지 시간
const RICH_SLOW_MS = 1200, RICH_SETTLE_MS = 700

function bounce(el, cls) {
  cls = cls || 'bounce'
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls)
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true })
}

// Dot twinkle
setInterval(() => {
  document.querySelectorAll('.tdot').forEach(d => d.classList.toggle('lit', Math.random() > 0.5))
}, 420)

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function isUrl(s) { return s && (s.startsWith('http') || s.startsWith('data:')) }

function makeCell(sym) {
  const c = document.createElement('div'); c.className = 'reel-cell'
  if (isUrl(sym)) {
    const img = document.createElement('img')
    img.src = sym; c.appendChild(img)
  } else { c.textContent = sym }
  return c
}
function buildReel(innerEl, target, symbols, rows) {
  innerEl.innerHTML = ''
  for (let i = 0; i < rows - 1; i++) innerEl.appendChild(makeCell(rand(symbols)))
  innerEl.appendChild(makeCell(target))
}
// 릴 회전. 기본: 빠르게(stopMs*0.75) → 0.5s 감속 정지.
// rich 옵션: 빠르게(fastMs) → RICH_SLOW_MS 동안 눈에 띄게 느리게 → RICH_SETTLE_MS 감속 정지 (리치 연출용 3번째 릴)
// onPhase('slow') 느린 구간 진입, onPhase('stop') 완전 정지 시점에 호출
function spinReel(reelEl, innerEl, target, symbols, stopMs, opts, onPhase) {
  const rows = 32, cellH = 108
  const rich = !!(opts && opts.rich)
  buildReel(innerEl, target, symbols, rows)
  innerEl.style.transition = 'none'
  innerEl.style.transform  = 'translateY(0)'
  const go = (cells, ms, ease) => {
    innerEl.style.transition = 'transform ' + (ms / 1000).toFixed(2) + 's ' + ease
    innerEl.style.transform  = 'translateY(-' + (cells * cellH) + 'px)'
  }
  const settle = () => {
    reelEl.classList.remove('slow')
    bounce(reelEl)
    FX.sound('stop')
    if (onPhase) onPhase('stop')
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!rich) {
      go(rows - 5, stopMs * 0.75, 'cubic-bezier(0.2,0,0.5,1)')
      later(() => {
        go(rows - 1, 500, 'cubic-bezier(0,0,0.15,1)')
        reelEl.classList.add('lit')
        later(settle, 500)
      }, stopMs * 0.75)
    } else {
      const fastMs = opts.fastMs
      // 끝 속도가 느린 구간 속도와 비슷해지도록 브레이크 곡선
      go(rows - 7, fastMs, 'cubic-bezier(0.25,0.1,0.6,0.9)')
      later(() => {
        reelEl.classList.add('slow')
        if (onPhase) onPhase('slow')
        go(rows - 3, RICH_SLOW_MS, 'linear')
        later(() => {
          go(rows - 1, RICH_SETTLE_MS, 'cubic-bezier(0.1,0.5,0.2,1)')
          reelEl.classList.add('lit')
          later(settle, RICH_SETTLE_MS)
        }, RICH_SLOW_MS)
      }, fastMs)
    }
  }))
}

function startSpin(slot) {
  // 같은 판(runId)이 다시 오면 무시, 다른 판이면 진행 중 연출을 끊고 새로 시작 (spinMs 가 길 때 두 번째 판이 안 보이던 문제)
  if (slot.runId !== undefined && slot.runId === lastRunId) return
  lastRunId = slot.runId ?? null
  cancelAll(); FX.drumStop(); FX.spinStop(); spinning = true
  const symbols = slot.symbols.length >= 3 ? slot.symbols : ['🍒','🍋','🍊','⭐','🎰','💎']
  const targets = slot.symbols
  const spinMs  = slot.spinMs ?? 3000
  const ratio   = spinMs / 3000
  const stops   = [Math.round(1100 * ratio), Math.round(1700 * ratio), Math.round(2300 * ratio)]
  // 릴 i 가 완전히 멈추는 시각 (왼쪽→오른쪽 순차)
  const settleAt = stops.map(s => Math.round(s * 0.75) + 500)
  // 리치: 앞 두 릴이 같으면 3번째 릴은 2번째 릴이 멈춘 뒤 느리게 더 돌다 멈춤
  const rich      = targets.length >= 3 && targets[0] != null && targets[0] === targets[1]
  const richExtra = rich ? (settleAt[1] + RICH_SLOW_MS + RICH_SETTLE_MS) - settleAt[2] : 0
  const resultAt  = stops[2] + 600 + richExtra
  const hideAt    = stops[2] + Math.round(4500 * ratio) + richExtra

  FX.hideWinner()
  resultBar.className = 'result-bar'; rbText.textContent = ''
  machine.classList.remove('rich', 'shake')
  ;[0,1,2].forEach(i => document.getElementById('reel' + i).classList.remove('lit', 'slow', 'bounce'))

  leverKnob.classList.remove('pulled'); startBtn.classList.remove('active')
  leverKnob.classList.add('pulled')
  later(() => leverKnob.classList.remove('pulled'), 600)
  startBtn.classList.add('active')
  later(() => startBtn.classList.remove('active'), 300)

  wrap.classList.add('show')
  FX.spinStart()
  ;[0,1,2].forEach(i => spinReel(
    document.getElementById('reel' + i), document.getElementById('inner' + i),
    targets[i], symbols, stops[i],
    (rich && i === 2) ? { rich: true, fastMs: settleAt[1] } : null,
    phase => {
      if (i !== 2) return
      if (phase === 'slow') { machine.classList.add('rich'); FX.drumStart(160) }
      if (phase === 'stop') { machine.classList.remove('rich'); FX.drumStop(); FX.spinStop() }
    }
  ))

  later(() => {
    if (slot.jackpot) {
      resultBar.className = 'result-bar show jackpot'; rbText.textContent = 'JACKPOT!'
      FX.sound('jackpot')
      FX.flash('rgba(255,200,40,.7)')
      const r = reelsEl.getBoundingClientRect()
      FX.confetti({ count: 220, x: r.left + r.width / 2, y: r.top })
    } else if (slot.twoKind) {
      resultBar.className = 'result-bar show twoKind'; rbText.textContent = '2개 일치!'
      FX.sound('win'); FX.burst(reelsEl, '#FFC928')
    } else {
      resultBar.className = 'result-bar show miss'; rbText.textContent = '꽝'
      FX.sound('lose'); bounce(machine, 'shake')
    }
    FX.winner({
      nick: slot.triggeredBy || '',
      sub: slot.jackpot ? '잭팟!' : slot.twoKind ? '2개 일치' : '슬롯 결과',
      anchor: machine, above: true,
      ms: Math.max(1500, hideAt - resultAt - 150),
    })
  }, resultAt)

  later(() => {
    wrap.classList.remove('show'); spinning = false
    FX.hideWinner(); FX.drumStop(); FX.spinStop()
    machine.classList.remove('rich', 'shake')
    ;[0,1,2].forEach(i => document.getElementById('reel' + i).classList.remove('lit', 'slow'))
  }, hideAt)
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'game:state' && msg.data?.id === 'slot' && msg.data?.status === 'running' && msg.data.slot?.symbols)
        startSpin(msg.data.slot)
      if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
    } catch {}
  }
  ws.onopen  = () => { if (window.__wsDown) location.reload() }  // 서버 재시작(앱 업데이트) → 새 코드 로드
  ws.onclose = () => { window.__wsDown = true; setTimeout(connect, 2000) }
}
connect()
<\/script>
</body>
</html>`
