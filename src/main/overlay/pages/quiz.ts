// OBS 오버레이 페이지: quiz — '퀴즈쇼 세트' 연출 (등장 → 진행 → 긴장(마지막 5초) → 공개 → 여운)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 카메라 리그 타임라인 렌더.
// 엔진 상태: game:state { id:'quiz', status, quiz{question, displayAnswer, deadline, winner}, result{result, detail, triggeredBy, balloon, ts} }
//  - collecting: 문제 등장 → 카운트다운 시계 진행. 마감 5초 전부터 긴장 박자 (초마다 숫자 슬램 + 줌 가속 + 레터박스)
//  - showing_result: 공개 박자 (80ms 히트스톱 → 플래시 + 펀치 줌 + 흔들림 + 타이포 슬램) → 여운 (사선 결과 카드)
//  - 결과 7초 뒤 페이드 아웃 (엔진 idle 은 결과 표시 중이면 무시 — v2.4.0 과 동일)
import { FX_SCRIPT } from './_fx'
export const QUIZ_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>퀴즈쇼 세트</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@700;800;900&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; width: 1920px; height: 1080px; }
  canvas { display: block; width: 1920px; height: 1080px; }
  /* 당첨자 배너(FX.winner) 기준 위치 — 세트 판의 고정 좌표 (측정 없는 고정 레이아웃) */
  #anchor { position: fixed; left: 260px; top: 650px; width: 1400px; height: 360px; pointer-events: none; }
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="anchor"></div>
<script>${FX_SCRIPT}<\/script>
<script>
const C = document.getElementById('c'), X = C.getContext('2d')
const ANCHOR = document.getElementById('anchor')
const W = 1920, H = 1080
const NAVY = '#172437', OR = '#FF5B17', CR = '#F5F3EF', MINT = '#00CB84', YEL = '#FFC61A'
const FT = '"Black Han Sans","Noto Sans KR",sans-serif'
const FK = '"Noto Sans KR","Apple SD Gothic Neo",sans-serif'
const FM = '"JetBrains Mono",ui-monospace,Menlo,monospace'

/* ---------- 세트 배치 (고정 좌표) ---------- */
const S = { x: 260, y: 650, w: 1400, h: 360, k: 40 }      // 세트 판
const CK = { x: 470, y: 830, r: 146 }                       // 카운트다운 시계
const QB = { x: 680, y: 690, w: 940, h: 262 }               // 문제 보드
const CARD = { x: 1220, y: 70, w: 600, h: 510 }             // 결과 카드 (리그 밖)
const SLAM = { x: 900, y: 600 }                             // 공개 타이포 위치
const TENSION_SEC = 5

/* ---------- helpers ---------- */
const cl = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v))
const lerp = (a, b, p) => a + (b - a) * p
const seg = (t, a, b) => cl((t - a) / (b - a))
const eo = p => 1 - Math.pow(1 - p, 3)
const ei = p => p * p * p
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
const eback = p => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
function panelPath(c, x, y, w, h, k) { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h); c.lineTo(x, y + h); c.lineTo(x, y + k); c.closePath() }
function outlined(c, txt, x, y, fill, stroke, sw, shadow, off) {
  c.lineJoin = 'round'
  if (shadow) { c.fillStyle = shadow; c.strokeStyle = shadow; c.lineWidth = sw; c.strokeText(txt, x + off, y + off); c.fillText(txt, x + off, y + off) }
  c.strokeStyle = stroke; c.lineWidth = sw; c.strokeText(txt, x, y)
  c.fillStyle = fill; c.fillText(txt, x, y)
}
function fitFont(c, txt, size, maxW, face, weight) {
  c.font = (weight ? weight + ' ' : '') + size + 'px ' + face
  const mw = c.measureText(txt).width
  if (mw > maxW) { size = Math.max(14, Math.floor(size * maxW / mw)); c.font = (weight ? weight + ' ' : '') + size + 'px ' + face }
  return size
}
function balloonIcon(c, x, y, r) {
  c.save(); c.translate(x, y)
  c.fillStyle = CR; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill()
  c.fillStyle = OR; c.beginPath()
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .38 : r * .78, a = -Math.PI / 2 + i * Math.PI / 5; i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  c.closePath(); c.fill(); c.restore()
}
// 문제 줄바꿈: 단어 단위(keep-all), 너무 긴 단어만 글자 단위로 자름. 최대 3줄, 넘치면 글자 크기를 줄임
function wrapQuestion(c, txt) {
  for (let size = 56; size >= 30; size -= 2) {
    c.font = '900 ' + size + 'px ' + FK
    const words = String(txt).split(' ').filter(Boolean), lines = []
    let cur = ''
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w
      if (c.measureText(t).width <= QB.w - 60) { cur = t; continue }
      if (cur) lines.push(cur)
      cur = ''
      let chunk = ''
      for (const ch of w) { if (c.measureText(chunk + ch).width > QB.w - 60) { lines.push(chunk); chunk = ch } else chunk += ch }
      cur = chunk
    }
    if (cur) lines.push(cur)
    if ((lines.length <= 3 && lines.length * size * 1.22 <= QB.h - 96) || size <= 30) return { size, lines: lines.slice(0, 3) }
  }
  return { size: 30, lines: [String(txt)] }
}

/* ---------- 라운드 상태 ---------- */
let Q = null        // { question, deadline(Date), limit(s), t0(perf), key, wrap }
let R = null        // { isWin, answer, nick, balloon, at(perf), left(s, 공개 순간 남은 시간), key }
let fadeAt = 0      // 페이드 아웃 시작(perf). 0 = 표시 중
let visible = false
let cues = {}
let hideTimer = null
let lastTickSec = -1
let buzzed = false
let curKey = '', resKey = ''

function leftSec(now) {
  if (!Q) return 0
  if (R) return R.left
  return Math.max(0, (Q.deadline - Date.now()) / 1000)
}
function cue(k, fn) { if (cues[k]) return; cues[k] = 1; try { fn() } catch (e) {} }

/* ---------- 카메라 ---------- */
// 반환: 피벗(px,py) 기준 scale z, 회전 r, 이동 dx,dy (리그 = 세트 판 전체)
function camera(now) {
  const e = now - Q.t0
  const left = leftSec(now)
  const tStart = Math.max(0, Q.limit - TENSION_SEC)
  const elapsedQ = Q.limit - left
  let z = 1, r = 0, dx = 0, dy = 0, sh = 0, px = S.x + S.w / 2, py = S.y + S.h / 2
  // 등장: 아래 바깥에서 밀려 들어오며 기울었다 정자세
  const op = seg(e, 0, 480)
  z = lerp(.86, 1, eback(op)); r = lerp(-.06, 0, eback(op)); dy = lerp(220, 0, eo(op))
  // 진행: 느린 푸시인 1.0 → 1.06 + 아주 느린 흔들림(핸드헬드)
  const bp = tStart > 0 ? seg(elapsedQ, 0, tStart) : 1
  z *= 1 + .06 * eio(bp)
  dx += Math.sin(now * .0006) * 4; dy += Math.sin(now * .0009) * 3
  // 긴장: 시계 쪽으로 줌 가속 + 흔들림 증가 + 초마다 킥
  const tn = Q.limit > TENSION_SEC ? seg(elapsedQ, tStart, Q.limit) : seg(e, 500, 500 + Q.limit * 1000)
  if (tn > 0 && !R) {
    px = lerp(px, CK.x + 120, eio(Math.min(1, tn * 2.2)))
    z *= 1 + .26 * ei(tn)
    const ms = (1 - (left - Math.floor(left))) * 1000   // 이번 초에 들어선 뒤 경과
    sh = 1.5 + tn * 6 + (left > 0 ? 12 * Math.exp(-ms / 120) : 0)
    r += Math.sin(now * .004) * .006 * tn
  }
  // 공개 → 여운
  if (R) {
    const a = now - R.at
    const tz = R.tz || 1
    if (a < 80) { z = tz * 1.06; px = R.px || px; sh = 26 }                       // 히트스톱 (정지 + 정지 흔들림)
    else {
      const pz = lerp(1.15, 1, eo(seg(a, 80, 260)))                               // 펀치 줌
      const base = lerp(tz, 1.0, eo(seg(a, 80, 700)))
      z = base * pz * (1 + .015 * eo(seg(a, 700, 3200)))                           // 여운: 아주 느린 푸시
      px = lerp(R.px || px, S.x + S.w / 2, eo(seg(a, 80, 700)))
      sh = 14 * Math.exp(-(a - 80) / 120)
      r = -.03 * Math.exp(-(a - 80) / 260) * Math.cos((a - 80) * .03)
    }
  }
  const k = Math.floor(now / 16)
  return { z, r, px, py, dx: dx + (rnd(k) - .5) * 2 * sh, dy: dy + (rnd(k + 977) - .5) * 2 * sh, tn, sh }
}

/* ---------- 세트 그리기 (리그 안) ---------- */
function bulbs(c, x, y, w, h, now, mode, amb) {
  // 퀴즈쇼 전구: 진행=느린 추적, 긴장=빠른 추적(주황), 공개=전부 점등, 여운=느린 교차
  const gap = 34, pts = []
  for (let u = x + 30; u <= x + w - 30; u += gap) { pts.push([u, y + 10]); pts.push([u, y + h - 10]) }
  for (let v = y + 34; v <= y + h - 34; v += gap) { pts.push([x + 10, v]); pts.push([x + w - 10, v]) }
  const step = mode === 'tension' ? 90 : 150
  const s = Math.floor(amb / step)
  for (let i = 0; i < pts.length; i++) {
    let on
    if (mode === 'impact') on = true
    else if (mode === 'after') on = (Math.floor(amb / 420) + i) % 2 === 0
    else on = ((i >> 1) + s) % 4 < 2
    const col = mode === 'tension' ? (on ? '#FFD27A' : 'rgba(255,91,23,.55)') : (on ? CR : 'rgba(245,243,239,.28)')
    c.fillStyle = col
    c.beginPath(); c.arc(pts[i][0], pts[i][1], on ? 5.5 : 4.5, 0, Math.PI * 2); c.fill()
    if (on && mode !== 'build') { c.fillStyle = 'rgba(255,220,150,.25)'; c.beginPath(); c.arc(pts[i][0], pts[i][1], 11, 0, Math.PI * 2); c.fill() }
  }
}
function drawSet(c, now, cam, ph) {
  const e = now - Q.t0, left = leftSec(now)
  const a = R ? now - R.at : -1
  const amb = R ? R.at + Math.max(0, a - 80) * .25 : now      // 여운은 0.25배 슬로모
  const mode = R ? (a < 380 ? 'impact' : 'after') : (cam.tn > 0 ? 'tension' : 'build')
  const py = S.y + (S.h - ph) / 2
  // 그림자 + 판
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 44; c.shadowOffsetY = 14
  panelPath(c, S.x, py, S.w, ph, S.k); c.fillStyle = OR; c.fill(); c.restore()
  panelPath(c, S.x, py, S.w, ph, S.k); c.strokeStyle = NAVY; c.lineWidth = 6; c.stroke()
  if (ph < S.h * .98) return
  bulbs(c, S.x, S.y, S.w, S.h, now, mode, amb)
  // 안쪽 무대 (네이비 → 결과 땐 더 어둡게)
  panelPath(c, S.x + 26, S.y + 26, S.w - 52, S.h - 52, S.k - 14)
  c.fillStyle = NAVY; c.fill()
  c.save(); panelPath(c, S.x + 26, S.y + 26, S.w - 52, S.h - 52, S.k - 14); c.clip()
  // 무대 바닥 사선 조명
  c.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 5; i++) {
    const x0 = S.x + 200 + i * 280 + Math.sin(amb * .0007 + i) * 40
    const g = c.createLinearGradient(0, S.y, 0, S.y + S.h)
    g.addColorStop(0, 'rgba(120,160,230,' + (mode === 'tension' ? .03 : .07) + ')'); g.addColorStop(1, 'rgba(120,160,230,0)')
    c.fillStyle = g; c.beginPath(); c.moveTo(x0, S.y); c.lineTo(x0 + 70, S.y); c.lineTo(x0 - 60, S.y + S.h); c.lineTo(x0 - 190, S.y + S.h); c.closePath(); c.fill()
  }
  c.globalCompositeOperation = 'source-over'
  // 여운: 시계 뒤 회전 후광
  if (R && a > 80) {
    const ha = eo(seg(a, 80, 600))
    c.save(); c.translate(CK.x, CK.y); c.rotate(amb * .0009)
    c.globalCompositeOperation = 'lighter'
    const col = R.isWin ? '0,203,132' : '255,91,23'
    for (let i = 0; i < 16; i++) {
      const an = i / 16 * Math.PI * 2
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 520); gr.addColorStop(0, 'rgba(' + col + ',' + (.45 * ha) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)')
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 520, an - .07, an + .07); c.closePath(); c.fill()
    }
    c.restore()
  }
  // 문제 보드
  drawBoard(c, now, e, mode, cam)
  // 레터박스 (긴장)
  const lb = (R ? 1 - seg(a, 80, 300) : 1) * eo(cl(cam.tn * 3)) * (cam.tn > 0 || R ? 1 : 0)
  if (lb > 0) { c.fillStyle = '#04070c'; c.fillRect(S.x, S.y + 26, S.w, 44 * lb); c.fillRect(S.x, S.y + S.h - 26 - 44 * lb, S.w, 44 * lb) }
  c.restore()
  // 시계 (판 위로 살짝 넘침)
  drawClock(c, now, e, left, mode, cam)
  // 판 안쪽 섬광 (공개)
  if (R && a < 380) {
    c.save(); panelPath(c, S.x, S.y, S.w, S.h, S.k); c.clip()
    c.fillStyle = 'rgba(255,250,240,' + (.9 * Math.pow(1 - seg(a, 0, 380), 2)) + ')'; c.fillRect(S.x, S.y, S.w, S.h); c.restore()
  }
}
function drawBoard(c, now, e, mode, cam) {
  const wp = eo(seg(e, 320, 760))            // 문제 와이프 인
  if (wp <= 0) return
  if (!Q.wrap || Q.wrapFont !== document.fonts.status) { Q.wrap = wrapQuestion(c, Q.question); Q.wrapFont = document.fonts.status }
  const { size, lines } = Q.wrap
  c.save()
  c.beginPath(); c.rect(QB.x, QB.y, QB.w * wp, QB.h); c.clip()
  // 보드 바탕: 크림 패널 + 주황 왼쪽 띠
  c.fillStyle = CR; c.fillRect(QB.x, QB.y, QB.w, QB.h - 40)
  c.fillStyle = OR; c.fillRect(QB.x, QB.y, 14, QB.h - 40)
  // 'Q.' 태그
  c.fillStyle = NAVY; c.fillRect(QB.x + 14, QB.y, 120, 50)
  c.fillStyle = OR; c.font = '40px ' + FT; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('Q.', QB.x + 32, QB.y + 27)
  c.fillStyle = 'rgba(23,36,55,.55)'; c.font = '800 20px ' + FM; c.fillText('QUIZ SHOW', QB.x + 150, QB.y + 26)
  // 문제 줄 — 한 줄씩 차례로 들어옴
  const lh = size * 1.22, top = QB.y + 50 + (QB.h - 90 - lines.length * lh) / 2 + lh / 2
  c.font = '900 ' + size + 'px ' + FK; c.fillStyle = NAVY
  for (let i = 0; i < lines.length; i++) {
    const lp = eo(seg(e, 420 + i * 90, 700 + i * 90))
    c.globalAlpha = lp; c.fillText(lines[i], QB.x + 44 + (1 - lp) * 60, top + i * lh)
  }
  c.globalAlpha = 1
  // 남은 시간 막대 (조용한 주변 정보)
  const left = leftSec(now), frac = Q.limit > 0 ? left / Q.limit : 0
  const by = QB.y + QB.h - 26
  c.fillStyle = 'rgba(4,8,14,.6)'; c.fillRect(QB.x, by - 10, QB.w, 20)
  c.fillStyle = frac > .35 ? MINT : OR; c.fillRect(QB.x, by - 10, QB.w * frac, 20)
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(QB.x, by - 10, QB.w * frac, 6)
  // 긴장: 강조 대상(시계)만 밝게 — 보드는 어둡게
  const dim = R ? .3 * (1 - seg(now - R.at, 80, 500)) + .22 * seg(now - R.at, 500, 900) : .38 * eo(cl(cam.tn * 2.5))
  if (dim > 0) { c.fillStyle = 'rgba(4,8,14,' + dim + ')'; c.fillRect(QB.x, QB.y, QB.w, QB.h) }
  c.restore()
}
function drawClock(c, now, e, left, mode, cam) {
  const cp = seg(e, 200, 620)
  if (cp <= 0) return
  const s0 = lerp(.2, 1, eback(cp))
  const limit = Math.max(1, Q.limit)
  const sec = Math.ceil(left - 1e-6)
  const a = R ? now - R.at : -1
  c.save(); c.translate(CK.x, CK.y); c.scale(s0, s0); c.rotate(lerp(-.5, 0, eo(cp)))
  // 바깥 링
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(8, 12, CK.r + 22, 0, Math.PI * 2); c.fill()
  c.fillStyle = mode === 'tension' ? OR : CR; c.beginPath(); c.arc(0, 0, CK.r + 22, 0, Math.PI * 2); c.fill()
  c.strokeStyle = NAVY; c.lineWidth = 6; c.stroke()
  c.fillStyle = NAVY; c.beginPath(); c.arc(0, 0, CK.r, 0, Math.PI * 2); c.fill()
  // 남은 시간 호 (부드럽게 줄어듦)
  const frac = left / limit
  c.lineCap = 'butt'
  c.strokeStyle = 'rgba(245,243,239,.12)'; c.lineWidth = 22; c.beginPath(); c.arc(0, 0, CK.r - 22, 0, Math.PI * 2); c.stroke()
  if (frac > 0) {
    c.strokeStyle = R ? (R.isWin ? MINT : OR) : (frac > .35 && mode !== 'tension' ? MINT : OR)
    c.beginPath(); c.arc(0, 0, CK.r - 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke()
  }
  // 눈금: 초마다 하나씩 꺼짐 (최대 60칸)
  const n = Math.min(60, Math.ceil(limit)), lit = Math.ceil(frac * n - 1e-6)
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + i / n * Math.PI * 2
    c.strokeStyle = i < lit ? (mode === 'tension' ? '#FFD27A' : CR) : 'rgba(245,243,239,.18)'; c.lineWidth = i % 5 === 0 ? 5 : 3
    c.beginPath(); c.moveTo(Math.cos(an) * (CK.r - 4), Math.sin(an) * (CK.r - 4)); c.lineTo(Math.cos(an) * (CK.r - (i % 5 === 0 ? 14 : 10)), Math.sin(an) * (CK.r - (i % 5 === 0 ? 14 : 10))); c.stroke()
  }
  // 초침: 초마다 '딱' 한 칸 점프 (오버슈트)
  const intoSec = 1 - (left - Math.floor(left))       // 0..1
  const jump = R ? 1 : eback(seg(intoSec, 0, .2))
  const handFrac = (limit - Math.ceil(left - 1e-6) - 1 + jump) / limit
  const hAn = -Math.PI / 2 + Math.PI * 2 * cl(handFrac)
  c.strokeStyle = OR; c.lineWidth = 7; c.lineCap = 'round'
  c.beginPath(); c.moveTo(-Math.cos(hAn) * 20, -Math.sin(hAn) * 20); c.lineTo(Math.cos(hAn) * (CK.r - 40), Math.sin(hAn) * (CK.r - 40)); c.stroke()
  c.fillStyle = OR; c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill()
  // 가운데 숫자
  c.textAlign = 'center'; c.textBaseline = 'middle'
  if (R) {
    // 공개/여운: 판정 글자
    const p = seg(a, 80, 300)
    const ss = lerp(1.9, 1, eback(p))
    c.save(); c.scale(ss, ss); c.rotate(lerp(-.1, 0, eo(p)))
    c.font = (R.isWin ? 92 : 78) + 'px ' + FT
    outlined(c, R.isWin ? 'O' : 'X', 0, 6, R.isWin ? MINT : OR, CR, 10, null, 0)
    c.restore()
  } else if (mode === 'tension' && sec > 0) {
    const ms = intoSec * 1000
    const ss = lerp(1.9, 1, eback(seg(ms, 0, 240)))
    c.save(); c.scale(ss, ss); c.rotate(lerp(-.1, 0, eo(seg(ms, 0, 240))))
    c.font = '150px ' + FT
    outlined(c, String(sec), 0, 8, CR, OR, 14, NAVY, 8)
    c.restore()
  } else {
    c.font = (sec >= 100 ? 70 : 96) + 'px ' + FT
    c.fillStyle = sec <= 0 ? OR : CR; c.fillText(String(Math.max(0, sec)), 0, 8)
    c.font = '800 18px ' + FM; c.fillStyle = 'rgba(245,243,239,.6)'; c.fillText('SEC', 0, 66)
  }
  c.restore()
  // 긴장: 초마다 시계에서 퍼지는 링
  if (mode === 'tension') {
    const ms = intoSec * 1000, rp = seg(ms, 0, 600)
    if (rp < 1) { c.strokeStyle = 'rgba(255,91,23,' + (1 - rp) * .8 + ')'; c.lineWidth = 8 * (1 - rp) + 2; c.beginPath(); c.arc(CK.x, CK.y, CK.r + 24 + rp * 110, 0, Math.PI * 2); c.stroke() }
  }
}

/* ---------- HUD (리그 안, 판과 함께 움직임) ---------- */
const PH = [['01', '출제'], ['02', '생각'], ['03', '카운트다운'], ['04', '정답 공개'], ['05', '결과']]
function hud(c, now, cam) {
  const e = now - Q.t0, hp = eo(seg(e, 420, 820))
  if (hp <= 0) return
  const a = R ? now - R.at : -1
  let idx = 1
  if (e < 700) idx = 0
  if (cam.tn > 0) idx = 2
  if (R) idx = a < 600 ? 3 : 4
  c.save(); c.globalAlpha = hp; c.translate(0, (1 - hp) * 30)
  // 게임명 태그 + ON AIR 램프 (퀴즈쇼 세트의 '중계 장치')
  const ty = S.y - 50
  c.fillStyle = NAVY; c.fillRect(S.x, ty, 300, 46)
  c.fillStyle = OR; c.fillRect(S.x, ty, 12, 46)
  c.font = '30px ' + FT; c.fillStyle = CR; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('퀴즈 도전!', S.x + 28, ty + 25)
  const onAir = Math.floor(now / 500) % 2 === 0 || cam.tn > 0 || R
  c.fillStyle = onAir ? '#ff2e2e' : 'rgba(255,46,46,.35)'; c.beginPath(); c.arc(S.x + 210, ty + 23, 8, 0, Math.PI * 2); c.fill()
  c.font = '800 18px ' + FM; c.fillStyle = CR; c.fillText('ON AIR', S.x + 222, ty + 24)
  // 단계 칩
  const pw = 150, gap = 8, sx = S.x + S.w - 5 * pw - 4 * gap
  for (let i = 0; i < 5; i++) {
    const x = sx + i * (pw + gap), y = ty + 4
    const act = i === idx, done = i < idx
    c.fillStyle = act ? OR : done ? 'rgba(245,243,239,.9)' : 'rgba(10,18,28,.7)'
    c.fillRect(x, y, pw, 38)
    if (!act && !done) { c.strokeStyle = 'rgba(245,243,239,.45)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, pw - 2, 36) }
    c.fillStyle = act ? CR : done ? NAVY : 'rgba(245,243,239,.75)'
    c.font = '700 19px ' + FK; c.textAlign = 'center'
    c.fillText(PH[i][0] + ' ' + PH[i][1], x + pw / 2, y + 20)
  }
  c.restore()
}

/* ---------- 화면 효과 (리그 밖) ---------- */
function screenFX(c, now, cam) {
  // 긴장: 가장자리 붉은 비네트 (초마다 1회 맥박 — 1Hz)
  if (cam.tn > 0 && !R) {
    const left = leftSec(now), ms = (1 - (left - Math.floor(left))) * 1000
    const pulse = Math.exp(-ms / 260)
    const g = c.createRadialGradient(960, 620, 380, 960, 620, 1150)
    g.addColorStop(0, 'rgba(255,60,10,0)'); g.addColorStop(1, 'rgba(200,30,0,' + Math.min(.5, .12 + cam.tn * .18 + pulse * .14) + ')')
    c.fillStyle = g; c.fillRect(0, 0, W, H)
    // 시계로 모이는 집중선
    c.save(); c.translate(CK.x, CK.y - 40)
    for (let i = 0; i < 40; i++) {
      const an = rnd(i + 400) * Math.PI * 2, r0 = 300 + rnd(i + 401) * 200 + ((now * .3) % 70), r1 = r0 + 240 + rnd(i + 402) * 380
      c.strokeStyle = 'rgba(245,243,239,' + (cam.tn * .22) + ')'; c.lineWidth = 2 + rnd(i + 403) * 4
      c.beginPath(); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); c.stroke()
    }
    c.restore()
  }
  if (!R) return
  const a = now - R.at
  // 공개: 방사 스타버스트 + 집중선 + 타이포 슬램
  if (a < 2400) {
    const fade = 1 - seg(a, 1500, 2400)
    if (a < 520) {
      c.save(); c.translate(SLAM.x, SLAM.y)
      const ra = Math.pow(1 - seg(a, 0, 520), 1.5)
      for (let i = 0; i < 36; i++) {
        const an = i / 36 * Math.PI * 2 + rnd(i) * .1, r0 = 140, r1 = 1100
        c.fillStyle = i % 2 ? 'rgba(255,91,23,' + ra * .85 + ')' : 'rgba(23,36,55,' + ra * .75 + ')'
        c.beginPath(); c.moveTo(Math.cos(an - .025) * r0, Math.sin(an - .025) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); c.lineTo(Math.cos(an + .035) * r0, Math.sin(an + .035) * r0); c.fill()
      }
      c.restore()
    }
    if (a >= 80) {
      const p = seg(a, 80, 300), s = lerp(1.9, 1, eback(p)) * (1 + seg(a, 300, 2400) * .05)
      c.save(); c.globalAlpha = fade * Math.min(1, p * 4); c.translate(SLAM.x, SLAM.y); c.rotate(lerp(-.105, -.035, eo(p))); c.scale(s, s)
      // 별 모양 받침
      c.save(); c.rotate(now * .0006)
      c.fillStyle = CR; c.beginPath()
      for (let i = 0; i < 32; i++) { const rr = i % 2 ? 170 : 250 + rnd(i) * 50, an = i / 32 * Math.PI * 2; i ? c.lineTo(Math.cos(an) * rr * 1.5, Math.sin(an) * rr * .78) : c.moveTo(Math.cos(an) * rr * 1.5, Math.sin(an) * rr * .78) }
      c.closePath(); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 8; c.stroke(); c.restore()
      c.textAlign = 'center'; c.textBaseline = 'middle'
      const word = R.isWin ? '정답!' : '시간 초과!'
      fitFont(c, word, R.isWin ? 210 : 150, 640, FT)
      outlined(c, word, 0, 0, R.isWin ? MINT : OR, NAVY, 20, R.isWin ? '#0a7f56' : '#9c2f05', 9)
      const lab = R.isWin ? 'CORRECT ANSWER' : 'TIME OVER', ly = R.isWin ? 132 : 112
      c.font = '800 30px ' + FM
      c.fillStyle = NAVY; c.beginPath(); c.roundRect(-lab.length * 10.5 - 26, ly - 25, lab.length * 21 + 52, 50, 8); c.fill()
      c.fillStyle = R.isWin ? MINT : OR; c.fillText(lab, 0, ly + 1)
      c.restore()
    }
  }
  // 공개 직후 수평 속도선
  if (a > 80 && a < 700) {
    const sp = 1 - seg(a, 300, 700)
    for (let i = 0; i < 26; i++) {
      const y = 120 + rnd(i + 50) * 840, x = ((rnd(i + 60) * 2400 + a * 3.2) % 2400) - 240, l = 200 + rnd(i + 70) * 400
      c.fillStyle = 'rgba(245,243,239,' + sp * (.2 + rnd(i + 80) * .35) + ')'; c.fillRect(x, y, l, 3 + rnd(i + 90) * 4)
    }
  }
}

/* ---------- 등장 타이틀 (리그 밖) — 문제 등장 박자: 사선 리본 위로 '퀴즈 타임!' 이 꽂혔다가 왼쪽으로 빠짐 ---------- */
function openTitle(c, now) {
  if (!Q || R) return
  const e = now - Q.t0
  if (e < 40 || e > 1250) return
  const ip = seg(e, 40, 280), op = seg(e, 980, 1250)
  const x = 960 - eio(op) * 1400, y = 520
  c.save(); c.globalAlpha = 1 - op * .6
  // 리본 (화면 밖 오른쪽에서 쓸려 들어옴)
  const rw = lerp(0, 1, eo(seg(e, 40, 240)))
  c.save(); c.translate(x, y); c.rotate(-.06); c.transform(1, 0, -.25, 1, 0, 0)
  c.fillStyle = NAVY; c.fillRect(-520 * rw, -78, 1040 * rw, 156)
  c.fillStyle = OR; c.fillRect(-520 * rw, 62, 1040 * rw, 16)
  c.restore()
  // 모션 스트릭
  if (ip < 1 || op > 0) {
    const k = ip < 1 ? 1 - ip : op
    c.fillStyle = 'rgba(245,243,239,' + .55 * k + ')'
    for (let i = 0; i < 8; i++) c.fillRect(x + (op > 0 ? 380 : -900) + rnd(i + 20) * 300, y - 70 + i * 18, 260 + rnd(i + 21) * 380, 5)
  }
  if (e >= 60) {
    const s = lerp(1.9, 1, eback(ip))
    c.translate(x, y); c.rotate(lerp(-.105, -.06, eo(ip))); c.scale(s, s)
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '118px ' + FT
    outlined(c, '퀴즈 타임!', 0, 4, CR, NAVY, 12, OR, 8)
  }
  c.restore()
}

/* ---------- 결과 카드 (리그 밖, 사선) ---------- */
function resultCard(c, now) {
  if (!R) return
  const a = now - R.at, base = 340
  if (a < base) return
  const { x: x0, y: y0, w, h } = CARD
  const inP = seg(a, base, base + 420), ox = (1 - eback(inP)) * 900
  c.save(); c.translate(ox, 0)
  if (inP < 1) { c.fillStyle = 'rgba(245,243,239,' + .6 * (1 - inP) + ')'; for (let i = 0; i < 8; i++) c.fillRect(x0 + w + 20 + rnd(i) * 200, y0 + 40 + i * 58, 300 + rnd(i + 3) * 300, 6) }
  c.transform(1, 0, -.14, 1, 0, 0); c.translate(y0 * .14 + 30, 0)   // skewX(-8°)
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x0 + 18, y0 + 22, w, h)
  c.fillStyle = CR; c.fillRect(x0, y0, w, h)
  c.fillStyle = OR; c.fillRect(x0, y0, 18, h)
  c.fillStyle = NAVY; c.fillRect(x0 + 18, y0, w - 18, 90)
  c.textBaseline = 'middle'; c.textAlign = 'left'
  c.fillStyle = OR; c.font = '60px ' + FT; c.fillText(R.isWin ? '결과!' : '땡!', x0 + 48, y0 + 49)
  c.fillStyle = 'rgba(245,243,239,.75)'; c.font = '700 20px ' + FM; c.fillText('QUIZ SHOW · ' + (R.isWin ? 'CORRECT' : 'TIME OVER'), x0 + 210, y0 + 50)
  // 1) 이름 = 정답
  const np = seg(a, base + 300, base + 540), ns = lerp(1.9, 1, eback(np))
  if (np > 0) {
    c.fillStyle = 'rgba(23,36,55,.6)'; c.font = '700 26px ' + FK; c.globalAlpha = Math.min(1, np * 3); c.fillText('정답', x0 + 52, y0 + 128)
    c.save(); c.translate(x0 + 48, y0 + 210); c.scale(ns, ns)
    fitFont(c, R.answer, 120, w - 250, FT)
    c.fillStyle = R.isWin ? MINT : OR; c.fillText(R.answer, 7, 8)
    c.fillStyle = NAVY; c.fillText(R.answer, 0, 0); c.restore()
    c.globalAlpha = 1
  }
  c.strokeStyle = 'rgba(23,36,55,.25)'; c.lineWidth = 3; c.setLineDash([10, 10])
  c.beginPath(); c.moveTo(x0 + 48, y0 + 290); c.lineTo(x0 + w - 36, y0 + 290); c.stroke(); c.setLineDash([])
  // 3) 닉네임
  const cp = eo(seg(a, base + 700, base + 1000))
  c.save(); c.globalAlpha = cp; c.translate((1 - cp) * 80, 0)
  c.fillStyle = 'rgba(23,36,55,.6)'; c.font = '700 26px ' + FK; c.fillText(R.isWin ? '맞힌 사람' : '도전한 사람', x0 + 52, y0 + 328)
  c.fillStyle = NAVY; fitFont(c, R.nick, 68, w - 110, FK, 900); c.fillText(R.nick, x0 + 50, y0 + 384)
  c.restore()
  // 4) 별풍선
  const gp = seg(a, base + 880, base + 1140), gs = lerp(.4, 1, eback(gp))
  if (gp > 0 && R.balloon > 0) {
    const label = '별풍선 ' + Number(R.balloon).toLocaleString() + '개'
    c.save(); c.translate(x0 + 52, y0 + 458); c.scale(gs, gs); c.globalAlpha = Math.min(1, gp * 2)
    c.fillStyle = OR; c.beginPath(); c.roundRect(0, -32, 380, 64, 32); c.fill()
    balloonIcon(c, 34, 0, 22)
    c.fillStyle = CR; fitFont(c, label, 38, 300, FK, 900); c.fillText(label, 70, 2)
    c.restore()
  }
  // 2) 도장
  const bp = seg(a, base + 520, base + 760)
  if (bp > 0) {
    const bs = lerp(3, 1, eback(bp)), col = R.isWin ? MINT : OR
    c.save(); c.translate(x0 + w - 80, y0 + 190); c.rotate(-.2); c.scale(bs, bs); c.globalAlpha = Math.min(1, bp * 2.5)
    if (bp < 1) { c.strokeStyle = col; c.lineWidth = 6; for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(an) * 112, Math.sin(an) * 112); c.lineTo(Math.cos(an) * (130 + bp * 60), Math.sin(an) * (130 + bp * 60)); c.stroke() } }
    c.fillStyle = NAVY; c.beginPath(); c.arc(6, 8, 96, 0, Math.PI * 2); c.fill()
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 96, 0, Math.PI * 2); c.fill()
    c.strokeStyle = CR; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 82, 0, Math.PI * 2); c.stroke()
    c.textAlign = 'center'; c.fillStyle = CR; c.font = '62px ' + FT; c.fillText(R.isWin ? '정답' : '실패', 0, -6)
    c.font = '800 17px ' + FM; c.fillText(R.isWin ? 'CORRECT' : 'TIME UP', 0, 46)
    c.restore()
  }
  c.restore()
}

/* ---------- 효과음 박자 ---------- */
function sounds(now) {
  if (!Q) return
  const e = now - Q.t0
  if (!R) {
    cue('open', () => FX.sound('whoosh'))
    if (e > 560) cue('land', () => FX.sound('pop'))
    const left = leftSec(now), sec = Math.ceil(left - 1e-6)
    if (left > 0 && sec <= TENSION_SEC) {
      cue('drum', () => FX.drumStart(140))
      if (sec !== lastTickSec) { lastTickSec = sec; FX.sound('timer') }
    } else if (left > 0 && e > 700 && sec !== lastTickSec) {
      // 진행: 시계 초침 틱 (초당 1회, 조용히)
      if (lastTickSec !== -1) FX.sound('tick')
      lastTickSec = sec
    }
    if (left <= 0 && !buzzed) { buzzed = true; FX.drumStop(); FX.sound('buzzer') }
    return
  }
  const a = now - R.at
  cue('impact', () => { FX.drumStop(); FX.sound('stop'); FX.flash(R.isWin ? 'rgba(255,255,255,.95)' : 'rgba(255,240,225,.9)'); if (!R.isWin && !buzzed) { buzzed = true; FX.sound('buzzer') } })
  if (a > 340) cue('card', () => FX.sound('reveal'))
  if (a > 660) cue('name', () => {
    if (R.isWin) { FX.sound('win'); FX.confetti({ x: SLAM.x, y: SLAM.y - 60, count: 160 }) }
    else FX.sound('lose')
  })
  if (a > 860) cue('stamp', () => FX.sound('stop'))
  if (a > 1600 && R.isWin) cue('banner', () => FX.winner({ nick: R.nick, sub: '퀴즈 정답 · ' + R.answer, anchor: ANCHOR, above: true, ms: 4800 }))
}

/* ---------- 렌더 ---------- */
function render(now) {
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H)
  if (!visible || !Q) return
  let alpha = 1
  if (fadeAt) { alpha = 1 - seg(now - fadeAt, 0, 400); if (alpha <= 0) { visible = false; Q = null; R = null; return } }
  // 히트스톱: 공개 후 80ms 동안 공개 직전 프레임으로 멈춤
  const tNow = R && now - R.at < 80 ? R.at - 1 : now
  const cam = camera(now)
  const e = tNow - Q.t0
  const ph = Math.max(6, S.h * eo(seg(e, 0, 420)))
  X.save(); X.globalAlpha = alpha
  X.save()
  X.translate(cam.px + cam.dx, cam.py + cam.dy); X.rotate(cam.r); X.scale(cam.z, cam.z); X.translate(-cam.px, -cam.py)
  drawSet(X, tNow, cam, ph)
  hud(X, tNow, cam)
  X.restore()
  screenFX(X, now, cam)
  openTitle(X, now)
  resultCard(X, now)
  X.restore()
}
function loop(now) {
  try { sounds(now); render(now) } catch (err) { console.warn(err) }
  requestAnimationFrame(loop)
}

/* ---------- 상태 처리 ---------- */
function hide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  FX.hideWinner(); FX.drumStop()
  if (visible && !fadeAt) fadeAt = performance.now()
}
function onQuestion(q) {
  const key = q.question + '|' + q.deadline
  const fresh = key !== curKey || !visible || !!fadeAt
  curKey = key; resKey = ''
  // 이전 판 결과의 숨김 타이머가 새 문제를 지우지 않게
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (fresh) {
    FX.hideWinner(); FX.drumStop()
    Q = { question: q.question, deadline: q.deadline, limit: Math.max(1, Math.round((q.deadline - Date.now()) / 1000)), t0: performance.now(), key }
    R = null; cues = {}; lastTickSec = -1; buzzed = false; fadeAt = 0; visible = true
  } else if (Q) {
    Q.question = q.question; Q.deadline = q.deadline
  }
}
function onResult(s) {
  const key = s.result.ts + '|' + s.result.result
  if (key === resKey) return
  resKey = key
  const isWin = !String(s.result.result).includes('시간 초과')
  const now = performance.now()
  if (!Q || fadeAt) {
    // 결과만 받은 경우(중간 합류): 등장은 건너뛴 세트로 바로 공개
    const q = s.quiz || { question: '', deadline: Date.now() }
    Q = { question: q.question || '', deadline: q.deadline || Date.now(), limit: 10, t0: now - 2000, key: '' }
    cues = { open: 1, land: 1, drum: 1 }; fadeAt = 0; visible = true
  }
  const detail = String(s.result.detail || '')
  const answer = (detail.indexOf('정답:') === 0 ? detail.slice(3).trim() : '') || (s.quiz && s.quiz.displayAnswer) || '?'
  const nickRaw = isWin ? ((s.quiz && s.quiz.winner) || s.result.triggeredBy || String(s.result.result).replace('정답!', '').trim()) : '정답자 없음'
  // 공개 순간 카메라 상태를 기억 (히트스톱 프레임 + 펀치 줌 출발점)
  const camNow = camera(now)
  R = { isWin, answer, nick: nickRaw || '스트리머', balloon: Number(s.result.balloon) || 0, at: now, left: leftSec(now), tz: camNow.z, px: camNow.px, key }
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, 7000)
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'game:state' && msg.data && msg.data.id === 'quiz') {
        const s = msg.data
        if (s.status === 'collecting' && s.quiz) onQuestion(s.quiz)
        else if (s.status === 'showing_result' && s.result) onResult(s)
        else if (s.status === 'idle') { if (!R) hide() }   // 결과 표시 중이면 7초 숨김 타이머에 맡김
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
    } catch (err) {}
  }
  ws.onopen  = () => { if (window.__wsDown) location.reload() }  // 서버 재시작(앱 업데이트) → 새 코드 로드
  ws.onclose = () => { window.__wsDown = true; setTimeout(connect, 2000) }
}
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('100px ' + FT), document.fonts.load('900 40px ' + FK), document.fonts.load('700 40px ' + FK), document.fonts.load('800 20px ' + FM)]).catch(() => {})
}
requestAnimationFrame(loop)
connect()
<\/script>
</body>
</html>`

// ── Ladder overlay ────────────────────────────────────────────────────────────
