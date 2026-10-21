// OBS 오버레이 페이지: roulette (HTML 템플릿 문자열)
// 연출 3단계: 긴장(회전·틱·핀 튕김) → 공개(정지 플래시·당첨 조각 펄스·결과 팝) → 여운(당첨자 배너·색종이)
import { FX_SCRIPT } from './_fx'

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
  /* 당첨자 배너가 아래에 붙을 자리를 비워주기 위해 살짝 들어올림 */
  #rbox.show.lift { transform: translateX(-50%) translateY(-140px); }

  /* ── Wheel mode ── */
  #wheel-wrap { display: none; flex-direction: column; align-items: center; gap: 16px; }
  #wheel-wrap.active { display: flex; }
  .wheel-canvas-wrap { position: relative; }
  .wheel-pin {
    position: absolute; top: -36px; left: 50%; transform: translateX(-50%);
    z-index: 10; filter: drop-shadow(0 4px 6px rgba(23,36,55,0.35));
  }
  .wheel-pin svg { display: block; transform-origin: 50% 31%; }   /* 핀은 머리(구슬) 중심을 축으로 튕긴다 */
  canvas#wcanvas { display: block; filter: drop-shadow(0 12px 28px rgba(23,36,55,0.32)); }
  #wheel-result {
    display: none;
    background: linear-gradient(180deg, #7D52E6 0%, var(--purple) 55%, var(--purple2) 100%);
    border: 4px solid var(--navy); border-radius: 28px; padding: 11px 44px 13px;
    color: #fff; font-size: 30px; font-weight: 900; letter-spacing: -0.01em;
    text-shadow: 0 2px 0 rgba(23,36,55,0.35);
    box-shadow: inset 0 3px 0 rgba(255,255,255,0.28), 0 6px 0 rgba(23,36,55,0.22), 0 12px 24px rgba(23,36,55,0.28);
    animation: wPop 0.45s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes wPop { 0%{transform:scale(0.6);opacity:0} 55%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:1} }

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
  /* 슬롯이 도는 동안 전구 체이스, 멈추면 금색으로 반짝 */
  .t-body.spinning .led-dot { animation: ledChase 0.48s steps(1) infinite; animation-delay: calc(var(--i, 0) * -0.06s); }
  .t-body.landed .led-dot { animation: ledLand 0.33s ease-in-out 3; }
  @keyframes ledChase { 0%{background:var(--gold);box-shadow:0 0 12px var(--gold)} 50%{background:var(--cream2);box-shadow:0 0 8px rgba(255,255,255,0.7)} }
  @keyframes ledLand  { 0%,100%{background:var(--cream2);box-shadow:0 0 8px rgba(255,255,255,0.7)} 50%{background:var(--gold);box-shadow:0 0 16px var(--gold)} }
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
    animation: wPop 0.45s cubic-bezier(0.34,1.56,0.64,1);
  }
</style>
</head>
<body>
<div id="rbox">
  <!-- Wheel mode -->
  <div id="wheel-wrap">
    <div class="wheel-canvas-wrap">
      <div class="wheel-pin">
        <svg id="wpin" width="58" height="81" viewBox="0 0 50 70" xmlns="http://www.w3.org/2000/svg">
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

<script>${FX_SCRIPT}<\/script>
<script>
const NAVY = '#172437', ORANGE = '#FF5B17', CREAM = '#FBF6EA', GOLD = '#FFC928'
const PASTEL = ['#FFD6D6','#FFE1C4','#FFF3B8','#D4F3E0','#CFE7FF','#E4D9FF','#FFD9EC','#D2F5F1','#FFD6D6','#FFE1C4']
const DARK   = ['#C8323A','#C2621A','#A88600','#1E8A4E','#1F63B8','#5A34B8','#B8307C','#0F8A80','#C8323A','#C2621A']
const JACKPOT_RE = /상금|이벤트|당첨|1등|JACKPOT/i
const LIFT_PX = 140            // #rbox.lift 가 올라가는 높이 (CSS 와 동일)
const REVEAL_GAP_MS = 700      // 정지 → 결과 공개 사이 최소 간격 (펄스가 보이도록)

const rbox      = document.getElementById('rbox')
const wheelWrap = document.getElementById('wheel-wrap')
const textWrap  = document.getElementById('text-wrap')
const wcanvas   = document.getElementById('wcanvas')
const ctx       = wcanvas.getContext('2d')
const wRes      = document.getElementById('wheel-result')
const slotInner = document.getElementById('slot-inner')
const textRes   = document.getElementById('text-result')
const tBody     = document.getElementById('t-body')
const pinSvg    = document.getElementById('wpin')
let hideTimer   = null

// 캔버스: CSS 400px, DPR 대응
const SIZE = 400
const DPR  = Math.max(1, window.devicePixelRatio || 1)
wcanvas.width = SIZE * DPR; wcanvas.height = SIZE * DPR
wcanvas.style.width = SIZE + 'px'; wcanvas.style.height = SIZE + 'px'
ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

function show() { rbox.classList.add('show') }
function hide() {
  rbox.classList.remove('show'); rbox.classList.remove('lift')
  clearPending(); FX.hideWinner(); FX.spinStop(); FX.drumStop()
}
let dotsBuilt = false
function setMode(m) {
  wheelWrap.classList.toggle('active', m === 'wheel')
  textWrap.classList.toggle('active', m === 'text')
  if (m === 'text' && !dotsBuilt) { if (tBody) { buildDots(tBody); dotsBuilt = true } }
}

// ── LED dots for text frame (캡슐 둘레를 따라 등간격 배치) ─────────────────────
// .t-body 는 width 660 고정, 높이 = 4(border)+32(pad)+3(inner border)+84(slot)+3+32+4 = 162 → 측정하지 않고 상수 사용
const T_BODY_W = 660, T_BODY_H = 162
function buildDots(el) {
  const W = T_BODY_W, H = T_BODY_H
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
        dot.style.setProperty('--i', String(i))
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
function estW(str) { let w = 0; for (const ch of str) w += ch === ' ' ? 0.3 : /[ㄱ-힝]/.test(ch) ? 1.0 : 0.58; return w }
function normRot(a) { a = ((a + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI; if (Math.abs(a) > Math.PI/2) a += a > 0 ? -Math.PI : Math.PI; return a }

let lastItems = null, lastAngle = 0, lastHub = 'spin'
// 당첨 조각 강조: { idx, a (0~1 밝기), ring (금색 테두리 유지) } / 전구: 'off' | 'chase' | 'gold'
let lastHl = null, lastBulbs = 'off'
function redraw() { if (lastItems) drawWheel(lastItems, lastAngle, lastHub) }

function drawWheel(items, angle, hub) {
  lastItems = items; lastAngle = angle; lastHub = hub
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
  // 당첨 조각 강조 (흰색으로 밝아졌다 돌아오기 + 금색 테두리)
  if (lastHl && labels[lastHl.idx]) {
    const l = labels[lastHl.idx]
    if (lastHl.a > 0) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, segR, l.start, l.start + l.sweep); ctx.closePath()
      ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * lastHl.a).toFixed(3) + ')'; ctx.fill()
    }
    const ringA = Math.max(lastHl.ring ? 0.95 : 0, lastHl.a)
    if (ringA > 0) {
      ctx.save()
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, segR - 2, l.start, l.start + l.sweep); ctx.closePath()
      ctx.strokeStyle = 'rgba(255,201,40,' + ringA.toFixed(3) + ')'; ctx.lineWidth = 6; ctx.lineJoin = 'round'
      ctx.shadowColor = 'rgba(255,201,40,' + (0.9 * ringA).toFixed(3) + ')'; ctx.shadowBlur = 14
      ctx.stroke()
      ctx.restore()
    }
  }
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

  // 크림 전구 (회전 중엔 금색 체이스, 공개 때 금색 플래시)
  const nDots = 20, dotR = 9
  const phase = Math.floor(performance.now() / 110) % 2
  for (let i = 0; i < nDots; i++) {
    const a = (i / nDots) * Math.PI * 2 - Math.PI/2
    const x = cx + Math.cos(a)*dotRingR, y = cy + Math.sin(a)*dotRingR
    let lit = false
    if (lastBulbs === 'chase') lit = i % 2 === phase
    else if (lastBulbs === 'gold') lit = true
    ctx.beginPath(); ctx.arc(x, y + 1.5, dotR, 0, Math.PI*2); ctx.fillStyle = 'rgba(23,36,55,0.22)'; ctx.fill()
    if (lit) { ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = 12 }
    ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI*2); ctx.fillStyle = lit ? GOLD : CREAM; ctx.fill()
    if (lit) ctx.restore()
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

// 12시 핀 아래에 있는 조각 index (angle = drawWheel 의 시작각)
function segmentUnderPin(items, angle) {
  const total = items.reduce((s, i) => s + i.probability, 0) || 1
  const TAU = Math.PI * 2
  let rel = ((-Math.PI/2 - angle) % TAU + TAU) % TAU   // 핀 각도를 휠 로컬 좌표로
  let cum = 0
  for (let i = 0; i < items.length; i++) {
    cum += (items[i].probability / total) * TAU
    if (rel < cum) return i
  }
  return items.length - 1
}

// 핀 튕김: 조각 경계를 넘을 때마다 회전 방향으로 12° 기울었다 복귀
let kickAnim = null
function kickPin() {
  if (!pinSvg || !pinSvg.animate) return
  if (kickAnim) kickAnim.cancel()
  kickAnim = pinSvg.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(12deg)', offset: 0.28 }, { transform: 'rotate(-2.5deg)', offset: 0.72 }, { transform: 'rotate(0deg)' }],
    { duration: 170, easing: 'ease-out' })
}

// ── 정지 → 공개 타이밍 ─────────────────────────────────────────────────────
// game:result 는 spinMs 직후 바로 오므로, 정지 연출(플래시·펄스)이 보이도록 공개를 REVEAL_GAP_MS 만큼 띄운다.
let spinToken = 0            // 새 회전이 시작되면 이전 애니메이션 루프 무효화
let stoppedAt = 0            // 마지막 정지 시각 (0 = 아직 회전 중)
let pendingResult = null     // 회전 중 도착한 결과 (정지 후 공개)
let revealTimer = null
function clearPending() { pendingResult = null; if (revealTimer) { clearTimeout(revealTimer); revealTimer = null } }
function scheduleReveal(fn) {
  if (revealTimer) clearTimeout(revealTimer)
  const wait = stoppedAt ? Math.max(0, stoppedAt + REVEAL_GAP_MS - performance.now()) : 0
  if (wait === 0) { revealTimer = null; fn(); return }
  revealTimer = setTimeout(() => { revealTimer = null; fn() }, wait)
}
function onStopped() {
  stoppedAt = performance.now()
  if (pendingResult) { const r = pendingResult; pendingResult = null; scheduleReveal(() => revealResult(r.result, r.animType)) }
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
  const token = ++spinToken
  const t0 = performance.now()
  function ease(t) { return 1 - Math.pow(1-t, 3) }
  lastHl = null; lastBulbs = 'chase'
  let lastSeg = segmentUnderPin(items, 0), lastTickAt = 0
  FX.spinStart()
  ;(function tick(now) {
    if (token !== spinToken) return
    const t = Math.min(1, (now - t0) / spinMs)
    const angle = ease(t) * finalAngle
    drawWheel(items, angle, 'spin')
    // 조각 경계 통과 → 틱 소리 + 핀 튕김 (최대 ~25/s)
    const seg = segmentUnderPin(items, angle)
    if (seg !== lastSeg) {
      lastSeg = seg
      if (now - lastTickAt >= 40) { lastTickAt = now; FX.sound('tick'); kickPin() }
    }
    if (t < 1) requestAnimationFrame(tick)
    else wheelStopped(token, winnerIdx)
  })(t0)
}

// 정지: 윙 소리 끝 + 쿵 + 플래시 + 당첨 조각 3회 펄스 (~1s) → 이후 금색 테두리 유지
function wheelStopped(token, winnerIdx) {
  FX.spinStop(); FX.sound('stop'); FX.flash('rgba(255,255,255,.6)')
  kickPin()
  const idx = (lastItems && lastItems[winnerIdx]) ? winnerIdx : segmentUnderPin(lastItems || [], lastAngle)
  lastBulbs = 'gold'
  const p0 = performance.now(), DUR = 1000
  ;(function pulse(now) {
    if (token !== spinToken) return
    const p = Math.min(1, (now - p0) / DUR)
    const a = Math.pow(Math.max(0, Math.sin(p * Math.PI * 3)), 1.4)   // 3번 밝아짐
    lastHl = { idx, a, ring: true }
    lastBulbs = a > 0.35 ? 'gold' : 'off'
    redraw()
    if (p < 1) requestAnimationFrame(pulse)
    else { lastHl = { idx, a: 0, ring: true }; lastBulbs = 'off'; redraw() }
  })(p0)
  onStopped()
}

// ── Text spin (위에서 아래로) ─────────────────────────────────────────────────
let textLandTimer = null
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
  if (tBody) { tBody.classList.remove('landed'); tBody.classList.add('spinning') }
  const token = ++spinToken
  FX.drumStart(140)
  // double rAF ensures browser flushes the reset before starting transition
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== spinToken) return
    slotInner.style.transition = 'transform ' + spinMs + 'ms cubic-bezier(0.2,0,0.1,1)'
    slotInner.style.transform  = 'translateY(0)'  // scroll DOWN to winner
    if (textLandTimer) clearTimeout(textLandTimer)
    textLandTimer = setTimeout(() => { textLandTimer = null; if (token === spinToken) textLanded() }, spinMs)
  }))
}
function textLanded() {
  FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,255,255,.45)')
  if (tBody) { tBody.classList.remove('spinning'); tBody.classList.add('landed') }
  onStopped()
}

// ── Handlers ──────────────────────────────────────────────────────────────────
const tSlotOuter = document.querySelector('.t-slot-outer')

function startSpin(data) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (textLandTimer) { clearTimeout(textLandTimer); textLandTimer = null }
  clearPending(); stoppedAt = 0
  FX.hideWinner(); FX.spinStop(); FX.drumStop()
  rbox.classList.remove('lift')
  wRes.style.display = 'none'; textRes.style.display = 'none'
  if (tSlotOuter) tSlotOuter.style.display = 'block'
  setMode(data.animType ?? 'wheel'); show()
  if (data.animType === 'text') spinText(data.items, data.winner, data.spinMs)
  else spinWheel(data.items, data.winnerIdx, data.spinMs)
}

function showResult(result, animType) {
  // 숨김 타이머는 결과 도착 기준 7초 유지
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, 7000)
  if (!stoppedAt) { pendingResult = { result, animType }; return }   // 아직 회전 중 → 정지 후 공개
  scheduleReveal(() => revealResult(result, animType))
}

function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 } }
// 배너 기준점: #rbox 가 LIFT_PX 만큼 올라간 뒤의 위치 (전환 중이라도 최종 위치 기준으로 계산)
function liftedAnchor() {
  const r = rbox.getBoundingClientRect()
  const lifted = rbox.classList.contains('lift')
  const dy = lifted ? 0 : LIFT_PX
  const rect = { left: r.left, right: r.right, width: r.width, height: r.height, top: r.top - dy, bottom: r.bottom - dy }
  return { getBoundingClientRect: () => rect }
}

function revealResult(result, animType) {
  const txt = result.result
  const jackpot = JACKPOT_RE.test(String(txt || ''))
  const miss    = /^\s*꽝/.test(String(txt || ''))   // 꽝은 팡파르 대신 꽝 소리
  let pill, burstEl, center
  if (animType === 'text') {
    if (tSlotOuter) tSlotOuter.style.display = 'none'
    textRes.textContent = txt
    textRes.style.display = 'flex'
    pill = textRes; center = centerOf(tBody || textRes)
    const c = centerOf(textRes), s = 150
    burstEl = { getBoundingClientRect: () => ({ left: c.x - s/2, top: c.y - s/2, width: s, height: s }) }
  } else {
    lastHub = 'badge'; redraw()
    wRes.textContent = txt; wRes.style.display = 'block'
    pill = wRes; burstEl = wRes; center = centerOf(wcanvas)
  }
  // 공개: 팝 + 팡파르 (잭팟이면 색종이)
  FX.sound(jackpot ? 'jackpot' : miss ? 'lose' : 'win')
  if (jackpot) { FX.confetti({ x: center.x, y: center.y, count: 200 }); FX.flash('rgba(255,201,40,.35)') }
  setTimeout(() => { if (pill.style.display !== 'none') FX.burst(burstEl, '#FF5B17') }, 130)
  // 여운: 당첨자 배너 (오버레이를 살짝 들어 배너 자리를 만든다)
  const by = result.triggeredBy
  const anchor = liftedAnchor()
  rbox.classList.add('lift')
  setTimeout(() => {
    if (!rbox.classList.contains('show')) return
    if (by && by !== '스트리머' && by !== 'weflab') FX.winner({ nick: by, balloons: result.balloon, sub: '룰렛 당첨', anchor, ms: 6000, icon: jackpot ? '🎉' : '🏆' })
    else FX.winner({ text: txt, sub: '룰렛 결과', anchor, ms: 6000, icon: '🎡' })
  }, 350)
}

let lastAnimType = 'wheel'

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)   // overlay:config → 효과음 on/off·볼륨 즉시 반영
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
