// OBS 오버레이 페이지: race (동물 경주 — 시청자가 1등을 맞힌다)
// 레이아웃은 모두 고정 px (OBS CEF 에서 레이아웃 측정 금지). 주자 위치는 엔진이 보낸 곡선으로 계산.
// 연출: 마감 5초 전 째깍 → 출발 휘슬 + 두구두구 → 도착마다 팝, 1등 도착 쿵·플래시 → 결과 팡파르·색종이·적중자 배너
import { FX_SCRIPT } from './_fx'

export const RACE_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root { --navy:#172437; --orange:#FF5B17; --cream:#F5F3EF; --mint:#00CB84; --gold:#FFC61A; --turf:#3FA36B; --turf2:#379660; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #card {
    position: fixed; left: 50%; top: 50%; width: 1100px;
    transform: translate(-50%,-50%) scale(0.9); opacity: 0;
    transition: transform .5s cubic-bezier(.34,1.56,.64,1), opacity .35s;
    filter: drop-shadow(0 22px 40px rgba(0,0,0,.45));
  }
  #card.show { transform: translate(-50%,-50%) scale(1); opacity: 1; }

  .frame { background: var(--orange); border: 5px solid var(--navy); border-radius: 28px; padding: 14px; }
  .inner { background: var(--navy); border-radius: 18px; padding: 16px 18px 14px; }

  .head { display: flex; align-items: center; gap: 14px; height: 52px; margin-bottom: 10px; }
  .title { font-size: 34px; font-weight: 900; color: var(--cream); letter-spacing: -0.02em; }
  .title .st { color: var(--gold); font-size: 26px; margin: 0 6px; }
  .phase { margin-left: auto; height: 40px; padding: 0 18px; border-radius: 20px; background: var(--cream); color: var(--navy);
           font-size: 20px; font-weight: 900; display: flex; align-items: center; }

  .lanes { display: flex; flex-direction: column; gap: 6px; }
  .lane { display: flex; align-items: center; height: 56px; gap: 10px; }
  .num { width: 40px; height: 40px; border-radius: 12px; background: var(--orange); color: var(--navy); border: 3px solid var(--cream);
         font-size: 20px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex: none; }
  .nm { width: 110px; font-size: 21px; font-weight: 900; color: var(--cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
  .track { position: relative; width: 760px; height: 56px; border-radius: 12px; flex: none; overflow: hidden;
           background: repeating-linear-gradient(90deg, var(--turf) 0 40px, var(--turf2) 40px 80px); border: 3px solid #0E1726; }
  .track::after { content: ''; position: absolute; right: 26px; top: 0; bottom: 0; width: 12px;
           background: repeating-linear-gradient(0deg, #fff 0 8px, #172437 8px 16px); opacity: .9; }
  .runner { position: absolute; left: 0; top: 2px; width: 48px; height: 46px; font-size: 38px; line-height: 46px; text-align: center;
            transform: scaleX(-1); will-change: transform; }
  .rank { position: absolute; right: 96px; top: 9px; height: 32px; min-width: 32px; padding: 0 8px; border-radius: 16px;
          background: var(--gold); color: var(--navy); font-size: 17px; font-weight: 900; line-height: 32px; text-align: center;
          border: 2px solid var(--navy); opacity: 0; transition: opacity .25s; }
  .rank.on { opacity: 1; }
  .bets { width: 74px; height: 40px; border-radius: 12px; background: rgba(245,243,239,.12); color: var(--cream);
          font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex: none; }
  .lane.win .track { border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold); }
  .lane.win .nm { color: var(--gold); }

  .foot { display: flex; align-items: center; gap: 14px; margin-top: 12px; height: 44px; }
  .hint { font-size: 21px; font-weight: 900; color: var(--cream); white-space: nowrap; }
  .hint b { color: var(--gold); }
  .tbar { flex: 1; height: 22px; background: #0E1726; border-radius: 11px; overflow: hidden; border: 2px solid rgba(245,243,239,.25); }
  .tfill { height: 100%; width: 100%; background: var(--mint); border-radius: 11px; transition: width .25s linear; }
  .tnum { width: 60px; font-size: 22px; font-weight: 900; color: var(--cream); text-align: right; }

  .banner { display: none; margin-top: 12px; padding: 12px 18px; border-radius: 14px; background: var(--cream); }
  .banner.on { display: block; animation: pop .4s ease; }
  .b-main { font-size: 32px; font-weight: 900; color: var(--orange); letter-spacing: -0.02em; }
  .b-sub  { font-size: 17px; font-weight: 800; color: var(--navy); margin-top: 4px; line-height: 1.35; }
  @keyframes pop { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
</style>
</head>
<body>
<div id="card">
  <div class="frame"><div class="inner">
    <div class="head">
      <div class="title"><span class="st">★</span>동물 경주<span class="st">★</span></div>
      <div class="phase" id="phase">대기</div>
    </div>
    <div class="lanes" id="lanes"></div>
    <div class="foot" id="foot">
      <div class="hint" id="hint"></div>
      <div class="tbar"><div class="tfill" id="tfill"></div></div>
      <div class="tnum" id="tnum"></div>
    </div>
    <div class="banner" id="banner"><div class="b-main" id="bmain"></div><div class="b-sub" id="bsub"></div></div>
  </div></div>
</div>
<script>${FX_SCRIPT}<\/script>
<script>
var TRACK_W = 760, RUNNER_W = 48, FINISH_PAD = 30
var card = document.getElementById('card'), lanesEl = document.getElementById('lanes')
var phaseEl = document.getElementById('phase'), hintEl = document.getElementById('hint')
var tfill = document.getElementById('tfill'), tnum = document.getElementById('tnum'), foot = document.getElementById('foot')
var banner = document.getElementById('banner'), bmain = document.getElementById('bmain'), bsub = document.getElementById('bsub')
var lanes = [], laneKey = '', timerIv = null, raf = null, hideTimer = null, runKey = null
var lastSec = -1, lastBetCount = -1, fxResultKey = null

// 엔진(raceProgress)과 같은 식
function progress(c, t) {
  if (t >= c.finish) return 1
  var u = Math.max(0, t / c.finish)
  var w = c.amp * Math.sin(2 * Math.PI * c.freq * u + c.phase) * u * (1 - u) * 4
  return Math.min(0.995, Math.max(0, u + w))
}
function xOf(p) { return p * (TRACK_W - RUNNER_W - FINISH_PAD) }

function buildLanes(racers) {
  var key = racers.map(function (r) { return r.emoji + r.name }).join('|')
  if (key === laneKey) return
  laneKey = key; lanesEl.innerHTML = ''; lanes = []
  racers.forEach(function (r, i) {
    var lane = document.createElement('div'); lane.className = 'lane'
    var num = document.createElement('div'); num.className = 'num'; num.textContent = String(i + 1)
    var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = r.name
    var track = document.createElement('div'); track.className = 'track'
    var runner = document.createElement('div'); runner.className = 'runner'; runner.textContent = r.emoji
    var rank = document.createElement('div'); rank.className = 'rank'
    var bets = document.createElement('div'); bets.className = 'bets'; bets.textContent = '0명'
    track.appendChild(runner); track.appendChild(rank)
    lane.appendChild(num); lane.appendChild(nm); lane.appendChild(track); lane.appendChild(bets)
    lanesEl.appendChild(lane)
    lanes.push({ lane: lane, runner: runner, rank: rank, bets: bets })
  })
}
function place(i, p) { lanes[i].runner.style.transform = 'translateX(' + xOf(p) + 'px) scaleX(-1)' }
function resetLanes() {
  lanes.forEach(function (l, i) { place(i, 0); l.rank.className = 'rank'; l.rank.textContent = ''; l.lane.classList.remove('win') })
}
function setBets(race) {
  var counts = race.racers.map(function () { return 0 })
  Object.keys(race.bets || {}).forEach(function (u) { var i = race.bets[u]; if (counts[i] !== undefined) counts[i]++ })
  lanes.forEach(function (l, i) { l.bets.textContent = counts[i] + '명' })
}
function stopAll() {
  if (timerIv) { clearInterval(timerIv); timerIv = null }
  if (raf) { cancelAnimationFrame(raf); raf = null }
  FX.drumStop()
}
function show() { card.classList.add('show') }
function hide() { card.classList.remove('show') }

function renderCollecting(race) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (runKey !== 'c' + race.deadline) { stopAll(); FX.hideWinner(); runKey = 'c' + race.deadline; lastSec = -1; lastBetCount = -1 }
  buildLanes(race.racers); resetLanes(); setBets(race)
  var nBets = Object.keys(race.bets || {}).length
  if (lastBetCount >= 0 && nBets > lastBetCount) FX.sound('pop')
  lastBetCount = nBets
  banner.classList.remove('on'); foot.style.display = ''
  phaseEl.textContent = '예측 접수 중'
  hintEl.innerHTML = ''
  hintEl.appendChild(document.createTextNode('채팅에 '))
  var b = document.createElement('b'); b.textContent = race.command + ' 번호'; hintEl.appendChild(b)
  hintEl.appendChild(document.createTextNode(' 로 1등 예측'))
  if (!timerIv) {
    var tick = function () {
      var left = Math.max(0, race.deadline - Date.now())
      tfill.style.width = (left / (race.joinMs || 20000) * 100) + '%'
      tnum.textContent = Math.ceil(left / 1000) + '초'
      var sec = Math.ceil(left / 1000)
      if (left > 0 && sec <= 5 && sec !== lastSec) { lastSec = sec; FX.sound('timer') }
    }
    tick(); timerIv = setInterval(tick, 250)
  }
  show()
}

function renderRunning(race) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  var key = 'r' + race.startedAt
  if (runKey === key && raf) return
  stopAll(); FX.hideWinner(); runKey = key
  buildLanes(race.racers); setBets(race); resetLanes()
  banner.classList.remove('on'); foot.style.display = 'none'
  phaseEl.textContent = '경주 중!'
  var arrived = [], first = true
  if (Date.now() - race.startedAt < 500) FX.sound('whoosh')   // 중간 합류면 출발음 생략
  FX.drumStart(150)
  var frame = function () {
    var t = (Date.now() - race.startedAt) / race.raceMs
    race.curves.forEach(function (c, i) {
      var p = progress(c, t); place(i, p)
      if (p >= 1 && arrived.indexOf(i) < 0) {
        arrived.push(i)
        lanes[i].rank.textContent = arrived.length + '등'; lanes[i].rank.className = 'rank on'
        if (arrived.length === 1) {
          lanes[i].lane.classList.add('win')
          if (!first) { FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,198,26,.35)'); FX.burst(lanes[i].runner, '#FFC61A') }
        } else if (!first) FX.sound('pop')
      }
    })
    if (first && arrived.length) FX.drumStop()
    first = false
    if (t < 1.02) raf = requestAnimationFrame(frame); else { raf = null; FX.drumStop() }
  }
  frame(); show()
}

function renderResult(s) {
  stopAll()
  var race = s.race
  if (race && race.order) {
    buildLanes(race.racers); setBets(race)
    race.order.forEach(function (ri, rank) {
      place(ri, 1); lanes[ri].rank.textContent = (rank + 1) + '등'; lanes[ri].rank.className = 'rank on'
      lanes[ri].lane.classList.toggle('win', rank === 0)
    })
  }
  foot.style.display = 'none'
  phaseEl.textContent = '결과'
  if (s.result) { bmain.textContent = s.result.result; bsub.textContent = s.result.detail; banner.classList.add('on') }
  show()
  resultFx(s)
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(function () { hideTimer = null; hide() }, 9000)
}

// 결과 연출 (판마다 한 번): 팡파르 + 1등 레인 색종이 + 적중자(없으면 1등 주자) 배너
function resultFx(s) {
  var race = s.race
  var key = race ? 'x' + (race.startedAt || race.deadline) : 'x' + (s.result && s.result.ts)
  if (fxResultKey === key) return
  fxResultKey = key
  var win = race && race.order ? race.order[0] : -1
  var winners = race && win >= 0 ? Object.keys(race.bets || {}).filter(function (u) { return race.bets[u] === win }) : []
  FX.sound(winners.length ? 'jackpot' : 'win')
  if (win >= 0 && lanes[win]) {
    // 색종이 시작점만 1등 주자 위치에서 (연출용 — 레이아웃은 측정에 의존하지 않음)
    var r = lanes[win].runner.getBoundingClientRect()
    FX.confetti({ x: r.left + r.width / 2, y: r.top, count: winners.length ? 200 : 110 })
  }
  var racer = race && win >= 0 ? race.racers[win] : null
  var racerTxt = racer ? racer.emoji + ' ' + racer.name + ' 1등' : (s.result ? s.result.result : '')
  if (winners.length) FX.winner({ nick: winners[0] + (winners.length > 1 ? ' 외 ' + (winners.length - 1) + '명' : ''), text: racerTxt, sub: '1등 예측 적중!', anchor: card, ms: 7000, icon: '🎯' })
  else FX.winner({ text: racerTxt, sub: '적중자 없음', anchor: card, ms: 7000, icon: '🏁' })
}

function onState(s) {
  if (s.status === 'collecting' && s.race) renderCollecting(s.race)
  else if (s.status === 'running' && s.race && s.race.curves) renderRunning(s.race)
  else if (s.status === 'showing_result') renderResult(s)
  else if (s.status === 'idle') { stopAll(); runKey = null; if (!hideTimer) { hide(); FX.hideWinner() } }
}

function connect() {
  var ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = function (e) {
    try {
      var msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'game:state' && msg.data && msg.data.id === 'race') onState(msg.data)
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
    } catch (err) {}
  }
  ws.onopen  = function () { if (window.__wsDown) location.reload() }  // 서버 재시작(앱 업데이트) → 새 코드 로드
  ws.onclose = function () { window.__wsDown = true; setTimeout(connect, 2000) }
}
connect()
<\/script>
</body>
</html>`
