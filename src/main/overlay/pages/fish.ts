// OBS 오버레이 페이지: fish (낚시 — 찌를 던지고 입질 후 물고기 공개, 누적 기록 표시)
export const FISH_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root { --navy:#172437; --orange:#FF5B17; --cream:#F5F3EF; --mint:#00CB84; --gold:#FFC61A;
          --c-common:#8A94A6; --c-uncommon:#12A866; --c-rare:#2F6BFF; --c-legendary:#F2A600; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #card {
    position: fixed; left: 50%; bottom: 60px; width: 620px;
    transform: translateX(-50%) translateY(200px); opacity: 0;
    transition: transform .5s cubic-bezier(.34,1.56,.64,1), opacity .35s;
    filter: drop-shadow(0 22px 40px rgba(0,0,0,.45));
  }
  #card.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  .frame { background: var(--orange); border: 5px solid var(--navy); border-radius: 28px; padding: 13px; }
  .inner { background: var(--navy); border-radius: 18px; padding: 14px 16px 16px; }
  .head { display: flex; align-items: center; height: 44px; margin-bottom: 10px; }
  .title { font-size: 30px; font-weight: 900; color: var(--cream); }
  .title .st { color: var(--gold); margin: 0 6px; font-size: 22px; }
  .who { margin-left: auto; height: 36px; padding: 0 16px; border-radius: 18px; background: var(--cream); color: var(--navy);
         font-size: 18px; font-weight: 900; display: flex; align-items: center; max-width: 260px; overflow: hidden; white-space: nowrap; }

  /* 낚시터 (560 × 250 고정) */
  .scene { position: relative; width: 562px; height: 250px; border-radius: 14px; overflow: hidden; border: 3px solid #0E1726;
           background: linear-gradient(180deg, #9ED8FF 0%, #CDEBFF 42%, #2C7FD1 42%, #1A5FA8 100%); }
  .sun { position: absolute; left: 40px; top: 20px; width: 54px; height: 54px; border-radius: 50%; background: #FFE27A; box-shadow: 0 0 24px #FFE27A; }
  .wave { position: absolute; left: -40px; right: -40px; top: 98px; height: 14px;
          background: radial-gradient(circle at 20px -4px, transparent 14px, rgba(255,255,255,.55) 15px, transparent 17px) 0 0 / 40px 14px repeat-x;
          animation: drift 3s linear infinite; }
  @keyframes drift { to { transform: translateX(40px) } }
  .line { position: absolute; left: 560px; top: 0; width: 2px; height: 0; background: rgba(23,36,55,.8); transform-origin: top left; }
  .bobber { position: absolute; left: 300px; top: 88px; width: 26px; height: 34px; opacity: 0; transition: top .5s ease, opacity .3s; }
  .bobber::before { content: ''; position: absolute; left: 3px; top: 0; width: 20px; height: 17px; border-radius: 10px 10px 0 0; background: var(--orange); border: 2px solid var(--navy); border-bottom: none; }
  .bobber::after  { content: ''; position: absolute; left: 3px; top: 15px; width: 20px; height: 17px; border-radius: 0 0 10px 10px; background: #fff; border: 2px solid var(--navy); border-top: none; }
  .bobber.in { opacity: 1; }
  .bobber.wait { animation: bob 1.4s ease-in-out infinite; }
  .bobber.bite { animation: bite .18s ease-in-out infinite; }
  @keyframes bob  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(5px) } }
  @keyframes bite { 0%,100% { transform: translateY(6px) rotate(-8deg) } 50% { transform: translateY(14px) rotate(8deg) } }
  .ring { position: absolute; left: 283px; top: 108px; width: 60px; height: 18px; border-radius: 50%; border: 3px solid rgba(255,255,255,.8); opacity: 0; }
  .ring.on { animation: ring .7s ease-out infinite; }
  @keyframes ring { from { transform: scale(.4); opacity: 1 } to { transform: scale(2.2); opacity: 0 } }
  .status { position: absolute; left: 0; right: 0; bottom: 14px; text-align: center; font-size: 22px; font-weight: 900; color: #fff;
            text-shadow: 0 2px 0 rgba(23,36,55,.6); }

  /* 결과 카드 (낚시터 위에 겹침) */
  .catch { position: absolute; inset: 18px 40px; border-radius: 18px; background: var(--cream); border: 4px solid var(--c, var(--navy));
           display: flex; align-items: center; gap: 18px; padding: 0 22px; opacity: 0; transform: scale(.6); pointer-events: none;
           transition: opacity .35s, transform .45s cubic-bezier(.34,1.56,.64,1); }
  .catch.on { opacity: 1; transform: scale(1); }
  .catch.legend { box-shadow: 0 0 0 4px var(--gold), 0 0 40px rgba(255,198,26,.9); }
  .femoji { font-size: 96px; line-height: 110px; flex: none; }
  .fname { font-size: 38px; font-weight: 900; color: var(--navy); letter-spacing: -0.02em; line-height: 1.1; }
  .ftag { display: inline-block; margin-top: 6px; height: 30px; padding: 0 12px; border-radius: 15px; background: var(--c, var(--navy));
          color: #fff; font-size: 16px; font-weight: 900; line-height: 30px; }
  .fstat { margin-top: 8px; font-size: 18px; font-weight: 800; color: var(--navy); }
  @keyframes confettiFall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  .cf { position: fixed; top: -20px; width: 9px; height: 15px; border-radius: 2px; animation: confettiFall 2.6s ease-in forwards; }
</style>
</head>
<body>
<div id="card">
  <div class="frame"><div class="inner">
    <div class="head">
      <div class="title"><span class="st">★</span>낚시 타임<span class="st">★</span></div>
      <div class="who" id="who"></div>
    </div>
    <div class="scene">
      <div class="sun"></div>
      <div class="wave"></div>
      <div class="line" id="line"></div>
      <div class="ring" id="ring"></div>
      <div class="bobber" id="bobber"></div>
      <div class="status" id="status"></div>
      <div class="catch" id="catch">
        <div class="femoji" id="femoji"></div>
        <div>
          <div class="fname" id="fname"></div>
          <div class="ftag" id="ftag"></div>
          <div class="fstat" id="fstat"></div>
        </div>
      </div>
    </div>
  </div></div>
</div>
<script>
var RARITY = { common: '일반', uncommon: '고급', rare: '희귀', legendary: '레전드' }
var card = document.getElementById('card'), who = document.getElementById('who'), line = document.getElementById('line')
var bobber = document.getElementById('bobber'), ring = document.getElementById('ring'), statusEl = document.getElementById('status')
var catchEl = document.getElementById('catch'), femoji = document.getElementById('femoji'), fname = document.getElementById('fname')
var ftag = document.getElementById('ftag'), fstat = document.getElementById('fstat')
var timers = [], hideTimer = null, runKey = null
// 낚싯줄: 오른쪽 위(560,0) → 찌(313,98). 고정 좌표로 길이·각도 계산 (측정 없음)
var LX = 560, LY = 0, BX = 313, BY = 98
var LINE_LEN = Math.sqrt((LX - BX) * (LX - BX) + (LY - BY) * (LY - BY))
var LINE_ANG = Math.atan2(BY - LY, BX - LX) * 180 / Math.PI - 90

function later(fn, ms) { timers.push(setTimeout(fn, Math.max(0, ms))) }
function cancelAll() { timers.forEach(clearTimeout); timers = [] }
function show() { card.classList.add('show') }
function hide() { card.classList.remove('show') }

function resetScene() {
  bobber.className = 'bobber'; bobber.style.top = '20px'; ring.className = 'ring'
  line.style.height = '0px'; line.style.transform = 'rotate(' + LINE_ANG + 'deg)'
  catchEl.className = 'catch'; statusEl.textContent = ''
}
function setCatch(f) {
  var fish = f.fish
  femoji.textContent = fish.emoji; fname.textContent = fish.name
  ftag.textContent = (RARITY[fish.rarity] || fish.rarity) + ' · +' + fish.points + '점'
  fstat.textContent = '누적 ' + f.count + '마리 · 총 ' + f.totalPoints + '점'
  catchEl.style.setProperty('--c', 'var(--c-' + fish.rarity + ')')
  catchEl.className = 'catch on' + (fish.rarity === 'legendary' ? ' legend' : '')
  bobber.className = 'bobber'; ring.className = 'ring'; statusEl.textContent = ''
  if (fish.rarity === 'legendary' || fish.rarity === 'rare') confetti(fish.rarity === 'legendary' ? 90 : 40)
}
function confetti(n) {
  var colors = ['#FF5B17', '#00CB84', '#FFC61A', '#F5F3EF', '#2F6BFF']
  for (var i = 0; i < n; i++) {
    var el = document.createElement('div'); el.className = 'cf'
    el.style.left = Math.random() * 100 + 'vw'; el.style.background = colors[i % colors.length]
    el.style.animationDelay = Math.random() * 0.8 + 's'
    document.body.appendChild(el); el.addEventListener('animationend', function () { this.remove() })
  }
}

function renderRunning(f) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  var key = 'f' + f.startedAt
  if (runKey === key) return
  cancelAll(); runKey = key
  who.textContent = f.triggeredBy + '님'
  resetScene(); show()
  var el = Date.now() - f.startedAt, T = f.castMs
  // 0~30% 던지기, 30~72% 기다림, 72~100% 입질, 100% 공개
  later(function () {
    line.style.transition = 'height .45s ease'; line.style.height = LINE_LEN + 'px'
    bobber.className = 'bobber in'; bobber.style.top = '88px'; statusEl.textContent = '찌를 던지는 중…'
  }, 50 - el)
  later(function () { bobber.className = 'bobber in wait'; statusEl.textContent = '입질을 기다리는 중…' }, T * 0.3 - el)
  later(function () { bobber.className = 'bobber in bite'; ring.className = 'ring on'; statusEl.textContent = '걸렸다!!' }, T * 0.72 - el)
  later(function () { setCatch(f) }, T - el)
}

function renderResult(s) {
  if (s.fish) {
    if (runKey !== 'f' + s.fish.startedAt) { cancelAll(); runKey = 'f' + s.fish.startedAt; resetScene(); who.textContent = s.fish.triggeredBy + '님' }
    if (!catchEl.classList.contains('on')) setCatch(s.fish)
  }
  show()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(function () { hideTimer = null; hide() }, 7000)
}

function onState(s) {
  if (s.status === 'running' && s.fish) renderRunning(s.fish)
  else if (s.status === 'showing_result') renderResult(s)
  else if (s.status === 'idle') { cancelAll(); runKey = null; if (!hideTimer) hide() }
}

function connect() {
  var ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = function (e) {
    try {
      var msg = JSON.parse(e.data)
      if (msg.type === 'game:state' && msg.data && msg.data.id === 'fish') onState(msg.data)
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
    } catch (err) {}
  }
  ws.onopen  = function () { if (window.__wsDown) location.reload() }
  ws.onclose = function () { window.__wsDown = true; setTimeout(connect, 2000) }
}
connect()
<\/script>
</body>
</html>`
