// OBS 오버레이 페이지: ladder (HTML 템플릿 문자열)
import { FX_SCRIPT } from './_fx'

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
  /* 새 참가자 칩 팝인 */
  @keyframes chipPop {
    0%   { transform: scale(0.6); opacity: 0; }
    60%  { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .chip.new { animation: chipPop 0.42s cubic-bezier(0.34,1.56,0.64,1) both; }
  /* 마감 임박 타이머 바 */
  @keyframes timerUrgent { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
  .timer-fill.urgent { background: #E0342C; animation: timerUrgent 0.5s ease-in-out infinite; }
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
  #lsvg { width: 100%; display: block; transform-origin: 0 0; will-change: transform; }
  /* 줄 공개: 고른 줄만 밝게, 나머지는 흐리게 */
  #lsvg .name-g { transform-box: fill-box; transform-origin: 50% 50%; transition: opacity .3s, transform .35s cubic-bezier(.34,1.56,.64,1); }
  #lsvg .name-g.picked { transform: scale(1.4); }
  #lsvg .dim { opacity: .28; transition: opacity .3s; }
  @keyframes wob { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
  #lsvg .prize-box.wob { animation: wob .16s linear infinite; }
  .pick-hint { position: relative; z-index: 2; text-align: center; min-height: 46px; margin-bottom: 2px;
    font-size: 30px; font-weight: 900; color: var(--navy); line-height: 46px; }
  .pick-hint .who { color: var(--orange); }
  .pick-hint.wait { color: rgba(23,36,55,.5); font-size: 24px; animation: waitPulse 1.6s ease-in-out infinite; }
  @keyframes waitPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  .pick-hint.slam { animation: slam .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes slam { 0% { transform: scale(1.9) rotate(-6deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
  .pick-hint.big { font-size: 42px; color: var(--orange); -webkit-text-stroke: 1px var(--navy); }
  @media (prefers-reduced-motion: reduce) { .pick-hint.slam, #lsvg .prize-box.wob { animation: none; } }
  /* 경로를 이끄는 점 */
  #lsvg .lead-dot { filter: drop-shadow(0 0 4px rgba(255,255,255,0.9)); }
  /* 상품 박스 착지 바운스 */
  @keyframes prizeBounce {
    0%   { transform: scale(1); }
    30%  { transform: scale(1.35) translateY(4px); }
    60%  { transform: scale(0.92); }
    80%  { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
  #lsvg .prize-box { transform-box: fill-box; transform-origin: 50% 50%; }
  #lsvg .prize-box.land { animation: prizeBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
  #lsvg .prize-box rect, #lsvg .prize-box text { transition: fill 0.25s, stroke 0.25s; }
  @keyframes prizeTop {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.12); }
  }
  #lsvg .prize-box.top { animation: prizeTop 0.7s ease-in-out infinite; }

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
  /* 아직 착지 안 한 결과 행 */
  .res-row.pending { opacity: 0.22; }
  .res-row.pending .res-prize { color: transparent; }
  /* 착지 순간 강조 */
  @keyframes rowHl {
    0%   { background: rgba(255,91,23,0.55); transform: translateX(14px); }
    100% { background: transparent; transform: translateX(0); }
  }
  .res-row { transition: opacity 0.25s; border-radius: 8px; }
  .res-row.hl { animation: rowHl 0.9s ease-out both; }
  .res-row.top .res-prize { color: var(--orange); }
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
          <div class="pick-hint" id="pick-hint"></div>
          <svg id="lsvg" viewBox="0 0 800 300"></svg>
        </div>
      </div>
    </div>

    <div class="res-box"><div class="res-list" id="res-list"></div></div>
    <div class="bottombar"></div>
  </div>

  <div class="banner"><div class="banner-in"><span class="star">★</span><span>사다리게임!</span><span class="star">★</span></div></div>
</div>
<script>${FX_SCRIPT}<\/script>
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
const pickHint = document.getElementById('pick-hint')
let hideTimer = null
let _revealLd = null

// ── 연출 상태 ──────────────────────────────────────────────
let _prevParts   = []      // 모집 중 직전 참가자 목록 (새 칩 감지용)
let _collDeadline= 0       // 모집 마감 시각 (로컬 타이머 바/임박음)
let _collTotal   = 30000   // 모집 전체 길이 (엔진 joinMs)
let _collTick    = null    // 모집 타이머 바 로컬 갱신 interval
let _lastTimerSec= -1      // 임박음 중복 방지 (남은 초 단위)
let _topPrize    = null    // 1등 상품 이름 (설정 prizes[0])
let _prizeBoxes  = []      // 하단 상품 박스 {g, rect, text, prize} (열 index)
let _seq         = 0       // 착지 시퀀스 토큰 (새 렌더 시 이전 시퀀스 무효화)
let _seqTimers   = []      // 착지 시퀀스 타이머

function _clearSeq() { _seq++; _seqTimers.forEach(clearTimeout); _seqTimers = [] }
function _stopCollTick() { if (_collTick) { clearInterval(_collTick); _collTick = null } _lastTimerSec = -1; tfill.classList.remove('urgent') }
function _fx(fn) { try { if (window.FX) fn(window.FX) } catch {} }

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
  const out = []
  ld.order.forEach((name, c) => {
    const label = name.length > 5 ? name.slice(0,4)+'…' : name
    const tw = Math.max(46, label.length * 13 + 22)
    const col = PEN[c % PEN.length]
    const g = document.createElementNS('http://www.w3.org/2000/svg','g')
    g.setAttribute('class', 'name-g')
    g.appendChild(_mkSvgEl('rect',{x:xp(c)-tw/2,y:6,width:tw,height:30,rx:6,
      fill:'#fff',stroke:col,'stroke-width':2.4}))
    const t = _mkSvgEl('text',{x:xp(c),y:27,'text-anchor':'middle',
      'font-size':13.5,'font-weight':900,fill:col,'font-family':FONT})
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
    out[c] = g
  })
  return out
}

// 하단 상품 박스 (흰 배경 + 네이비 테두리)
function _drawPrizes(ld, rows, PAD_T, ROW_H, xp, hidden) {
  _prizeBoxes = []
  ld.prizes.forEach((prize, c) => {
    const label = hidden ? '?' : (prize.length > 5 ? prize.slice(0,4)+'…' : prize)
    const tw = Math.max(46, label.length * 13 + 22)
    const py = PAD_T + rows * ROW_H + 12
    const g = document.createElementNS('http://www.w3.org/2000/svg','g')
    g.setAttribute('class', 'prize-box')
    const rect = _mkSvgEl('rect',{x:xp(c)-tw/2,y:py,width:tw,height:30,rx:6,
      fill:'#fff',stroke:NAVY,'stroke-width':2.4})
    g.appendChild(rect)
    const t = _mkSvgEl('text',{x:xp(c),y:py+21,'text-anchor':'middle',
      'font-size':hidden ? 16 : 13.5,'font-weight':900,fill:hidden ? 'rgba(23,36,55,0.4)' : NAVY,'font-family':FONT})
    t.textContent = label; g.appendChild(t); svgEl.appendChild(g)
    _prizeBoxes[c] = { g, rect, text: t, prize, hidden: !!hidden }
  })
}

function _addResRow(user, prize, color, pending) {
  const row = document.createElement('div')
  row.className = 'res-row' + (pending ? ' pending' : '')
  const u = document.createElement('span'); u.className = 'res-user'; u.style.background = color; u.textContent = user
  const a = document.createElement('span'); a.className = 'res-arrow'; a.textContent = '➜'
  const p = document.createElement('span'); p.className = 'res-prize'; p.textContent = prize
  row.appendChild(u); row.appendChild(a); row.appendChild(p)
  resList.appendChild(row)
  return row
}

function _isTop(prize) { return _topPrize != null && prize === _topPrize }
function _isLose(prize) { return typeof prize === 'string' && prize.indexOf('꽝') >= 0 }

// 경로 착지 연출: 정지음 + 상품 박스 바운스/참가자 색 + 결과 행 강조 + 1등이면 잭팟
function _landPath(ld, idx, color, row) {
  const res = ld.results.find(r => r.startCol === idx)
  const path = ld.paths[idx]
  const endCol = res ? res.endCol : (path ? path.cols[ld.rows] : -1)
  const prize = res ? res.prize : (ld.prizes[endCol] ?? '')
  const box = _prizeBoxes[endCol]
  const top = _isTop(prize)

  _fx(F => F.sound('stop'))

  if (box) {
    // 가려진('?') 박스였다면 실제 상품 공개
    if (box.hidden) {
      const label = prize.length > 5 ? prize.slice(0,4)+'…' : prize
      box.text.textContent = label
      box.text.setAttribute('font-size', 13.5)
      const tw = Math.max(46, label.length * 13 + 22)
      const cx = parseFloat(box.text.getAttribute('x'))
      box.rect.setAttribute('x', cx - tw/2); box.rect.setAttribute('width', tw)
      box.hidden = false
    }
    box.rect.setAttribute('fill', color); box.rect.setAttribute('stroke', color)
    box.text.setAttribute('fill', '#fff')
    box.g.classList.remove('land'); void box.g.getBoundingClientRect(); box.g.classList.add('land')
    const seq = _seq
    _seqTimers.push(setTimeout(() => {
      if (seq !== _seq) return
      box.rect.setAttribute('fill', '#fff'); box.text.setAttribute('fill', color)
      box.g.classList.remove('land')
    }, 900))
  }

  if (row) {
    row.classList.remove('pending', 'hl'); void row.offsetWidth; row.classList.add('hl')
    if (top) row.classList.add('top')
  }

  if (top) {
    _fx(F => {
      F.sound('jackpot')
      F.flash('rgba(255,255,255,.5)')
      let x, y
      if (box) { const r = box.rect.getBoundingClientRect(); x = r.left + r.width/2; y = r.top + r.height/2 }
      F.confetti({ x, y, count: 180 })
      if (box) { F.burst(box.rect, '#FF5B17'); box.g.classList.add('top') }
    })
  } else if (_isLose(prize)) {
    _fx(F => F.sound('lose'))
  } else {
    _fx(F => F.sound('win'))
  }
  return { res, prize, top }
}

// 여운: 1등 당첨자 배너 (1등이 없으면 생략)
function _showWinnerBanner(ld) {
  if (_topPrize == null) return
  const w = ld.results.find(r => r.prize === _topPrize)
  if (!w) return
  _fx(F => F.winner({ nick: w.user, text: _topPrize, sub: '사다리 1등', anchor: card, ms: 6000 }))
}

// ── 줄 하나씩 공개 (스트리머가 고른 줄이 내려간다) ─────────────────────
// 박자: 선택(이름 확대·나머지 흐리게) → 내려가기(카메라가 점을 따라감, 끝 22% 에서 확 느려짐)
//      → 착지 직전 북소리·'?' 상자 떨림 → 80ms 멈춤 + 섬광 + 상품 쾅 → 카메라 복귀
const REVEAL = { pick: 800, travel: 4600, land: 1600 }   // 합계 7000 = 엔진 LADDER_REVEAL_MS
const REVEAL_TOTAL = REVEAL.pick + REVEAL.travel + REVEAL.land
let _board = null

function _pathPts(ld, idx, L) {
  const cols = ld.paths[idx].cols, pts = [[L.xp(cols[0]), L.PAD_T]]
  for (let r = 0; r < L.rows; r++) {
    const curY = L.PAD_T + r * L.ROW_H, nxtY = L.PAD_T + (r + 1) * L.ROW_H
    if (cols[r + 1] !== cols[r]) pts.push([L.xp(cols[r + 1]), curY])
    pts.push([L.xp(cols[r + 1]), nxtY])
  }
  return pts
}
function _ptsStr(pts) { return pts.map(p => p[0] + ',' + p[1]).join(' ') }

/** 판 깔기 (같은 판이면 그대로). 상품은 '?' 로 가린다 */
function ensureBoard(ld) {
  const key = JSON.stringify([ld.order, ld.rungs, ld.prizes])
  if (_board && _board.key === key) return _board
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (pathTick) { clearInterval(pathTick); pathTick = null }
  _stopCollTick(); _clearSeq(); _fx(F => F.hideWinner())
  _endAnim(true)
  phColl.style.display = 'none'
  phRes.classList.add('on')
  resList.innerHTML = ''
  svgEl.style.transform = ''
  const L = _buildGrid(ld)
  const layer = _mkSvgEl('g', {}); svgEl.appendChild(layer)
  const names = _drawNames(ld, L.xp)
  _drawPrizes(ld, L.rows, L.PAD_T, L.ROW_H, L.xp, true)
  _board = { key, ld, L, layer, names, drawn: new Set(), animKey: '', anim: null, total: ld.order.length }
  _hintWait()
  show()
  return _board
}

function _hintWait() {
  if (!_board) return
  const left = _board.total - _board.drawn.size
  pickHint.className = 'pick-hint wait'
  pickHint.textContent = left > 0 ? '스트리머가 줄을 고르는 중… (남은 ' + left + '줄)' : ''
}
function _hintSlam(html, big) {
  pickHint.className = 'pick-hint'
  void pickHint.offsetWidth
  pickHint.className = 'pick-hint slam' + (big ? ' big' : '')
  pickHint.innerHTML = html
}
function _esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }

/** 상품 상자 조용히 공개 (새로고침·중간 접속 때) */
function _revealBoxQuiet(endCol, prize, color) {
  const box = _prizeBoxes[endCol]; if (!box) return
  if (box.hidden) {
    const label = prize.length > 5 ? prize.slice(0,4)+'…' : prize
    box.text.textContent = label; box.text.setAttribute('font-size', 13.5)
    const tw = Math.max(46, label.length * 13 + 22), cx = parseFloat(box.text.getAttribute('x'))
    box.rect.setAttribute('x', cx - tw/2); box.rect.setAttribute('width', tw); box.hidden = false
  }
  box.rect.setAttribute('fill', '#fff'); box.rect.setAttribute('stroke', color); box.text.setAttribute('fill', color)
}

/** 이미 연 줄을 바로 그려 둔다 */
function drawStatic(idx, withSound) {
  const B = _board; if (!B || B.drawn.has(idx)) return
  const ld = B.ld, color = PEN[idx % PEN.length], pts = _pathPts(ld, idx, B.L)
  B.layer.appendChild(_mkSvgEl('polyline', { fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', points: _ptsStr(pts) }))
  const end = pts[pts.length - 1]
  B.layer.appendChild(_mkSvgEl('circle', { r: 6.5, fill: '#fff', cx: end[0], cy: end[1], stroke: color, 'stroke-width': 3.5 }))
  _prizeBoxes.forEach(b => { if (b) svgEl.appendChild(b.g) })
  const res = ld.results.find(r => r.startCol === idx)
  const row = res ? _addResRow(res.user, res.prize, color) : null
  if (withSound) _landPath(ld, idx, color, row)
  else if (res) _revealBoxQuiet(res.endCol, res.prize, color)
  B.drawn.add(idx)
}

function _setDim(on, keep) {
  const B = _board; if (!B) return
  B.names.forEach((g, c) => { g.classList.toggle('dim', on && c !== keep); g.classList.toggle('picked', on && c === keep) })
  Array.from(B.layer.children).forEach(el => { if (!el.__live) el.classList.toggle('dim', on) })
}
function _camera(z, fx, fy) {
  const B = _board; if (!B) return
  if (z <= 1.001) { svgEl.style.transform = ''; return }
  const cw = svgEl.clientWidth, ch = svgEl.clientHeight
  const s = Math.min(cw / B.L.W, ch / B.L.H), ox = (cw - B.L.W * s) / 2, oy = (ch - B.L.H * s) / 2
  const px = ox + fx * s, py = oy + fy * s
  const a = Math.min(1, (z - 1) / 0.8)               // 확대될수록 점을 화면 가운데로
  const tx = px * (1 - z) + (cw / 2 - px) * a, ty = py * (1 - z) + (ch / 2 - py) * a
  svgEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')'
}
const _eio = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2
const _eo  = t => 1 - Math.pow(1 - t, 3)

/** 고른 줄 내려가기 시작 (at = 엔진이 공개를 받은 시각 → 중간 접속해도 같은 지점부터) */
function animateReveal(idx, at) {
  const B = _board; if (!B) return
  const key = idx + ':' + at
  if (B.animKey === key || B.drawn.has(idx)) return
  _endAnim(true)
  B.animKey = key
  const ld = B.ld, color = PEN[idx % PEN.length], pts = _pathPts(ld, idx, B.L)
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]))
  const pl = _mkSvgEl('polyline', { fill: 'none', stroke: color, 'stroke-width': 6.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', points: _ptsStr([pts[0]]) })
  const dot = _mkSvgEl('circle', { r: 8.5, fill: '#fff', cx: pts[0][0], cy: pts[0][1], stroke: color, 'stroke-width': 4, class: 'lead-dot' })
  pl.__live = dot.__live = true
  B.layer.appendChild(pl); B.layer.appendChild(dot)
  _prizeBoxes.forEach(b => { if (b) svgEl.appendChild(b.g) })
  const res = ld.results.find(r => r.startCol === idx)
  B.anim = { idx, at, color, pts, cum, total: cum[cum.length - 1], pl, dot, res, seg: 0, drum: false, landed: false }
  _setDim(true, idx)
  _hintSlam('<span class="who">' + _esc(ld.order[idx]) + '</span> 님의 줄!')
  if (Date.now() - at < 400) _fx(F => F.sound('whoosh'))
  requestAnimationFrame(_animLoop)
}

function _progress(t) {   // 0..1 시간 → 0..1 거리. 앞 62% 시간에 78% 를 가고, 남은 22% 를 끈질기게 끈다
  if (t <= 0) return 0
  if (t >= 1) return 1
  if (t < .62) return t * (.78 / .62)
  const u = (t - .62) / .38
  return .78 + .22 * (1 - Math.pow(1 - u, 2.4))
}

function _animLoop() {
  const B = _board, A = B && B.anim; if (!A) return
  const e = Date.now() - A.at
  const t = (e - REVEAL.pick) / REVEAL.travel
  const d = _progress(t) * A.total
  let i = 1; while (i < A.cum.length - 1 && A.cum[i] < d) i++
  const k = A.cum[i] === A.cum[i-1] ? 1 : (d - A.cum[i-1]) / (A.cum[i] - A.cum[i-1])
  const x = A.pts[i-1][0] + (A.pts[i][0] - A.pts[i-1][0]) * Math.min(1, Math.max(0, k))
  const y = A.pts[i-1][1] + (A.pts[i][1] - A.pts[i-1][1]) * Math.min(1, Math.max(0, k))
  if (!A.landed) {
    A.pl.setAttribute('points', _ptsStr(A.pts.slice(0, i).concat([[x, y]])))
    A.dot.setAttribute('cx', x); A.dot.setAttribute('cy', y)
    // 가로 발판을 건널 때마다 딱
    if (i !== A.seg) { if (A.seg && A.pts[i][1] === A.pts[i-1][1]) _fx(F => F.sound('tick')); A.seg = i }
  }
  // 긴장: 마지막 구간에 북소리 + 가려진 상자 떨림
  if (t > .62 && !A.drum && !A.landed) {
    A.drum = true
    if (e < REVEAL.pick + REVEAL.travel) _fx(F => F.drumStart())
    _prizeBoxes.forEach(b => { if (b && b.hidden) b.g.classList.add('wob') })
  }
  // 카메라: 선택 때 다가가고, 내려가는 동안 따라가고, 끝에서 더 붙는다
  let z
  if (e < REVEAL.pick) z = 1 + .7 * _eio(e / REVEAL.pick)
  else if (t < 1) z = 1.7 + (t > .62 ? .55 * _eio((t - .62) / .38) : 0)
  else { const r = (e - REVEAL.pick - REVEAL.travel) / 900; z = r < 1 ? 2.25 - 1.25 * _eo(r) : 1 }
  // 착지 직후 흔들림
  let sx = 0, sy = 0
  if (A.landed) { const q = e - REVEAL.pick - REVEAL.travel; if (q < 380) { const a = 9 * (1 - q / 380); sx = (Math.random() - .5) * a; sy = (Math.random() - .5) * a } }
  _camera(z, x + sx, y + sy)

  if (t >= 1 && !A.landed) {
    A.landed = true
    A.pl.setAttribute('points', _ptsStr(A.pts)); const end = A.pts[A.pts.length - 1]
    A.dot.setAttribute('cx', end[0]); A.dot.setAttribute('cy', end[1])
    _prizeBoxes.forEach(b => { if (b) b.g.classList.remove('wob') })
    _fx(F => F.drumStop())
    // 80ms 히트스톱 뒤 공개
    setTimeout(() => {
      if (!_board || _board.anim !== A) return
      _fx(F => F.flash('rgba(255,255,255,.55)'))
      const row = A.res ? _addResRow(A.res.user, A.res.prize, A.color) : null
      const landed = _landPath(_board.ld, A.idx, A.color, row)
      _board.drawn.add(A.idx)
      const prize = A.res ? A.res.prize : ''
      _hintSlam(_esc(prize || '결과') + (landed.top ? '!!' : _isLose(prize) ? '…' : '!'), true)
      if (landed.top && landed.res) _fx(F => F.winner({ nick: landed.res.user, text: _topPrize, sub: '사다리 1등', anchor: card, ms: 5000 }))
    }, 80)
  }
  if (e >= REVEAL_TOTAL) { _endAnim(false); return }
  requestAnimationFrame(_animLoop)
}

/** 진행 중 공개 마무리. now=true 면 즉시 끝(결과는 조용히 반영) */
function _endAnim(now) {
  const B = _board, A = B && B.anim; if (!A) return
  if (now && !A.landed) {
    _fx(F => F.drumStop())
    _prizeBoxes.forEach(b => { if (b) b.g.classList.remove('wob') })
    A.pl.setAttribute('points', _ptsStr(A.pts))
    if (A.res) { _addResRow(A.res.user, A.res.prize, A.color); _revealBoxQuiet(A.res.endCol, A.res.prize, A.color) }
    B.drawn.add(A.idx)
  }
  A.pl.__live = A.dot.__live = false
  A.dot.setAttribute('r', 6.5)
  B.anim = null
  _setDim(false)
  svgEl.style.transform = ''
  _hintWait()
}

/** 엔진 상태 → 화면 (running: 줄 고르는 중 / 한 줄 내려가는 중) */
function renderPicking(l) {
  const B = ensureBoard(l.ladderData)
  const rv = l.revealing
  ;(l.revealed || []).forEach(idx => {
    if (rv && rv.idx === idx && Date.now() - rv.at < REVEAL_TOTAL) animateReveal(idx, rv.at)
    else if (!(B.anim && B.anim.idx === idx)) drawStatic(idx, false)
  })
}

/** 결과 확정: 아직 안 연 줄은 차례로 빠르게 공개 → 1등 배너 */
function renderFinal(ld) {
  const B = ensureBoard(ld)
  const left = ld.order.map((_, i) => i).filter(i => !B.drawn.has(i) && !(B.anim && B.anim.idx === i))
  const seq = _seq
  left.forEach((idx, k) => _seqTimers.push(setTimeout(() => { if (seq === _seq && _board === B) drawStatic(idx, true) }, k * 420)))
  _seqTimers.push(setTimeout(() => {
    if (seq !== _seq) return
    pickHint.className = 'pick-hint'; pickHint.textContent = '결과 확정!'
    _showWinnerBanner(ld)
  }, left.length * 420 + 300))
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, 12000 + left.length * 420)
}

function show() { card.classList.add('show') }
function hide() {
  card.classList.remove('show')
  _endAnim(true); _board = null
  _stopCollTick(); _clearSeq(); _prevParts = []
  _fx(F => F.hideWinner())
}

function _collTimerStep() {
  const remain = _collDeadline - Date.now()
  const pct = Math.max(0, Math.min(100, (remain / _collTotal) * 100))
  tfill.style.width = pct + '%'
  if (pct <= 20 && remain > 0 && remain <= 5000) {
    tfill.classList.add('urgent')
    const sec = Math.ceil(remain / 1000)
    if (sec !== _lastTimerSec) { _lastTimerSec = sec; _fx(F => F.sound('timer')) }
  } else {
    tfill.classList.remove('urgent')
  }
  if (remain <= 0) _stopCollTick()
}

function renderCollecting(ladder) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }   // 이전 판 결과 숨김 타이머가 새 모집 화면을 지우지 않게
  if (pathTick) { clearInterval(pathTick); pathTick = null }
  _clearSeq()
  _fx(F => F.hideWinner())
  _endAnim(true); _board = null; svgEl.style.transform = ''
  phColl.style.display = ''
  phRes.classList.remove('on')
  resList.innerHTML = ''
  _topPrize = Array.isArray(ladder.prizes) && ladder.prizes.length ? ladder.prizes[0] : null
  cntLbl.textContent = ladder.participants.length + '/' + ladder.maxSlots + '명'
  _collDeadline = ladder.deadline
  _collTotal = ladder.joinMs || 30000
  const pct = Math.max(0, Math.min(100, ((ladder.deadline - Date.now()) / _collTotal) * 100))
  tfill.style.width = pct + '%'
  if (!_collTick) _collTick = setInterval(_collTimerStep, 200)
  chips.innerHTML = ''
  let added = 0
  ladder.participants.forEach((p, i) => {
    const c = document.createElement('span')
    c.className = 'chip'
    if (!_prevParts.includes(p)) { c.classList.add('new'); added++ }
    c.textContent = p
    c.style.color = PEN[i % PEN.length]
    c.style.borderColor = PEN[i % PEN.length]
    chips.appendChild(c)
  })
  if (added > 0) _fx(F => F.sound('pop'))
  _prevParts = ladder.participants.slice()
  waitHint.style.display = ladder.participants.length === 0 ? '' : 'none'
  show()
}

let pathTick = null
function renderResult(ld) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (pathTick) { clearInterval(pathTick); pathTick = null }
  _stopCollTick(); _clearSeq()
  _fx(F => F.hideWinner())
  _endAnim(true); _board = null; svgEl.style.transform = ''
  pickHint.className = 'pick-hint'; pickHint.textContent = ''
  phColl.style.display = 'none'
  phRes.classList.add('on')
  resList.innerHTML = ''

  const layout = _buildGrid(ld)
  const { rows, PAD_T, ROW_H, xp } = layout

  _drawNames(ld, xp)

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
      cx: xp(path.cols[0]), cy: PAD_T, stroke: PEN[pi % PEN.length], 'stroke-width': 3.5, class: 'lead-dot' })
    svgEl.appendChild(d); return d
  })
  // 상품 박스는 경로/점 위에
  _drawPrizes(ld, rows, PAD_T, ROW_H, xp, false)

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

  const seq = _seq
  const tick = pathTick = setInterval(() => {
    step++
    _fx(F => F.sound('tick'))
    ld.paths.forEach((path, pi) => {
      lines[pi].setAttribute('points', orthoPts(path.cols, step))
      const cr = Math.min(step, rows)
      dots[pi].setAttribute('cx', xp(path.cols[cr]))
      dots[pi].setAttribute('cy', PAD_T + cr * ROW_H)
    })
    if (step >= rows) {
      clearInterval(tick); if (pathTick === tick) pathTick = null
      if (seq !== _seq) return
      // 결과 행은 순서대로 미리 깔아두고(흐리게), 착지 순서에 따라 하나씩 켠다
      resList.innerHTML = ''
      const rowsByStart = {}
      ld.results.forEach(r => { rowsByStart[r.startCol] = _addResRow(r.user, r.prize, PEN[r.startCol % PEN.length], true) })
      // 착지 순서: 꽝/하위 상품부터, 1등은 맨 마지막 (클라이맥스)
      const landOrder = ld.results.slice().reverse()
      const GAP = 380
      landOrder.forEach((r, i) => {
        _seqTimers.push(setTimeout(() => {
          if (seq !== _seq) return
          _landPath(ld, r.startCol, PEN[r.startCol % PEN.length], rowsByStart[r.startCol])
        }, i * GAP))
      })
      _seqTimers.push(setTimeout(() => {
        if (seq !== _seq) return
        _showWinnerBanner(ld)
      }, landOrder.length * GAP + 250))
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(hide, 12000 + landOrder.length * GAP)
    }
  }, 55)

  show()
}

function renderManualPreview(ld) {
  _revealLd = ld
  _board = null
  ensureBoard(ld)
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      _fx(F => F.handle(msg))
      if (msg.type === 'game:state' && msg.data?.id === 'ladder') {
        const s = msg.data
        if (s.ladder && Array.isArray(s.ladder.prizes) && s.ladder.prizes.length) _topPrize = s.ladder.prizes[0]
        if (s.status === 'collecting' && s.ladder) renderCollecting(s.ladder)
        else if (s.status === 'running' && s.ladder?.ladderData) renderPicking(s.ladder)
        else if (s.status === 'showing_result' && s.ladder?.ladderData) renderFinal(s.ladder.ladderData)
        else if (s.status === 'manual_preview' && s.ladder?.ladderData) renderManualPreview(s.ladder.ladderData)
        else if (s.status === 'manual_running' && s.ladder?.ladderData) renderResult(s.ladder.ladderData)
        else if (s.status === 'idle') hide()
      }
      if (msg.type === 'game:ladder:reveal') {   // 수동 모드: 앱 패널이 직접 보낸다
        const ld = msg.data?.ladderData ?? _revealLd
        if (ld) { ensureBoard(ld); animateReveal(msg.data?.revealIdx, Date.now()) }
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

// ── Roulette overlay (wheel + text slot) ─────────────────────────────────────
