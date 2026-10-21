// OBS 오버레이 페이지: rps (가위바위보 — 시청자가 채팅으로 손을 내고 스트리머와 대결)
// 연출: 참가 팝·마감 5초 째깍 → 손 섞기 두구두구 → 공개 쿵·플래시 → 시청자 승리면 팡파르·색종이·배너, 스트리머 승리면 꽝
import { FX_SCRIPT } from './_fx'

export const RPS_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root { --navy:#172437; --orange:#FF5B17; --cream:#F5F3EF; --mint:#00CB84; --gold:#FFC61A; --red:#E0342C; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #card {
    position: fixed; left: 50%; bottom: 70px; width: 860px;
    transform: translateX(-50%) translateY(180px); opacity: 0;
    transition: transform .5s cubic-bezier(.34,1.56,.64,1), opacity .35s;
    filter: drop-shadow(0 22px 40px rgba(0,0,0,.45));
  }
  #card.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  .frame { background: var(--orange); border: 5px solid var(--navy); border-radius: 30px; padding: 14px;
    background-image: radial-gradient(circle, #FFE7B8 3.2px, rgba(255,231,184,0) 3.9px);
    background-size: 26px 26px; }
  .inner { background: var(--cream); border: 3px solid var(--navy); border-radius: 20px; padding: 18px 24px 20px; }

  .head { display: flex; align-items: center; gap: 12px; height: 46px; }
  .title { font-size: 32px; font-weight: 900; color: var(--navy); letter-spacing: -0.02em; }
  .title .st { color: var(--orange); margin: 0 6px; font-size: 24px; }
  .cnt { margin-left: auto; height: 40px; padding: 0 18px; border-radius: 20px; background: var(--navy); color: var(--cream);
         font-size: 20px; font-weight: 900; display: flex; align-items: center; }

  /* 모집 */
  #collect .hint { margin: 12px 0 14px; font-size: 22px; font-weight: 900; color: var(--navy); }
  #collect .hint b { color: var(--orange); }
  .hands { display: flex; gap: 16px; justify-content: center; }
  .hand { width: 200px; height: 120px; border-radius: 18px; background: #fff; border: 3px solid var(--navy);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .hand .e { font-size: 54px; line-height: 64px; }
  .hand .l { font-size: 20px; font-weight: 900; color: var(--navy); }
  .trow { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
  .tbar { flex: 1; height: 24px; background: var(--navy); border-radius: 12px; overflow: hidden; border: 3px solid var(--navy); }
  .tfill { height: 100%; width: 100%; background: var(--mint); border-radius: 10px; transition: width .25s linear; }
  .tnum { min-width: 64px; height: 40px; border-radius: 12px; background: var(--navy); color: var(--cream);
          font-size: 22px; font-weight: 900; display: flex; align-items: center; justify-content: center; }

  /* 공개 / 결과 */
  #reveal { display: none; }
  .vs { display: flex; align-items: center; gap: 22px; margin-top: 12px; }
  .sbox { width: 210px; height: 190px; border-radius: 22px; background: var(--navy); border: 4px solid var(--navy);
          display: flex; flex-direction: column; align-items: center; justify-content: center; flex: none; }
  .sbox .e { font-size: 96px; line-height: 120px; }
  .sbox .l { font-size: 20px; font-weight: 900; color: var(--cream); }
  .sbox.lock .e { animation: pop .45s ease; }
  .res { flex: 1; }
  .tiles { display: flex; gap: 12px; }
  .tile { flex: 1; height: 86px; border-radius: 16px; border: 3px solid var(--navy); background: #fff;
          display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .tile b { font-size: 34px; font-weight: 900; line-height: 40px; }
  .tile span { font-size: 16px; font-weight: 900; color: var(--navy); }
  .tile.w b { color: var(--mint); } .tile.d b { color: #8A94A6; } .tile.l b { color: var(--red); }
  .winners { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; min-height: 40px; }
  .chip { height: 36px; padding: 0 14px; border-radius: 10px; background: #fff; border: 3px solid var(--mint); color: var(--navy);
          font-size: 17px; font-weight: 900; display: flex; align-items: center; }
  .msg { font-size: 20px; font-weight: 900; color: var(--navy); }
  .dim { opacity: .25; }
  @keyframes pop { 0%{transform:scale(.4)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }
</style>
</head>
<body>
<div id="card">
  <div class="frame"><div class="inner">
    <div class="head">
      <div class="title"><span class="st">★</span>가위바위보 대결<span class="st">★</span></div>
      <div class="cnt" id="cnt">참가 0명</div>
    </div>
    <div id="collect">
      <div class="hint" id="hint"></div>
      <div class="hands">
        <div class="hand"><div class="e">✌️</div><div class="l">가위</div></div>
        <div class="hand"><div class="e">✊</div><div class="l">바위</div></div>
        <div class="hand"><div class="e">🖐️</div><div class="l">보</div></div>
      </div>
      <div class="trow"><div class="tbar"><div class="tfill" id="tfill"></div></div><div class="tnum" id="tnum">--</div></div>
    </div>
    <div id="reveal">
      <div class="vs">
        <div class="sbox" id="sbox"><div class="e" id="se">✊</div><div class="l">스트리머</div></div>
        <div class="res">
          <div class="tiles" id="tiles">
            <div class="tile w"><b id="nw">0</b><span>시청자 승</span></div>
            <div class="tile d"><b id="nd">0</b><span>무승부</span></div>
            <div class="tile l"><b id="nl">0</b><span>시청자 패</span></div>
          </div>
          <div class="winners" id="winners"></div>
        </div>
      </div>
    </div>
  </div></div>
</div>
<script>${FX_SCRIPT}<\/script>
<script>
var EMOJI = { rock: '✊', paper: '🖐️', scissors: '✌️' }
var LABEL = { rock: '바위', paper: '보', scissors: '가위' }
var card = document.getElementById('card'), collect = document.getElementById('collect'), reveal = document.getElementById('reveal')
var cnt = document.getElementById('cnt'), hint = document.getElementById('hint')
var tfill = document.getElementById('tfill'), tnum = document.getElementById('tnum')
var sbox = document.getElementById('sbox'), se = document.getElementById('se'), tiles = document.getElementById('tiles')
var winnersEl = document.getElementById('winners')
var timerIv = null, shuffleIv = null, lockTimer = null, hideTimer = null, runKey = null
var lastSec = -1, lastPicks = -1, fxResultKey = null

function show() { card.classList.add('show') }
function hide() { card.classList.remove('show') }
function stopAll() {
  if (timerIv) { clearInterval(timerIv); timerIv = null }
  if (shuffleIv) { clearInterval(shuffleIv); shuffleIv = null }
  if (lockTimer) { clearTimeout(lockTimer); lockTimer = null }
  FX.drumStop()
}

function renderCollecting(r) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (runKey !== 'c' + r.deadline) { stopAll(); FX.hideWinner(); runKey = 'c' + r.deadline; lastSec = -1; lastPicks = -1 }
  collect.style.display = ''; reveal.style.display = 'none'
  var nPicks = Object.keys(r.picks || {}).length
  if (lastPicks >= 0 && nPicks > lastPicks) FX.sound('pop')
  lastPicks = nPicks
  cnt.textContent = '참가 ' + nPicks + '명'
  hint.innerHTML = ''
  hint.appendChild(document.createTextNode('채팅에 '))
  var b = document.createElement('b'); b.textContent = r.command + ' 가위 / 바위 / 보'; hint.appendChild(b)
  hint.appendChild(document.createTextNode(' 를 입력하세요'))
  if (!timerIv) {
    var tick = function () {
      var left = Math.max(0, r.deadline - Date.now())
      tfill.style.width = (left / (r.joinMs || 15000) * 100) + '%'
      tnum.textContent = Math.ceil(left / 1000) + '초'
      var sec = Math.ceil(left / 1000)
      if (left > 0 && sec <= 5 && sec !== lastSec) { lastSec = sec; FX.sound('timer') }
    }
    tick(); timerIv = setInterval(tick, 250)
  }
  show()
}

function fillResult(r) {
  document.getElementById('nw').textContent = String((r.winners || []).length)
  document.getElementById('nd').textContent = String((r.draws || []).length)
  document.getElementById('nl').textContent = String((r.losers || []).length)
  winnersEl.innerHTML = ''
  var w = r.winners || []
  var total = w.length + (r.draws || []).length + (r.losers || []).length
  if (!total) { var m = document.createElement('div'); m.className = 'msg'; m.textContent = '참가자가 없었어요'; winnersEl.appendChild(m) }
  else if (!w.length) { var m2 = document.createElement('div'); m2.className = 'msg'; m2.textContent = '스트리머 승리! 🎉'; winnersEl.appendChild(m2) }
  w.slice(0, 12).forEach(function (u) { var c = document.createElement('div'); c.className = 'chip'; c.textContent = u; winnersEl.appendChild(c) })
  if (w.length > 12) { var more = document.createElement('div'); more.className = 'chip'; more.textContent = '+' + (w.length - 12) + '명'; winnersEl.appendChild(more) }
  tiles.classList.remove('dim')
}

function lock(r, silent) {
  if (shuffleIv) { clearInterval(shuffleIv); shuffleIv = null }
  FX.drumStop()
  if (!silent) { FX.sound('stop'); FX.flash('rgba(255,255,255,.4)'); FX.burst(sbox, '#FF5B17') }
  se.textContent = EMOJI[r.streamer]; sbox.classList.remove('lock'); void sbox.offsetHeight; sbox.classList.add('lock')
  sbox.querySelector('.l').textContent = '스트리머 · ' + LABEL[r.streamer]
  fillResult(r)
}

function renderRunning(r) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  var key = 'r' + r.startedAt
  if (runKey === key) return
  stopAll(); FX.hideWinner(); runKey = key
  collect.style.display = 'none'; reveal.style.display = 'block'
  cnt.textContent = '참가 ' + Object.keys(r.picks || {}).length + '명'
  sbox.querySelector('.l').textContent = '스트리머'
  winnersEl.innerHTML = ''; tiles.classList.add('dim')
  var left = (r.startedAt + (r.revealMs || 2200) - 600) - Date.now()
  if (left <= 0) { lock(r, true) }
  else {
    var order = ['rock', 'scissors', 'paper'], k = 0
    FX.drumStart(140)
    shuffleIv = setInterval(function () { se.textContent = EMOJI[order[k++ % 3]] }, 90)
    lockTimer = setTimeout(function () { lock(r) }, left)
  }
  show()
}

function renderResult(s) {
  stopAll()
  if (s.rps && s.rps.streamer) {
    collect.style.display = 'none'; reveal.style.display = 'block'
    se.textContent = EMOJI[s.rps.streamer]; sbox.querySelector('.l').textContent = '스트리머 · ' + LABEL[s.rps.streamer]
    fillResult(s.rps)
    resultFx(s.rps)
  }
  show()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(function () { hideTimer = null; hide() }, 8000)
}

// 결과 연출 (판마다 한 번)
function resultFx(r) {
  var key = 'x' + r.startedAt
  if (fxResultKey === key) return
  fxResultKey = key
  var w = r.winners || [], total = w.length + (r.draws || []).length + (r.losers || []).length
  var hand = EMOJI[r.streamer] + ' ' + LABEL[r.streamer]
  if (!total) return
  if (w.length) {
    FX.sound('win')
    var rc = winnersEl.getBoundingClientRect()
    FX.confetti({ x: rc.left + rc.width / 2, y: rc.top, count: Math.min(220, 100 + w.length * 10) })
    FX.winner({ nick: w[0] + (w.length > 1 ? ' 외 ' + (w.length - 1) + '명' : ''), text: '스트리머 ' + hand + ' 격파!', sub: '가위바위보 승리', anchor: card, above: true, ms: 6500, icon: '✌️' })
  } else {
    FX.sound('lose')
    FX.winner({ text: '스트리머 승리! (' + hand + ')', sub: '무 ' + (r.draws || []).length + ' · 패 ' + (r.losers || []).length, anchor: card, above: true, ms: 6000, icon: '😎' })
  }
}

function onState(s) {
  if (s.status === 'collecting' && s.rps) renderCollecting(s.rps)
  else if (s.status === 'running' && s.rps && s.rps.streamer) renderRunning(s.rps)
  else if (s.status === 'showing_result') renderResult(s)
  else if (s.status === 'idle') { stopAll(); runKey = null; if (!hideTimer) { hide(); FX.hideWinner() } }
}

function connect() {
  var ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = function (e) {
    try {
      var msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'game:state' && msg.data && msg.data.id === 'rps') onState(msg.data)
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
