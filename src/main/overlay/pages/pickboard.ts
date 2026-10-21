// OBS 오버레이 페이지: pickboard (HTML 템플릿 문자열)
import { app } from 'electron'
import { FX_SCRIPT } from './_fx'
export const PICKBOARD_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
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
    --ticket: #F8E6C6;
  }
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

  /* ── 바깥 오렌지 프레임 (네이비 외곽선 + 크림 전구 점) ── */
  #pb-board {
    position: relative;
    background: var(--orange);
    border: 4px solid var(--navy);
    border-radius: 30px;
    padding: 30px 30px 30px;
    box-shadow: 0 18px 50px rgba(23,36,55,0.45), inset 0 0 0 3px rgba(255,255,255,0.18);
  }
  .pb-dots { position: absolute; pointer-events: none; }
  .pb-dots.top, .pb-dots.bottom {
    left: 18px; right: 18px; height: 16px;
    background: radial-gradient(circle at center, var(--cream) 5px, rgba(245,243,239,0) 5.8px) center / 34px 16px repeat-x;
  }
  .pb-dots.top    { top: 6px; }
  .pb-dots.bottom { bottom: 6px; }
  .pb-dots.left, .pb-dots.right {
    top: 18px; bottom: 18px; width: 16px;
    background: radial-gradient(circle at center, var(--cream) 5px, rgba(245,243,239,0) 5.8px) center / 16px 34px repeat-y;
  }
  .pb-dots.left  { left: 6px; }
  .pb-dots.right { right: 6px; }

  /* ── 헤더 캡슐 ── */
  #pb-title-row {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--cream);
    border: 3px solid var(--navy);
    border-radius: 999px;
    padding: 6px 10px 6px 16px;
    margin-bottom: 14px;
    box-shadow: 0 3px 0 rgba(23,36,55,0.35);
  }
  .pb-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 34px; font-weight: 900; color: var(--navy);
    letter-spacing: -0.02em; line-height: 1;
  }
  .pb-title .pb-icon { font-size: 32px; line-height: 1; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.15)); }
  .pb-title .pb-spark { width: 30px; height: 30px; margin-left: 2px; margin-top: -16px; }
  .pb-title .pb-ver { font-size: 9px; font-weight: 700; color: var(--navy); opacity: 0.35; align-self: flex-end; margin-bottom: 2px; }
  .pb-count {
    font-size: 17px; font-weight: 800; color: var(--cream);
    background: var(--navy); border-radius: 999px;
    padding: 6px 18px; line-height: 1.2; letter-spacing: 0.02em;
    white-space: nowrap;
  }
  /* 카운터 팝 (칸 공개 시) */
  .pb-count.pop { animation: countPop 0.4s cubic-bezier(0.2,1.6,0.4,1); }
  @keyframes countPop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.22); background: var(--orange); }
    100% { transform: scale(1); }
  }
  /* 전부 공개 → 보드 바운스 */
  #pb-board.done { animation: boardBounce 0.7s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes boardBounce {
    0%   { transform: scale(1); }
    35%  { transform: scale(1.04); }
    70%  { transform: scale(0.985); }
    100% { transform: scale(1); }
  }

  /* Grid — 행 높이를 그리드에서 강제 고정 (엔진별 콘텐츠 기반 축소 방지) */
  #pb-grid {
    display: grid;
    gap: 10px;
    grid-auto-rows: 106px;
    align-items: stretch;
  }

  /* Ticket wrapper (for notch effect) */
  .pb-ticket-wrap {
    position: relative;
    padding-top: 10px;
    height: 106px;
    min-width: 0;   /* 그리드 아이템이 콘텐츠 폭으로 늘어나는 것 방지 */
    perspective: 520px;   /* 3D 플립 원근 — 레이아웃엔 영향 없음 */
  }
  /* 빛살 회전 중엔 이웃 칸 위로 (카드 자체는 z-index:1 로 빛살보다 위) */
  .pb-ticket-wrap.raying { z-index: 5; }
  .pb-ray-spin {
    --c: 0,203,132;
    position: absolute; left: 50%; top: 55%;
    width: 260px; height: 260px; margin: -130px 0 0 -130px;
    z-index: 0; pointer-events: none;
    /* 크림색 빛살 + 상품색 후광 — 오렌지 보드 위에서 또렷하게 */
    background:
      repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,250,240,0.95) 0deg 8deg, rgba(255,250,240,0) 8deg 22.5deg),
      radial-gradient(circle, rgba(var(--c),0.75) 0%, rgba(var(--c),0.35) 30%, rgba(var(--c),0) 55%);
    -webkit-mask: radial-gradient(circle, #000 0%, rgba(0,0,0,0.85) 30%, transparent 58%);
            mask: radial-gradient(circle, #000 0%, rgba(0,0,0,0.85) 30%, transparent 58%);
    animation: raySpin 1.1s ease-out forwards;
  }
  @keyframes raySpin {
    0%   { transform: rotate(0deg) scale(0.45); opacity: 0; }
    12%  { opacity: 1; }
    70%  { opacity: 0.8; }
    100% { transform: rotate(160deg) scale(1.25); opacity: 0; }
  }
  /* Notch circle - 보드 배경색(오렌지) + 네이비 테두리로 잘린 듯한 홈 */
  .pb-ticket-wrap::before {
    content: '';
    position: absolute;
    top: 0; left: 50%; transform: translateX(-50%);
    width: 20px; height: 20px;
    background: var(--orange);
    border: 3px solid var(--navy);
    border-radius: 50%;
    z-index: 3;
  }

  /* The ticket card — wrap(106px 고정)에서 padding 제외한 96px를 항상 채움 */
  .pb-ticket {
    --c: 0,203,132;            /* 공개된 상품 색 (r,g,b) — JS에서 덮어씀 */
    background: linear-gradient(180deg, #FBEDD3 0%, var(--ticket) 100%);
    border: 3px solid var(--navy);
    border-radius: 14px;
    height: 100%;
    min-height: 96px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative; overflow: hidden; z-index: 1;
    box-shadow: 0 3px 0 rgba(23,36,55,0.35);
    transition: transform 0.3s ease, background 0.4s ease, box-shadow 0.3s;
    cursor: default;
    backface-visibility: hidden;
  }
  /* 3D 플립: 앞면(번호) 0→90° 로 사라진 뒤 내용 교체, 뒷면(상품) -90→0° 로 등장 (총 ~450ms) */
  .pb-ticket.flip-out { animation: flipOut 0.225s ease-in forwards; }
  .pb-ticket.flip-in  { animation: flipIn 0.225s ease-out both; }
  @keyframes flipOut { from { transform: rotateY(0deg); }   to { transform: rotateY(90deg); } }
  @keyframes flipIn  { from { transform: rotateY(-90deg); } to { transform: rotateY(0deg); } }
  /* 꽝: 작은 흔들림 */
  .pb-ticket.shake { animation: pbShake 0.45s ease; }
  @keyframes pbShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px) rotate(-2deg); }
    40% { transform: translateX(6px) rotate(2deg); }
    60% { transform: translateX(-4px) rotate(-1deg); }
    80% { transform: translateX(4px) rotate(1deg); }
  }

  /* Star watermark */
  .pb-ticket-star {
    font-size: 64px; line-height: 1; color: #C9964F; opacity: 0.22;
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -52%);
    pointer-events: none; user-select: none;
  }

  /* Number label (unrevealed) — 칸 가운데 크게 */
  .pb-ticket-num {
    position: relative; z-index: 2;
    font-size: 44px; font-weight: 900; line-height: 1;
    color: var(--navy);
    text-shadow: 0 2px 0 rgba(255,255,255,0.45);
  }

  /* Revealed ticket — 상품 색을 틴트로 (배경/테두리/글로우) */
  .pb-ticket.revealed {
    /* 불투명 크림 베이스 위에 상품색 틴트 — 아래 오렌지 보드가 비치지 않게 */
    background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.9) 0%, rgba(var(--c),0.16) 55%, rgba(var(--c),0.40) 100%) #FFFDF8;
    border-color: rgba(var(--c),1);
    box-shadow: 0 0 0 2px rgba(255,255,255,0.6) inset, 0 0 18px rgba(var(--c),0.55), 0 3px 0 rgba(23,36,55,0.25);
  }
  .pb-ticket.revealed .pb-ticket-star { display: none; }
  /* 빛살(레이) 텍스처 */
  .pb-ticket-rays {
    position: absolute; inset: -30%;
    background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.55) 0deg 7deg, rgba(255,255,255,0) 7deg 18deg);
    opacity: 0.6; pointer-events: none;
    -webkit-mask: radial-gradient(circle, #000 20%, transparent 70%);
            mask: radial-gradient(circle, #000 20%, transparent 70%);
  }

  /* Prize content */
  .pb-ticket-content {
    display: flex; flex-direction: column; align-items: center;
    gap: 3px; padding: 4px 4px; text-align: center; z-index: 1; width: 100%;
    position: relative;
  }
  .pb-ticket-name {
    font-size: 22px; font-weight: 900; line-height: 1.2;
    word-break: keep-all; overflow-wrap: anywhere; width: 100%;
    text-shadow: 0 1px 0 rgba(255,255,255,0.6);
  }
  .pb-ticket-desc {
    font-size: 13px; font-weight: 800; line-height: 1.2; opacity: 0.85;
    word-break: keep-all; overflow-wrap: anywhere; width: 100%;
  }

  /* Highlight animation for just-revealed (플립 종료 후) */
  .pb-ticket.revealed {
    outline: 3px solid transparent;
  }
  .pb-ticket.revealed.glow {
    outline-color: rgba(var(--c),0.7);
    animation: ticketGlow 2s ease-out;
  }
  @keyframes ticketGlow {
    0%   { outline-color: rgba(var(--c),0.9); box-shadow: 0 0 28px rgba(var(--c),0.9); }
    100% { outline-color: rgba(var(--c),0.2); box-shadow: 0 0 18px rgba(var(--c),0.55), 0 3px 0 rgba(23,36,55,0.25); }
  }
</style>
</head>
<body>
<div id="pb-wrap">
  <div id="pb-board">
    <div class="pb-dots top"></div>
    <div class="pb-dots bottom"></div>
    <div class="pb-dots left"></div>
    <div class="pb-dots right"></div>
    <div id="pb-title-row">
      <span class="pb-title">
        <span class="pb-icon">🎯</span>
        <span>뽑기판</span>
        <svg class="pb-spark" viewBox="0 0 24 24" fill="none" stroke="#FF5B17" stroke-width="3.5" stroke-linecap="round">
          <line x1="13" y1="14" x2="21" y2="16"/>
          <line x1="11" y1="9" x2="17" y2="3"/>
          <line x1="15" y1="12" x2="22" y2="8"/>
        </svg>
        <span class="pb-ver">v${app.getVersion()}</span>
      </span>
      <span class="pb-count" id="pb-count">0 / 0 오픈</span>
    </div>
    <div id="pb-grid"></div>
  </div>
</div>

<script>${FX_SCRIPT}</script>
<script>
const wrap   = document.getElementById('pb-wrap')
const board  = document.getElementById('pb-board')
const grid   = document.getElementById('pb-grid')
const countEl= document.getElementById('pb-count')
let currentCells = [], currentRows = 4, currentCols = 5
let gridGen = 0   // 그리드 재구성 세대 — 재구성 후 이전 공개 타이머 무효화
let allDone = false   // 전부 공개 피날레 1회 가드 (재구성/초기화 시 갱신)

const NAVY = [23, 36, 55]
const MINT = [0, 203, 132]

// 상품 색 파싱 — 잘못된 값이면 민트로 폴백
function parseColor(c) {
  let h = String(c || '').trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return MINT
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)) }
function rgb(c) { return 'rgb(' + c.join(',') + ')' }

// 1차: 측정 없이 글자 폭 가중치만으로 폰트 크기 결정.
// OBS(CEF) 등 레이아웃 측정이 불안정한 환경에서도 항상 동일하게 동작한다.
// 카드 폭은 100px 고정(buildGrid)이므로 계산이 실제와 항상 일치.
function textUnits(s) {
  let u = 0
  for (const ch of String(s)) u += /[\\u0020-\\u00FF]/.test(ch) ? 0.55 : 1   // 영문·숫자·기호는 한글의 절반 폭
  return Math.max(1, u)
}
function calcNameSize(name, cols, hasDesc) {
  const avail = 86                                   // 카드 100px - 안쪽 여백
  const units = textUnits(String(name).trim())
  // 줄 수별 폰트 높이 상한 (카드 96px, 설명 줄 유무 반영)
  const capsNoDesc = [0, 55, 27, 18]
  const capsDesc   = [0, 33, 17, 13]
  const caps = hasDesc ? capsDesc : capsNoDesc
  // 1~3줄 각각 "폭에 들어가는 최대 크기 vs 높이 상한"을 따져 가장 큰 조합 선택
  let best = 10
  for (let lines = 1; lines <= 3; lines++) {
    const sizeW = Math.floor(avail / Math.max(1, units / lines))
    const cand  = Math.min(sizeW, caps[lines], 34)
    if (cand > best) best = cand
  }
  return best
}

function applyTicketFont(name, desc, size) {
  name.style.fontSize = size + 'px'
  if (desc) desc.style.fontSize = Math.max(10, Math.round(size * 0.55)) + 'px'
}

// 상품 내용 DOM 생성 — 생성 시점에 폰트 크기를 인라인으로 확정
function makeTicketContent(cell, cols) {
  const c = parseColor(cell.color)
  const content = document.createElement('div')
  content.className = 'pb-ticket-content'
  const name = document.createElement('div')
  name.className = 'pb-ticket-name'
  name.textContent = cell.name
  name.style.color = rgb(mix(c, NAVY, 0.45))      // 상품 색을 어둡게 — 연한 틴트 위에서 잘 읽히게
  content.appendChild(name)
  let desc = null
  if (cell.description) {
    desc = document.createElement('div')
    desc.className = 'pb-ticket-desc'
    desc.textContent = cell.description
    desc.style.color = rgb(mix(c, NAVY, 0.35))
    content.appendChild(desc)
  }
  applyTicketFont(name, desc, calcNameSize(cell.name, cols, !!cell.description))
  return content
}

// 공개된 카드에 상품 색 틴트 적용 (배경·테두리·글로우는 CSS 변수 --c 로)
function applyTint(ticket, cell) {
  const c = parseColor(cell.color)
  ticket.style.setProperty('--c', c.join(','))
  const rays = document.createElement('div')
  rays.className = 'pb-ticket-rays'
  ticket.appendChild(rays)
}

function buildGrid(cells, rows, cols) {
  gridGen++
  // 카드 폭 100px 완전 고정 — 콘텐츠가 열/보드 폭을 절대 못 늘림 (폰트 계산과 항상 일치)
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 100px)'
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
      applyTint(ticket, cell)
      ticket.appendChild(makeTicketContent(cell, cols))
    }
    ticketWrap.appendChild(ticket)
    grid.appendChild(ticketWrap)
  })
  const revealed = cells.filter(c => c.revealed).length
  setCount(revealed, cells.length, false)
  allDone = revealed === cells.length   // 이미 다 열린 상태로 (재)로드되면 피날레 안 함
  board.classList.remove('done')
  if (cells.length > 0) wrap.classList.add('show')
  else wrap.classList.remove('show')
}

function setCount(n, total, pop) {
  countEl.textContent = n + ' / ' + total + ' 오픈'
  if (!pop) return
  countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('pop')
}

const isLoseName = name => /꽝/.test(String(name || ''))
const isJackName = name => /1등|대박|특별/.test(String(name || ''))

// 한 칸 공개 연출: 3D 플립(0→90° 앞면 → 내용 교체 → -90→0° 상품면) → 당첨/꽝 피드백
// batch: 같은 메시지로 여러 칸이 동시에 열릴 때 효과음은 종류별 1회만 (시각 연출은 칸마다)
function revealCell(ticket, cell, finalCount, total, batch) {
  const gen = gridGen
  const wrapEl = ticket.parentElement
  const col = parseColor(cell.color)
  const lose = isLoseName(cell.name), jack = isJackName(cell.name)
  const mySound = lose ? 'lose' : jack ? 'jackpot' : 'win'
  ticket.classList.remove('glow', 'shake', 'flip-in')
  ticket.classList.add('flip-out')
  if (!batch.flip) { batch.flip = true; FX.sound('flip') }
  setTimeout(() => {
    if (gen !== gridGen) return   // 그 사이 초기화됐으면 무시
    ticket.innerHTML = ''
    ticket.classList.remove('flip-out')
    ticket.classList.add('revealed', 'flip-in')
    applyTint(ticket, cell)
    ticket.appendChild(makeTicketContent(cell, currentCols))
    setCount(finalCount, total, true)
    if (!batch.pop) { batch.pop = true; FX.sound('pop') }
  }, 225)
  setTimeout(() => {
    if (gen !== gridGen) return
    ticket.classList.remove('flip-in')
    if (mySound === batch.kind && !batch.played) { batch.played = true; FX.sound(mySound) }
    if (lose) { ticket.classList.add('shake'); return }
    ticket.classList.add('glow')
    FX.burst(ticket, rgb(col))
    // 카드 뒤 빛살 회전
    const ray = document.createElement('div')
    ray.className = 'pb-ray-spin'
    ray.style.setProperty('--c', col.join(','))
    wrapEl.classList.add('raying')
    wrapEl.insertBefore(ray, ticket)
    setTimeout(() => { ray.remove(); wrapEl.classList.remove('raying') }, 1150)
    const r = ticket.getBoundingClientRect()
    FX.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: jack ? 160 : 60, spread: 0.8,
                  colors: [rgb(col), '#FFC928', '#F5F3EF', rgb(mix(col, [255,255,255], 0.5)), '#FF5B17'] })
  }, 450)
}

// 전부 공개 피날레
function finale(total) {
  FX.sound('jackpot')
  board.classList.remove('done'); void board.offsetWidth; board.classList.add('done')
  const r = board.getBoundingClientRect()
  FX.confetti({ x: r.left + r.width / 2, y: r.top + 30, count: 320, spread: 1.5 })
  FX.confetti({ x: r.left + 20, y: r.top + r.height * 0.6, count: 90, spread: 0.7 })
  FX.confetti({ x: r.right - 20, y: r.top + r.height * 0.6, count: 90, spread: 0.7 })
  FX.winner({ text: '뽑기판 종료', sub: total + '칸 모두 공개', anchor: board, ms: 6000, icon: '🎯' })
}

function updateGrid(cells, rows, cols) {
  if (cells.length === 0) { wrap.classList.remove('show'); FX.hideWinner(); return }

  // 초기화 감지: 공개됐던 칸이 미공개로 돌아가면 전체 재구성
  // (증분 업데이트는 미공개→공개 전환만 처리하므로 초기화가 반영 안 됨)
  const resetDetected = currentCells.length === cells.length
    && cells.some((cell, i) => currentCells[i].revealed && !cell.revealed)

  // If grid is fresh (no tickets rendered yet), build from scratch
  if (currentCells.length !== cells.length || currentRows !== rows || currentCols !== cols || resetDetected) {
    currentCells = cells; currentRows = rows; currentCols = cols
    buildGrid(cells, rows, cols)
    return
  }

  // Otherwise update incrementally (just-revealed cells)
  const revealed = cells.filter(c => c.revealed).length
  const fresh = cells.filter((cell, i) => !currentCells[i].revealed && cell.revealed)
  // 이번 배치의 대표 효과음: 1등급 > 당첨 > 꽝
  const batch = { flip: false, pop: false, played: false,
    kind: fresh.some(c => isJackName(c.name)) ? 'jackpot' : fresh.some(c => !isLoseName(c.name)) ? 'win' : 'lose' }
  let flipped = 0
  cells.forEach((cell, i) => {
    if (!currentCells[i].revealed && cell.revealed) {
      const ticket = document.getElementById('ticket-' + i)
      if (!ticket) return
      flipped++
      revealCell(ticket, cell, revealed, cells.length, batch)
    }
  })
  currentCells = cells
  if (flipped === 0) setCount(revealed, cells.length, false)   // 플립이 있으면 내용 교체 시점에 팝과 함께 갱신

  if (revealed === cells.length && !allDone) {
    allDone = true
    const gen = gridGen
    setTimeout(() => { if (gen === gridGen) finale(cells.length) }, flipped ? 1000 : 0)
  }
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'pickboard:state') {
        updateGrid(msg.data.cells, msg.data.rows, msg.data.cols)
      }
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
