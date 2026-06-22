import { createServer, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import type { GameResult, GameState } from '../games/engine'

// ── Quiz overlay ──────────────────────────────────────────────────────────────

const QUIZ_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  .quiz-box {
    position: fixed;
    bottom: 80px; left: 50%;
    transform: translateX(-50%) translateY(140px);
    width: 720px;
    background: rgba(12, 8, 35, 0.93);
    border: 2px solid rgba(139, 92, 246, 0.7);
    border-radius: 22px;
    padding: 28px 36px;
    backdrop-filter: blur(18px);
    box-shadow: 0 12px 48px rgba(109,40,217,0.45);
    opacity: 0;
    transition: transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
  }
  .quiz-box.show { transform: translateX(-50%) translateY(0); opacity: 1; }

  .quiz-tag {
    font-size: 11px; font-weight: 800; letter-spacing: 0.15em;
    text-transform: uppercase; color: #A78BFA; margin-bottom: 12px;
  }
  .quiz-q {
    font-size: 26px; font-weight: 800; color: #fff;
    line-height: 1.3; margin-bottom: 20px; letter-spacing: -0.02em;
  }
  .timer-row { display: flex; align-items: center; gap: 12px; }
  .timer-bar {
    flex: 1; height: 8px; background: rgba(255,255,255,0.12);
    border-radius: 4px; overflow: hidden;
  }
  .timer-fill {
    height: 100%; border-radius: 4px;
    background: #10B981;
    transition: width 0.9s linear, background 0.5s;
  }
  .timer-num {
    font-family: 'Inter', monospace; font-size: 18px;
    font-weight: 800; color: rgba(255,255,255,0.85);
    width: 36px; text-align: right;
  }
  .result-row {
    margin-top: 16px; padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 22px; font-weight: 800; color: #fff;
    display: none; align-items: center; gap: 10px;
  }
  .result-row.visible { display: flex; }
  .result-win  { color: #10B981; }
  .result-fail { color: rgba(255,255,255,0.6); font-size: 16px; }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0; }
    60%  { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  .result-row.visible { animation: pop 0.4s ease; }
</style>
</head>
<body>
<div class="quiz-box" id="box">
  <div class="quiz-tag">❓ 퀴즈 도전!</div>
  <div class="quiz-q" id="q-text">문제를 불러오는 중...</div>
  <div class="timer-row" id="timer-row">
    <div class="timer-bar"><div class="timer-fill" id="t-fill" style="width:100%"></div></div>
    <div class="timer-num" id="t-num">--</div>
  </div>
  <div class="result-row" id="result-row">
    <span id="result-icon"></span>
    <span id="result-text"></span>
  </div>
</div>
<script>
  const box      = document.getElementById('box')
  const qText    = document.getElementById('q-text')
  const tFill    = document.getElementById('t-fill')
  const tNum     = document.getElementById('t-num')
  const timerRow = document.getElementById('timer-row')
  const resultRow= document.getElementById('result-row')
  const resIcon  = document.getElementById('result-icon')
  const resText  = document.getElementById('result-text')

  let ticker = null
  let deadline = 0
  let totalSec = 30
  let hideTimer = null

  function show() { box.classList.add('show') }
  function hide() { box.classList.remove('show') }

  function startTimer(dl, limit) {
    deadline = dl; totalSec = limit
    if (ticker) clearInterval(ticker)
    timerRow.style.display = ''
    resultRow.classList.remove('visible')

    const tick = () => {
      const left = Math.max(0, (deadline - Date.now()) / 1000)
      tNum.textContent = Math.ceil(left)
      tFill.style.width = (left / totalSec * 100) + '%'
      tFill.style.background = left > totalSec * 0.35 ? '#10B981' : '#EF4444'
      if (left <= 0) { clearInterval(ticker); ticker = null }
    }
    tick()
    ticker = setInterval(tick, 200)
  }

  function showResult(text, isWin) {
    if (ticker) { clearInterval(ticker); ticker = null }
    timerRow.style.display = 'none'
    resIcon.textContent  = isWin ? '🎉' : '⏰'
    resText.textContent  = text
    resText.className    = isWin ? 'result-win' : 'result-fail'
    resultRow.classList.add('visible')
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(hide, 7000)
  }

  function connect() {
    const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)

        if (msg.type === 'game:state' && msg.data?.id === 'quiz') {
          const s = msg.data
          if (s.status === 'collecting' && s.quiz) {
            qText.textContent = s.quiz.question
            const limitSec = Math.max(1, Math.round((s.quiz.deadline - Date.now()) / 1000))
            startTimer(s.quiz.deadline, limitSec)
            show()
          } else if (s.status === 'showing_result' && s.result) {
            const isWin = !s.result.result.includes('시간 초과')
            showResult(s.result.result, isWin)
          } else if (s.status === 'idle') {
            if (!resultRow.classList.contains('visible')) hide()
          }
        }

        if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
      } catch {}
    }
    ws.onclose = () => setTimeout(connect, 2000)
  }
  connect()
<\/script>
</body>
</html>`

// ── Ladder overlay ────────────────────────────────────────────────────────────

const LADDER_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #card {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%,-50%) scale(0.88); opacity: 0;
    width: 900px;
    background: #FEFCF0;
    border: 7px solid #2B5CE6;
    border-radius: 26px;
    padding: 7px;
    box-shadow: 0 20px 60px rgba(43,92,230,0.28), 0 0 0 2px rgba(43,92,230,0.12);
    transition: transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
  }
  #card.show { transform: translate(-50%,-50%) scale(1); opacity: 1; }

  .inner {
    border: 3px dashed #6A9EF5;
    border-radius: 20px;
    padding: 20px 26px 18px;
    background: #FEFCF0;
    min-height: 540px;
    display: flex; flex-direction: column;
  }

  /* Title */
  .title-area { text-align: center; margin-bottom: 6px; }
  .game-title { font-size: 46px; font-weight: 900; letter-spacing: -0.01em; line-height: 1.1; }
  .tc1{color:#F95959}.tc2{color:#F5C000}.tc3{color:#5BC95B}
  .tc4{color:#3B8FF5}.tc5{color:#B760F0}.tc6{color:#F5A623}.tc7{color:#5BC95B}

  .subtitle {
    display: inline-block; background: #5B87EE; color: #fff;
    border-radius: 20px; padding: 5px 22px;
    font-size: 14px; font-weight: 700; margin-bottom: 14px;
  }

  /* Collecting */
  .header-row { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 6px; }

  .flag-post { display: flex; flex-direction: column; align-items: flex-start; flex-shrink: 0; }
  .flag-fabric {
    background: #5B87EE; color: #fff; font-size: 12px; font-weight: 900;
    padding: 4px 10px; border-radius: 5px; margin-bottom: 0;
    position: relative; white-space: nowrap;
  }
  .flag-fabric::after {
    content: ''; position: absolute; right: -8px; top: 50%;
    transform: translateY(-50%);
    border: 6px solid transparent; border-left-color: #5B87EE;
  }
  .flag-stick { width: 3px; height: 38px; background: #555; border-radius: 2px; margin-top: 1px; }

  .chips-wrap { flex: 1; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; min-height: 42px; }
  .chip {
    padding: 5px 14px; border-radius: 20px; border: 2.5px solid;
    font-size: 13px; font-weight: 800; background: #fff; white-space: nowrap;
  }
  .count-lbl { font-size: 12px; color: #6B7280; font-weight: 700; flex-shrink: 0; }

  .timer-wrap { height: 5px; background: #E5E7EB; border-radius: 3px; overflow: hidden; margin: 7px 0 10px; }
  .timer-fill { height: 100%; background: #5B87EE; border-radius: 3px; transition: width 0.9s linear; }

  .wait-hint { text-align: center; font-size: 13px; color: #9CA3AF; font-weight: 700; padding: 16px 0; flex: 1; display: flex; align-items: center; justify-content: center; }

  /* Result */
  #phase-result { display: none; flex: 1; flex-direction: column; }
  #phase-result.on { display: flex; }
  #lsvg { width: 100%; display: block; }

  .res-list { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
  .res-row {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 14px; border-radius: 10px;
    background: #fff; border: 2.5px solid;
    font-size: 13px;
  }
  .res-user  { font-weight: 800; }
  .res-arrow { color: #9CA3AF; }
  .res-prize { font-weight: 800; color: #374151; margin-left: auto; }
</style>
</head>
<body>
<div id="card">
  <div class="inner">
    <div class="title-area">
      <div class="game-title">
        <span class="tc1">사</span><span class="tc2">다</span><span class="tc3">리</span>&thinsp;
        <span class="tc4">타</span><span class="tc5">기</span>&thinsp;
        <span class="tc6">게</span><span class="tc7">임</span>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:14px">
      <span class="subtitle">출발! 선을 따라 내려가서 결과를 확인해 보세요!</span>
    </div>

    <!-- Collecting -->
    <div id="phase-collecting">
      <div class="header-row">
        <div class="flag-post">
          <div class="flag-fabric">출발!</div>
          <div class="flag-stick"></div>
        </div>
        <div class="chips-wrap" id="chips"></div>
        <span class="count-lbl" id="count-lbl"></span>
      </div>
      <div class="timer-wrap"><div class="timer-fill" id="tfill" style="width:100%"></div></div>
      <div class="wait-hint" id="wait-hint">참가자 모집 중... 채팅에서 명령어를 입력하세요!</div>
    </div>

    <!-- Result -->
    <div id="phase-result">
      <svg id="lsvg" viewBox="0 0 800 300"></svg>
      <div class="res-list" id="res-list"></div>
    </div>
  </div>
</div>
<script>
const COLORS = ['#F95959','#F5C000','#5BC95B','#3B8FF5','#B760F0','#F5A623','#14B8A6','#EC4899']
const BGTINT = ['#FFF0F0','#FFFDE0','#F0FFF0','#EFF7FF','#F9F0FF','#FFF7ED','#EDFCFC','#FFF0F7']

const card    = document.getElementById('card')
const chips   = document.getElementById('chips')
const cntLbl  = document.getElementById('count-lbl')
const tfill   = document.getElementById('tfill')
const waitHint= document.getElementById('wait-hint')
const phColl  = document.getElementById('phase-collecting')
const phRes   = document.getElementById('phase-result')
const svgEl   = document.getElementById('lsvg')
const resList = document.getElementById('res-list')
let hideTimer = null

function show() { card.classList.add('show') }
function hide() { card.classList.remove('show') }

function renderCollecting(ladder) {
  phColl.style.display = ''
  phRes.classList.remove('on')

  cntLbl.textContent = ladder.participants.length + '/' + ladder.maxSlots + '명'
  const pct = Math.max(0, Math.min(100, ((ladder.deadline - Date.now()) / 30000) * 100))
  tfill.style.width = pct + '%'

  chips.innerHTML = ''
  ladder.participants.forEach((p, i) => {
    const c = document.createElement('span')
    c.className = 'chip'
    c.textContent = p
    c.style.color       = COLORS[i % COLORS.length]
    c.style.borderColor = COLORS[i % COLORS.length]
    c.style.background  = BGTINT[i % BGTINT.length]
    chips.appendChild(c)
  })
  waitHint.style.display = ladder.participants.length === 0 ? '' : 'none'
  show()
}

function renderResult(ld) {
  phColl.style.display = 'none'
  phRes.classList.add('on')

  const cols = ld.cols, rows = ld.rows
  const COL_W = Math.min(120, Math.floor(760 / Math.max(cols - 1, 1)))
  const ROW_H = 30, PAD_X = 50, PAD_T = 52, PAD_B = 48
  const W = PAD_X * 2 + (cols - 1) * COL_W
  const H = PAD_T + rows * ROW_H + PAD_B
  svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H)
  svgEl.style.height = H + 'px'
  svgEl.innerHTML = ''

  const xp = c => PAD_X + c * COL_W
  const mkEl = (tag, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); return el
  }

  // Rails
  for (let c = 0; c < cols; c++) {
    svgEl.appendChild(mkEl('line', {
      x1: xp(c), y1: PAD_T, x2: xp(c), y2: PAD_T + rows * ROW_H,
      stroke: '#333', 'stroke-width': 3.5, 'stroke-linecap': 'round'
    }))
    svgEl.appendChild(mkEl('circle', { cx: xp(c), cy: PAD_T, r: 5, fill: '#333' }))
    svgEl.appendChild(mkEl('circle', { cx: xp(c), cy: PAD_T + rows * ROW_H, r: 5, fill: '#333' }))
  }

  // Rungs
  ld.rungs.forEach(rg => {
    svgEl.appendChild(mkEl('line', {
      x1: xp(rg.leftCol), y1: PAD_T + rg.row * ROW_H,
      x2: xp(rg.leftCol + 1), y2: PAD_T + rg.row * ROW_H,
      stroke: '#333', 'stroke-width': 3, 'stroke-linecap': 'round'
    }))
  })

  // Name pills (top)
  ld.order.forEach((name, c) => {
    const col = COLORS[c % COLORS.length], bg = BGTINT[c % BGTINT.length]
    const label = name.length > 5 ? name.slice(0,4)+'…' : name
    const tw = Math.max(38, label.length * 10 + 18)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.appendChild(mkEl('rect', { x: xp(c)-tw/2, y: 4, width: tw, height: 26, rx: 13, fill: bg, stroke: col, 'stroke-width': 2.5 }))
    const t = mkEl('text', { x: xp(c), y: 22, 'text-anchor':'middle', 'font-size': 12, 'font-weight': 800, fill: col, 'font-family': 'Noto Sans KR, sans-serif' })
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
  })

  // Prize pills (bottom)
  ld.prizes.forEach((prize, c) => {
    const col = COLORS[c % COLORS.length], bg = BGTINT[c % BGTINT.length]
    const label = prize.length > 5 ? prize.slice(0,4)+'…' : prize
    const tw = Math.max(38, label.length * 10 + 18)
    const py = PAD_T + rows * ROW_H + 11
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.appendChild(mkEl('rect', { x: xp(c)-tw/2, y: py, width: tw, height: 26, rx: 13, fill: bg, stroke: col, 'stroke-width': 2.5 }))
    const t = mkEl('text', { x: xp(c), y: py+18, 'text-anchor':'middle', 'font-size': 12, 'font-weight': 800, fill: col, 'font-family': 'Noto Sans KR, sans-serif' })
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
  })

  // Animate paths
  let step = 0
  const lines = ld.paths.map((path, pi) => {
    const pl = mkEl('polyline', { fill:'none', stroke: COLORS[pi % COLORS.length],
      'stroke-width': 3.5, 'stroke-opacity': 0.9,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      points: xp(path.cols[0]) + ',' + PAD_T })
    svgEl.appendChild(pl); return pl
  })
  const dots = ld.paths.map((path, pi) => {
    const d = mkEl('circle', { r: 6, fill: COLORS[pi % COLORS.length],
      cx: xp(path.cols[0]), cy: PAD_T, stroke:'#fff', 'stroke-width': 2 })
    svgEl.appendChild(d); return d
  })

  // Build right-angle path points up to a given step
  function orthoPts(cols, upTo) {
    const pts = [xp(cols[0]) + ',' + PAD_T]
    for (let r = 0; r < Math.min(upTo, rows); r++) {
      const curY = PAD_T + r * ROW_H
      const nxtY = PAD_T + (r + 1) * ROW_H
      if (cols[r + 1] !== cols[r]) pts.push(xp(cols[r + 1]) + ',' + curY) // horizontal rung
      pts.push(xp(cols[r + 1]) + ',' + nxtY)                               // vertical descent
    }
    return pts.join(' ')
  }

  const tick = setInterval(() => {
    step++
    ld.paths.forEach((path, pi) => {
      lines[pi].setAttribute('points', orthoPts(path.cols, step))
      const cr = Math.min(step, rows)
      dots[pi].setAttribute('cx', xp(path.cols[cr]))
      dots[pi].setAttribute('cy', PAD_T + cr * ROW_H)
    })
    if (step >= rows) {
      clearInterval(tick)
      resList.innerHTML = ''
      ld.results.forEach(r => {
        const col = COLORS[r.startCol % COLORS.length], bg = BGTINT[r.startCol % BGTINT.length]
        const row = document.createElement('div')
        row.className = 'res-row'
        row.style.borderColor = col; row.style.background = bg
        row.innerHTML = '<span class="res-user" style="color:' + col + '">' + r.user + '</span>' +
          '<span class="res-arrow">→</span><span class="res-prize">' + r.prize + '</span>'
        resList.appendChild(row)
      })
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(hide, 12000)
    }
  }, 55)
}

function renderManualPreview(ld) {
  phColl.style.display = 'none'
  phRes.classList.add('on')

  const cols = ld.cols, rows = ld.rows
  const COL_W = Math.min(120, Math.floor(760 / Math.max(cols - 1, 1)))
  const ROW_H = 30, PAD_X = 50, PAD_T = 52, PAD_B = 48
  const W = PAD_X * 2 + (cols - 1) * COL_W
  const H = PAD_T + rows * ROW_H + PAD_B
  svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H)
  svgEl.style.height = H + 'px'
  svgEl.innerHTML = ''

  const xp = c => PAD_X + c * COL_W
  const mkEl = (tag, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); return el
  }

  // Rails only (no rungs shown)
  for (let c = 0; c < cols; c++) {
    svgEl.appendChild(mkEl('line', {
      x1: xp(c), y1: PAD_T, x2: xp(c), y2: PAD_T + rows * ROW_H,
      stroke: '#333', 'stroke-width': 3.5, 'stroke-linecap': 'round'
    }))
    svgEl.appendChild(mkEl('circle', { cx: xp(c), cy: PAD_T, r: 5, fill: '#333' }))
    svgEl.appendChild(mkEl('circle', { cx: xp(c), cy: PAD_T + rows * ROW_H, r: 5, fill: '#333' }))
  }

  // Name pills (top)
  ld.order.forEach((name, c) => {
    const col = COLORS[c % COLORS.length], bg = BGTINT[c % BGTINT.length]
    const label = name.length > 5 ? name.slice(0,4)+'…' : name
    const tw = Math.max(38, label.length * 10 + 18)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.appendChild(mkEl('rect', { x: xp(c)-tw/2, y: 4, width: tw, height: 26, rx: 13, fill: bg, stroke: col, 'stroke-width': 2.5 }))
    const t = mkEl('text', { x: xp(c), y: 22, 'text-anchor':'middle', 'font-size': 12, 'font-weight': 800, fill: col, 'font-family': 'Noto Sans KR, sans-serif' })
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
  })

  // Prize pills (bottom) hidden as "?"
  ld.prizes.forEach((_, c) => {
    const col = COLORS[c % COLORS.length], bg = BGTINT[c % BGTINT.length]
    const tw = 42, py = PAD_T + rows * ROW_H + 11
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.appendChild(mkEl('rect', { x: xp(c)-tw/2, y: py, width: tw, height: 26, rx: 13, fill: bg, stroke: col, 'stroke-width': 2.5 }))
    const t = mkEl('text', { x: xp(c), y: py+18, 'text-anchor':'middle', 'font-size': 15, 'font-weight': 900, fill: col, 'font-family': 'Noto Sans KR, sans-serif' })
    t.textContent = '?'; g.appendChild(t); svgEl.appendChild(g)
  })

  // Frosted cover over rung area
  svgEl.appendChild(mkEl('rect', {
    x: PAD_X - 12, y: PAD_T, width: W - (PAD_X - 12) * 2, height: rows * ROW_H,
    fill: 'rgba(254,252,240,0.82)', rx: 6
  }))

  resList.innerHTML = ''
  show()
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'game:state' && msg.data?.id === 'ladder') {
        const s = msg.data
        if (s.status === 'collecting' && s.ladder) renderCollecting(s.ladder)
        else if (s.status === 'showing_result' && s.ladder?.ladderData) renderResult(s.ladder.ladderData)
        else if (s.status === 'manual_preview' && s.ladder?.ladderData) renderManualPreview(s.ladder.ladderData)
        else if (s.status === 'manual_running' && s.ladder?.ladderData) renderResult(s.ladder.ladderData)
        else if (s.status === 'idle') hide()
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
    } catch {}
  }
  ws.onclose = () => setTimeout(connect, 2000)
}
connect()
<\/script>
</body>
</html>`

// ── Roulette overlay (wheel + text slot) ─────────────────────────────────────

const ROULETTE_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #rbox {
    position: fixed; bottom: 60px; left: 50%;
    transform: translateX(-50%) translateY(160px); opacity: 0;
    transition: transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
  }
  #rbox.show { transform: translateX(-50%) translateY(0); opacity: 1; }

  /* ── Wheel mode ── */
  #wheel-wrap { display: none; flex-direction: column; align-items: center; gap: 14px; }
  #wheel-wrap.active { display: flex; }
  .wheel-canvas-wrap { position: relative; }
  .wheel-pin {
    position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
    z-index: 10; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
  }
  canvas#wcanvas { display: block; filter: drop-shadow(0 10px 30px rgba(0,0,0,0.3)); }
  #wheel-result {
    display: none;
    background: linear-gradient(135deg, #7B4FCE, #5B30A8);
    border-radius: 50px; padding: 12px 40px;
    color: #fff; font-size: 24px; font-weight: 900;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    animation: wPop 0.4s ease;
  }
  @keyframes wPop { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }

  /* ── Text mode ── */
  #text-wrap { display: none; }
  #text-wrap.active { display: block; }

  .t-label-wrap { text-align: center; margin-bottom: -18px; position: relative; z-index: 2; }
  .t-label {
    display: inline-flex; align-items: center; gap: 12px;
    background: linear-gradient(135deg, #7B4FCE, #5930AA);
    border-radius: 50px; padding: 10px 28px;
    color: #fff; font-size: 18px; font-weight: 900;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
  }
  .t-star { color: #FFD700; }

  .t-body {
    background: linear-gradient(180deg, #8E60CC 0%, #6B40AA 100%);
    border-radius: 52px; padding: 26px 20px 22px;
    position: relative; overflow: hidden;
    box-shadow: 5px 6px 22px rgba(0,0,0,0.42), inset 0 2px 0 rgba(255,200,255,0.22);
    min-width: 580px;
  }
  .led-dot {
    position: absolute; width: 16px; height: 16px; border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 10px rgba(255,255,255,0.95), 0 0 20px rgba(255,255,255,0.5);
    pointer-events: none; z-index: 0;
  }
  .t-inner {
    background: #fff; border-radius: 34px;
    overflow: hidden; position: relative; z-index: 1;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.1);
  }
  .t-slot-outer { height: 78px; overflow: hidden; position: relative; }
  .t-slot-outer::before, .t-slot-outer::after {
    content: ''; position: absolute; left: 0; right: 0; height: 22px; z-index: 2; pointer-events: none;
  }
  .t-slot-outer::before { top: 0; background: linear-gradient(to bottom, rgba(255,255,255,0.96), transparent); }
  .t-slot-outer::after  { bottom: 0; background: linear-gradient(to top, rgba(255,255,255,0.96), transparent); }
  .t-slot-inner { display: flex; flex-direction: column; align-items: center; transition: transform 0s; }
  .t-slot-item {
    height: 78px; display: flex; align-items: center; justify-content: center;
    font-size: 30px; font-weight: 900; color: #5B30A8;
    flex-shrink: 0; width: 100%; text-align: center; letter-spacing: -0.02em;
  }
  #text-result {
    display: none; height: 78px;
    align-items: center; justify-content: center;
    font-size: 26px; font-weight: 900; color: #5B30A8;
    text-align: center; letter-spacing: -0.02em;
  }
  .t-res-inner { display: inline-flex; align-items: center; gap: 14px; }
  .t-bar  { display: inline-block; width: 22px; height: 3.5px; background: #8B5EC7; transform: skewX(-14deg); }
  .t-bar2 { display: inline-block; width: 14px; height: 3.5px; background: #8B5EC7; transform: skewX(-14deg); }
</style>
</head>
<body>
<div id="rbox">
  <!-- Wheel mode -->
  <div id="wheel-wrap">
    <div class="wheel-canvas-wrap">
      <div class="wheel-pin">
        <svg width="44" height="60" viewBox="0 0 44 60" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="pg" cx="38%" cy="28%" r="68%">
              <stop offset="0%" stop-color="#FF7070"/>
              <stop offset="100%" stop-color="#CC1010"/>
            </radialGradient>
          </defs>
          <ellipse cx="22" cy="21" rx="20" ry="20" fill="url(#pg)" stroke="#AA0000" stroke-width="2"/>
          <path d="M 4 33 Q 6 50 22 60 Q 38 50 40 33" fill="url(#pg)" stroke="#AA0000" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="22" cy="21" r="7.5" fill="rgba(255,255,255,0.93)"/>
        </svg>
      </div>
      <canvas id="wcanvas" width="380" height="380"></canvas>
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
const PASTEL = ['#FFD6D8','#FFE2C4','#FFF5C0','#D6F5D6','#C4EEE0','#C2E8FF','#D2D8FF','#E2D0FF','#F2D2FA','#FFD6D8']
const DARK   = ['#C03040','#B86018','#A08000','#2A7A30','#1A7060','#1A5098','#3040A0','#5030A0','#8030A0','#C03040']

const rbox      = document.getElementById('rbox')
const wheelWrap = document.getElementById('wheel-wrap')
const textWrap  = document.getElementById('text-wrap')
const wcanvas   = document.getElementById('wcanvas')
const ctx       = wcanvas.getContext('2d')
const wRes      = document.getElementById('wheel-result')
const slotInner = document.getElementById('slot-inner')
const textRes   = document.getElementById('text-result')
let hideTimer   = null

function show() { rbox.classList.add('show') }
function hide() { rbox.classList.remove('show') }
function setMode(m) {
  wheelWrap.classList.toggle('active', m === 'wheel')
  textWrap.classList.toggle('active', m === 'text')
}

// ── LED dots for text frame ────────────────────────────────────────────────────
function buildDots(el) {
  const W = el.offsetWidth, H = el.offsetHeight
  const R = 52, inset = 14, gap = 33
  const add = (x, y) => {
    const d = document.createElement('div'); d.className = 'led-dot'
    d.style.left = (x - 8) + 'px'; d.style.top = (y - 8) + 'px'
    el.appendChild(d)
  }
  for (let x = R + gap/2; x < W - R; x += gap) { add(x, inset); add(x, H - inset) }
  for (let y = R + gap/2; y < H - R; y += gap) { add(inset, y); add(W - inset, y) }
}
setTimeout(() => { const b = document.getElementById('t-body'); if (b) buildDots(b) }, 80)

// ── Wheel drawing ─────────────────────────────────────────────────────────────
function drawWheel(items, angle) {
  const SIZE = 380, cx = 190, cy = 190
  const outerR = 188, ringW = 28, segR = outerR - ringW
  ctx.clearRect(0, 0, SIZE, SIZE)

  // Gold ring
  const grd = ctx.createRadialGradient(cx - 10, cy - 10, segR, cx, cy, outerR)
  grd.addColorStop(0, '#D48800'); grd.addColorStop(0.5, '#FFD740'); grd.addColorStop(1, '#B87000')
  ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI*2); ctx.fillStyle = grd; ctx.fill()

  // Segments
  const total = items.reduce((s, i) => s + i.probability, 0)
  let start = angle
  items.forEach((item, i) => {
    const sweep = (item.probability / total) * Math.PI * 2
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, segR - 1, start, start + sweep); ctx.closePath()
    ctx.fillStyle = PASTEL[i % PASTEL.length]; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = 2; ctx.stroke()
    const mid = start + sweep / 2
    const lx = cx + Math.cos(mid) * segR * 0.62, ly = cy + Math.sin(mid) * segR * 0.62
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(mid + Math.PI / 2)
    ctx.fillStyle = DARK[i % DARK.length]; ctx.font = '800 15px "Noto Sans KR",sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(item.name.length > 5 ? item.name.slice(0,4)+'…' : item.name, 0, 0)
    ctx.restore(); start += sweep
  })

  // White LED dots on gold ring
  const nDots = 20, dotRingR = outerR - ringW / 2, dotR = 9
  for (let i = 0; i < nDots; i++) {
    const a = (i / nDots) * Math.PI * 2
    ctx.beginPath(); ctx.arc(cx + Math.cos(a)*dotRingR, cy + Math.sin(a)*dotRingR, dotR, 0, Math.PI*2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.strokeStyle = 'rgba(180,140,0,0.2)'; ctx.lineWidth = 1; ctx.stroke()
  }

  // Center gold circle
  const cgrd = ctx.createRadialGradient(cx-5, cy-8, 5, cx, cy, 52)
  cgrd.addColorStop(0, '#FFE566'); cgrd.addColorStop(0.65, '#FFC400'); cgrd.addColorStop(1, '#CC8800')
  ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI*2); ctx.fillStyle = cgrd; ctx.fill()
  ctx.strokeStyle = '#886600'; ctx.lineWidth = 2.5; ctx.stroke()
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI*2)
  ctx.strokeStyle = 'rgba(100,60,0,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]); ctx.stroke()
  ctx.restore()
  ctx.fillStyle = '#5A2800'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = '800 12px "Noto Sans KR",sans-serif'
  ctx.fillText('룰렛', cx, cy - 10); ctx.fillText('돌리기', cx, cy + 4)
  ctx.font = '700 11px sans-serif'; ctx.fillText('★', cx, cy + 18)
}

function spinWheel(items, winnerIdx, spinMs) {
  const total = items.reduce((s, i) => s + i.probability, 0)
  let cum = -Math.PI/2, winMid = 0
  items.forEach((item, i) => {
    const sweep = (item.probability / total) * Math.PI * 2
    if (i === winnerIdx) winMid = cum + sweep / 2
    cum += sweep
  })
  const finalAngle = -Math.PI/2 - winMid + 6 * Math.PI * 2
  const t0 = performance.now()
  function ease(t) { return 1 - Math.pow(1-t, 3) }
  ;(function tick(now) {
    const t = Math.min(1, (now - t0) / spinMs)
    drawWheel(items, ease(t) * finalAngle)
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
  const startY = -(full.length - 1) * 78  // start showing last items (bottom of list)
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
  ws.onclose = () => setTimeout(connect, 2000)
}
connect()
<\/script>
</body>
</html>`

// ── Pickboard overlay (ticket board) ─────────────────────────────────────────

const PICKBOARD_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #pb-wrap {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0;
    transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events: none;
  }
  #pb-wrap.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }

  /* Outer blue frame */
  #pb-board {
    background: #3B6AC7;
    border-radius: 22px;
    padding: 7px;
    box-shadow: 0 16px 60px rgba(59,106,199,0.5);
  }

  /* Inner white area with dashed border */
  #pb-inner {
    background: #EEF4FF;
    border-radius: 16px;
    border: 3px dashed #7AABDF;
    padding: 14px 14px 10px;
    min-width: 560px;
  }

  /* Header row */
  #pb-title-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px; padding: 0 4px;
  }
  .pb-title { font-size: 13px; font-weight: 800; color: #3B6AC7; letter-spacing: 0.05em; }
  .pb-count { font-size: 11px; font-weight: 700; color: #7AABDF; }

  /* Grid */
  #pb-grid {
    display: grid;
    gap: 8px;
  }

  /* Ticket wrapper (for notch effect) */
  .pb-ticket-wrap {
    position: relative;
    padding-top: 10px;
  }
  /* Notch circle - same color as inner bg */
  .pb-ticket-wrap::before {
    content: '';
    position: absolute;
    top: 0; left: 50%; transform: translateX(-50%);
    width: 20px; height: 20px;
    background: #EEF4FF;
    border-radius: 50%;
    z-index: 3;
  }

  /* The ticket card */
  .pb-ticket {
    background: #C8CAD4;
    border-radius: 10px;
    height: 96px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    transition: transform 0.3s ease, background 0.4s ease, box-shadow 0.3s;
    cursor: default;
  }

  /* Star watermark */
  .pb-ticket-star {
    font-size: 48px; opacity: 0.13; color: #888;
    position: absolute; pointer-events: none;
    user-select: none;
  }

  /* Number label (unrevealed) */
  .pb-ticket-num {
    position: absolute; bottom: 6px; right: 8px;
    font-size: 10px; color: rgba(0,0,0,0.25); font-weight: 700;
  }

  /* Revealed ticket */
  .pb-ticket.revealed {
    background: #fff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .pb-ticket.revealed .pb-ticket-star { display: none; }
  .pb-ticket.just-revealed {
    animation: ticketFlip 0.5s cubic-bezier(0.4,0,0.2,1);
  }
  @keyframes ticketFlip {
    0%   { transform: scaleX(1); }
    40%  { transform: scaleX(0); }
    100% { transform: scaleX(1); }
  }

  /* Prize content */
  .pb-ticket-content {
    display: flex; flex-direction: column; align-items: center;
    gap: 3px; padding: 6px 8px; text-align: center; z-index: 1; width: 100%;
  }
  .pb-ticket-name {
    font-size: 22px; font-weight: 900; line-height: 1.2;
    word-break: keep-all; width: 100%;
  }
  .pb-ticket-desc {
    font-size: 13px; color: rgba(0,0,0,0.5); line-height: 1.2;
    word-break: keep-all; width: 100%;
  }

  /* Highlight animation for just-revealed */
  .pb-ticket.revealed {
    outline: 3px solid transparent;
  }
  .pb-ticket.just-revealed.revealed {
    outline-color: rgba(139,92,246,0.7);
    animation: ticketFlip 0.5s, ticketGlow 2s ease-out 0.5s;
  }
  @keyframes ticketGlow {
    0%   { outline-color: rgba(139,92,246,0.9); box-shadow: 0 0 20px rgba(139,92,246,0.6); }
    100% { outline-color: rgba(139,92,246,0.2); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  }
</style>
</head>
<body>
<div id="pb-wrap">
  <div id="pb-board">
    <div id="pb-inner">
      <div id="pb-title-row">
        <span class="pb-title">🎯 뽑기판</span>
        <span class="pb-count" id="pb-count">0 / 0 오픈</span>
      </div>
      <div id="pb-grid"></div>
    </div>
  </div>
</div>

<script>
const wrap   = document.getElementById('pb-wrap')
const grid   = document.getElementById('pb-grid')
const countEl= document.getElementById('pb-count')
let currentCells = [], currentRows = 4, currentCols = 5

function fitTicketText(ticket) {
  const name = ticket.querySelector('.pb-ticket-name')
  const desc = ticket.querySelector('.pb-ticket-desc')
  if (!name) return
  const maxH = ticket.clientHeight - 16
  let size = 26
  name.style.fontSize = size + 'px'
  if (desc) desc.style.fontSize = Math.max(11, Math.round(size * 0.58)) + 'px'
  while (size > 11 && ticket.querySelector('.pb-ticket-content').scrollHeight > maxH) {
    size--
    name.style.fontSize = size + 'px'
    if (desc) desc.style.fontSize = Math.max(11, Math.round(size * 0.58)) + 'px'
  }
}

function buildGrid(cells, rows, cols) {
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)'
  grid.innerHTML = ''
  cells.forEach((cell, i) => {
    const ticketWrap = document.createElement('div')
    ticketWrap.className = 'pb-ticket-wrap'

    const ticket = document.createElement('div')
    ticket.className = 'pb-ticket' + (cell.revealed ? ' revealed' : '')
    ticket.id = 'ticket-' + i

    if (!cell.revealed) {
      const star = document.createElement('div')
      star.className = 'pb-ticket-star'
      star.textContent = '★'
      ticket.appendChild(star)

      const num = document.createElement('div')
      num.className = 'pb-ticket-num'
      num.textContent = (i + 1)
      ticket.appendChild(num)
    } else {
      const content = document.createElement('div')
      content.className = 'pb-ticket-content'
      const name = document.createElement('div')
      name.className = 'pb-ticket-name'
      name.textContent = cell.name
      name.style.color = cell.color || '#333'
      content.appendChild(name)
      if (cell.description) {
        const desc = document.createElement('div')
        desc.className = 'pb-ticket-desc'
        desc.textContent = cell.description
        content.appendChild(desc)
      }
      ticket.appendChild(content)
    }
    ticketWrap.appendChild(ticket)
    grid.appendChild(ticketWrap)
  })
  requestAnimationFrame(() => {
    document.querySelectorAll('.pb-ticket.revealed').forEach(fitTicketText)
  })

  const revealed = cells.filter(c => c.revealed).length
  countEl.textContent = revealed + ' / ' + cells.length + ' 오픈'
  if (cells.length > 0) wrap.classList.add('show')
  else wrap.classList.remove('show')
}

function updateGrid(cells, rows, cols) {
  if (cells.length === 0) { wrap.classList.remove('show'); return }

  // If grid is fresh (no tickets rendered yet), build from scratch
  if (currentCells.length !== cells.length || currentRows !== rows || currentCols !== cols) {
    currentCells = cells; currentRows = rows; currentCols = cols
    buildGrid(cells, rows, cols)
    return
  }

  // Otherwise update incrementally (just-revealed cells)
  cells.forEach((cell, i) => {
    if (!currentCells[i].revealed && cell.revealed) {
      const ticket = document.getElementById('ticket-' + i)
      if (!ticket) return
      ticket.classList.add('just-revealed')
      setTimeout(() => {
        ticket.innerHTML = ''
        ticket.classList.add('revealed')
        const content = document.createElement('div')
        content.className = 'pb-ticket-content'
        const name = document.createElement('div')
        name.className = 'pb-ticket-name'
        name.textContent = cell.name
        name.style.color = cell.color || '#333'
        content.appendChild(name)
        if (cell.description) {
          const desc = document.createElement('div')
          desc.className = 'pb-ticket-desc'
          desc.textContent = cell.description
          content.appendChild(desc)
        }
        ticket.appendChild(content)
        requestAnimationFrame(() => fitTicketText(ticket))
      }, 200)
    }
  })
  currentCells = cells

  const revealed = cells.filter(c => c.revealed).length
  countEl.textContent = revealed + ' / ' + cells.length + ' 오픈'
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'pickboard:state') {
        updateGrid(msg.data.cells, msg.data.rows, msg.data.cols)
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
    } catch {}
  }
  ws.onclose = () => setTimeout(connect, 2000)
}
connect()
<\/script>
</body>
</html>`

const NUMBER_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }
  #num-wrap {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.7);
    opacity: 0; text-align: center;
    transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events: none;
  }
  #num-wrap.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  .num-bg {
    background: rgba(10,6,28,0.93);
    border: 3px solid rgba(139,92,246,0.7);
    border-radius: 32px; padding: 32px 56px 28px;
    box-shadow: 0 16px 60px rgba(109,40,217,0.5);
    backdrop-filter: blur(24px);
    min-width: 320px;
  }
  .num-label { font-size: 11px; font-weight: 800; letter-spacing: 0.25em; color: #A78BFA; margin-bottom: 16px; text-transform: uppercase; }
  .num-display {
    font-size: 120px; font-weight: 900; color: #fff;
    letter-spacing: -0.04em; line-height: 1;
    min-width: 240px; display: inline-block; text-align: center;
    transition: color 0.3s;
  }
  .num-display.rolling { color: rgba(167,139,250,0.6); }
  .num-display.landed  { color: #fff; animation: landPop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes landPop { 0%{transform:scale(0.8)} 60%{transform:scale(1.08)} 100%{transform:scale(1)} }
  .num-range { font-size: 14px; color: rgba(255,255,255,0.4); margin-top: 10px; font-weight: 600; }
  .num-chips { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
  .num-chip {
    padding: 6px 16px; border-radius: 20px;
    background: rgba(139,92,246,0.2); border: 2px solid rgba(139,92,246,0.5);
    font-size: 24px; font-weight: 900; color: #fff;
    animation: chipIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes chipIn { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  .num-by { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 12px; font-weight: 600; }
</style>
</head>
<body>
<div id="num-wrap">
  <div class="num-bg">
    <div class="num-label">🔢 숫자 추첨</div>
    <div class="num-display rolling" id="num-display">?</div>
    <div class="num-chips" id="num-chips" style="display:none"></div>
    <div class="num-range" id="num-range"></div>
    <div class="num-by" id="num-by"></div>
  </div>
</div>
<script>
const wrap=document.getElementById('num-wrap'),display=document.getElementById('num-display'),chips=document.getElementById('num-chips'),range=document.getElementById('num-range'),byEl=document.getElementById('num-by')
let rolling=false
function rollAnimation(min,max,targets,spinMs,triggeredBy){
  if(rolling)return
  rolling=true
  wrap.classList.add('show')
  chips.style.display='none'; chips.innerHTML=''
  byEl.textContent=triggeredBy+'님 추첨'
  range.textContent=min+' ~ '+max
  display.className='num-display rolling'; display.textContent='?'
  if(targets.length>1){
    display.style.display='none'; chips.style.display='flex'
    let idx=0
    function landNext(){
      if(idx>=targets.length){setTimeout(hide,4000);rolling=false;return}
      const chip=document.createElement('div'); chip.className='num-chip'; chip.textContent='?'; chips.appendChild(chip)
      let f=0; const iv=setInterval(()=>{ chip.textContent=Math.floor(Math.random()*(max-min+1))+min; if(++f>=18){clearInterval(iv);chip.textContent=targets[idx];idx++;setTimeout(landNext,500)} },60)
    }
    landNext()
  } else {
    display.style.display='inline-block'
    const end=Date.now()+spinMs-400; let interval=40
    function tick(){
      const now=Date.now(),progress=1-Math.max(0,(end-now)/(spinMs-400)); interval=40+progress*200
      display.textContent=Math.floor(Math.random()*(max-min+1))+min
      if(now<end){ setTimeout(tick,interval) } else { display.textContent=targets[0]; display.className='num-display landed'; setTimeout(hide,4000); rolling=false }
    }
    tick()
  }
}
function hide(){ wrap.classList.remove('show'); display.style.display='inline-block'; chips.innerHTML='' }
function connect(){
  const ws=new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage=e=>{
    try{
      const msg=JSON.parse(e.data)
      if(msg.type==='game:state'&&msg.data?.id==='number'&&msg.data?.status==='running'){
        const ns=msg.data.number
        if(ns?.result) rollAnimation(ns.min,ns.max,ns.result,ns.spinMs??3000,ns.triggeredBy??'')
      }
      if(msg.type==='ping') ws.send(JSON.stringify({type:'pong'}))
    }catch{}
  }
  ws.onclose=()=>setTimeout(connect,2000)
}
connect()
<\/script>
</body>
</html>`

const SLOT_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
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
    position: relative; width: 420px;
    background: linear-gradient(175deg, #E83232 0%, #C01E1E 55%, #A81818 100%);
    border-radius: 52px 52px 24px 24px;
    border: 5px solid #F5C518;
    padding: 16px 20px 18px;
    box-shadow: 0 0 0 3px #B8880E, 0 24px 64px rgba(0,0,0,0.55), inset 0 3px 0 rgba(255,210,80,0.35);
  }
  .machine::before {
    content: ''; position: absolute; inset: 5px;
    border-radius: 46px 46px 18px 18px;
    border: 2px solid rgba(255,200,70,0.35); pointer-events: none;
  }

  /* ── Title display ── */
  .title-panel {
    background: linear-gradient(180deg, #FFFDE7 0%, #FFF5B0 100%);
    border: 4px solid #F5C518; border-radius: 14px;
    padding: 6px 16px 10px; text-align: center; margin-bottom: 12px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.9);
  }
  .title-dots { display: flex; justify-content: center; gap: 7px; margin-bottom: 5px; }
  .tdot {
    width: 9px; height: 9px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #F5E040, #D4960A);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    transition: box-shadow 0.3s;
  }
  .tdot.lit { background: radial-gradient(circle at 35% 35%, #FFF176, #F5C518); box-shadow: 0 0 10px #F5C518, 0 0 18px #F5C518; }
  .title-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .title-star { color: #F5C518; font-size: 18px; line-height: 1; }
  .title-text { font-size: 28px; font-weight: 900; color: #4A2000; letter-spacing: -0.02em; }

  /* ── Reels frame ── */
  .reels-frame {
    background: linear-gradient(180deg, #1E0E00, #140A00);
    border-radius: 12px; padding: 8px 10px 10px;
    border: 3px solid #0D0600; margin-bottom: 10px;
    box-shadow: inset 0 4px 14px rgba(0,0,0,0.6);
  }
  .reels-row { display: flex; gap: 8px; }
  .reel {
    flex: 1; height: 108px; background: #fff;
    border-radius: 9px; border: 2px solid #CCC;
    overflow: hidden; position: relative;
    box-shadow: inset 0 2px 5px rgba(0,0,0,0.2), 0 2px 5px rgba(0,0,0,0.35);
  }
  .reel.lit { border-color: #F5C518; box-shadow: inset 0 2px 5px rgba(0,0,0,0.1), 0 0 22px rgba(245,197,24,0.7); }
  .reel-inner { display: flex; flex-direction: column; align-items: center; transition: transform 0s; }
  .reel-cell { width: 100%; height: 108px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 50px; background: #fff; }
  .reel-cell img { width: 68px; height: 68px; object-fit: contain; }
  .reel::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(to bottom, rgba(255,255,255,0.88) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.88) 100%);
    z-index: 2; pointer-events: none; border-radius: 7px;
  }

  /* ── Lever ── */
  .lever {
    position: absolute; right: -38px; top: 55px;
    display: flex; flex-direction: column; align-items: center;
  }
  .lever-knob {
    width: 28px; height: 28px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #FF6E6E, #BB1010);
    border: 3px solid #8A0000;
    box-shadow: 0 3px 7px rgba(0,0,0,0.45);
    transition: transform 0.18s ease;
  }
  .lever-knob.pulled { transform: translateY(58px); }
  .lever-rod {
    width: 8px; height: 64px; margin-top: -3px;
    background: linear-gradient(to right, #7A7A7A, #D0D0D0, #7A7A7A);
    border-radius: 4px; box-shadow: 2px 0 5px rgba(0,0,0,0.35);
  }
  .lever-base {
    width: 22px; height: 11px;
    background: linear-gradient(180deg, #AAAAAA, #555);
    border-radius: 4px; border: 2px solid #333;
  }

  /* ── Result bar ── */
  .result-bar {
    height: 34px; display: flex; align-items: center; justify-content: center;
    font-size: 17px; font-weight: 900; color: #fff;
    opacity: 0; transition: opacity 0.4s;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5); margin-bottom: 4px;
    letter-spacing: 0.03em;
  }
  .result-bar.show    { opacity: 1; }
  .result-bar.jackpot { color: #F5C518; animation: jackpotPulse 0.55s ease infinite alternate; }
  .result-bar.twoKind { color: #FFD0D0; }

  /* ── START button ── */
  .start-btn {
    width: 100%; height: 36px;
    background: linear-gradient(180deg, #FFD740 0%, #F59F00 100%);
    border: none; border-radius: 22px;
    font-size: 15px; font-weight: 900; color: #5A2800;
    letter-spacing: 0.25em; cursor: default; font-family: inherit;
    box-shadow: 0 4px 0 #B87200, 0 6px 14px rgba(0,0,0,0.4);
    transition: transform 0.1s, box-shadow 0.1s;
    position: relative;
  }
  .start-btn.active { transform: translateY(3px); box-shadow: 0 1px 0 #B87200, 0 3px 7px rgba(0,0,0,0.4); }

  @keyframes jackpotPulse { from { text-shadow: 0 0 20px #F5C518; } to { text-shadow: 0 0 55px #F5C518, 0 0 90px #EF4444; } }
  @keyframes confettiFall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  .confetti-piece { position: fixed; top: -20px; width: 8px; height: 14px; border-radius: 2px; animation: confettiFall 2.5s ease-in forwards; }
</style>
</head>
<body>
<div id="slot-wrap">
  <div class="machine">
    <!-- Gold lever -->
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
        <div class="tdot lit" id="td5"></div>
        <div class="tdot" id="td6"></div>
      </div>
      <div class="title-inner">
        <span class="title-star">&#9733;</span>
        <span class="title-text">슬롯머신</span>
        <span class="title-star">&#9733;</span>
      </div>
    </div>

    <!-- Reels -->
    <div class="reels-frame">
      <div class="reels-row">
        <div class="reel" id="reel0"><div class="reel-inner" id="inner0"></div></div>
        <div class="reel" id="reel1"><div class="reel-inner" id="inner1"></div></div>
        <div class="reel" id="reel2"><div class="reel-inner" id="inner2"></div></div>
      </div>
    </div>

    <!-- Result + START -->
    <div class="result-bar" id="result-bar"></div>
    <button class="start-btn" id="start-btn">START</button>
  </div>
</div>
<script>
const wrap      = document.getElementById('slot-wrap')
const resultBar = document.getElementById('result-bar')
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
  const colors = ['#F5C518','#EF4444','#10B981','#3B82F6','#EC4899','#8B5CF6']
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

  resultBar.className = 'result-bar'; resultBar.textContent = ''
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
    resultBar.classList.add('show')
    if (slot.jackpot)      { resultBar.className = 'result-bar show jackpot'; resultBar.textContent = 'JACKPOT!'; showConfetti() }
    else if (slot.twoKind) { resultBar.className = 'result-bar show twoKind'; resultBar.textContent = '2개 일치!' }
    else                   { resultBar.className = 'result-bar show'; resultBar.textContent = '꽝' }
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
  ws.onclose = () => setTimeout(connect, 2000)
}
connect()
<\/script>
</body>
</html>`

const BOSS_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #boss-hud {
    position: fixed; top: 40px; left: 40px; width: 520px;
    background: rgba(10,6,28,0.88); border: 2px solid rgba(239,68,68,0.55);
    border-radius: 20px; padding: 18px 22px; backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(239,68,68,0.25);
    opacity: 0; transform: translateX(-60px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  }
  #boss-hud.show { opacity: 1; transform: translateX(0); }

  .boss-name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .boss-skull    { font-size: 22px; }
  .boss-name     { font-size: 18px; font-weight: 900; color: #fff; letter-spacing: -0.02em; }
  .hp-label      { margin-left: auto; font-size: 11px; font-weight: 800; color: rgba(239,68,68,0.8); letter-spacing: 0.1em; }
  .hp-numbers    { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 7px; text-align: right; }
  .hp-bar-bg     { height: 16px; background: rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; }
  .hp-bar-fill   {
    height: 100%; border-radius: 8px;
    background: linear-gradient(90deg, #EF4444, #F97316);
    box-shadow: 0 0 12px rgba(239,68,68,0.5);
    transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
  }
  .participants  { margin-top: 14px; display: flex; flex-direction: column; gap: 4px; }
  .participant-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.65); }
  .p-name { font-weight: 700; color: #fff; min-width: 80px; }
  .p-dmg  { margin-left: auto; font-weight: 800; color: #F97316; }
  .p-crit { font-size: 10px; color: #FBBF24; }

  #dice-popup {
    position: fixed; bottom: 60px; left: 50%;
    transform: translateX(-50%) translateY(100px); opacity: 0;
    transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    text-align: center; pointer-events: none;
  }
  #dice-popup.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  .dice-face {
    width: 90px; height: 90px; margin: 0 auto 10px;
    background: rgba(10,6,28,0.95); border: 3px solid rgba(239,68,68,0.7);
    border-radius: 18px; display: flex; align-items: center; justify-content: center;
    font-size: 42px; font-weight: 900; color: #fff;
    box-shadow: 0 8px 30px rgba(239,68,68,0.35);
  }
  .dice-face.spin { animation: diceSpin 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes diceSpin {
    0%   { transform: rotateX(0deg)   rotateY(0deg);   }
    50%  { transform: rotateX(540deg) rotateY(270deg); }
    100% { transform: rotateX(720deg) rotateY(360deg); }
  }
  .dice-user   { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 6px; }
  .damage-tag  {
    display: inline-block; padding: 6px 20px; border-radius: 20px;
    font-size: 22px; font-weight: 900; color: #fff;
    background: rgba(239,68,68,0.85); box-shadow: 0 4px 16px rgba(239,68,68,0.4);
    letter-spacing: -0.02em;
  }
  .damage-tag.critical {
    background: linear-gradient(135deg, #F59E0B, #EF4444);
    animation: critPulse 0.3s ease;
  }
  @keyframes critPulse {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.15); }
  }
  .critical-badge { display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; color: #FBBF24; margin-top: 4px; }

  .float-dmg {
    position: fixed; font-size: 28px; font-weight: 900; color: #F97316;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5); pointer-events: none;
    animation: floatUp 1.8s ease-out forwards;
  }
  .float-dmg.crit { color: #FBBF24; font-size: 38px; }
  @keyframes floatUp {
    0%   { opacity: 1; transform: translateY(0) scale(1); }
    60%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(-120px) scale(0.7); }
  }

  #defeat-screen {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.75); opacity: 0; pointer-events: none;
    transition: opacity 0.6s ease;
  }
  #defeat-screen.show { opacity: 1; }
  .defeat-title {
    font-size: 72px; font-weight: 900; color: #fff;
    text-shadow: 0 0 40px #F59E0B; letter-spacing: -0.04em;
    animation: defeatBounce 0.6s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes defeatBounce { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .defeat-sub { font-size: 20px; color: rgba(255,255,255,0.7); margin-top: 12px; font-weight: 700; }
</style>
</head>
<body>
<div id="boss-hud">
  <div class="boss-name-row">
    <span class="boss-skull">💀</span>
    <span class="boss-name" id="boss-name">보스</span>
    <span class="hp-label">BOSS HP</span>
  </div>
  <div class="hp-numbers" id="hp-numbers">100,000 / 100,000</div>
  <div class="hp-bar-bg"><div class="hp-bar-fill" id="hp-fill" style="width:100%"></div></div>
  <div class="participants" id="participants"></div>
</div>

<div id="dice-popup">
  <div class="dice-user" id="dice-user"></div>
  <div class="dice-face" id="dice-face">?</div>
  <div class="damage-tag" id="damage-tag">0</div>
  <span class="critical-badge" id="crit-badge" style="display:none">🎯 CRITICAL HIT!</span>
</div>

<div id="defeat-screen">
  <div class="defeat-title">👑 BOSS DEFEATED!</div>
  <div class="defeat-sub" id="defeat-sub"></div>
</div>

<script>
let lastRollTs = 0, bossAlive = false, diceTimer = null
const hud      = document.getElementById('boss-hud')
const bossName = document.getElementById('boss-name')
const hpNums   = document.getElementById('hp-numbers')
const hpFill   = document.getElementById('hp-fill')
const partList = document.getElementById('participants')
const dicePopup= document.getElementById('dice-popup')
const diceUser = document.getElementById('dice-user')
const diceFace = document.getElementById('dice-face')
const dmgTag   = document.getElementById('damage-tag')
const critBadge= document.getElementById('crit-badge')
const defeatScr= document.getElementById('defeat-screen')
const defeatSub= document.getElementById('defeat-sub')

function updateHud(boss) {
  bossName.textContent = boss.bossName ?? '보스'
  const pct = Math.max(0, (boss.currentHp / boss.maxHp) * 100)
  hpFill.style.width   = pct + '%'
  hpNums.textContent   = boss.currentHp.toLocaleString() + ' / ' + boss.maxHp.toLocaleString()
  const entries = Object.entries(boss.participants ?? {})
    .sort((a, b) => b[1].totalDamage - a[1].totalDamage).slice(0, 5)
  partList.innerHTML = entries.map(([u, p]) => {
    const cp = p.attackCount ? Math.round(p.critCount / p.attackCount * 100) : 0
    return '<div class="participant-row"><span class="p-name">' + u + '</span>' +
      (cp > 0 ? '<span class="p-crit">⚡' + cp + '%</span>' : '') +
      '<span class="p-dmg">' + p.totalDamage.toLocaleString() + '</span></div>'
  }).join('')
}

function showRoll(roll) {
  if (roll.ts === lastRollTs) return
  lastRollTs = roll.ts
  diceUser.textContent = roll.user + '님'
  diceFace.textContent = '?'
  diceFace.classList.remove('spin')
  void diceFace.offsetWidth
  diceFace.classList.add('spin')
  let f = 0
  const iv = setInterval(() => {
    diceFace.textContent = Math.floor(Math.random() * 12) + 1
    if (++f >= 16) { clearInterval(iv); diceFace.textContent = roll.roll }
  }, 55)
  setTimeout(() => {
    dmgTag.textContent  = (roll.isCritical ? '💥 ' : '') + roll.damage.toLocaleString() + ' DMG'
    dmgTag.className    = 'damage-tag' + (roll.isCritical ? ' critical' : '')
    critBadge.style.display = roll.isCritical ? 'block' : 'none'
  }, 950)
  dicePopup.classList.add('show')
  clearTimeout(diceTimer)
  diceTimer = setTimeout(() => dicePopup.classList.remove('show'), 4000)
  const el = document.createElement('div')
  el.className = 'float-dmg' + (roll.isCritical ? ' crit' : '')
  el.textContent = (roll.isCritical ? '💥' : '−') + roll.damage.toLocaleString()
  el.style.left  = (25 + Math.random() * 50) + '%'
  el.style.top   = '55%'
  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'game:state' && msg.data?.id === 'boss') {
        const s    = msg.data
        const boss = s.boss
        if (!boss) return
        if (s.status === 'running' || s.status === 'showing_result') hud.classList.add('show')
        if (s.status === 'idle') { hud.classList.remove('show'); defeatScr.classList.remove('show') }
        updateHud(boss)
        if (boss.lastRoll) showRoll(boss.lastRoll)
        if (s.status === 'showing_result' && bossAlive) {
          const total = Object.values(boss.participants ?? {}).reduce((x, p) => x + p.totalDamage, 0)
          defeatSub.textContent = '총 데미지: ' + total.toLocaleString() + ' | 참여자: ' + Object.keys(boss.participants ?? {}).length + '명'
          defeatScr.classList.add('show')
          setTimeout(() => defeatScr.classList.remove('show'), 7000)
        }
        bossAlive = boss.alive
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
    } catch {}
  }
  ws.onclose = () => setTimeout(connect, 2000)
}
connect()
<\/script>
</body>
</html>`

const OVERLAY_HTML = (gameId: string, theme: string, port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: transparent;
    font-family: 'Noto Sans KR', sans-serif;
    overflow: hidden;
  }
  #overlay {
    position: fixed; bottom: 40px; right: 40px;
    min-width: 280px; max-width: 380px;
    background: rgba(20, 10, 40, 0.88);
    border: 1.5px solid rgba(139, 92, 246, 0.5);
    border-radius: 16px;
    padding: 18px 22px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(109,40,217,0.35), inset 0 1px 0 rgba(255,255,255,0.07);
    transform: translateY(120px);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
  }
  #overlay.show {
    transform: translateY(0);
    opacity: 1;
  }
  .game-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: rgba(139,92,246,0.9);
    margin-bottom: 6px;
  }
  .result-text {
    font-size: 22px; font-weight: 800; color: #fff;
    letter-spacing: -0.02em; line-height: 1.2;
    margin-bottom: 4px;
  }
  .detail-text {
    font-size: 13px; color: rgba(255,255,255,0.6);
  }
  .trigger-row {
    display: flex; align-items: center; gap: 7px;
    margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .trigger-user { font-size: 12px; color: rgba(255,255,255,0.5); }
  .trigger-balloon { font-size: 12px; color: #F59E0B; font-weight: 700; }

  @keyframes confetti-fall {
    to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  .confetti-piece {
    position: fixed; top: -20px;
    width: 8px; height: 12px; border-radius: 2px;
    animation: confetti-fall 2.5s ease-in forwards;
  }
</style>
</head>
<body>
<div id="overlay">
  <div class="game-label" id="game-label">SOOP GAME BOT</div>
  <div class="result-text" id="result-text">대기 중...</div>
  <div class="detail-text" id="detail-text"></div>
  <div class="trigger-row">
    <span class="trigger-user" id="trigger-user"></span>
    <span class="trigger-balloon" id="trigger-balloon"></span>
  </div>
</div>
<script>
  const GAME_NAMES = {
    roulette:'룰렛', ladder:'사다리타기', boss:'보스전', gacha:'뽑기',
    quiz:'퀴즈', slot:'슬롯머신', race:'경주', rps:'가위바위보',
    fish:'낚시', lottery:'복권', number:'숫자 추첨'
  }

  const overlay  = document.getElementById('overlay')
  const label    = document.getElementById('game-label')
  const resultEl = document.getElementById('result-text')
  const detailEl = document.getElementById('detail-text')
  const userEl   = document.getElementById('trigger-user')
  const balloonEl= document.getElementById('trigger-balloon')

  let hideTimer = null

  function showResult(data) {
    label.textContent     = GAME_NAMES[data.gameId] ?? data.gameId
    resultEl.textContent  = data.result
    detailEl.textContent  = data.detail
    userEl.textContent    = data.triggeredBy ? '@' + data.triggeredBy : ''
    balloonEl.textContent = data.balloon ? '🎈 ' + data.balloon.toLocaleString() + '개' : ''

    overlay.classList.add('show')
    if (data.result.includes('클리어') || data.result.includes('JACKPOT') || data.result.includes('레전드')) {
      launchConfetti()
    }

    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => overlay.classList.remove('show'), 6000)
  }

  function launchConfetti() {
    const colors = ['#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444']
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div')
      el.className = 'confetti-piece'
      el.style.left     = Math.random() * 100 + 'vw'
      el.style.background = colors[Math.floor(Math.random() * colors.length)]
      el.style.animationDelay    = Math.random() * 0.8 + 's'
      el.style.animationDuration = (2 + Math.random()) + 's'
      document.body.appendChild(el)
      el.addEventListener('animationend', () => el.remove())
    }
  }

  // WebSocket
  function connect() {
    const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'game:result') showResult(msg.data)
        if (msg.type === 'ping') ws.send(JSON.stringify({type:'pong'}))
      } catch {}
    }
    ws.onclose = () => setTimeout(connect, 2000)
  }
  connect()
<\/script>
</body>
</html>`

export class OverlayServer {
  private httpServer: ReturnType<typeof createServer> | null = null
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private port = 3939

  start(port = 3939) {
    this.port = port

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url    = req.url ?? '/'
      const gameId = url.replace('/overlay/', '').split('?')[0] || 'roulette'

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      let html: string
      if      (gameId === 'quiz')      html = QUIZ_OVERLAY_HTML(port)
      else if (gameId === 'ladder')    html = LADDER_OVERLAY_HTML(port)
      else if (gameId === 'roulette')  html = ROULETTE_OVERLAY_HTML(port)
      else if (gameId === 'slot')      html = SLOT_OVERLAY_HTML(port)
      else if (gameId === 'boss')      html = BOSS_OVERLAY_HTML(port)
      else if (gameId === 'number')    html = NUMBER_OVERLAY_HTML(port)
      else if (gameId === 'pickboard') html = PICKBOARD_OVERLAY_HTML(port)
      else html = OVERLAY_HTML(gameId, 'purple', port)
      res.end(html)
    })

    this.wss = new WebSocketServer({ server: this.httpServer, path: '/__overlay_ws__' })

    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.on('close', () => this.clients.delete(ws))
      ws.on('error', () => this.clients.delete(ws))
    })

    this.httpServer.listen(port, '127.0.0.1')
  }

  broadcast(type: string, data: unknown) {
    const msg = JSON.stringify({ type, data })
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(msg) } catch {}
      }
    }
  }

  sendResult(result: GameResult) {
    this.broadcast('game:result', result)
  }

  sendState(state: GameState) {
    this.broadcast('game:state', state)
  }

  getUrl(gameId: string) {
    return `http://localhost:${this.port}/overlay/${gameId}`
  }

  stop() {
    this.wss?.close()
    this.httpServer?.close()
  }
}

export const overlayServer = new OverlayServer()
