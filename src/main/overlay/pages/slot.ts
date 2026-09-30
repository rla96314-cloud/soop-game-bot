// OBS 오버레이 페이지: slot (HTML 템플릿 문자열)
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
  @keyframes confettiFall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  .confetti-piece { position: fixed; top: -20px; width: 9px; height: 15px; border-radius: 2px; animation: confettiFall 2.5s ease-in forwards; }
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
<script>
const wrap      = document.getElementById('slot-wrap')
const resultBar = document.getElementById('result-bar')
const rbText    = document.getElementById('rb-text')
const startBtn  = document.getElementById('start-btn')
const leverKnob = document.getElementById('lever-knob')
let spinning = false

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
function spinReel(reelEl, innerEl, target, symbols, stopMs) {
  const rows = 32, cellH = 108
  buildReel(innerEl, target, symbols, rows)
  innerEl.style.transition = 'none'
  innerEl.style.transform  = 'translateY(0)'
  requestAnimationFrame(() => requestAnimationFrame(() => {
    innerEl.style.transition = 'transform ' + (stopMs * 0.75 / 1000).toFixed(2) + 's cubic-bezier(0.2,0,0.5,1)'
    innerEl.style.transform  = 'translateY(-' + ((rows - 5) * cellH) + 'px)'
    setTimeout(() => {
      innerEl.style.transition = 'transform 0.5s cubic-bezier(0,0,0.15,1)'
      innerEl.style.transform  = 'translateY(-' + ((rows - 1) * cellH) + 'px)'
      reelEl.classList.add('lit')
    }, stopMs * 0.75)
  }))
}

function showConfetti() {
  const colors = ['#FF5B17','#00CB84','#FFC61A','#F5F3EF','#172437','#FF8C5A']
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div'); el.className = 'confetti-piece'
    el.style.left = Math.random() * 100 + 'vw'
    el.style.background = colors[Math.floor(Math.random() * colors.length)]
    el.style.animationDelay = Math.random() + 's'
    el.style.animationDuration = (2 + Math.random() * 1.5) + 's'
    document.body.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
}

function startSpin(slot) {
  if (spinning) return; spinning = true
  const symbols = slot.symbols.length >= 3 ? slot.symbols : ['🍒','🍋','🍊','⭐','🎰','💎']
  const targets = slot.symbols
  const spinMs  = slot.spinMs ?? 3000
  const ratio   = spinMs / 3000
  const stops   = [Math.round(1100 * ratio), Math.round(1700 * ratio), Math.round(2300 * ratio)]
  const hideAt  = stops[2] + Math.round(4500 * ratio)

  resultBar.className = 'result-bar'; rbText.textContent = ''
  ;[0,1,2].forEach(i => document.getElementById('reel' + i).classList.remove('lit'))

  leverKnob.classList.add('pulled')
  setTimeout(() => leverKnob.classList.remove('pulled'), 600)
  startBtn.classList.add('active')
  setTimeout(() => startBtn.classList.remove('active'), 300)

  wrap.classList.add('show')
  ;[0,1,2].forEach(i => spinReel(
    document.getElementById('reel' + i), document.getElementById('inner' + i),
    targets[i], symbols, stops[i]
  ))

  setTimeout(() => {
    if (slot.jackpot)      { resultBar.className = 'result-bar show jackpot'; rbText.textContent = 'JACKPOT!'; showConfetti() }
    else if (slot.twoKind) { resultBar.className = 'result-bar show twoKind'; rbText.textContent = '2개 일치!' }
    else                   { resultBar.className = 'result-bar show miss';    rbText.textContent = '꽝' }
  }, stops[2] + 600)

  setTimeout(() => {
    wrap.classList.remove('show'); spinning = false
    ;[0,1,2].forEach(i => document.getElementById('reel' + i).classList.remove('lit'))
  }, hideAt)
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
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
