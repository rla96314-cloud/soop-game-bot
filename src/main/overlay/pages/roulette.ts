// OBS 오버레이 페이지: roulette (HTML 템플릿 문자열)
export const ROULETTE_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #172437; --orange: #FF5B17; --cream: #F5F3EF; --mint: #00CB84;
    --cream2: #FBF6EA; --gold: #FFC928; --purple: #6B3FD6; --purple2: #4F27B8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #rbox {
    position: fixed; bottom: 60px; left: 50%;
    transform: translateX(-50%) translateY(160px); opacity: 0;
    transition: transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
  }
  #rbox.show { transform: translateX(-50%) translateY(0); opacity: 1; }

  /* ── Wheel mode ── */
  #wheel-wrap { display: none; flex-direction: column; align-items: center; gap: 16px; }
  #wheel-wrap.active { display: flex; }
  .wheel-canvas-wrap { position: relative; }
  .wheel-pin {
    position: absolute; top: -36px; left: 50%; transform: translateX(-50%);
    z-index: 10; filter: drop-shadow(0 4px 6px rgba(23,36,55,0.35));
  }
  canvas#wcanvas { display: block; filter: drop-shadow(0 12px 28px rgba(23,36,55,0.32)); }
  #wheel-result {
    display: none;
    background: linear-gradient(180deg, #7D52E6 0%, var(--purple) 55%, var(--purple2) 100%);
    border: 4px solid var(--navy); border-radius: 28px; padding: 11px 44px 13px;
    color: #fff; font-size: 30px; font-weight: 900; letter-spacing: -0.01em;
    text-shadow: 0 2px 0 rgba(23,36,55,0.35);
    box-shadow: inset 0 3px 0 rgba(255,255,255,0.28), 0 6px 0 rgba(23,36,55,0.22), 0 12px 24px rgba(23,36,55,0.28);
    animation: wPop 0.4s ease;
  }
  @keyframes wPop { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }

  /* ── Text mode ── */
  #text-wrap { display: none; padding-top: 30px; }
  #text-wrap.active { display: block; }

  .t-label-wrap { text-align: center; margin-bottom: -30px; position: relative; z-index: 3; }
  .t-label {
    display: inline-flex; align-items: center; gap: 12px;
    background: var(--navy);
    border: 3px solid var(--orange); border-radius: 50px; padding: 8px 26px;
    color: var(--cream); font-size: 21px; font-weight: 900; letter-spacing: -0.01em;
    box-shadow: 0 0 0 3px var(--navy), 0 6px 14px rgba(23,36,55,0.35);
  }
  .t-star { color: var(--gold); font-size: 22px; line-height: 1; transform: translateY(-1px); }

  .t-body {
    background: var(--orange);
    border: 4px solid var(--navy);
    border-radius: 999px; padding: 32px 44px;
    position: relative; overflow: hidden;
    box-shadow: inset 0 -6px 0 rgba(23,36,55,0.12), inset 0 4px 0 rgba(255,255,255,0.18), 0 12px 28px rgba(23,36,55,0.32);
    width: 660px;
  }
  .led-dot {
    position: absolute; width: 18px; height: 18px; border-radius: 50%;
    background: var(--cream2);
    box-shadow: inset 0 -2px 0 rgba(23,36,55,0.18), 0 0 8px rgba(255,255,255,0.7);
    pointer-events: none; z-index: 0;
  }
  .t-inner {
    background: var(--cream2); border-radius: 999px;
    border: 3px solid var(--navy);
    overflow: hidden; position: relative; z-index: 1;
    box-shadow: inset 0 -3px 0 rgba(23,36,55,0.08);
  }
  .t-slot-outer { height: 84px; overflow: hidden; position: relative; }
  .t-slot-outer::before, .t-slot-outer::after {
    content: ''; position: absolute; left: 0; right: 0; height: 24px; z-index: 2; pointer-events: none;
  }
  .t-slot-outer::before { top: 0; background: linear-gradient(to bottom, rgba(251,246,234,0.98), transparent); }
  .t-slot-outer::after  { bottom: 0; background: linear-gradient(to top, rgba(251,246,234,0.98), transparent); }
  .t-slot-inner { display: flex; flex-direction: column; align-items: center; transition: transform 0s; }
  .t-slot-item {
    height: 84px; display: flex; align-items: center; justify-content: center;
    font-size: 40px; font-weight: 900; color: var(--navy);
    flex-shrink: 0; width: 100%; text-align: center; letter-spacing: -0.02em;
  }
  #text-result {
    display: none; height: 84px;
    align-items: center; justify-content: center;
    font-size: 42px; font-weight: 900; color: var(--navy);
    text-align: center; letter-spacing: -0.02em;
    animation: wPop 0.4s ease;
  }
</style>
</head>
<body>
<div id="rbox">
  <!-- Wheel mode -->
  <div id="wheel-wrap">
    <div class="wheel-canvas-wrap">
      <div class="wheel-pin">
        <svg width="58" height="81" viewBox="0 0 50 70" xmlns="http://www.w3.org/2000/svg">
          <path d="M 25 3 C 12.5 3 4.5 12.5 4.5 23.5 C 4.5 34 12 40 25 66 C 38 40 45.5 34 45.5 23.5 C 45.5 12.5 37.5 3 25 3 Z"
                fill="#FF5B17" stroke="#172437" stroke-width="3.5" stroke-linejoin="round"/>
          <circle cx="25" cy="22" r="7.5" fill="#FBF6EA" stroke="#172437" stroke-width="2"/>
        </svg>
      </div>
      <canvas id="wcanvas"></canvas>
    </div>
    <div id="wheel-result"></div>
  </div>

  <!-- Text mode -->
  <div id="text-wrap">
    <div class="t-label-wrap">
      <span class="t-label">
        <span class="t-star">★</span>룰렛 추첨기<span class="t-star">★</span>
      </span>
    </div>
    <div class="t-body" id="t-body">
      <div class="t-inner">
        <div class="t-slot-outer">
          <div class="t-slot-inner" id="slot-inner"></div>
        </div>
        <div id="text-result"></div>
      </div>
    </div>
  </div>
</div>

<script>
const NAVY = '#172437', ORANGE = '#FF5B17', CREAM = '#FBF6EA', GOLD = '#FFC928'
const PASTEL = ['#FFD6D6','#FFE1C4','#FFF3B8','#D4F3E0','#CFE7FF','#E4D9FF','#FFD9EC','#D2F5F1','#FFD6D6','#FFE1C4']
const DARK   = ['#C8323A','#C2621A','#A88600','#1E8A4E','#1F63B8','#5A34B8','#B8307C','#0F8A80','#C8323A','#C2621A']

const rbox      = document.getElementById('rbox')
const wheelWrap = document.getElementById('wheel-wrap')
const textWrap  = document.getElementById('text-wrap')
const wcanvas   = document.getElementById('wcanvas')
const ctx       = wcanvas.getContext('2d')
const wRes      = document.getElementById('wheel-result')
const slotInner = document.getElementById('slot-inner')
const textRes   = document.getElementById('text-result')
let hideTimer   = null

// 캔버스: CSS 400px, DPR 대응
const SIZE = 400
const DPR  = Math.max(1, window.devicePixelRatio || 1)
wcanvas.width = SIZE * DPR; wcanvas.height = SIZE * DPR
wcanvas.style.width = SIZE + 'px'; wcanvas.style.height = SIZE + 'px'
ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

function show() { rbox.classList.add('show') }
function hide() { rbox.classList.remove('show') }
let dotsBuilt = false
function setMode(m) {
  wheelWrap.classList.toggle('active', m === 'wheel')
  textWrap.classList.toggle('active', m === 'text')
  if (m === 'text' && !dotsBuilt) { const b = document.getElementById('t-body'); if (b && b.offsetWidth > 0) { buildDots(b); dotsBuilt = true } }
}

// ── LED dots for text frame (캡슐 둘레를 따라 등간격 배치) ─────────────────────
function buildDots(el) {
  const W = el.offsetWidth, H = el.offsetHeight
  const R = H / 2, inset = 20, r = R - inset, D = 18
  const segs = []
  // top edge, right arc, bottom edge, left arc
  segs.push({ len: W - 2*R, at: t => [R + t*(W - 2*R), inset] })
  segs.push({ len: Math.PI * r, at: t => { const a = -Math.PI/2 + t*Math.PI; return [W - R + Math.cos(a)*r, R + Math.sin(a)*r] } })
  segs.push({ len: W - 2*R, at: t => [W - R - t*(W - 2*R), H - inset] })
  segs.push({ len: Math.PI * r, at: t => { const a = Math.PI/2 + t*Math.PI; return [R + Math.cos(a)*r, R + Math.sin(a)*r] } })
  const L = segs.reduce((s, g) => s + g.len, 0)
  const n = Math.max(8, Math.round(L / 46)), gap = L / n
  for (let i = 0; i < n; i++) {
    let d = i * gap
    for (const g of segs) {
      if (d <= g.len) {
        const [x, y] = g.at(g.len ? d / g.len : 0)
        const dot = document.createElement('div'); dot.className = 'led-dot'
        dot.style.left = (x - D/2) + 'px'; dot.style.top = (y - D/2) + 'px'
        el.appendChild(dot); break
      }
      d -= g.len
    }
  }
}

// ── Wheel drawing ─────────────────────────────────────────────────────────────
const cx = SIZE/2, cy = SIZE/2
const outerR = 196          // 남색 외곽선 바깥
const ringOut = outerR - 4  // 주황 링 바깥
const segR = 160            // 세그먼트 반지름
const dotRingR = (ringOut + segR + 3) / 2
const HUB_R = 54

function starPath(x, y, ro, ri, n) {
  ctx.beginPath()
  for (let i = 0; i < n*2; i++) {
    const a = -Math.PI/2 + i * Math.PI / n, rr = i % 2 === 0 ? ro : ri
    ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a)*rr, y + Math.sin(a)*rr)
  }
  ctx.closePath()
}
function estW(str) { let w = 0; for (const ch of str) w += ch === ' ' ? 0.3 : /[\u3131-\uD79D]/.test(ch) ? 1.0 : 0.58; return w }
function normRot(a) { a = ((a + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI; if (Math.abs(a) > Math.PI/2) a += a > 0 ? -Math.PI : Math.PI; return a }

let lastItems = null, lastAngle = 0

function drawWheel(items, angle, hub) {
  lastItems = items; lastAngle = angle
  ctx.clearRect(0, 0, SIZE, SIZE)

  // 남색 외곽 + 주황 마퀴 링
  ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI*2); ctx.fillStyle = NAVY; ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy, ringOut, 0, Math.PI*2); ctx.fillStyle = ORANGE; ctx.fill()
  // 링 안쪽 살짝 어두운 그림자 (입체감)
  ctx.beginPath(); ctx.arc(cx, cy, ringOut, 0, Math.PI*2); ctx.arc(cx, cy, ringOut - 6, 0, Math.PI*2, true)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill()
  // 세그먼트 영역 남색 테두리
  ctx.beginPath(); ctx.arc(cx, cy, segR + 3, 0, Math.PI*2); ctx.fillStyle = NAVY; ctx.fill()

  // Segments
  const total = items.reduce((s, i) => s + i.probability, 0) || 1
  let start = angle
  const labels = []
  items.forEach((item, i) => {
    const sweep = (item.probability / total) * Math.PI * 2
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, segR, start, start + sweep); ctx.closePath()
    ctx.fillStyle = PASTEL[i % PASTEL.length]; ctx.fill()
    labels.push({ item, i, start, sweep })
    start += sweep
  })
  // 흰색 구분선
  if (items.length > 1) labels.forEach(l => {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(l.start)*segR, cy + Math.sin(l.start)*segR)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke()
  })
  // 라벨
  labels.forEach(({ item, i, start, sweep }) => {
    const mid = start + sweep / 2
    const label = item.name.length > 7 ? item.name.slice(0,6) + '…' : item.name
    const arcLen = sweep * segR * 0.66
    const ew = estW(label)
    const fsT = Math.floor((arcLen - 10) / (ew + 0.2))
    ctx.fillStyle = DARK[i % DARK.length]
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.save()
    if (fsT >= 13 || sweep > 1.2) {
      // 호를 따라 (접선 방향)
      const fs = Math.min(24, Math.max(11, fsT))
      const rr = segR * 0.66
      ctx.translate(cx + Math.cos(mid)*rr, cy + Math.sin(mid)*rr); ctx.rotate(normRot(mid + Math.PI/2))
      ctx.font = '900 ' + fs + 'px "Noto Sans KR",sans-serif'
      ctx.fillText(label, 0, 0)
    } else {
      // 얇은 조각: 반지름 방향으로
      const avail = segR - HUB_R - 14
      const fs = Math.min(17, Math.max(9, Math.floor(avail / (ew + 0.3))))
      const rr = HUB_R + 4 + avail / 2
      const flip = Math.cos(mid) < 0
      ctx.translate(cx + Math.cos(mid)*rr, cy + Math.sin(mid)*rr); ctx.rotate(flip ? mid + Math.PI : mid)
      ctx.font = '900 ' + fs + 'px "Noto Sans KR",sans-serif'
      ctx.fillText(label, 0, 0)
    }
    ctx.restore()
  })

  // 크림 전구
  const nDots = 20, dotR = 9
  for (let i = 0; i < nDots; i++) {
    const a = (i / nDots) * Math.PI * 2 - Math.PI/2
    const x = cx + Math.cos(a)*dotRingR, y = cy + Math.sin(a)*dotRingR
    ctx.beginPath(); ctx.arc(x, y + 1.5, dotR, 0, Math.PI*2); ctx.fillStyle = 'rgba(23,36,55,0.22)'; ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI*2); ctx.fillStyle = CREAM; ctx.fill()
  }

  // 허브
  if (hub === 'badge') {
    ctx.beginPath(); ctx.arc(cx, cy + 3, HUB_R, 0, Math.PI*2); ctx.fillStyle = 'rgba(23,36,55,0.25)'; ctx.fill()
    ctx.beginPath(); ctx.arc(cx, cy, HUB_R, 0, Math.PI*2); ctx.fillStyle = NAVY; ctx.fill()
    ctx.beginPath(); ctx.arc(cx, cy, HUB_R - 5, 0, Math.PI*2); ctx.fillStyle = GOLD; ctx.fill()
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, HUB_R - 11, 0, Math.PI*2)
    ctx.strokeStyle = 'rgba(23,36,55,0.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([4,4]); ctx.stroke()
    ctx.restore()
    ctx.fillStyle = NAVY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '900 15px "Noto Sans KR",sans-serif'
    ctx.fillText('룰렛', cx, cy - 13); ctx.fillText('돌리기', cx, cy + 4)
    starPath(cx, cy + 22, 6.5, 2.8, 5); ctx.fill()
  } else {
    const hr = 42
    ctx.beginPath(); ctx.arc(cx, cy + 3, hr, 0, Math.PI*2); ctx.fillStyle = 'rgba(23,36,55,0.25)'; ctx.fill()
    ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI*2); ctx.fillStyle = NAVY; ctx.fill()
    ctx.beginPath(); ctx.arc(cx, cy, hr - 5, 0, Math.PI*2); ctx.fillStyle = ORANGE; ctx.fill()
    starPath(cx, cy + 1, 19, 8.5, 5); ctx.fillStyle = CREAM; ctx.fill()
  }
}

function spinWheel(items, winnerIdx, spinMs) {
  const total = items.reduce((s, i) => s + i.probability, 0) || 1
  let cum = -Math.PI/2, winMid = 0
  items.forEach((item, i) => {
    const sweep = (item.probability / total) * Math.PI * 2
    if (i === winnerIdx) winMid = cum + sweep / 2
    cum += sweep
  })
  // 당첨 조각 중앙이 12시(핀) 아래에 오도록: angle + (winMid + π/2) = -π/2
  const finalAngle = -Math.PI - winMid + 6 * Math.PI * 2
  const t0 = performance.now()
  function ease(t) { return 1 - Math.pow(1-t, 3) }
  ;(function tick(now) {
    const t = Math.min(1, (now - t0) / spinMs)
    drawWheel(items, ease(t) * finalAngle, 'spin')
    if (t < 1) requestAnimationFrame(tick)
  })(t0)
}

// ── Text spin (위에서 아래로) ─────────────────────────────────────────────────
function spinText(items, winner, spinMs) {
  slotInner.innerHTML = ''
  const names = items.map(i => i.name), full = []
  // winner goes first: ends visible at translateY(0)
  full.push(winner)
  for (let r = 0; r < 5; r++) full.push(...[...names].sort(() => Math.random() - 0.5))
  full.forEach(name => {
    const el = document.createElement('div'); el.className = 't-slot-item'; el.textContent = name
    slotInner.appendChild(el)
  })
  const startY = -(full.length - 1) * 84  // start showing last items (bottom of list)
  slotInner.style.transition = 'none'
  slotInner.style.transform = 'translateY(' + startY + 'px)'
  // double rAF ensures browser flushes the reset before starting transition
  requestAnimationFrame(() => requestAnimationFrame(() => {
    slotInner.style.transition = 'transform ' + spinMs + 'ms cubic-bezier(0.2,0,0.1,1)'
    slotInner.style.transform  = 'translateY(0)'  // scroll DOWN to winner
  }))
}

// ── Handlers ──────────────────────────────────────────────────────────────────
const tSlotOuter = document.querySelector('.t-slot-outer')

function startSpin(data) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  wRes.style.display = 'none'; textRes.style.display = 'none'
  if (tSlotOuter) tSlotOuter.style.display = 'block'
  setMode(data.animType ?? 'wheel'); show()
  if (data.animType === 'text') spinText(data.items, data.winner, data.spinMs)
  else spinWheel(data.items, data.winnerIdx, data.spinMs)
}

function showResult(result, animType) {
  const txt = result.result
  if (animType === 'text') {
    if (tSlotOuter) tSlotOuter.style.display = 'none'
    textRes.textContent = txt
    textRes.style.display = 'flex'
  } else {
    if (lastItems) drawWheel(lastItems, lastAngle, 'badge')
    wRes.textContent = txt; wRes.style.display = 'block'
  }
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, 7000)
}

let lastAnimType = 'wheel'

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'game:state' && msg.data?.id === 'roulette') {
        const s = msg.data
        if (s.status === 'running' && s.roulette) { lastAnimType = s.roulette.animType ?? 'wheel'; startSpin(s.roulette) }
        else if (s.status === 'idle') hide()
      }
      if (msg.type === 'game:result' && msg.data?.gameId === 'roulette') showResult(msg.data, lastAnimType)
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

// ── Pickboard overlay (ticket board) ─────────────────────────────────────────
