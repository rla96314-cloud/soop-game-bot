// OBS 오버레이 페이지: number — '로또 추첨 TV 생중계' 연출 (등장 → 혼합 → 긴장 → 공개 → 여운)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 카메라 리그 타임라인 렌더.
//  - 화면 가운데 큰 유리 추첨기가 주인공. 안의 공들은 실제 2D 물리(중력 + 송풍 + 충돌)로 튄다 (모션 블러 꼬리).
//  - 뽑힌 공은 배출관으로 빨려 올라가고 카메라가 따라 올라가 클로즈업 → 출구에서 흔들리다 → 히트스톱 + 섬광 + 거대한 공 공개.
//  - 여운: 카메라가 빠지며 공이 위쪽 결과 레일로 날아가 자리를 잡고, 오른쪽에 사선 결과 카드 (번호 → 도장 → 닉네임 → 별풍선).
// 엔진 상태: game:state { id:'number', status:'running', number{min,max,count,result[],triggeredBy,spinMs} }
//  → 엔진은 spinMs 뒤에 결과를 확정(showing_result, result.balloon)하고 5초 뒤 idle. 연출의 마지막 공 공개 = spinMs 직전.
//  - 새 running 이 오면 진행 중 판을 끊고 새로 시작 (v2.4.0 규칙)
//  - count > 1 이면 앞의 공들은 혼합 중에 하나씩 작게 공개되어 레일로 가고, 마지막 공만 큰 공개.
import { FX_SCRIPT } from './_fx'
export const NUMBER_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>로또 추첨 생중계</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@700;800;900&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { background: transparent !important; overflow: hidden; width: 1920px; height: 1080px }
canvas { display: block; width: 1920px; height: 1080px }
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<script>${FX_SCRIPT}<\/script>
<script>
const C = document.getElementById('c'), X = C.getContext('2d')
const W = 1920, H = 1080
const NAVY = '#172437', OR = '#FF5B17', CR = '#F5F3EF', MINT = '#00CB84', YEL = '#FFC61A'
const FT = '"Black Han Sans","Noto Sans KR",sans-serif'
const FK = '"Noto Sans KR","Apple SD Gothic Neo",sans-serif'
const FM = '"JetBrains Mono",ui-monospace,Menlo,monospace'
// 공 색 (5개 구간) — [밝은, 기본, 그늘, 꼬리 rgb]
const BALL = [
  ['#FFE27A', '#F2B200', '#8A5E00', '242,178,0'],
  ['#9FD0FF', '#2F78D6', '#123A78', '47,120,214'],
  ['#FFA595', '#E5403A', '#7E1816', '229,64,58'],
  ['#EEF1F5', '#97A3B1', '#45505E', '170,180,195'],
  ['#8BF0C0', '#00B472', '#004F33', '0,180,114']]

/* ---------- 배치 (고정 좌표, 월드 좌표) ---------- */
const P = { x: 120, y: 70, w: 1680, h: 900, k: 52 }           // 중계 화면 판 (화면 좌표)
const G = { x: 900, y: 520, r: 290 }                          // 유리 추첨기 (공 물리 원)
// 추첨기 그림 (/assets/number-machine.webp 1254x1254): 공 물리 원 중심 (575,430) / 반지름 320px
const MI = { w: 1254, h: 1254, cx: 575, cy: 430, k: 290 / 320 }
const iwx = x => G.x + (x - MI.cx) * MI.k, iwy = y => G.y + (y - MI.cy) * MI.k
const ipt = (x, y) => ({ x: iwx(x), y: iwy(y) })
// 뽑힌 공 길: 유리 오른쪽 연결부 → 오른쪽 타워 → 통로로 떨어짐 → 아래 경사 트레이를 굴러 왼쪽으로
const ROUTE_HEAD = (() => {
  const pts = [ipt(830, 432), ipt(1062, 432), ipt(1062, 870)]
  const a = ipt(1062, 870), b = ipt(1062, 975), e = ipt(990, 978)          // 통로 바닥에서 트레이로 꺾이는 곡선
  for (let k = 1; k <= 8; k++) { const s = k / 8; pts.push({ x: (1 - s) * (1 - s) * a.x + 2 * s * (1 - s) * b.x + s * s * e.x, y: (1 - s) * (1 - s) * a.y + 2 * s * (1 - s) * b.y + s * s * e.y }) }
  return pts
})()
const TRAY = { r: ipt(990, 978), l: ipt(225, 1037) }          // 트레이 바닥에 얹힌 공 중심선 (오른쪽 높고 왼쪽 낮음)
const TRAY_LEN = Math.hypot(TRAY.r.x - TRAY.l.x, TRAY.r.y - TRAY.l.y)
const MB = new Image(), MH = new Image()                      // 추첨기 본체 / 유리·아크릴 반사광 (lighter 로 덧그림)
MB.src = '/assets/number-machine.webp'; MH.src = '/assets/number-machine-hl.webp'
const mReady = () => MB.complete && MB.naturalWidth > 0 && MH.complete && MH.naturalWidth > 0
// i 번째 공이 멈출 트레이 자리 (0 = 맨 왼쪽 끝)
function slotPos(i) {
  const r = RUN.D / 2, d = r + 4 + i * (RUN.D + 4), q = d / TRAY_LEN
  return { x: lerp(TRAY.l.x, TRAY.r.x, q), y: lerp(TRAY.l.y, TRAY.r.y, q) }
}
// i 번째 공의 길 위 점. u = 0 (유리 안) … 1 (자기 자리). tray = 트레이 위를 굴러간 거리
function routeAt(i, u) {
  const pts = ROUTE_HEAD.concat([slotPos(i)])
  const lens = [0]
  for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y))
  const total = lens[lens.length - 1], s = cl(u) * total
  let k = 1; while (k < pts.length - 1 && lens[k] < s) k++
  const p = (s - lens[k - 1]) / Math.max(1e-6, lens[k] - lens[k - 1])
  const headLen = lens[ROUTE_HEAD.length - 1]
  return { x: lerp(pts[k - 1].x, pts[k].x, p), y: lerp(pts[k - 1].y, pts[k].y, p), tray: Math.max(0, s - headLen), s, total, headLen }
}
const CARD = { x: 1130, y: 300, w: 600, h: 480 }              // 결과 카드 (화면 좌표)
const BIG = { x: 960, y: 470, r: 232 }                        // 거대 공개 공 (화면 좌표)
const FLY0 = 1300, FLY1 = 1900                                 // 공개 후 공이 트레이 자리로 날아가는 구간 (ms)

/* ---------- helpers ---------- */
const cl = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v))
const lerp = (a, b, p) => a + (b - a) * p
const seg = (t, a, b) => cl((t - a) / (b - a))
const eo = p => 1 - Math.pow(1 - p, 3)
const ei = p => p * p * p
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
const eback = p => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const TAU = Math.PI * 2
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
  if (mw > maxW) { size = Math.max(10, Math.floor(size * maxW / mw)); c.font = (weight ? weight + ' ' : '') + size + 'px ' + face }
  return size
}
function balloonIcon(c, x, y, r) {
  c.save(); c.translate(x, y)
  c.fillStyle = CR; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill()
  c.fillStyle = OR; c.beginPath()
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .38 : r * .78, a = -Math.PI / 2 + i * Math.PI / 5; i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  c.closePath(); c.fill(); c.restore()
}
function star(c, n, r0, r1, jag) {
  c.beginPath()
  for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r0 : r1 + (jag ? rnd(i) * jag : 0), an = i / (n * 2) * TAU; i ? c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr) }
  c.closePath()
}
// 로또공 (3D 느낌): 색 구슬 + 번호가 적힌 흰 원(면). o.yaw/o.pitch = 면이 돌아간 각도 (0 = 정면), o.roll = 평면 회전, o.glow = 후광 세기
function drawBall(c, x, y, r, col, txt, o) {
  o = o || {}
  c.save(); c.translate(x, y)
  if (o.glow) {
    c.save(); c.globalCompositeOperation = 'lighter'
    const gr = r * (o.glowR || 2.3), gg = c.createRadialGradient(0, 0, r * .7, 0, 0, gr)
    gg.addColorStop(0, 'rgba(255,198,26,' + (.75 * o.glow) + ')'); gg.addColorStop(.45, 'rgba(255,120,30,' + (.3 * o.glow) + ')'); gg.addColorStop(1, 'rgba(255,91,23,0)')
    c.fillStyle = gg; c.beginPath(); c.arc(0, 0, gr, 0, TAU); c.fill(); c.restore()
  }
  const g = c.createRadialGradient(-r * .38, -r * .42, r * .05, -r * .1, -r * .1, r * 1.1)
  g.addColorStop(0, col[0]); g.addColorStop(.55, col[1]); g.addColorStop(1, col[2])
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill()
  // 번호 면 (구 위에 붙은 원판 — 돌아가면 타원으로 눌리며 가장자리로 숨는다)
  const yaw = o.yaw || 0, pitch = o.pitch || 0
  const nz = Math.cos(yaw) * Math.cos(pitch)
  if (nz > -.05) {
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip()
    const ox = Math.sin(yaw) * Math.cos(pitch) * r * .62, oy = -Math.sin(pitch) * r * .62
    const ang = Math.atan2(oy, ox)
    c.translate(ox, oy); c.rotate(ang); c.scale(Math.max(.05, nz), 1); c.rotate(-ang); c.rotate(o.roll || 0)
    c.fillStyle = 'rgba(255,255,255,.97)'; c.beginPath(); c.arc(0, 0, r * .57, 0, TAU); c.fill()
    if (txt !== '' && txt !== undefined) {
      c.fillStyle = NAVY; c.textAlign = 'center'; c.textBaseline = 'middle'
      fitFont(c, String(txt), Math.round(r * .7), r * .9, FT); c.fillText(String(txt), 0, r * .04)
    }
    c.restore()
  }
  // 음영 + 반사광
  const sh = c.createRadialGradient(-r * .25, -r * .3, r * .35, 0, 0, r * 1.02)
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(4,10,24,.5)')
  c.fillStyle = sh; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill()
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = Math.max(1.5, r * .07)
  c.beginPath(); c.arc(0, 0, r * .84, .15 * Math.PI, .55 * Math.PI); c.stroke()
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-r * .36, -r * .48, r * .28, r * .14, -.6, 0, TAU); c.fill()
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * .46, -r * .5, r * .06, 0, TAU); c.fill()
  c.strokeStyle = NAVY; c.lineWidth = Math.max(1.5, r * .05); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke()
  c.restore()
}

/* ---------- 판 상태 ---------- */
let RUN = null
let cues = {}
let SIM = [], SIMT = 0, lastNow = 0

function colorOf(n) {
  const span = Math.max(1, Math.ceil((RUN.max - RUN.min + 1) / 5))
  return BALL[cl(Math.floor((Number(n) - RUN.min) / span), 0, 4)]
}
function plan(ns) {
  const targets = (ns.result || []).map(Number)
  const N = Math.max(1, targets.length)
  const pre = Math.max(900, Number(ns.spinMs) || 3000)            // 엔진이 결과를 확정하는 시점 (마지막 공 공개 = 그 직전)
  const open = Math.min(520, pre * .17)
  const last = pre - 100
  const tLen = cl(pre * (N > 1 ? .45 : .62), 900, 3200)           // 마지막 공 긴장 구간 (타워로 떨어져 트레이를 굴러오는 시간)
  const Ts = Math.max(open + 50, last - tLen)
  const rEnd = last - Math.min(420, (last - Ts) * .24)            // 마지막 공이 자리에 멈추는 시점 (멈춘 뒤 잠깐 번호를 보여주고 공개)
  const Ti = [], rise = []
  const slot = (Ts - open) / N
  for (let i = 0; i < N - 1; i++) { Ti.push(open + slot * (i + 1)); rise.push(Math.min(1300, slot * .85)) }
  Ti.push(last); rise.push(rEnd - Ts)
  let no = 1
  try { no = (Number(localStorage.getItem('numberDrawNo')) || 0) + 1; localStorage.setItem('numberDrawNo', String(no)) } catch (e) { no = 1 + Math.floor(Math.random() * 900) }
  const nick = ns.triggeredBy && ns.triggeredBy !== 'weflab' ? String(ns.triggeredBy) : '스트리머'
  const D = Math.min(68, (TRAY_LEN - 8) / N - 4)
  return { min: Number(ns.min) || 1, max: Number(ns.max) || 100, targets, N, nick, pre, open, Ts, rEnd, Ti, rise, last, D, slot,
    end: last + 5000, balloon: 0, no: String(no).padStart(3, '0'), t0: performance.now() }
}
function isBig() { return RUN.N >= 3 || RUN.targets.some(n => n === RUN.max) }

/* ---------- 추첨기 속 공 물리 (중력 + 송풍 + 충돌) ---------- */
const BR = 34, NB = 28, GRAV = 2300
function simInit() {
  SIM = []; SIMT = 0
  for (let i = 0; i < NB; i++) {
    SIM.push({ x: G.x + (Math.random() - .5) * 420, y: G.y + 120 - Math.random() * 260, vx: 0, vy: 0,
      yaw: Math.random() * TAU, pitch: Math.random() * TAU, roll: Math.random() * TAU, seed: Math.random() * 100,
      n: RUN.min + Math.floor(Math.random() * (RUN.max - RUN.min + 1)) })
  }
  for (let k = 0; k < 260; k++) simStep(1 / 120, 0)       // 바닥에 쌓인 채로 시작
}
function simStep(dt, jet) {
  SIMT += dt
  const R = G.r - 12 - BR, T = SIMT
  for (const b of SIM) {
    b.vy += GRAV * dt
    if (jet > 0) {
      const dx = (b.x - G.x) / G.r, dy = (b.y - G.y) / G.r
      const sway = Math.sin(T * 1.7) * .35                          // 기류 기둥이 좌우로 흔들림
      const colm = Math.exp(-(dx - sway) * (dx - sway) * 3.2)
      const low = cl((dy + .45) / 1.35)
      const gust = .55 + .6 * Math.abs(Math.sin(T * 6.1 + b.seed) * Math.sin(T * 2.3 + b.seed * 1.7))
      b.vy -= jet * (GRAV * .45 + 10500 * colm * low * gust) * dt
      b.vx += jet * (Math.sin(T * 2.1 + b.seed * 3) * 1800 + Math.sin(T * 9.7 + b.seed) * 1100) * dt
    }
    const damp = 1 - .5 * dt
    b.vx *= damp; b.vy *= damp
    const sp = Math.hypot(b.vx, b.vy); if (sp > 2400) { b.vx *= 2400 / sp; b.vy *= 2400 / sp }
    b.x += b.vx * dt; b.y += b.vy * dt
    b.yaw += b.vx * dt / BR * .8; b.pitch += b.vy * dt / BR * .6; b.roll += (b.vx - b.vy) * dt / BR * .15
    const wx = b.x - G.x, wy = b.y - G.y, d = Math.hypot(wx, wy)
    if (d > R) {
      const nx = wx / d, ny = wy / d
      b.x = G.x + nx * R; b.y = G.y + ny * R
      const vn = b.vx * nx + b.vy * ny
      if (vn > 0) { b.vx -= 1.78 * vn * nx; b.vy -= 1.78 * vn * ny; b.vx *= .97; b.vy *= .97 }
    }
  }
  const D2 = 4 * BR * BR
  for (let i = 0; i < SIM.length; i++) {
    const a = SIM[i]
    for (let j = i + 1; j < SIM.length; j++) {
      const b = SIM[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy
      if (d2 >= D2 || d2 < 1e-6) continue
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (2 * BR - d) * .5
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (vn < 0) { const jj = -1.85 * vn / 2; a.vx -= jj * nx; a.vy -= jj * ny; b.vx += jj * nx; b.vy += jj * ny }
    }
  }
}
// 송풍 세기 / 물리 시간 배율 (박자별)
function jetAt(t) {
  const { open, Ts, last } = RUN
  if (t < open) return 1.6 * seg(t, 180, open)
  if (t < Ts) return 1.2
  if (t < last) return lerp(1.2, .8, seg(t, Ts, last))
  return .85
}
function tsAt(t) {
  const { Ts, last } = RUN
  if (t < Ts) return 1
  if (t < last) return lerp(1, .45, eio(seg(t, Ts, last)))           // 긴장: 슬로모로 가라앉음
  if (t < last + 80) return 0                                          // 히트스톱
  return lerp(.3, .55, seg(t, last + 80, last + 2000))
}

/* ---------- 뽑힌 공의 궤적 (월드) ---------- */
// 굴러가는 공의 번호 면 방향: 굴러간 각 ang 만큼 면이 공 둘레를 돈다 (phi = 면이 정면에서 비껴난 각, 클수록 번호가 가장자리로 숨음)
function spin(ang, phi, i) {
  const th = rnd(i + 31) * TAU - ang, dx = Math.sin(phi) * Math.cos(th), dy = Math.sin(phi) * Math.sin(th)
  return { yaw: Math.atan2(dx, Math.cos(phi)), pitch: -Math.asin(dy), roll: th + Math.PI / 2 }
}
// 시간 p(0~1) → 길 위치 u: 앞 40% 는 연결부·타워 통로를 떨어지며 빨라지고, 뒤 60% 는 트레이를 굴러 uEnd 까지 감속
function travelU(i, p, uEnd) {
  const q0 = routeAt(i, 0), hf = q0.headLen / q0.total
  return p < .4 ? hf * Math.pow(p / .4, 1.6) : lerp(hf, uEnd, eo((p - .4) / .6))
}
// 반환 { vis, x, y, r, yaw, roll, glow, land }
function ballPath(i, t) {
  const Ti = RUN.Ti[i], Rr = RUN.rise[i], isLast = i === RUN.N - 1
  const t0 = isLast ? RUN.Ts : Ti - Rr
  if (t < t0) return { vis: false }
  const rs = RUN.D / 2, sp = slotPos(i)
  if (!isLast) {
    if (t < Ti) {   // 연결부 → 타워 통로로 떨어짐 → 트레이를 굴러 자기 자리로 (번호 면이 빙글빙글)
      const p = seg(t, t0, Ti), q = routeAt(i, travelU(i, p, 1))
      return Object.assign({ vis: true, x: q.x, y: q.y, r: rs }, spin(q.s / rs, .7, i))
    }
    const d = t - Ti, pop = d < 320 ? lerp(1.35, 1, eback(seg(d, 0, 320))) : 1
    return { vis: true, x: sp.x, y: sp.y, r: rs * pop, yaw: 0, roll: 0, glow: d < 700 ? 1 - seg(d, 300, 700) : 0, land: true }
  }
  // 마지막 공: 타워로 떨어져 트레이를 굴러오다 한 번에 길게 감속해 자리에서 멈춘다 (끝은 슬로모처럼 아주 천천히).
  // 굴러오는 동안 번호 면은 가장자리 쪽에서 돌다가, 멈추는 순간 자연스럽게 정면으로 굴러와 바로 선다 → 잠깐 보여준 뒤 공개.
  if (t < RUN.last) {
    const q0 = routeAt(i, 0), hf = q0.headLen / q0.total, angEnd = q0.total / rs
    const g = seg(t, t0, RUN.rEnd)
    let u, x = 0
    if (g < .36) u = hf * Math.pow(g / .36, 1.6)
    else { x = (g - .36) / .64; u = lerp(hf, 1, 1 - Math.pow(1 - x, 3.4)) }
    const q = routeAt(i, u), face = eio(seg(x, .45, 1))
    const phi = 1.25 * (1 - face), th = -Math.PI / 2 + (angEnd - q.s / rs)
    const dx = Math.sin(phi) * Math.cos(th), dy = Math.sin(phi) * Math.sin(th)
    const hold = seg(t, RUN.rEnd, RUN.last)
    return { vis: true, x: q.x, y: q.y, r: rs, yaw: Math.atan2(dx, Math.cos(phi)), pitch: -Math.asin(dy), roll: th + Math.PI / 2, glow: .35 + .4 * face + .25 * hold }
  }  const a = t - RUN.last
  if (a < 80) return { vis: true, x: sp.x, y: sp.y, r: rs, yaw: 0, roll: 0, glow: 1 }     // 히트스톱 프레임
  if (a < FLY1) return { vis: false }                                                     // 거대 공이 대신 그려짐
  return { vis: true, x: sp.x, y: sp.y, r: rs, yaw: 0, roll: 0, glow: .55 + .25 * Math.sin(t * .006), land: true }
}
function heroPos(t) { const b = ballPath(RUN.N - 1, t); return b.vis ? b : slotPos(RUN.N - 1) }

/* ---------- 카메라 ---------- */
function camera(t) {
  const { open, Ts, last, Ti, rise, rEnd } = RUN
  const CX = iwx(645), CY = iwy(640), Z0 = .76                  // 기본 구도: 추첨기 전체
  let fx = CX, fy = CY, sx = 960, sy = 540, z = Z0, r = 0, sh = 0
  const ZT = 1.9                                                  // 긴장 클로즈업 배율
  // 등장: 추첨기 아래쪽에 바짝 붙은 기울어진 화면에서 쑥 빠지며 정자세
  const op = seg(t, 0, 700)
  z = lerp(1.25, Z0, eo(op)); fy = lerp(iwy(900), CY, eo(op)); fx = lerp(iwx(575), CX, eo(op)); r = lerp(-.07, 0, eback(op))
  // 진행: 느린 푸시인 + 핸드헬드
  z *= 1 + .05 * eio(seg(t, open, Ts))
  sx += Math.sin(t * .0008) * 6; sy += Math.sin(t * .0011) * 5
  // 작은 공개 (count>1): 출구 쪽으로 살짝 당겼다 놓기 + 킥
  let u = 0
  for (let i = 0; i < RUN.N - 1; i++) {
    const a0 = Ti[i] - rise[i] * .6
    const v = t < Ti[i] ? eio(seg(t, a0, Ti[i])) : 1 - eio(seg(t, Ti[i] + 200, Ti[i] + 650))
    u = Math.max(u, v)
    const d = t - Ti[i]; if (d > 0 && d < 600) { z *= 1 + .05 * Math.exp(-d / 120); sh += 9 * Math.exp(-d / 110) }
  }
  for (let i = 0; i < RUN.N - 1; i++) if (t > Ti[i] - rise[i] * .6 && t < Ti[i] + 650) { const p = slotPos(i); fx = lerp(fx, p.x + 120, .6 * u); fy = lerp(fy, p.y - 120, .6 * u) }
  z *= 1 + .7 * u
  let tn = 0
  if (t < last) {
    if (t >= Ts) {
      // 긴장: 공을 따라 타워 통로 → 트레이로 내려가며 클로즈업 → 자리 앞에서 느린 푸시인
      tn = seg(t, Ts, last)
      const k = eio(seg(t, Ts, rEnd + (last - rEnd) * .15))
      // 트레이에 들어서면 카메라는 멈출 자리 쪽에 미리 자리 잡고, 공이 화면 안으로 굴러 들어오게 둔다
      const hp = heroPos(t), sp = slotPos(RUN.N - 1), w = .92 * eio(seg(t, lerp(Ts, rEnd, .3), lerp(Ts, rEnd, .7)))
      const tx = lerp(hp.x, sp.x + 70, w), ty = lerp(hp.y, sp.y - 10, w)
      fx = lerp(fx, tx, k); fy = lerp(fy, ty, k); sx = lerp(sx, 960, k); sy = lerp(sy, 500, k)
      z = lerp(z, ZT, eio(seg(t, Ts, rEnd))) * (1 + .16 * eio(seg(t, rEnd, last)))
      sh += .8 + 6 * ei(tn)
    }
  } else {
    const a = t - last, ZC = ZT * 1.16
    const hs = slotPos(RUN.N - 1)
    if (a < 80) { fx = hs.x; fy = hs.y; sx = 960; sy = 500; z = ZC * 1.05; sh = 24; r = 0 }
    else {
      const pb = eio(seg(a, FLY0, FLY1 + 200))
      const zClose = ZC * lerp(1.22, 1, eo(seg(a, 80, 320))) * lerp(1, .82, eo(seg(a, 320, FLY0)))
      fx = lerp(hs.x, CX, pb); fy = lerp(hs.y, iwy(620), pb); sx = lerp(960, 640, pb); sy = lerp(500, 560, pb)
      z = lerp(zClose, .68, pb)
      sh = 20 * Math.exp(-(a - 80) / 150)
      r = -.04 * Math.exp(-(a - 80) / 320) * Math.cos((a - 80) * .025)
      sx += Math.sin(t * .0006) * 4 * pb; sy += Math.sin(t * .0009) * 3 * pb
    }
  }
  const k = Math.floor(t / 16)
  return { fx, fy, sx: sx + (rnd(k) - .5) * 2 * sh, sy: sy + (rnd(k + 977) - .5) * 2 * sh, z, r, tn }
}
function w2s(cam, x, y) {
  const dx = (x - cam.fx) * cam.z, dy = (y - cam.fy) * cam.z, c = Math.cos(cam.r), s = Math.sin(cam.r)
  return { x: cam.sx + dx * c - dy * s, y: cam.sy + dx * s + dy * c }
}

/* ---------- 월드: 추첨기 ---------- */
// 그림 한 장을 두 겹으로 쓴다: 본체(유리·아크릴 반사광을 뺀 것) → 공들 → 반사광(lighter). 유리-타워 연결부는 맨 앞에 다시 그린다.
const MX = iwx(0), MY = iwy(0), MW = MI.w * MI.k, MHh = MI.h * MI.k
const CONN = { x: 938, y: 368, w: 62, h: 132 }                // 유리 → 타워 연결부 (그림 좌표) — 지나가는 공보다 앞
const LEDS = [440, 570, 705].map(x => ipt(x, 885))
const BEACON = ipt(1068, 215)                                 // 타워 꼭대기 경광등
function drawMachineBack(c, t, wt, mode, glowK) {
  const jet = jetAt(wt)
  // 바닥 그림자
  c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(iwx(640), iwy(1170), 560, 30, 0, 0, TAU); c.fill()
  // 외곽 발광 (추첨기가 빛남)
  c.save(); c.globalCompositeOperation = 'lighter'
  const og = c.createRadialGradient(iwx(575), iwy(452), G.r * .95, iwx(575), iwy(452), G.r * 1.6)
  const gk = glowK * (.75 + .25 * Math.sin(t * .008))
  og.addColorStop(0, 'rgba(255,120,40,' + (.38 * gk) + ')'); og.addColorStop(.4, 'rgba(255,91,23,' + (.14 * gk) + ')'); og.addColorStop(1, 'rgba(255,91,23,0)')
  c.fillStyle = og; c.beginPath(); c.arc(iwx(575), iwy(452), G.r * 1.6, 0, TAU); c.fill(); c.restore()
  if (mReady()) c.drawImage(MB, MX, MY, MW, MHh)
  c.save(); c.beginPath(); c.arc(G.x, G.y, G.r, 0, TAU); c.clip()
  // 송풍 기류 (바닥 송풍구에서 소용돌이치며 올라감)
  c.globalCompositeOperation = 'lighter'
  const ng = c.createRadialGradient(G.x, G.y + G.r, 10, G.x, G.y + G.r, 260)
  ng.addColorStop(0, 'rgba(170,220,255,' + (.45 * jet) + ')'); ng.addColorStop(1, 'rgba(170,220,255,0)')
  c.fillStyle = ng; c.fillRect(G.x - G.r, G.y, G.r * 2, G.r)
  for (let i = 0; i < 30; i++) {
    const ph = (SIMT * (.9 + rnd(i + 6) * .9) + rnd(i + 7)) % 1
    const x0 = G.x + (rnd(i + 5) - .5) * 180 + Math.sin(SIMT * 1.7) * 60
    const y0 = G.y + G.r - 10 - ph * G.r * 1.75
    const sw = Math.sin(SIMT * 3 + i) * 70 * ph
    const len = 70 + rnd(i + 9) * 90
    const a = jet * Math.sin(ph * Math.PI) * .32
    if (a <= .01) continue
    c.strokeStyle = 'rgba(190,230,255,' + a + ')'; c.lineWidth = 2 + rnd(i + 8) * 4; c.lineCap = 'round'
    c.beginPath(); c.moveTo(x0 + sw, y0); c.quadraticCurveTo(x0 + sw + 30 * Math.sin(i), y0 - len * .5, x0 + sw * 1.4, y0 - len); c.stroke()
  }
  c.globalCompositeOperation = 'source-over'
  // 공들 (모션 블러 꼬리 → 공)
  for (const b of SIM) {
    const col = colorOf(b.n), sp = Math.hypot(b.vx, b.vy)
    if (sp > 260) {
      const k = Math.min(1, (sp - 260) / 1400), L = .045
      const tx = b.x - b.vx * L, ty = b.y - b.vy * L
      const lg = c.createLinearGradient(b.x, b.y, tx, ty)
      lg.addColorStop(0, 'rgba(' + col[3] + ',' + (.55 * k) + ')'); lg.addColorStop(1, 'rgba(' + col[3] + ',0)')
      c.strokeStyle = lg; c.lineWidth = BR * 1.8; c.lineCap = 'round'
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(tx, ty); c.stroke()
    }
    drawBall(c, b.x, b.y, BR, col, b.n, { yaw: b.yaw, pitch: b.pitch, roll: b.roll })
  }
  // 앞 유리의 옅은 막 (공이 유리 안에 있는 느낌)
  const fr = c.createRadialGradient(G.x - 40, G.y - 50, G.r * .55, G.x, G.y, G.r)
  fr.addColorStop(0, 'rgba(200,230,255,.03)'); fr.addColorStop(.85, 'rgba(200,230,255,.07)'); fr.addColorStop(1, 'rgba(210,235,255,.22)')
  c.fillStyle = fr; c.fillRect(G.x - G.r, G.y - G.r, G.r * 2, G.r * 2)
  c.restore()
}
function drawMachineFront(c, t, mode) {
  if (mReady()) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(MH, MX, MY, MW, MHh); c.restore()
    c.drawImage(MB, CONN.x, CONN.y, CONN.w, CONN.h, iwx(CONN.x), iwy(CONN.y), CONN.w * MI.k, CONN.h * MI.k)
  }
  c.save(); c.globalCompositeOperation = 'lighter'
  // 받침 램프 3개: 진행 = 차례로, 긴장 = 빠르게, 공개 후 = 전부 강하게
  LEDS.forEach((p, i) => {
    const on = mode === 'after' ? 1 : ((i + Math.floor(t / (mode === 'tension' ? 90 : 220))) % 3 === 0 ? 1 : .25)
    const lg = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 46)
    lg.addColorStop(0, 'rgba(255,214,140,' + (.75 * on) + ')'); lg.addColorStop(1, 'rgba(255,120,30,0)')
    c.fillStyle = lg; c.beginPath(); c.arc(p.x, p.y, 46, 0, TAU); c.fill()
  })
  // 경광등 (진행 = 노랑 천천히, 긴장 = 빨강 빠르게, 공개 후 = 민트)
  const on = mode === 'after' ? 1 : mode === 'tension' ? (Math.floor(t / 120) % 2 ? .25 : 1) : .5 + .5 * Math.sin(t * .006)
  const lc = mode === 'after' ? '0,203,132' : mode === 'tension' ? '255,59,47' : '255,198,26'
  const bg = c.createRadialGradient(BEACON.x, BEACON.y, 4, BEACON.x, BEACON.y, 90)
  bg.addColorStop(0, 'rgba(' + lc + ',' + (.85 * on) + ')'); bg.addColorStop(.35, 'rgba(' + lc + ',' + (.3 * on) + ')'); bg.addColorStop(1, 'rgba(' + lc + ',0)')
  c.fillStyle = bg; c.beginPath(); c.arc(BEACON.x, BEACON.y, 90, 0, TAU); c.fill()
  c.restore()
}
function drawWorld(c, t, wt, cam) {
  const a = t - RUN.last
  const mode = wt < RUN.open ? 'open' : wt < RUN.Ts ? 'build' : t < RUN.last ? 'tension' : 'after'
  // 여운: 트레이 위 회전 후광 (마지막 공 자리 뒤)
  if (a > FLY0) {
    const ha = eo(seg(a, FLY0, FLY1 + 300)), hp = slotPos(RUN.N - 1)
    c.save(); c.translate(hp.x, hp.y); c.rotate(t * .0005); c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 16; i++) {
      const an = i / 16 * TAU, gr = c.createRadialGradient(0, 0, 0, 0, 0, 760)
      gr.addColorStop(0, 'rgba(255,200,80,' + (.3 * ha) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)')
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 760, an - .07, an + .07); c.closePath(); c.fill()
    }
    c.restore()
  }
  const glowK = mode === 'open' ? seg(wt, 150, RUN.open) : mode === 'build' ? 1 : mode === 'tension' ? .5 : (a < 80 ? 1 : 1.3)
  drawMachineBack(c, t, wt, mode, glowK)
  // 뽑힌 공들 (타워·트레이 아크릴 안이라 반사광 아래에 그린다)
  const balls = []
  for (let i = 0; i < RUN.N; i++) { const b = ballPath(i, wt); if (b.vis) balls.push([i, b]) }
  for (const [i, b] of balls) {
    if (b.land) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(b.x + 3, b.y + b.r * .92, b.r * .85, b.r * .2, 0, 0, TAU); c.fill() }
    drawBall(c, b.x, b.y, b.r, colorOf(RUN.targets[i]), RUN.targets[i], { yaw: b.yaw, pitch: b.pitch, roll: b.roll, glow: b.glow })
  }
  drawMachineFront(c, wt, mode)
  // 작은 공개 (count>1): 자리에 들어간 순간 터지는 별 + 링
  for (let i = 0; i < RUN.N - 1; i++) {
    const d = wt - RUN.Ti[i]
    if (d <= 0 || d >= 520) continue
    const rp = seg(d, 0, 520), p = slotPos(i)
    c.save(); c.translate(p.x, p.y); c.rotate(rp * .6); c.globalCompositeOperation = 'lighter'
    for (let k = 0; k < 16; k++) {
      const an = k / 16 * TAU, r0 = 40 + rp * 30, r1 = r0 + 60 + rp * 140
      c.strokeStyle = 'rgba(255,198,26,' + (1 - rp) + ')'; c.lineWidth = 6 * (1 - rp) + 1
      c.beginPath(); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); c.stroke()
    }
    c.restore()
    c.strokeStyle = 'rgba(255,255,255,' + (1 - rp) + ')'; c.lineWidth = 5 * (1 - rp) + 1
    c.beginPath(); c.arc(p.x, p.y, RUN.D / 2 + 10 + rp * 110, 0, TAU); c.stroke()
  }
  return mode
}

/* ---------- HUD (화면 좌표, 리그 밖) ---------- */
const PH = [['01', '준비'], ['02', '혼합'], ['03', '추첨'], ['04', '공개'], ['05', '결과']]
function hud(c, t, cam, mode) {
  const hp = eo(seg(t, 260, 700))
  if (hp <= 0) return
  const dim = mode === 'tension' ? lerp(1, .35, seg(t, RUN.Ts, RUN.Ts + 300)) : 1
  c.save(); c.globalAlpha = hp * dim
  // 오른쪽 위: 생중계 배지 + 회차
  const bx = P.x + P.w - 470, by = P.y + 34 - (1 - hp) * 30
  const on = Math.floor(t / 500) % 2 === 0 || mode === 'tension'
  c.fillStyle = '#e02424'; c.fillRect(bx, by, 120, 46)
  c.fillStyle = on ? '#fff' : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(bx + 22, by + 23, 8, 0, TAU); c.fill()
  c.fillStyle = '#fff'; c.font = '800 22px ' + FK; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('생중계', bx + 38, by + 24)
  c.fillStyle = NAVY; c.fillRect(bx + 120, by, 312, 46)
  c.fillStyle = OR; c.fillRect(bx + 120, by + 42, 312, 4)
  c.fillStyle = CR; c.font = '30px ' + FT; c.fillText('제 ' + RUN.no + '회 번호 추첨', bx + 138, by + 25)
  c.fillStyle = 'rgba(245,243,239,.85)'; c.font = '800 20px ' + FK; c.textAlign = 'right'
  c.fillText(RUN.min + ' ~ ' + RUN.max + '  중  ' + RUN.N + '개', bx + 432, by + 72)
  // 왼쪽 아래: 단계 칩 + 경과 시간
  const pw = 112, gap = 6, sx = P.x + 40, sy = P.y + P.h - 74 + (1 - hp) * 30
  let idx = mode === 'open' ? 0 : mode === 'build' ? 1 : mode === 'tension' ? 2 : (t - RUN.last < FLY0 ? 3 : 4)
  for (let i = 0; i < 5; i++) {
    const x = sx + i * (pw + gap), act = i === idx, done = i < idx
    c.fillStyle = act ? OR : done ? 'rgba(245,243,239,.92)' : 'rgba(10,18,28,.75)'; c.fillRect(x, sy, pw, 40)
    if (!act && !done) { c.strokeStyle = 'rgba(245,243,239,.45)'; c.lineWidth = 2; c.strokeRect(x + 1, sy + 1, pw - 2, 38) }
    c.fillStyle = act ? CR : done ? NAVY : 'rgba(245,243,239,.75)'; c.font = '700 19px ' + FK; c.textAlign = 'center'
    c.fillText(PH[i][0] + ' ' + PH[i][1], x + pw / 2, sy + 21)
  }
  const s = Math.floor(t / 1000), fr = Math.floor(t / 1000 * 30) % 30
  c.textAlign = 'left'; c.fillStyle = 'rgba(245,243,239,.8)'; c.font = '700 18px ' + FM
  c.fillText('00:00:' + String(s).padStart(2, '0') + ':' + String(fr).padStart(2, '0'), sx, sy - 18)
  // 오른쪽 아래: 공 카운터
  const got = RUN.Ti.filter(v => t >= v).length
  c.textAlign = 'right'; c.fillStyle = 'rgba(10,18,28,.75)'; c.fillRect(P.x + P.w - 210, sy, 170, 40)
  c.fillStyle = CR; c.font = '800 22px ' + FK; c.fillText('공 ' + got + ' / ' + RUN.N, P.x + P.w - 56, sy + 21)
  c.restore()
}

/* ---------- 화면 효과 ---------- */
function screenFX(c, t, cam) {
  const { last, Ts } = RUN, a = t - last
  // 비네트
  let g = c.createRadialGradient(960, 520, 420, 960, 520, 1050)
  g.addColorStop(0, 'rgba(0,8,16,0)'); g.addColorStop(1, 'rgba(0,8,16,.45)')
  c.fillStyle = g; c.fillRect(P.x, P.y, P.w, P.h)
  // 긴장: 타워를 지나 트레이에 들어서면 공만 남기고 전부 어둡게 + 위에서 내리꽂는 조명
  const dk = (t < last ? eio(seg(t, lerp(Ts, RUN.rEnd, .5), RUN.rEnd)) * .85 + .15 * eio(seg(t, Ts, Ts + 300)) : 1 - eo(seg(a, 80, 700))) * (t >= Ts ? 1 : 0)
  if (dk > 0) {
    const hb = ballPath(RUN.N - 1, t < last ? t : last - 1), hs = slotPos(RUN.N - 1), sp = w2s(cam, hb.vis ? hb.x : hs.x, hb.vis ? hb.y : hs.y)
    const rr = RUN.D / 2 * cam.z
    const sg = c.createRadialGradient(sp.x, sp.y, rr * 1.15, sp.x, sp.y, rr * 3.6)
    sg.addColorStop(0, 'rgba(2,5,10,0)'); sg.addColorStop(1, 'rgba(2,5,10,' + (.84 * dk) + ')')
    c.fillStyle = sg; c.fillRect(P.x, P.y, P.w, P.h)
    c.save(); c.globalCompositeOperation = 'lighter'
    const bg = c.createLinearGradient(0, P.y, 0, sp.y + rr * 1.6)
    bg.addColorStop(0, 'rgba(255,240,210,' + (.2 * dk) + ')'); bg.addColorStop(1, 'rgba(255,240,210,0)')
    c.fillStyle = bg; c.beginPath(); c.moveTo(sp.x - rr * .5, P.y); c.lineTo(sp.x + rr * .5, P.y); c.lineTo(sp.x + rr * 2.2, sp.y + rr * 1.6); c.lineTo(sp.x - rr * 2.2, sp.y + rr * 1.6); c.closePath(); c.fill()
    c.restore()
    if (t < last) {
      // 조준 괄호 (점점 조여듦)
      const tn = cam.tn, q = rr * (1.9 - .45 * tn) + Math.sin(t * .02) * 4
      c.strokeStyle = 'rgba(255,198,26,' + (.45 + .5 * tn) + ')'; c.lineWidth = 6; c.lineCap = 'square'
      for (let k = 0; k < 4; k++) {
        const sx = k % 2 ? 1 : -1, sy = k < 2 ? -1 : 1, L = rr * .45
        c.beginPath(); c.moveTo(sp.x + sx * q, sp.y + sy * (q - L)); c.lineTo(sp.x + sx * q, sp.y + sy * q); c.lineTo(sp.x + sx * (q - L), sp.y + sy * q); c.stroke()
      }
      // 꼬리표
      const lab = RUN.N > 1 ? '마지막 공' : '행운의 공'
      c.font = '34px ' + FT; c.textAlign = 'center'; c.textBaseline = 'middle'
      const ly = sp.y + q + 52, lw = c.measureText(lab).width + 44
      c.save(); c.translate(sp.x, ly); c.rotate(-.04)
      c.fillStyle = NAVY; c.fillRect(-lw / 2, -26, lw, 52); c.fillStyle = OR; c.fillRect(-lw / 2, 22, lw, 4)
      c.fillStyle = Math.floor(t / 160) % 2 ? YEL : CR; c.fillText(lab, 0, 2); c.restore()
    }
  }
  // 레터박스
  const lbIn = eo(seg(t, Ts, Ts + 400)), lbOut = 1 - seg(t, last + 80, last + 320)
  const hb2 = 84 * lbIn * lbOut
  if (hb2 > 0) { c.fillStyle = '#03060b'; c.fillRect(P.x, P.y, P.w, hb2); c.fillRect(P.x, P.y + P.h - hb2, P.w, hb2) }
  // 공개 섬광
  if (t >= last && a < 460) { c.fillStyle = 'rgba(255,252,245,' + (a < 80 ? .96 : .96 * Math.pow(1 - seg(a, 80, 460), 2)) + ')'; c.fillRect(P.x, P.y, P.w, P.h) }
  // 필름 그레인
  const k = Math.floor(t / 42)
  for (let i = 0; i < 160; i++) { c.fillStyle = rnd(k * 31 + i) > .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'; c.fillRect(P.x + rnd(k * 17 + i) * P.w, P.y + rnd(k * 13 + i + 5) * P.h, 2, 2) }
}

/* ---------- 공개: 거대한 공 (화면 좌표) ---------- */
function bigBall(c, t, cam) {
  const a = t - RUN.last
  if (a < 80 || a >= FLY1) return
  const n = RUN.targets[RUN.N - 1], col = colorOf(n)
  const pin = seg(a, 80, 330)
  let x = BIG.x, y = BIG.y, r = BIG.r * lerp(1.55, 1, eback(pin)) * (1 + .025 * Math.sin(a * .012) * (1 - seg(a, 800, FLY0)))
  const fp = seg(a, FLY0, FLY1), fe = eio(fp)
  if (fp > 0) { const hs = slotPos(RUN.N - 1), sp = w2s(cam, hs.x, hs.y); x = lerp(BIG.x, sp.x, fe); y = lerp(BIG.y, sp.y, fe) - Math.sin(fe * Math.PI) * 140; r = lerp(BIG.r, RUN.D / 2 * cam.z, fe) }
  const burstA = 1 - seg(a, 1000, FLY0 + 200)
  // 방사 광선 (회전)
  if (burstA > 0) {
    c.save(); c.translate(BIG.x, BIG.y); c.rotate(a * .00035)
    const sc = eo(seg(a, 80, 300))
    for (let i = 0; i < 36; i++) {
      const an = i / 36 * TAU, r0 = BIG.r * .9, r1 = 1500 * sc
      c.fillStyle = i % 2 ? 'rgba(255,91,23,' + (.8 * burstA) + ')' : 'rgba(255,198,26,' + (.55 * burstA) + ')'
      c.beginPath(); c.moveTo(Math.cos(an - .035) * r0, Math.sin(an - .035) * r0); c.lineTo(Math.cos(an - .05) * r1, Math.sin(an - .05) * r1); c.lineTo(Math.cos(an + .05) * r1, Math.sin(an + .05) * r1); c.lineTo(Math.cos(an + .035) * r0, Math.sin(an + .035) * r0); c.fill()
    }
    c.restore()
    // 만화풍 별 (노랑 + 남색 테두리)
    c.save(); c.translate(BIG.x, BIG.y); c.rotate(-a * .0006); const ss = lerp(.4, 1, eback(seg(a, 80, 300)))
    c.scale(ss, ss); c.globalAlpha = burstA
    star(c, 18, BIG.r * 1.18, BIG.r * 1.55, BIG.r * .22); c.fillStyle = YEL; c.fill(); c.strokeStyle = NAVY; c.lineWidth = 9; c.stroke()
    c.restore()
    // 충격파 링
    for (let k = 0; k < 3; k++) {
      const rp = seg(a, 80 + k * 90, 620 + k * 90)
      if (rp <= 0 || rp >= 1) continue
      c.strokeStyle = 'rgba(255,255,255,' + (1 - rp) * .9 + ')'; c.lineWidth = 14 * (1 - rp) + 2
      c.beginPath(); c.arc(BIG.x, BIG.y, BIG.r + rp * 620, 0, TAU); c.stroke()
    }
  }
  // 공: 옆을 보던 번호 면이 카메라 쪽으로 홱 돌아옴
  const yaw = lerp(1.1, 0, eback(seg(a, 80, 380)))
  if (burstA > 0) { c.save(); c.globalAlpha = burstA; c.fillStyle = NAVY; c.beginPath(); c.arc(x, y, r * 1.1, 0, TAU); c.fill(); c.strokeStyle = CR; c.lineWidth = r * .035; c.beginPath(); c.arc(x, y, r * 1.06, 0, TAU); c.stroke(); c.restore() }
  drawBall(c, x, y, r, col, n, { yaw, glow: 1 - fe * .4, glowR: 1.9 })
  // 이름표
  const la = Math.min(1, seg(a, 200, 360) * 1) * (1 - seg(a, FLY0 - 200, FLY0 + 100))
  if (la > 0) {
    const lab = RUN.N > 1 ? '마지막 공!' : '행운의 공!'
    const ls = lerp(1.8, 1, eback(seg(a, 200, 400)))
    c.save(); c.globalAlpha = la; c.translate(BIG.x, BIG.y + BIG.r + 62); c.rotate(-.05); c.scale(ls, ls)
    c.font = '54px ' + FT; c.textAlign = 'center'; c.textBaseline = 'middle'
    const lw = c.measureText(lab).width + 70
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-lw / 2 + 10, -36 + 10, lw, 72)
    c.fillStyle = NAVY; c.fillRect(-lw / 2, -36, lw, 72); c.fillStyle = OR; c.fillRect(-lw / 2, 30, lw, 6)
    outlined(c, lab, 0, 2, YEL, NAVY, 6, null, 0)
    c.restore()
  }
}
function panelFrame(c, py, ph) {
  c.save(); panelPath(c, P.x, py, P.w, ph, P.k); c.strokeStyle = 'rgba(245,243,239,.55)'; c.lineWidth = 3; c.stroke()
  const L = 70, y0 = py, y1 = py + ph
  c.strokeStyle = OR; c.lineWidth = 9; c.lineCap = 'square'
  c.beginPath(); c.moveTo(P.x + P.w - L, y0 - 10); c.lineTo(P.x + P.w + 10, y0 - 10); c.lineTo(P.x + P.w + 10, y0 + L); c.stroke()
  c.beginPath(); c.moveTo(P.x - 10, y1 - L); c.lineTo(P.x - 10, y1 + 10); c.lineTo(P.x + L, y1 + 10); c.stroke()
  c.beginPath(); c.moveTo(P.x - 10, y0 + P.k + L); c.lineTo(P.x - 10, y0 + P.k - 6); c.lineTo(P.x + P.k - 6, y0 - 10); c.lineTo(P.x + P.k + L, y0 - 10); c.stroke()
  c.restore()
}

/* ---------- 등장 타이틀 — '추첨 시작!' 이 사선 리본 위로 꽂혔다가 오른쪽으로 빠짐 ---------- */
function openTitle(c, t) {
  const end = Math.max(950, Math.min(1350, RUN.Ti[0] - RUN.rise[0] * .6 - 40))
  if (t < 40 || t > end) return
  const ip = seg(t, 40, 280), op = seg(t, end - 260, end)
  const x = 960 + eio(op) * 1300, y = 640
  c.save(); c.globalAlpha = 1 - op * .6
  const rw = eo(seg(t, 40, 240))
  c.save(); c.translate(x, y); c.rotate(-.06); c.transform(1, 0, -.25, 1, 0, 0)
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-460 * rw + 14, -80 + 14, 920 * rw, 160)
  c.fillStyle = OR; c.fillRect(-460 * rw, -80, 920 * rw, 160)
  c.fillStyle = NAVY; c.fillRect(-460 * rw, 62, 920 * rw, 18)
  c.restore()
  if (ip < 1 || op > 0) {
    const k = ip < 1 ? 1 - ip : op
    c.fillStyle = 'rgba(245,243,239,' + .55 * k + ')'
    for (let i = 0; i < 8; i++) c.fillRect(x + (op > 0 ? -1000 : 340) + rnd(i + 20) * 300, y - 70 + i * 18, 260 + rnd(i + 21) * 380, 5)
  }
  if (t >= 60) {
    const s = lerp(1.9, 1, eback(ip))
    c.translate(x, y); c.rotate(lerp(-.105, -.06, eo(ip))); c.scale(s, s)
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '124px ' + FT
    outlined(c, '추첨 시작!', 0, -2, CR, NAVY, 12, NAVY, 8)
    c.font = '800 26px ' + FK; c.fillStyle = CR
    c.fillText(RUN.min + ' ~ ' + RUN.max + ' 중 ' + RUN.N + '개를 뽑습니다', 0, 96)
  }
  c.restore()
}

/* ---------- 결과 카드 (화면 좌표, 사선) ---------- */
function resultCard(c, t) {
  const a = t - RUN.last, base = 1400
  if (a < base) return
  const { x: x0, y: y0, w, h } = CARD
  const inP = seg(a, base, base + 420), ox = (1 - eback(inP)) * 900
  c.save(); c.translate(ox, 0)
  if (inP < 1) { c.fillStyle = 'rgba(245,243,239,' + .6 * (1 - inP) + ')'; for (let i = 0; i < 8; i++) c.fillRect(x0 + w + 20 + rnd(i) * 200, y0 + 40 + i * 55, 300 + rnd(i + 3) * 300, 6) }
  c.transform(1, 0, -.14, 1, 0, 0); c.translate(y0 * .14 + 30, 0)   // skewX(-8°)
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x0 + 18, y0 + 22, w, h)
  c.fillStyle = CR; c.fillRect(x0, y0, w, h)
  c.fillStyle = OR; c.fillRect(x0, y0, 18, h)
  c.fillStyle = NAVY; c.fillRect(x0 + 18, y0, w - 18, 90)
  c.textBaseline = 'middle'; c.textAlign = 'left'
  c.fillStyle = OR; c.font = '62px ' + FT; c.fillText('당첨!', x0 + 48, y0 + 49)
  c.fillStyle = 'rgba(245,243,239,.75)'; c.font = '700 22px ' + FK; c.textAlign = 'right'; c.fillText('추첨 기록 제 ' + RUN.no + '회', x0 + w - 36, y0 + 50); c.textAlign = 'left'
  // 1) 당첨 번호
  const np = seg(a, base + 300, base + 540), ns = lerp(1.9, 1, eback(np))
  if (np > 0) {
    c.globalAlpha = Math.min(1, np * 3)
    c.fillStyle = 'rgba(23,36,55,.6)'; c.font = '700 26px ' + FK; c.fillText('당첨 번호', x0 + 52, y0 + 126)
    const half = RUN.N > 4 ? Math.ceil(RUN.N / 2) : RUN.N
    const rows = half < RUN.N ? [RUN.targets.slice(0, half), RUN.targets.slice(half)] : [RUN.targets]
    c.save(); c.translate(x0 + 48, y0 + (rows.length > 1 ? 178 : 205)); c.scale(ns, ns)
    let fs = 0
    for (const r of rows) { const z = fitFont(c, r.join(' · '), rows.length > 1 ? 70 : 116, w - 290, FT); fs = fs ? Math.min(fs, z) : z }
    c.font = fs + 'px ' + FT
    rows.forEach((r, k) => { const txt = r.join(' · '), yy = k * (fs + 8); c.fillStyle = OR; c.fillText(txt, 6, yy + 6); c.fillStyle = NAVY; c.fillText(txt, 0, yy) })
    c.restore(); c.globalAlpha = 1
  }
  c.strokeStyle = 'rgba(23,36,55,.25)'; c.lineWidth = 3; c.setLineDash([10, 10])
  c.beginPath(); c.moveTo(x0 + 48, y0 + 280); c.lineTo(x0 + w - 36, y0 + 280); c.stroke(); c.setLineDash([])
  // 3) 닉네임
  const cp = eo(seg(a, base + 700, base + 1000))
  c.save(); c.globalAlpha = cp; c.translate((1 - cp) * 80, 0)
  c.fillStyle = 'rgba(23,36,55,.6)'; c.font = '700 26px ' + FK; c.fillText('추첨한 사람', x0 + 52, y0 + 318)
  c.fillStyle = NAVY; fitFont(c, RUN.nick, 66, w - 110, FK, 900); c.fillText(RUN.nick, x0 + 50, y0 + 372)
  c.restore()
  // 4) 별풍선
  const gp = seg(a, base + 880, base + 1140), gs = lerp(.4, 1, eback(gp))
  if (gp > 0 && RUN.balloon > 0) {
    const label = '별풍선 ' + Number(RUN.balloon).toLocaleString() + '개'
    c.save(); c.translate(x0 + 52, y0 + 440); c.scale(gs, gs); c.globalAlpha = Math.min(1, gp * 2)
    c.fillStyle = OR; c.beginPath(); c.roundRect(0, -30, 380, 60, 30); c.fill()
    balloonIcon(c, 32, 0, 21)
    c.fillStyle = CR; fitFont(c, label, 36, 300, FK, 900); c.fillText(label, 66, 2)
    c.restore()
  }
  // 2) 도장
  const bp = seg(a, base + 520, base + 760)
  if (bp > 0) {
    const bs = lerp(3, 1, eback(bp)), big = isBig(), col = big ? OR : MINT
    c.save(); c.translate(x0 + w - 86, y0 + 196); c.rotate(-.2); c.scale(bs, bs); c.globalAlpha = Math.min(1, bp * 2.5)
    if (bp < 1) { c.strokeStyle = col; c.lineWidth = 6; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; c.beginPath(); c.moveTo(Math.cos(an) * 112, Math.sin(an) * 112); c.lineTo(Math.cos(an) * (130 + bp * 60), Math.sin(an) * (130 + bp * 60)); c.stroke() } }
    c.fillStyle = NAVY; c.beginPath(); c.arc(6, 8, 96, 0, TAU); c.fill()
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 96, 0, TAU); c.fill()
    c.strokeStyle = CR; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 82, 0, TAU); c.stroke()
    c.textAlign = 'center'; c.fillStyle = CR; c.font = '62px ' + FT; c.fillText(big ? '대박' : '당첨', 0, -6)
    c.font = '800 20px ' + FK; c.fillText('공 ' + RUN.N + '개', 0, 46)
    c.restore()
  }
  c.restore()
}

/* ---------- 효과음 박자 ---------- */
function cue(k, fn) { if (cues[k]) return; cues[k] = 1; try { fn() } catch (e) {} }
function sounds(t) {
  const { open, Ts, last, Ti, rise, rEnd } = RUN
  cue('open', () => FX.sound('whoosh'))
  if (t > 300) cue('blow', () => FX.sound('pop'))
  if (t > open && t < Ts) cue('spin', () => FX.spinStart())
  for (let i = 0; i < RUN.N - 1; i++) {
    if (t > Ti[i] - rise[i]) cue('rise' + i, () => FX.sound('flip'))
    if (t > Ti[i]) cue('ball' + i, () => { FX.sound('pop'); FX.sound('tick') })
  }
  if (t > Ts) cue('tension', () => { FX.spinStop(); FX.sound('whoosh'); FX.drumStart(150) })
  if (t > rEnd) cue('gate', () => FX.sound('tick'))
  if (t > last) cue('impact', () => { FX.drumStop(); FX.sound('stop') })
  if (t > last + 90) cue('boom', () => { FX.sound(isBig() ? 'jackpot' : 'win'); FX.confetti({ count: isBig() ? 220 : 130, x: BIG.x, y: BIG.y }) })
  if (t > last + FLY0) cue('fly', () => FX.sound('whoosh'))
  if (t > last + FLY1) cue('land', () => FX.sound('pop'))
  if (t > last + 1400) cue('card', () => FX.sound('reveal'))
  if (t > last + 1960) cue('stamp', () => FX.sound('stop'))
  if (t > last + 2100) cue('name', () => FX.sound('coin'))
  if (t > last + 2900) cue('banner', () => FX.winner({ nick: RUN.nick, sub: '숫자 추첨 · ' + RUN.targets.join(', '), ms: 3000 }))
}

/* ---------- 렌더 ---------- */
function render(t) {
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H)
  if (!RUN) return
  const alpha = 1 - seg(t, RUN.end, RUN.end + 400)
  if (alpha <= 0) return
  // 히트스톱: 공개 후 80ms 동안 공개 직전 프레임으로 멈춤
  const wt = t >= RUN.last && t < RUN.last + 80 ? RUN.last - 1 : t
  const cam = camera(t)
  const rv = eo(seg(t, 0, 420)), ph = Math.max(6, P.h * rv), py = P.y + (P.h - ph) / 2
  X.save(); X.globalAlpha = alpha
  X.save(); X.shadowColor = 'rgba(0,0,0,.55)'; X.shadowBlur = 50; X.shadowOffsetY = 14
  panelPath(X, P.x, py, P.w, ph, P.k); X.fillStyle = '#0B1524'; X.fill(); X.restore()
  X.save(); panelPath(X, P.x, py, P.w, ph, P.k); X.clip()
  // 판 바탕: 스튜디오 (위 조명 + 격자 바닥)
  const bg = X.createLinearGradient(0, P.y, 0, P.y + P.h); bg.addColorStop(0, '#15263f'); bg.addColorStop(1, '#060b15')
  X.fillStyle = bg; X.fillRect(P.x, P.y, P.w, P.h)
  X.save()
  X.translate(cam.sx, cam.sy); X.rotate(cam.r); X.scale(cam.z, cam.z); X.translate(-cam.fx, -cam.fy)
  const sl = X.createRadialGradient(G.x, G.y - 100, 100, G.x, G.y - 100, 900)
  sl.addColorStop(0, 'rgba(90,140,220,.22)'); sl.addColorStop(1, 'rgba(90,140,220,0)')
  X.fillStyle = sl; X.fillRect(G.x - 1000, G.y - 1100, 2000, 2000)
  X.strokeStyle = 'rgba(120,160,230,.07)'; X.lineWidth = 2
  for (let gx = -400; gx <= 2400; gx += 80) { X.beginPath(); X.moveTo(gx, -600); X.lineTo(gx, 1500); X.stroke() }
  for (let gy = -600; gy <= 1500; gy += 80) { X.beginPath(); X.moveTo(-400, gy); X.lineTo(2400, gy); X.stroke() }
  const mode = drawWorld(X, t, wt, cam)
  X.restore()
  screenFX(X, t, cam)
  if (rv >= 1) bigBall(X, t, cam)
  X.restore()
  panelFrame(X, py, ph)
  if (rv >= 1) { hud(X, wt, cam, mode); resultCard(X, t) }
  openTitle(X, t)
  X.restore()
}
function loop(now) {
  const dt = Math.min(.05, Math.max(0, (now - (lastNow || now)) / 1000)); lastNow = now
  if (RUN) {
    const t = now - RUN.t0
    try {
      if (!RUN.kicked && t > 280) { RUN.kicked = 1; for (const b of SIM) { b.vy -= 1500 + Math.random() * 1700; b.vx += (Math.random() - .5) * 1800 } }   // 송풍 개시: 공들이 한꺼번에 튀어오름
      const sdt = dt * tsAt(t), jet = jetAt(t)
      if (sdt > 0) { const n = Math.ceil(sdt / .006); for (let i = 0; i < n; i++) simStep(sdt / n, jet) }
      sounds(t); render(t)
    } catch (err) { console.warn(err) }
    if (t > RUN.end + 500) stop()
  }
  requestAnimationFrame(loop)
}
function stop() {
  RUN = null; SIM = []
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H)
  FX.drumStop(); FX.spinStop(); FX.hideWinner()
}
function start(ns) {
  // 진행 중이면 끊고 새 판 (엔진은 spinMs 뒤에 결과를 확정하므로 연출도 그 안에 공개)
  FX.drumStop(); FX.spinStop(); FX.hideWinner()
  cues = {}
  RUN = plan(ns)
  simInit()
}

function connect() {
  const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data)
      FX.handle(msg)
      if (msg.type === 'game:state' && msg.data && msg.data.id === 'number') {
        const s = msg.data
        if (s.status === 'running' && s.number && s.number.result) start(s.number)
        else if (s.status === 'showing_result' && s.result && RUN) RUN.balloon = Number(s.result.balloon) || 0
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
    } catch (err) {}
  }
  ws.onopen = () => { if (window.__wsDown) location.reload() }
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
