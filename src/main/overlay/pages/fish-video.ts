// OBS 오버레이 페이지: fish (영상 클립 모드) — 찌 던지기 → 입질 → 챔질 → 결과 를 영상처럼 이어서 재생
// 기본은 내장 애니메이션(SVG). <userData>/data/media/fish/ 에 클립이 있으면 그 영상을 단계별로 재생한다:
//   cast.mp4 | wait.mp4 | bite.mp4 | hook.mp4 | result-common.mp4 result-uncommon.mp4 result-rare.mp4 result-legendary.mp4 (없으면 result.mp4)
//   (webm 도 됨. cast + result* 가 있어야 영상 모드로 전환, 빠진 단계는 내장 애니메이션으로 대체)
import { FX_SCRIPT } from './_fx'

export const FISH_VIDEO_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&family=Inter:wght@700;800&display=swap" rel="stylesheet">
<style>
  :root{ --navy:#172437; --orange:#FF5B17; --cream:#F5F3EF; --mint:#00CB84; --gold:#FFC928; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:transparent !important; overflow:hidden; width:1920px; height:1080px; font-family:'Noto Sans KR',sans-serif; }
  #stage { position:absolute; left:50%; top:50%; width:1280px; height:720px; transform:translate(-50%,-50%) scale(.92); opacity:0; transition:transform .5s cubic-bezier(.2,1.3,.3,1), opacity .35s; border-radius:26px; border:8px solid var(--orange); outline:4px solid var(--navy); background:var(--navy); overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.45); }
  #stage.show { opacity:1; transform:translate(-50%,-50%) scale(1); }
  #scene { position:absolute; inset:0; }
  #video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:none; background:#000; }
  .tag { position:absolute; left:22px; top:18px; z-index:5; display:flex; align-items:center; gap:10px; padding:8px 18px 8px 14px; border-radius:999px; background:var(--cream); color:var(--navy); font-weight:900; font-size:24px; border:3px solid var(--navy); box-shadow:0 4px 0 rgba(0,0,0,.25); }
  .live { position:absolute; right:22px; top:22px; z-index:5; padding:6px 14px; border-radius:8px; background:var(--orange); color:#fff; font-family:Inter,sans-serif; font-weight:800; letter-spacing:.08em; font-size:14px; animation:blink 1.1s steps(2) infinite; }
  @keyframes blink { to { opacity:.35 } }
  .steps { position:absolute; left:50%; top:22px; transform:translateX(-50%); z-index:5; display:flex; gap:8px; }
  .step { padding:7px 16px; border-radius:999px; background:rgba(23,36,55,.78); color:#aeb8c8; font-weight:800; font-size:15px; border:2px solid rgba(255,255,255,.14); transition:all .25s; }
  .step.on { background:var(--orange); color:#fff; border-color:#fff; transform:scale(1.08); box-shadow:0 0 18px rgba(255,91,23,.6); }
  .step.done { background:var(--mint); color:var(--navy); border-color:var(--mint); }
  #caption { position:absolute; left:0; right:0; bottom:0; z-index:5; padding:16px 28px; background:linear-gradient(transparent, rgba(23,36,55,.92)); color:#fff; font-weight:900; font-size:34px; letter-spacing:-.01em; display:flex; align-items:center; gap:14px; min-height:90px; }
  #caption small { font-size:18px; font-weight:700; color:#c9d1de; }
  #caption .bang { color:var(--orange); animation:pulse .5s ease-in-out infinite alternate; }
  @keyframes pulse { to { transform:scale(1.15) } }
  #resultBox { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%) scale(.6); z-index:6; text-align:center; opacity:0; transition:transform .55s cubic-bezier(.2,1.4,.3,1), opacity .3s; pointer-events:none; }
  #resultBox.show { opacity:1; transform:translate(-50%,-50%) scale(1); }
  #fishBig { font-size:150px; line-height:1; filter:drop-shadow(0 12px 24px rgba(0,0,0,.45)); }
  #fishName { margin-top:6px; font-size:58px; font-weight:900; color:#fff; text-shadow:0 4px 0 var(--navy), 0 0 24px rgba(0,0,0,.5); letter-spacing:-.02em; }
  #rarity { display:inline-block; margin-top:10px; padding:8px 22px; border-radius:999px; font-weight:900; font-size:22px; color:var(--navy); background:var(--cream); border:3px solid var(--navy); }
  #rarity.legendary { background:var(--gold); } #rarity.rare { background:#C9B6FF; } #rarity.uncommon { background:#9DE0C0; }
  .glow { position:absolute; left:50%; top:46%; width:520px; height:520px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, rgba(255,201,40,.55), rgba(255,201,40,0) 65%); opacity:0; transition:opacity .4s; z-index:4; pointer-events:none; }
  .glow.on { opacity:1; animation:spinGlow 6s linear infinite; }
  @keyframes spinGlow { to { transform:translate(-50%,-50%) rotate(360deg) } }
  .rays { position:absolute; left:50%; top:46%; width:900px; height:900px; transform:translate(-50%,-50%); background:repeating-conic-gradient(rgba(255,255,255,.14) 0 6deg, transparent 6deg 14deg); border-radius:50%; opacity:0; z-index:3; pointer-events:none; mask:radial-gradient(circle, #000 20%, transparent 70%); -webkit-mask:radial-gradient(circle, #000 20%, transparent 70%); }
  .rays.on { opacity:1; animation:spinGlow 10s linear infinite; }
  #stage.shake { animation:shake .45s; }
  @keyframes shake { 0%,100%{transform:translate(-50%,-50%)} 20%{transform:translate(calc(-50% - 10px),calc(-50% + 4px)) rotate(-.6deg)} 40%{transform:translate(calc(-50% + 10px),calc(-50% - 4px)) rotate(.6deg)} 60%{transform:translate(calc(-50% - 6px),-50%)} 80%{transform:translate(calc(-50% + 6px),-50%)} }
  .wave { animation:waveMove 4s linear infinite; }
  .wave.w2 { animation-duration:6.5s; animation-direction:reverse; opacity:.6; }
  @keyframes waveMove { from { transform:translateX(0) } to { transform:translateX(-160px) } }
</style>
</head>
<body>
<div id="stage">
  <video id="video" playsinline preload="auto"></video>
  <svg id="scene" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3a6b"/><stop offset=".55" stop-color="#3f7fc4"/><stop offset="1" stop-color="#9fd0ee"/></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e6fb0"/><stop offset="1" stop-color="#0b2f5c"/></linearGradient>
      <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff5c2"/><stop offset=".4" stop-color="#ffd36a"/><stop offset="1" stop-color="rgba(255,211,106,0)"/></radialGradient>
      <linearGradient id="rodG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3a1e"/><stop offset=".3" stop-color="#8a5a2b"/><stop offset="1" stop-color="#d9c7a0"/></linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#sky)"/>
    <circle cx="1040" cy="150" r="130" fill="url(#sun)"/>
    <g opacity=".9"><ellipse cx="280" cy="150" rx="110" ry="34" fill="#fff" opacity=".85"/><ellipse cx="340" cy="135" rx="80" ry="30" fill="#fff" opacity=".9"/><ellipse cx="760" cy="90" rx="90" ry="26" fill="#fff" opacity=".7"/></g>
    <rect x="0" y="400" width="1280" height="320" fill="url(#sea)"/>
    <g class="wave"><path d="M-160 404 Q-120 392 -80 404 T0 404 T80 404 T160 404 T240 404 T320 404 T400 404 T480 404 T560 404 T640 404 T720 404 T800 404 T880 404 T960 404 T1040 404 T1120 404 T1200 404 T1280 404 T1360 404 T1440 404 V430 H-160 Z" fill="#2f8fd6"/></g>
    <g class="wave w2"><path d="M-160 420 Q-120 410 -80 420 T0 420 T80 420 T160 420 T240 420 T320 420 T400 420 T480 420 T560 420 T640 420 T720 420 T800 420 T880 420 T960 420 T1040 420 T1120 420 T1200 420 T1280 420 T1360 420 T1440 420 V450 H-160 Z" fill="#4aa6e8"/></g>
    <g id="ripples"></g>
    <g id="splash"></g>
    <path id="line" d="" fill="none" stroke="#f5f3ef" stroke-width="2.5" stroke-linecap="round" opacity=".95"/>
    <g id="bobber" transform="translate(-100,-100)">
      <ellipse cx="0" cy="22" rx="12" ry="5" fill="rgba(0,0,0,.25)"/>
      <path d="M-16 0 a16 16 0 0 1 32 0 Z" fill="#E0342C"/>
      <path d="M-16 0 a16 16 0 0 0 32 0 Z" fill="#F5F3EF"/>
      <rect x="-3" y="-30" width="6" height="14" rx="3" fill="#172437"/>
    </g>
    <g id="rodG" transform="translate(1180,690)">
      <g id="rod">
        <path d="M0 0 L-10 -8 L-330 -430 L-322 -436 Z" fill="url(#rodG)" stroke="#2b1b0d" stroke-width="2"/>
        <rect x="-26" y="-60" width="26" height="80" rx="8" fill="#172437" transform="rotate(38)"/>
        <circle cx="-30" cy="-30" r="18" fill="#FF5B17" stroke="#172437" stroke-width="3"/>
      </g>
    </g>
    <g id="fishJump" transform="translate(-200,-200)" opacity="0"><text id="fishEmoji" x="0" y="0" font-size="110" text-anchor="middle" dominant-baseline="middle">🐟</text></g>
  </svg>
  <div class="rays" id="rays"></div><div class="glow" id="glow"></div>
  <div class="tag">🎣 낚시</div>
  <div class="live" id="live">LIVE</div>
  <div class="steps"><span class="step" data-p="cast">찌 던지기</span><span class="step" data-p="wait">기다리기</span><span class="step" data-p="bite">입질</span><span class="step" data-p="hook">챔질</span><span class="step" data-p="reveal">결과</span></div>
  <div id="resultBox"><div id="fishBig">🐟</div><div id="fishName"></div><div id="rarity"></div></div>
  <div id="caption"><span id="capMain">낚시 준비 중</span><small id="capSub"></small></div>
</div>
<script>${FX_SCRIPT}<\/script>
<script>
const $ = id => document.getElementById(id)
const stage = $('stage'), video = $('video'), scene = $('scene'), line = $('line'), bobber = $('bobber'), rod = $('rod'), ripples = $('ripples'), splash = $('splash')
const RAR = { common:['일반','#9DD3F5'], uncommon:['고급','#00CB84'], rare:['희귀','#C9B6FF'], legendary:['전설','#FFC928'] }
const TIP0 = { x: 1180 - 322, y: 690 - 436 }          // 로드 끝(기본 자세)
let media = null, token = 0, raf = null, hideT = null, cur = null

// 사용자 영상 클립 목록 (있으면 영상 모드)
fetch('/api/media/fish').then(r => r.json()).then(j => {
  const files = (j && j.files) || []
  const pick = n => files.find(f => new RegExp('^' + n + '\\\\.(mp4|webm|mov)$', 'i').test(f))
  const m = { cast: pick('cast'), wait: pick('wait'), bite: pick('bite'), hook: pick('hook'), result: pick('result'),
    rc: pick('result-common'), ru: pick('result-uncommon'), rr: pick('result-rare'), rl: pick('result-legendary') }
  media = (m.cast && (m.result || m.rc || m.ru || m.rr || m.rl)) ? m : null
}).catch(() => {})

function setStep(p){ document.querySelectorAll('.step').forEach(s => { const order = ['cast','wait','bite','hook','reveal']; const i = order.indexOf(s.dataset.p), j = order.indexOf(p); s.classList.toggle('on', i === j); s.classList.toggle('done', i < j) }) }
function cap(main, sub, bang){ $('capMain').innerHTML = (bang ? '<span class="bang">!</span> ' : '') + main; $('capSub').textContent = sub || '' }
function svgEl(tag, attrs){ const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e }
function ripple(x, y, big){ const r = svgEl('ellipse', { cx:x, cy:y, rx:4, ry:1.5, fill:'none', stroke:'rgba(255,255,255,.8)', 'stroke-width':2 }); ripples.appendChild(r)
  const t0 = performance.now(), dur = big ? 900 : 650; (function f(n){ const k = Math.min(1, (n - t0) / dur); r.setAttribute('rx', 4 + k * (big ? 90 : 46)); r.setAttribute('ry', 1.5 + k * (big ? 26 : 13)); r.setAttribute('opacity', 1 - k); if (k < 1) requestAnimationFrame(f); else r.remove() })(t0) }
function splashBurst(x, y, n){ for (let i = 0; i < (n || 14); i++) { const d = svgEl('circle', { cx:x, cy:y, r: 3 + Math.random() * 5, fill: i % 3 ? '#dff3ff' : '#ffffff' }); splash.appendChild(d)
  const vx = (Math.random() - .5) * 9, vy0 = -(5 + Math.random() * 9); let px = x, py = y, vy = vy0; const t0 = performance.now(); let last = t0
  ;(function f(now){ const dt = Math.min(2, (now - last) / 16.7); last = now; vy += .45 * dt; px += vx * dt; py += vy * dt; d.setAttribute('cx', px); d.setAttribute('cy', py); d.setAttribute('opacity', Math.max(0, 1 - (now - t0) / 900)); if (py < y + 60 && now - t0 < 1000) requestAnimationFrame(f); else d.remove() })(t0) } }
function setBobber(x, y, tilt){ bobber.setAttribute('transform', 'translate(' + x + ',' + y + ') rotate(' + (tilt || 0) + ')') }
function setLine(tx, ty, bx, by, slack){ const mx = (tx + bx) / 2, my = Math.max(ty, by) + (slack || 0); line.setAttribute('d', 'M' + tx + ' ' + ty + ' Q' + mx + ' ' + my + ' ' + bx + ' ' + by) }
function rodAngle(a){ rod.setAttribute('transform', 'rotate(' + a + ')') }
function tipAt(a){ const r = a * Math.PI / 180, dx = TIP0.x - 1180, dy = TIP0.y - 690; return { x: 1180 + dx * Math.cos(r) - dy * Math.sin(r), y: 690 + dx * Math.sin(r) + dy * Math.cos(r) } }
const ease = { out: t => 1 - Math.pow(1 - t, 3), inout: t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2 }

function reset(){ if (raf) cancelAnimationFrame(raf); raf = null; ripples.innerHTML = ''; splash.innerHTML = ''; setBobber(-100, -100); line.setAttribute('d', ''); rodAngle(0); $('fishJump').setAttribute('opacity', 0); $('resultBox').classList.remove('show'); $('glow').classList.remove('on'); $('rays').classList.remove('on'); $('rarity').className = ''; video.pause(); video.style.display = 'none'; scene.style.display = ''; FX.drumStop(); }
function show(){ stage.classList.add('show') }
function hide(){ stage.classList.remove('show'); FX.hideWinner(); FX.drumStop(); setTimeout(reset, 400) }

// 영상 모드: 해당 단계 클립이 있으면 재생 (없으면 내장 장면 유지)
function playClip(name){ if (!media || !media[name]) { video.style.display = 'none'; scene.style.display = ''; return false }
  video.src = '/media/fish/' + encodeURIComponent(media[name]); video.muted = !(FX.config && FX.config.enabled); video.volume = FX.config ? FX.config.volume : .7
  video.style.display = 'block'; scene.style.display = 'none'; video.currentTime = 0; video.play().catch(() => {}); return true }

function run(fs){
  const my = ++token; reset(); show(); cur = fs
  const tl = fs.timeline || { cast:1400, wait:1600, bite:1400, hook:700, reveal:2600 }
  const emoji = (String(fs.name).match(/\\p{Extended_Pictographic}+/u) || ['🐟'])[0]
  const nameOnly = String(fs.name).replace(/\\p{Extended_Pictographic}/gu, '').replace(/\\uFE0F/g, '').trim() || fs.name
  const rar = RAR[fs.rarity] || RAR.common
  const WATER = { x: 520, y: 405 }
  const at = (ms, fn) => setTimeout(() => { if (my === token) fn() }, ms)
  let t = 0

  // ── 1. 찌 던지기 ──
  setStep('cast'); cap('찌 던지기', fs.triggeredBy ? fs.triggeredBy + '님의 낚시' : '')
  if (!playClip('cast')) {
    FX.sound('whoosh')
    const t0 = performance.now()
    ;(function f(n){ if (my !== token) return; const k = Math.min(1, (n - t0) / tl.cast)
      // 로드: 뒤로 젖혔다가(−35°) 앞으로 휘두름(+12°) 후 복귀
      const a = k < .35 ? -35 * ease.out(k / .35) : k < .6 ? -35 + 47 * ease.out((k - .35) / .25) : 12 - 12 * ease.inout((k - .6) / .4)
      rodAngle(a); const tip = tipAt(a)
      if (k < .4) { setBobber(tip.x - 6, tip.y + 14, 0); setLine(tip.x, tip.y, tip.x - 6, tip.y + 14, 10) }
      else { const q = ease.out((k - .4) / .6); const bx = tip.x + (WATER.x - tip.x) * q, by = tip.y + (WATER.y - tip.y) * q - 260 * Math.sin(Math.PI * q); setBobber(bx, by, -20 + 40 * q); setLine(tip.x, tip.y, bx, by, 40 * (1 - q))
        if (q >= .999 && !f.done) { f.done = true; FX.sound('pop'); splashBurst(WATER.x, WATER.y, 12); ripple(WATER.x, WATER.y, true) } }
      if (k < 1) raf = requestAnimationFrame(f) })(t0)
  }
  t += tl.cast

  // ── 2. 기다리기 ──
  at(t, () => { setStep('wait'); cap('입질을 기다리는 중…', '찌를 지켜보세요')
    if (!playClip('wait')) { const t0 = performance.now(); let lastR = 0
      ;(function f(n){ if (my !== token) return; const e = n - t0; if (e > tl.wait) return
        const tip = tipAt(0); const by = WATER.y + Math.sin(e / 420) * 4; setBobber(WATER.x, by, Math.sin(e / 600) * 6); setLine(tip.x, tip.y, WATER.x, by, 30)
        if (e - lastR > 700) { lastR = e; ripple(WATER.x, WATER.y, false) }
        raf = requestAnimationFrame(f) })(t0) } })
  t += tl.wait

  // ── 3. 입질 ──
  at(t, () => { setStep('bite'); cap('입질!', '찌가 들어갑니다', true); FX.drumStart(130)
    if (!playClip('bite')) { const t0 = performance.now(); const dips = [0, 420, 820, 1150]; let di = 0
      ;(function f(n){ if (my !== token) return; const e = n - t0; if (e > tl.bite) return
        const tip = tipAt(0); let depth = 0
        while (di < dips.length && e >= dips[di]) { FX.sound('tick'); ripple(WATER.x, WATER.y, di === dips.length - 1); di++ }
        const phase = dips.length ? (e - (dips[Math.max(0, di - 1)] || 0)) : 0; depth = Math.max(0, 1 - phase / 350) * (8 + di * 10)
        setBobber(WATER.x, WATER.y + depth, (Math.random() - .5) * 18); setLine(tip.x, tip.y, WATER.x, WATER.y + depth, 26)
        raf = requestAnimationFrame(f) })(t0) } })
  t += tl.bite

  // ── 4. 챔질 ──
  at(t, () => { setStep('hook'); cap('챔질!', '', true); FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,255,255,.35)'); stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake')
    if (!playClip('hook')) { const t0 = performance.now(); splashBurst(WATER.x, WATER.y, 26); ripple(WATER.x, WATER.y, true)
      ;(function f(n){ if (my !== token) return; const k = Math.min(1, (n - t0) / tl.hook); const a = -28 * Math.sin(Math.PI * Math.min(1, k * 1.2)); rodAngle(a); const tip = tipAt(a)
        const by = WATER.y - 20 * ease.out(k); setBobber(WATER.x + 30 * k, by, -30 * k); setLine(tip.x, tip.y, WATER.x + 30 * k, by, -10)
        if (k < 1) raf = requestAnimationFrame(f) })(t0) } })
  t += tl.hook

  // ── 5. 결과 ──
  at(t, () => { setStep('reveal'); cap(nameOnly + ' 낚았다!', rar[0] + ' 등급')
    const clip = { common:'rc', uncommon:'ru', rare:'rr', legendary:'rl' }[fs.rarity]
    const usedVideo = playClip(media && media[clip] ? clip : 'result')
    if (!usedVideo) { // 물고기가 물에서 튀어올라 가운데로
      const fj = $('fishJump'); $('fishEmoji').textContent = emoji; fj.setAttribute('opacity', 1); splashBurst(WATER.x, WATER.y, 30)
      const t0 = performance.now(); const to = { x: 640, y: 330 }
      ;(function f(n){ if (my !== token) return; const k = Math.min(1, (n - t0) / 700); const q = ease.out(k)
        const x = WATER.x + (to.x - WATER.x) * q, y = WATER.y + (to.y - WATER.y) * q - 120 * Math.sin(Math.PI * q); fj.setAttribute('transform', 'translate(' + x + ',' + y + ') rotate(' + (-25 + 25 * q) + ') scale(' + (.6 + .9 * q) + ')')
        if (k < 1) raf = requestAnimationFrame(f); else fj.setAttribute('opacity', 0) })(t0)
    }
    FX.sound('reveal')
    at(usedVideo ? 300 : 650, () => {
      $('fishBig').textContent = emoji; $('fishName').textContent = nameOnly; $('rarity').textContent = rar[0] + ' 등급'; $('rarity').className = fs.rarity; $('resultBox').classList.add('show')
      const c = stage.getBoundingClientRect(); const cx = c.left + c.width / 2, cy = c.top + c.height * .46
      if (fs.rarity === 'legendary') { FX.sound('jackpot'); FX.flash('rgba(255,201,40,.6)'); $('glow').classList.add('on'); $('rays').classList.add('on'); FX.confetti({ x:cx, y:cy, count:220, colors:['#FFC928','#FF5B17','#fff','#FFE49A'] }) }
      else if (fs.rarity === 'rare') { FX.sound('win'); $('rays').classList.add('on'); FX.confetti({ x:cx, y:cy, count:120 }) }
      else if (fs.rarity === 'uncommon') { FX.sound('coin'); FX.burst($('resultBox'), '#00CB84') }
      else { FX.sound('pop') }
      const by = fs.triggeredBy
      if (by && by !== '스트리머' && by !== 'weflab') FX.winner({ nick: by, balloons: fs.balloon, text: nameOnly, sub: '낚시 · ' + rar[0], anchor: stage, ms: 6500 })
      else FX.winner({ text: nameOnly, sub: '낚시 결과 · ' + rar[0], anchor: stage, ms: 6500 })
    })
  })
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data); FX.handle(msg)
      if (msg.type === 'game:state' && msg.data?.id === 'fish') {
        const s = msg.data
        if (s.status === 'running' && s.fish) { if (!cur || cur.startedAt !== s.fish.startedAt) run(s.fish) }
        else if (s.status === 'showing_result') { if (!cur && s.result) { // 진행 중에 오버레이가 열린 경우: 결과만 바로
            run({ name: s.result.result, rarity: (String(s.result.detail).match(/\\((common|uncommon|rare|legendary)\\)/) || [])[1] || 'common', triggeredBy: s.result.triggeredBy, balloon: s.result.balloon, startedAt: s.result.ts, timeline: { cast:0, wait:0, bite:0, hook:0, reveal:2600 } }) }
          if (hideT) clearTimeout(hideT); hideT = setTimeout(() => { hide(); cur = null }, 6500) }
        else if (s.status === 'idle') { if (hideT) clearTimeout(hideT); hideT = setTimeout(() => { hide(); cur = null }, 1200) }
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
    } catch {}
  }
  ws.onopen  = () => { if (window.__wsDown) location.reload() }
  ws.onclose = () => { window.__wsDown = true; setTimeout(connect, 2000) }
}
connect()
<\/script>
</body>
</html>`
