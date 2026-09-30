// OBS 오버레이 페이지: ladder (HTML 템플릿 문자열)
export const LADDER_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #172437;
    --orange: #FF5B17;
    --cream: #F5F3EF;
    --mint: #00CB84;
    --line: rgba(23,36,55,0.13);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  #card {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%,-50%) scale(0.88); opacity: 0;
    width: 960px;
    transition: transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
    filter: drop-shadow(0 22px 40px rgba(0,0,0,0.45));
  }
  #card.show { transform: translate(-50%,-50%) scale(1); opacity: 1; }

  /* ── 네이비 각진 프레임 ── */
  .frame {
    position: relative;
    background: var(--navy);
    padding: 76px 54px 18px;
    clip-path: polygon(
      30px 0, calc(100% - 30px) 0, 100% 30px,
      100% calc(50% - 34px), calc(100% - 12px) calc(50% - 22px), calc(100% - 12px) calc(50% + 22px), 100% calc(50% + 34px),
      100% calc(100% - 30px), calc(100% - 30px) 100%, 30px 100%, 0 calc(100% - 30px),
      0 calc(50% + 34px), 12px calc(50% + 22px), 12px calc(50% - 22px), 0 calc(50% - 34px),
      0 30px
    );
  }
  /* 상단 좌우 주황 바 */
  .topbar {
    position: absolute; top: 18px; height: 12px; border-radius: 6px;
    background: var(--orange);
  }
  .topbar.l { left: 58px; right: calc(50% + 276px); }
  .topbar.r { right: 58px; left: calc(50% + 276px); }
  /* 측면 주황 사선 스트라이프 */
  .hazard {
    position: absolute; width: 30px; height: 30%;
    background: repeating-linear-gradient(-58deg, var(--orange) 0 13px, transparent 13px 28px);
  }
  .hazard.tl { left: 12px; top: 13%; }
  .hazard.bl { left: 12px; top: 57%; }
  .hazard.tr { right: 12px; top: 13%; }
  .hazard.br { right: 12px; top: 57%; }

  /* ── 공책 종이 ── */
  .paper {
    position: relative;
    background: var(--cream);
    border-radius: 16px;
    padding: 20px 26px 22px 46px;
    overflow: hidden;
    min-height: 150px;
    box-shadow: inset 0 0 0 3px rgba(23,36,55,0.06);
  }
  .paper::before {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(to bottom, transparent 0, transparent 31px, var(--line) 31px, var(--line) 33px);
    background-position: 0 14px;
    pointer-events: none; z-index: 0;
  }
  .paper::after {
    content: '';
    position: absolute; left: 32px; top: 0; bottom: 0; width: 2px;
    background: rgba(224,52,44,0.45);
    pointer-events: none; z-index: 0;
  }
  .inner { position: relative; z-index: 1; }
  /* 종이 아래 주황 바 */
  .bottombar { height: 12px; border-radius: 6px; background: var(--orange); margin: 12px 4px 0; }

  /* ── 타이틀 배너 ── */
  .banner {
    position: absolute; left: 50%; top: -34px; transform: translateX(-50%);
    width: 560px; height: 96px;
    background: var(--navy);
    clip-path: polygon(22px 0, calc(100% - 22px) 0, 100% 100%, 0 100%);
    display: flex; align-items: center; justify-content: center;
    z-index: 3;
  }
  .banner-in {
    width: 540px; height: 80px; margin-top: -2px;
    background: var(--orange);
    clip-path: polygon(20px 0, calc(100% - 20px) 0, 100% 100%, 0 100%);
    display: flex; align-items: center; justify-content: center; gap: 22px;
    color: var(--navy); font-weight: 900; font-size: 44px; letter-spacing: 1px; line-height: 1;
    padding-bottom: 4px;
  }
  .banner-in .star { font-size: 30px; padding-top: 6px; }

  /* ── 모집 단계 ── */
  .speech-row { display: flex; align-items: center; gap: 18px; margin-bottom: 16px; }
  .speech-bubble {
    position: relative;
    background: #fff; border: 3px solid var(--navy); border-radius: 10px;
    padding: 12px 24px; font-size: 22px; font-weight: 800; color: var(--navy);
    line-height: 1.1;
  }
  .speech-bubble::before {
    content: '';
    position: absolute; left: -12px; top: 14px;
    border: 8px solid transparent; border-right-color: var(--navy);
  }
  .speech-bubble::after {
    content: '';
    position: absolute; left: -7px; top: 16px;
    border: 6px solid transparent; border-right-color: #fff;
  }
  .count-badge {
    background: #fff; border: 3px solid var(--navy); border-radius: 10px;
    padding: 12px 18px; font-size: 22px; font-weight: 900; color: var(--navy);
    white-space: nowrap; line-height: 1.1;
  }
  .chips-wrap { display: flex; flex-wrap: wrap; gap: 12px; min-height: 52px; margin: 0 0 18px; }
  .chip {
    background: #fff; border: 3px solid var(--navy); border-radius: 10px;
    padding: 9px 18px; font-size: 22px; font-weight: 900; color: var(--navy);
    line-height: 1.1;
  }
  .timer-wrap {
    height: 28px; background: #e6e5e3; border: 3px solid var(--navy); border-radius: 14px;
    overflow: hidden; margin: 4px 0 6px; padding: 3px;
  }
  .timer-fill { height: 100%; background: var(--orange); border-radius: 10px; transition: width 0.9s linear; }
  .wait-hint {
    font-size: 20px; font-weight: 800; color: rgba(23,36,55,0.45);
    padding: 2px 0 0; text-align: center;
  }

  /* ── 결과 단계 ── */
  #phase-result { display: none; flex-direction: column; }
  #phase-result.on { display: flex; }
  #lsvg { width: 100%; display: block; }

  /* 결과 리스트 박스 (종이 아래, 프레임 안) */
  .res-box {
    margin-top: 12px;
    background: #fff; border: 4px solid var(--orange); border-radius: 14px;
    padding: 6px 18px;
  }
  .res-box:has(.res-list:empty) { display: none; }
  .res-list { display: flex; flex-direction: column; }
  .res-row {
    display: flex; align-items: center; gap: 14px;
    padding: 8px 4px; font-size: 22px; font-weight: 900; color: var(--navy);
    border-bottom: 2px dashed rgba(23,36,55,0.18);
  }
  .res-row:last-child { border-bottom: none; }
  .res-user {
    color: #fff; border-radius: 8px; padding: 5px 20px; font-size: 20px; min-width: 120px; text-align: center;
    line-height: 1.15;
  }
  .res-arrow { color: var(--orange); font-size: 26px; line-height: 1; padding-bottom: 3px; }
  .res-prize { margin-left: auto; padding-right: 18px; }
</style>
</head>
<body>
<div id="card">
  <div class="frame">
    <div class="topbar l"></div>
    <div class="topbar r"></div>
    <div class="hazard tl"></div>
    <div class="hazard bl"></div>
    <div class="hazard tr"></div>
    <div class="hazard br"></div>

    <div class="paper">
      <div class="inner">
        <!-- 모집 단계 -->
        <div id="phase-collecting">
          <div class="speech-row">
            <div class="speech-bubble">채팅에서 <strong>!참가</strong>를 입력해 주세요</div>
            <div class="count-badge" id="count-lbl">0/0명</div>
          </div>
          <div class="chips-wrap" id="chips"></div>
          <div class="timer-wrap"><div class="timer-fill" id="tfill" style="width:100%"></div></div>
          <div class="wait-hint" id="wait-hint">참가자를 기다리는 중...</div>
        </div>

        <!-- 결과 단계 -->
        <div id="phase-result">
          <svg id="lsvg" viewBox="0 0 800 300"></svg>
        </div>
      </div>
    </div>

    <div class="res-box"><div class="res-list" id="res-list"></div></div>
    <div class="bottombar"></div>
  </div>

  <div class="banner"><div class="banner-in"><span class="star">★</span><span>사다리게임!</span><span class="star">★</span></div></div>
</div>
<script>
const PEN = ['#E0342C','#2F6BFF','#12A866','#B8860B','#6A2CB0','#0E8A8A','#D8358A','#8B4A1E']
const NAVY = '#172437'
const FONT = 'Noto Sans KR, sans-serif'

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
let _revealLd = null

function _mkSvgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); return el
}

function _orthoPts(cols, upTo, rows, COL_W, PAD_X, PAD_T, ROW_H) {
  const xp = c => PAD_X + c * COL_W
  const pts = [xp(cols[0]) + ',' + PAD_T]
  for (let r = 0; r < Math.min(upTo, rows); r++) {
    const curY = PAD_T + r * ROW_H
    const nxtY = PAD_T + (r + 1) * ROW_H
    if (cols[r + 1] !== cols[r]) pts.push(xp(cols[r + 1]) + ',' + curY)
    pts.push(xp(cols[r + 1]) + ',' + nxtY)
  }
  return pts.join(' ')
}

function _buildGrid(ld) {
  const cols = ld.cols, rows = ld.rows
  const COL_W = Math.min(120, Math.floor(760 / Math.max(cols - 1, 1)))
  const PAD_X = 50, PAD_T = 52, PAD_B = 48
  const ROW_H = Math.max(16, Math.min(30, Math.floor((480 - PAD_T - PAD_B) / Math.max(1, rows))))
  const W = PAD_X * 2 + (cols - 1) * COL_W
  const H = PAD_T + rows * ROW_H + PAD_B
  svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H)
  svgEl.style.height = (H * 1.12) + 'px'
  svgEl.innerHTML = ''
  const xp = c => PAD_X + c * COL_W

  // 수직선 (사다리 기둥) — 참가자 색, 경로 공개 전엔 연하게
  for (let c = 0; c < cols; c++) {
    svgEl.appendChild(_mkSvgEl('line', {
      x1: xp(c), y1: PAD_T, x2: xp(c), y2: PAD_T + rows * ROW_H,
      stroke: PEN[c % PEN.length], 'stroke-width': 4, 'stroke-opacity': 0.32, 'stroke-linecap': 'round'
    }))
  }

  // 수평선 (가로 발판) — 왼쪽 기둥 색
  ld.rungs.forEach(rg => {
    svgEl.appendChild(_mkSvgEl('line', {
      x1: xp(rg.leftCol), y1: PAD_T + rg.row * ROW_H,
      x2: xp(rg.leftCol+1), y2: PAD_T + rg.row * ROW_H,
      stroke: PEN[rg.leftCol % PEN.length], 'stroke-width': 4, 'stroke-opacity': 0.55, 'stroke-linecap': 'round'
    }))
  })

  // 기둥 하단 끝 원
  for (let c = 0; c < cols; c++) {
    svgEl.appendChild(_mkSvgEl('circle', {
      cx: xp(c), cy: PAD_T + rows * ROW_H, r: 5, fill: '#fff',
      stroke: PEN[c % PEN.length], 'stroke-width': 3
    }))
  }

  return { cols, rows, COL_W, PAD_X, PAD_T, PAD_B, ROW_H, W, H, xp }
}

// 상단 이름 박스 (흰 배경 + 색 테두리)
function _drawNames(ld, xp) {
  ld.order.forEach((name, c) => {
    const label = name.length > 5 ? name.slice(0,4)+'…' : name
    const tw = Math.max(46, label.length * 13 + 22)
    const col = PEN[c % PEN.length]
    const g = document.createElementNS('http://www.w3.org/2000/svg','g')
    g.appendChild(_mkSvgEl('rect',{x:xp(c)-tw/2,y:6,width:tw,height:30,rx:6,
      fill:'#fff',stroke:col,'stroke-width':2.4}))
    const t = _mkSvgEl('text',{x:xp(c),y:27,'text-anchor':'middle',
      'font-size':13.5,'font-weight':900,fill:col,'font-family':FONT})
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
  })
}

// 하단 상품 박스 (흰 배경 + 네이비 테두리)
function _drawPrizes(ld, rows, PAD_T, ROW_H, xp, hidden) {
  ld.prizes.forEach((prize, c) => {
    const label = hidden ? '?' : (prize.length > 5 ? prize.slice(0,4)+'…' : prize)
    const tw = Math.max(46, label.length * 13 + 22)
    const py = PAD_T + rows * ROW_H + 12
    const g = document.createElementNS('http://www.w3.org/2000/svg','g')
    g.appendChild(_mkSvgEl('rect',{x:xp(c)-tw/2,y:py,width:tw,height:30,rx:6,
      fill:'#fff',stroke:NAVY,'stroke-width':2.4}))
    const t = _mkSvgEl('text',{x:xp(c),y:py+21,'text-anchor':'middle',
      'font-size':hidden ? 16 : 13.5,'font-weight':900,fill:hidden ? 'rgba(23,36,55,0.4)' : NAVY,'font-family':FONT})
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
  })
}

function _addResRow(user, prize, color) {
  const row = document.createElement('div')
  row.className = 'res-row'
  const u = document.createElement('span'); u.className = 'res-user'; u.style.background = color; u.textContent = user
  const a = document.createElement('span'); a.className = 'res-arrow'; a.textContent = '➜'
  const p = document.createElement('span'); p.className = 'res-prize'; p.textContent = prize
  row.appendChild(u); row.appendChild(a); row.appendChild(p)
  resList.appendChild(row)
}

function revealSinglePath(ld, idx) {
  if (!ld) return
  const cols = ld.cols, rows = ld.rows
  const COL_W = Math.min(120, Math.floor(760 / Math.max(cols - 1, 1)))
  const PAD_X = 50, PAD_T = 52
  const ROW_H = Math.max(16, Math.min(30, Math.floor(380 / Math.max(1, rows))))
  const xp = c => PAD_X + c * COL_W
  const path = ld.paths[idx]; if (!path) return
  const penColor = PEN[idx % PEN.length]

  const pl = _mkSvgEl('polyline', { fill:'none', stroke: penColor,
    'stroke-width': 5,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    points: xp(path.cols[0]) + ',' + PAD_T })
  svgEl.appendChild(pl)
  const dot = _mkSvgEl('circle', { r: 6.5, fill: '#fff', cx: xp(path.cols[0]), cy: PAD_T, stroke: penColor, 'stroke-width': 3.5 })
  svgEl.appendChild(dot)

  let step = 0
  const tick = setInterval(() => {
    step++
    pl.setAttribute('points', _orthoPts(path.cols, step, rows, COL_W, PAD_X, PAD_T, ROW_H))
    const cr = Math.min(step, rows)
    dot.setAttribute('cx', xp(path.cols[cr]))
    dot.setAttribute('cy', PAD_T + cr * ROW_H)
    if (step >= rows) {
      clearInterval(tick)
      const res = ld.results[idx]
      if (res) _addResRow(res.user, res.prize, penColor)
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(hide, 15000)
    }
  }, 55)
}

function show() { card.classList.add('show') }
function hide() { card.classList.remove('show') }

function renderCollecting(ladder) {
  phColl.style.display = ''
  phRes.classList.remove('on')
  resList.innerHTML = ''
  cntLbl.textContent = ladder.participants.length + '/' + ladder.maxSlots + '명'
  const pct = Math.max(0, Math.min(100, ((ladder.deadline - Date.now()) / 30000) * 100))
  tfill.style.width = pct + '%'
  chips.innerHTML = ''
  ladder.participants.forEach((p, i) => {
    const c = document.createElement('span')
    c.className = 'chip'
    c.textContent = p
    c.style.color = PEN[i % PEN.length]
    c.style.borderColor = PEN[i % PEN.length]
    chips.appendChild(c)
  })
  waitHint.style.display = ladder.participants.length === 0 ? '' : 'none'
  show()
}

function renderResult(ld) {
  phColl.style.display = 'none'
  phRes.classList.add('on')

  const layout = _buildGrid(ld)
  const { rows, PAD_T, ROW_H, xp } = layout

  _drawNames(ld, xp)
  _drawPrizes(ld, rows, PAD_T, ROW_H, xp, false)

  // 경로 애니메이션
  let step = 0
  const lines = ld.paths.map((path, pi) => {
    const pl = _mkSvgEl('polyline', { fill:'none', stroke: PEN[pi % PEN.length],
      'stroke-width': 5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      points: xp(path.cols[0]) + ',' + PAD_T })
    svgEl.appendChild(pl); return pl
  })
  const dots = ld.paths.map((path, pi) => {
    const d = _mkSvgEl('circle', { r: 6.5, fill: '#fff',
      cx: xp(path.cols[0]), cy: PAD_T, stroke: PEN[pi % PEN.length], 'stroke-width': 3.5 })
    svgEl.appendChild(d); return d
  })

  function orthoPts(cols, upTo) {
    const pts = [xp(cols[0]) + ',' + PAD_T]
    for (let r = 0; r < Math.min(upTo, rows); r++) {
      const curY = PAD_T + r * ROW_H
      const nxtY = PAD_T + (r + 1) * ROW_H
      if (cols[r + 1] !== cols[r]) pts.push(xp(cols[r + 1]) + ',' + curY)
      pts.push(xp(cols[r + 1]) + ',' + nxtY)
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
      ld.results.forEach(r => _addResRow(r.user, r.prize, PEN[r.startCol % PEN.length]))
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(hide, 12000)
    }
  }, 55)

  show()
}

function renderManualPreview(ld) {
  _revealLd = ld
  phColl.style.display = 'none'
  phRes.classList.add('on')

  const layout = _buildGrid(ld)
  const { rows, PAD_T, ROW_H, xp } = layout

  _drawNames(ld, xp)
  _drawPrizes(ld, rows, PAD_T, ROW_H, xp, true)

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
      if (msg.type === 'game:ladder:reveal') revealSinglePath(msg.data?.ladderData ?? _revealLd, msg.data?.revealIdx)
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

// ── Roulette overlay (wheel + text slot) ─────────────────────────────────────
