// OBS 오버레이 페이지: number — '로또 추첨기 생중계' 연출 (등장 → 혼합 → 공 하나씩 작은 공개 → 마지막 공 긴장 → 공개 → 여운)
// 모션 언어: .inhabited/motion-language.md (기준: fish.ts '수중 다큐 카메라'). 캔버스 1장 + 카메라 리그 타임라인 렌더.
// 엔진 상태: game:state { id:'number', status:'running', number{min,max,count,result[],triggeredBy,spinMs} }
//  → 엔진은 spinMs 뒤에 결과를 확정(showing_result, result.balloon)하고 5초 뒤 idle. 연출의 마지막 공 공개 = spinMs 직전.
//  - 새 running 이 오면 진행 중 판을 끊고 새로 시작 (v2.4.0 규칙)
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
// 공 색 (5개 구간) — [밝은, 진한]
const BALL = [['#FFE27A', '#F2B200'], ['#8FC8FF', '#2F78D6'], ['#FF9A8A', '#E5403A'], ['#C9D1DA', '#7D8A99'], ['#7FEDB9', '#00A86B']]

/* ---------- 배치 (고정 좌표, 월드 = 화면 1:1) ---------- */
const P = { x: 200, y: 110, w: 1520, h: 800, k: 48 }          // 중계 화면 판
const G = { x: 700, y: 575, r: 245 }                          // 추첨기 구체
const TUBE = { x: 700, top: 262 }                             // 배출관 꼭대기
const RAIL = { x0: 660, x1: 1670, y: 262 }                    // 결과 레일
const SLOTS = { x0: 900, x1: 1640 }
const CARD = { x: 1180, y: 350, w: 600, h: 480 }              // 결과 카드 (리그 밖)

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
// 로또공: 색 구슬 + 가운데 흰 원 + 번호. spin = 공 회전(흰 원이 돌며 옆으로 비껴감)
function drawBall(c, x, y, r, col, txt, spin, glow) {
  c.save(); c.translate(x, y)
  if (glow) { c.shadowColor = glow; c.shadowBlur = 40 }
  const g = c.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r)
  g.addColorStop(0, col[0]); g.addColorStop(1, col[1])
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0
  c.strokeStyle = NAVY; c.lineWidth = Math.max(2, r * .07); c.stroke()
  const sx = Math.sin(spin || 0), vis = Math.cos(spin || 0)
  if (vis > -.2) {
    c.save(); c.translate(sx * r * .45, 0); c.scale(Math.max(.15, vis), 1)
    c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(0, 0, r * .58, 0, Math.PI * 2); c.fill()
    if (txt !== '') {
      c.fillStyle = NAVY; c.textAlign = 'center'; c.textBaseline = 'middle'
      fitFont(c, String(txt), Math.round(r * .78), r * 1.0, FT); c.fillText(String(txt), 0, r * .05)
    }
    c.restore()
  }
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-r * .38, -r * .5, r * .26, r * .14, -.6, 0, Math.PI * 2); c.fill()
  c.restore()
}

/* ---------- 판 상태 ---------- */
let RUN = null      // { min,max,targets[],nick,pre,t0,open,Ts,Ti[],rise[],last,end, balloon, no }
let cues = {}
let hideTimer = null

function colorOf(n) {
  const span = Math.max(1, Math.ceil((RUN.max - RUN.min + 1) / 5))
  return BALL[cl(Math.floor((Number(n) - RUN.min) / span), 0, 4)]
}
function plan(ns) {
  const targets = (ns.result || []).map(Number)
  const N = Math.max(1, targets.length)
  const pre = Math.max(900, Number(ns.spinMs) || 3000)            // 엔진이 결과를 확정하는 시점 (연출의 마지막 공 공개 = 그 직전)
  const open = Math.min(500, pre * .15)
  const tLen = cl(pre * .3, 400, 1400)                            // 마지막 공 긴장 구간
  const last = pre - 100
  const Ts = Math.max(open + 50, last - tLen)
  const Ti = [], rise = []
  const slot = (Ts - open) / N
  for (let i = 0; i < N - 1; i++) { Ti.push(open + slot * (i + 1)); rise.push(Math.min(560, slot * .78)) }
  Ti.push(last); rise.push(last - Ts)
  let no = 1
  try { no = (Number(localStorage.getItem('numberDrawNo')) || 0) + 1; localStorage.setItem('numberDrawNo', String(no)) } catch (e) { no = 1 + Math.floor(Math.random() * 900) }
  const nick = ns.triggeredBy && ns.triggeredBy !== 'weflab' ? String(ns.triggeredBy) : '스트리머'
  const D = Math.min(84, (SLOTS.x1 - SLOTS.x0) / N - 8)
  return { min: Number(ns.min) || 1, max: Number(ns.max) || 100, targets, N, nick, pre, open, Ts, Ti, rise, last, D,
    end: last + 5000, balloon: 0, no: String(no).padStart(3, '0'), t0: performance.now() }
}
function slotX(i) { const w = (SLOTS.x1 - SLOTS.x0) / RUN.N; return SLOTS.x0 + w * (i + .5) }

/* ---------- 공 하나의 궤적 ---------- */
// 반환 { x, y, s(크기 배율), spin, shown(번호 공개 여부), vis }
function ballPath(i, t) {
  const Ti = RUN.Ti[i], Rr = RUN.rise[i], isLast = i === RUN.N - 1
  const t0 = Ti - Rr
  if (t < t0) return { vis: false }
  const sx = slotX(i), r = RUN.D / 2
  if (!isLast) {
    // 빨려 올라감(가속) → 레일 따라 굴러 감(감속) → 슬롯에 착지
    const up = seg(t, t0, t0 + Rr * .42), roll = seg(t, t0 + Rr * .42, Ti)
    if (t < Ti) {
      if (up < 1) return { vis: true, x: TUBE.x, y: lerp(G.y - 40, TUBE.top, ei(up)), s: 1, spin: t * .03, shown: false }
      return { vis: true, x: lerp(TUBE.x, sx, eo(roll)), y: TUBE.top, s: 1, spin: (sx - TUBE.x) * eo(roll) / r, shown: false }
    }
    return { vis: true, x: sx, y: TUBE.top, s: 1, spin: 0, shown: true }
  }
  // 마지막 공: 관을 천천히 올라와 꼭대기에서 머뭇거림 → 공개 → 여운에 슬롯으로 굴러감
  if (t < Ti) {
    const p = seg(t, t0, Ti - 160)
    const y = lerp(G.y - 40, TUBE.top, eo(p)) + (p >= 1 ? Math.sin(t * .05) * 3 : 0)
    return { vis: true, x: TUBE.x, y, s: 1, spin: t * .02 * (1 - eo(p)) + .9 * Math.sin(t * .012), shown: false }
  }
  const roll = seg(t, Ti + 900, Ti + 1500)
  return { vis: true, x: lerp(TUBE.x, sx, eio(roll)), y: TUBE.top, s: lerp(1.5, 1, eo(seg(t, Ti + 80, Ti + 900))), spin: roll > 0 && roll < 1 ? (sx - TUBE.x) * eio(roll) / r : 0, shown: true }
}

/* ---------- 혼합 속도 (감속 곡선) ---------- */
function mixT(t) {
  const { open, Ts, last } = RUN
  if (t < open) return t * t / (2 * open)                          // 등장: 0 → 1 가속
  let m = open / 2
  if (t < Ts) return m + (t - open)
  m += Ts - open
  const L = Math.max(1, last - Ts), d = Math.min(t, last) - Ts
  m += d - .72 * d * d / (2 * L)                                    // 긴장: 1 → 0.28 감속
  if (t <= last) return m
  return m + (t - last) * .25                                       // 여운: 슬로모
}

/* ---------- 카메라 ---------- */
function camera(t) {
  const { open, Ts, last, Ti } = RUN
  let fx = 960, fy = 510, sx = 960, sy = 510, z = 1, r = 0, sh = 0
  // 등장: 기울어진 채 밀려 들어와 정자세
  const op = seg(t, 0, 460)
  z = lerp(.84, 1, eback(op)); r = lerp(-.06, 0, eback(op)); sx += lerp(-260, 0, eo(op))
  // 진행: 느린 푸시인
  z *= 1 + .06 * eio(seg(t, open, Ts))
  sx += Math.sin(t * .0007) * 5; sy += Math.sin(t * .001) * 4
  // 공 하나 착지마다 작은 킥
  for (let i = 0; i < RUN.N - 1; i++) { const d = t - Ti[i]; if (d > 0 && d < 600) { z *= 1 + .035 * Math.exp(-d / 140); sh += 8 * Math.exp(-d / 110) } }
  // 긴장: 배출관 꼭대기로 줌 가속 + 흔들림 증가
  const tn = seg(t, Ts, last)
  if (t < last) {
    const k = eio(Math.min(1, tn * 1.6))
    fx = lerp(fx, TUBE.x, k); fy = lerp(fy, TUBE.top + 60, k); sx = lerp(sx, 800, k); sy = lerp(sy, 470, k)
    z *= 1 + .5 * ei(tn); sh += tn > 0 ? 1.5 + tn * 7 : 0
  } else {
    const a = t - last
    const back = eo(seg(a, 80, 1100))
    const tz = 1.06 * 1.5
    fx = lerp(TUBE.x, 960, back); fy = lerp(TUBE.top + 60, 510, back); sx = lerp(800, 960, back); sy = lerp(470, 510, back)
    if (a < 80) { z = tz * 1.06; sh = 26 }                          // 히트스톱
    else {
      z = lerp(tz, 1, back) * lerp(1.15, 1, eo(seg(a, 80, 260)))     // 펀치 줌
      sh = 14 * Math.exp(-(a - 80) / 120)
      r = -.03 * Math.exp(-(a - 80) / 260) * Math.cos((a - 80) * .03)
    }
  }
  const k = Math.floor(t / 16)
  return { fx, fy, sx: sx + (rnd(k) - .5) * 2 * sh, sy: sy + (rnd(k + 977) - .5) * 2 * sh, z, r, tn }
}

/* ---------- 월드 ---------- */
function drawMachine(c, t, cam) {
  const mt = mixT(t), a = t - RUN.last
  const mode = t < RUN.open ? 'open' : t < RUN.Ts ? 'build' : t < RUN.last ? 'tension' : 'after'
  // 받침대
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(G.x + 10, 900, 300, 26, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = OR; c.strokeStyle = NAVY; c.lineWidth = 6; c.lineJoin = 'round'
  c.beginPath(); c.moveTo(G.x - 150, 790); c.lineTo(G.x + 150, 790); c.lineTo(G.x + 250, 892); c.lineTo(G.x - 250, 892); c.closePath(); c.fill(); c.stroke()
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(G.x - 140, 802, 280, 8)
  // 받침 LED: 진행=추적, 긴장=빠른 추적, 공개 후=전부 점등
  for (let i = 0; i < 13; i++) {
    const lx = G.x - 200 + i * 33.3
    const on = mode === 'after' ? true : ((i + Math.floor(t / (mode === 'tension' ? 90 : 160))) % 3 === 0)
    c.fillStyle = on ? (mode === 'tension' ? '#FFD27A' : CR) : 'rgba(23,36,55,.5)'
    c.beginPath(); c.arc(lx, 856, 7, 0, Math.PI * 2); c.fill()
  }
  // 구체 안
  c.save(); c.beginPath(); c.arc(G.x, G.y, G.r, 0, Math.PI * 2); c.clip()
  const bg = c.createRadialGradient(G.x, G.y + 60, 20, G.x, G.y, G.r)
  bg.addColorStop(0, '#2C3F5F'); bg.addColorStop(.6, '#1B2A44'); bg.addColorStop(1, '#0B1422')
  c.fillStyle = bg; c.fillRect(G.x - G.r, G.y - G.r, G.r * 2, G.r * 2)
  // 송풍 기류선 (바닥에서 위로)
  const jet = mode === 'open' ? seg(t, 200, RUN.open) : mode === 'build' ? 1 : mode === 'tension' ? 1 - .7 * cam.tn : .25
  for (let i = 0; i < 18; i++) {
    const x = G.x - 170 + rnd(i + 5) * 340, sp = .5 + rnd(i + 6)
    const y = G.y + G.r - ((mt * .9 * sp + rnd(i + 7) * 600) % 600)
    c.strokeStyle = 'rgba(160,200,255,' + (.18 * jet) + ')'; c.lineWidth = 3 + rnd(i + 8) * 3
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(mt * .003 + i) * 20, y - 60 - rnd(i + 9) * 60); c.stroke()
  }
  // 섞이는 공들
  const M = 16
  for (let i = 0; i < M; i++) {
    const w = (.0021 + rnd(i + 30) * .0026) * (i % 2 ? 1 : -1)
    const an = rnd(i + 31) * 6.28 + mt * w
    const rad = (G.r - 50) * (.25 + .72 * Math.abs(Math.sin(mt * (.0013 + rnd(i + 32) * .0012) + i)))
    // 등장 땐 바닥에 쌓여 있다가 기류를 타고 뜬다
    const settle = 1 - eo(seg(t, 150, RUN.open + 300))
    let bx = G.x + Math.cos(an) * rad, by = G.y + Math.sin(an) * rad
    const px = G.x - 150 + (i % 6) * 60 + (Math.floor(i / 6) % 2) * 30, py = G.y + G.r - 48 - Math.floor(i / 6) * 50
    bx = lerp(bx, px, settle); by = lerp(by, py, settle)
    const v = RUN.min + Math.floor(rnd(i * 7 + Math.floor(mt / 140)) * (RUN.max - RUN.min + 1))
    drawBall(c, bx, by, 34, BALL[i % 5], i % 3 === 0 ? '' : v, mt * .01 * (i % 2 ? 1 : -1) + i, null)
  }
  c.restore()
  // 유리 + 테두리
  c.lineWidth = 14; c.strokeStyle = OR; c.beginPath(); c.arc(G.x, G.y, G.r + 7, 0, Math.PI * 2); c.stroke()
  c.lineWidth = 5; c.strokeStyle = NAVY; c.beginPath(); c.arc(G.x, G.y, G.r + 15, 0, Math.PI * 2); c.stroke()
  c.beginPath(); c.arc(G.x, G.y, G.r, 0, Math.PI * 2); c.stroke()
  c.fillStyle = 'rgba(255,255,255,.75)'; c.save(); c.translate(G.x - 130, G.y - 140); c.rotate(.7); c.beginPath(); c.roundRect(-20, -55, 40, 110, 20); c.fill(); c.restore()
  c.fillStyle = 'rgba(255,255,255,.4)'; c.save(); c.translate(G.x + 160, G.y + 120); c.rotate(.7); c.beginPath(); c.roundRect(-8, -28, 16, 56, 8); c.fill(); c.restore()
  // 배출관 + 레일
  c.fillStyle = 'rgba(200,225,255,.16)'; c.strokeStyle = NAVY; c.lineWidth = 5
  c.beginPath(); c.roundRect(TUBE.x - 50, TUBE.top - 50, 100, G.y - G.r - TUBE.top + 70, 18); c.fill(); c.stroke()
  c.beginPath(); c.roundRect(RAIL.x0, RAIL.y - 54, RAIL.x1 - RAIL.x0, 108, 54); c.fillStyle = 'rgba(10,18,30,.55)'; c.fill(); c.strokeStyle = CR; c.lineWidth = 4; c.stroke()
  c.strokeStyle = OR; c.lineWidth = 6; c.beginPath(); c.moveTo(RAIL.x0 + 40, RAIL.y + 46); c.lineTo(RAIL.x1 - 40, RAIL.y + 46); c.stroke()
  // 빈 슬롯 자리
  for (let i = 0; i < RUN.N; i++) {
    c.strokeStyle = 'rgba(245,243,239,.35)'; c.lineWidth = 3; c.setLineDash([6, 6])
    c.beginPath(); c.arc(slotX(i), RAIL.y, RUN.D / 2 + 2, 0, Math.PI * 2); c.stroke(); c.setLineDash([])
  }
  // 추첨된 공들
  for (let i = 0; i < RUN.N; i++) {
    const b = ballPath(i, t)
    if (!b.vis) continue
    const n = RUN.targets[i], isLast = i === RUN.N - 1
    const d = t - RUN.Ti[i]
    const pop = !isLast && b.shown ? lerp(1.6, 1, eback(seg(d, 0, 260))) : 1
    const glow = b.shown ? (isLast ? YEL : (d < 500 ? YEL : null)) : (isLast && cam.tn > 0 ? 'rgba(255,198,26,' + cam.tn + ')' : null)
    // 작은 공개: 슬롯에서 퍼지는 링
    if (!isLast && d > 0 && d < 500) {
      const rp = seg(d, 0, 500)
      c.strokeStyle = 'rgba(255,198,26,' + (1 - rp) + ')'; c.lineWidth = 6 * (1 - rp) + 1
      c.beginPath(); c.arc(b.x, b.y, RUN.D / 2 + 6 + rp * 60, 0, Math.PI * 2); c.stroke()
    }
    const r = RUN.D / 2 * b.s * pop * (isLast && !b.shown ? 1.15 : 1)
    drawBall(c, b.x, b.y, r, colorOf(n), b.shown ? n : '?', b.spin, glow)
  }
  // 여운: 마지막 공 뒤 회전 후광 (슬롯에 들어간 뒤에도 유지)
  return mode
}

/* ---------- HUD (리그 안) ---------- */
const PH = [['01', '준비'], ['02', '혼합'], ['03', '추첨'], ['04', '공개'], ['05', '결과']]
function hud(c, t, cam, mode) {
  const hp = eo(seg(t, 260, 700))
  if (hp <= 0) return
  c.save(); c.globalAlpha = hp; c.translate(0, (1 - hp) * -30)
  const y = P.y + 30
  // LIVE + 회차 + 타임코드 (로또 생중계의 '중계 장치')
  const on = Math.floor(t / 500) % 2 === 0 || mode === 'tension'
  c.fillStyle = '#e02424'; c.fillRect(P.x + 40, y, 110, 42)
  c.fillStyle = on ? '#fff' : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(P.x + 62, y + 21, 8, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#fff'; c.font = '800 22px ' + FM; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('LIVE', P.x + 78, y + 22)
  c.fillStyle = NAVY; c.fillRect(P.x + 150, y, 330, 42)
  c.fillStyle = CR; c.font = '28px ' + FT; c.fillText('제 ' + RUN.no + '회 번호 추첨', P.x + 168, y + 23)
  const s = Math.floor(t / 1000), fr = Math.floor(t / 1000 * 30) % 30
  c.fillStyle = 'rgba(245,243,239,.85)'; c.font = '700 20px ' + FM
  c.fillText('TC 00:00:' + String(s).padStart(2, '0') + ':' + String(fr).padStart(2, '0') + '   ' + RUN.min + '~' + RUN.max + ' · ' + RUN.N + '개', P.x + 44, y + 66)
  // 단계 칩
  let idx = mode === 'open' ? 0 : mode === 'build' ? 1 : mode === 'tension' ? 2 : (t - RUN.last < 600 ? 3 : 4)
  const pw = 130, gap = 8, sx = P.x + P.w - 40 - (5 * pw + 4 * gap)
  for (let i = 0; i < 5; i++) {
    const x = sx + i * (pw + gap)
    const act = i === idx, done = i < idx
    c.fillStyle = act ? OR : done ? 'rgba(245,243,239,.9)' : 'rgba(10,18,28,.7)'; c.fillRect(x, y, pw, 42)
    if (!act && !done) { c.strokeStyle = 'rgba(245,243,239,.45)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, pw - 2, 40) }
    c.fillStyle = act ? CR : done ? NAVY : 'rgba(245,243,239,.75)'; c.font = '700 20px ' + FK; c.textAlign = 'center'
    c.fillText(PH[i][0] + ' ' + PH[i][1], x + pw / 2, y + 22)
  }
  // 공 카운터
  const got = RUN.Ti.filter(v => t >= v).length
  c.textAlign = 'right'; c.fillStyle = CR; c.font = '800 22px ' + FM
  c.fillText('BALL ' + got + ' / ' + RUN.N, P.x + P.w - 40, y + 66)
  c.restore()
}

/* ---------- 화면 효과 ---------- */
function screenFX(c, t, cam) {
  const { last } = RUN
  // 비네트 (판 안)
  let g = c.createRadialGradient(960, 520, 380, 960, 520, 1000)
  g.addColorStop(0, 'rgba(0,8,16,0)'); g.addColorStop(1, 'rgba(0,8,16,' + (.35 + cam.tn * .3) + ')')
  c.fillStyle = g; c.fillRect(P.x, P.y, P.w, P.h)
  if (t < last && cam.tn > 0) {
    // 긴장: 주황 가장자리 + 배출관 쪽으로 모이는 집중선 + 레터박스
    const tx = cam.sx, ty = cam.sy - 60
    const og = c.createRadialGradient(tx, ty, 220, tx, ty, 1000)
    og.addColorStop(0, 'rgba(255,91,23,0)'); og.addColorStop(1, 'rgba(255,60,10,' + Math.min(.5, cam.tn * .45) + ')')
    c.fillStyle = og; c.fillRect(P.x, P.y, P.w, P.h)
    c.save(); c.translate(tx, ty)
    for (let i = 0; i < 44; i++) {
      const an = rnd(i + 400) * Math.PI * 2, r0 = 240 + rnd(i + 401) * 180 + ((t * .3) % 60), r1 = r0 + 240 + rnd(i + 402) * 400
      c.strokeStyle = 'rgba(245,243,239,' + (cam.tn * .25) + ')'; c.lineWidth = 2 + rnd(i + 403) * 4
      c.beginPath(); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); c.stroke()
    }
    // 대상 조준 링
    const rr = 92 + Math.sin(t * .012) * 6
    c.strokeStyle = 'rgba(255,198,26,' + (.5 + cam.tn * .5) + ')'; c.lineWidth = 5
    for (let q = 0; q < 4; q++) { c.beginPath(); c.arc(0, 60, rr, q * Math.PI / 2 + .25, q * Math.PI / 2 + Math.PI / 2 - .25); c.stroke() }
    c.restore()
  }
  const lbIn = eo(seg(t, RUN.Ts, RUN.Ts + 400)), lbOut = 1 - seg(t, last + 80, last + 300)
  const hb = 80 * lbIn * lbOut
  if (hb > 0) { c.fillStyle = '#04070c'; c.fillRect(P.x, P.y, P.w, hb); c.fillRect(P.x, P.y + P.h - hb, P.w, hb) }
  // 공개 섬광 (판 안) + 방사 스타버스트
  if (t >= last) {
    const a = t - last
    if (a < 420) { c.fillStyle = 'rgba(255,250,240,' + (.9 * Math.pow(1 - seg(a, 0, 420), 2)) + ')'; c.fillRect(P.x, P.y, P.w, P.h) }
    if (a < 560) {
      c.save(); c.translate(SL.x, SL.y)
      const ra = Math.pow(1 - seg(a, 0, 560), 1.4)
      for (let i = 0; i < 40; i++) {
        const an = i / 40 * Math.PI * 2 + rnd(i) * .1, r0 = 120, r1 = 1300
        c.fillStyle = i % 2 ? 'rgba(255,91,23,' + ra * .85 + ')' : 'rgba(23,36,55,' + ra * .75 + ')'
        c.beginPath(); c.moveTo(Math.cos(an - .02) * r0, Math.sin(an - .02) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); c.lineTo(Math.cos(an + .03) * r0, Math.sin(an + .03) * r0); c.fill()
      }
      c.restore()
    }
  }
  // 필름 그레인
  const k = Math.floor(t / 42)
  for (let i = 0; i < 180; i++) { c.fillStyle = rnd(k * 31 + i) > .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'; c.fillRect(P.x + rnd(k * 17 + i) * P.w, P.y + rnd(k * 13 + i + 5) * P.h, 2, 2) }
}
// 공개 타이포 위치 (화면 좌표 — 줌된 공 옆)
const SL = { x: 820, y: 430 }
function slam(c, t) {
  const a = t - RUN.last
  if (a < 80 || a > 2200) return
  const n = String(RUN.targets[RUN.N - 1])
  const p = seg(a, 80, 300), s = lerp(1.9, 1, eback(p)) * (1 + seg(a, 300, 2200) * .06), fade = 1 - seg(a, 1500, 2200)
  c.save(); c.globalAlpha = fade * Math.min(1, p * 4); c.translate(SL.x, SL.y); c.rotate(lerp(-.105, -.04, eo(p))); c.scale(s, s)
  c.save(); c.rotate(t * .0008)
  c.fillStyle = YEL; c.beginPath()
  for (let i = 0; i < 32; i++) { const rr = i % 2 ? 150 : 230 + rnd(i) * 50, an = i / 32 * Math.PI * 2; i ? c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr) }
  c.closePath(); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 8; c.stroke(); c.restore()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  fitFont(c, n, 240, 360, FT)
  outlined(c, n, 0, 6, CR, NAVY, 22, OR, 9)
  const lab = RUN.N > 1 ? 'LAST BALL!' : 'LUCKY BALL!'
  c.font = '800 30px ' + FM
  c.fillStyle = NAVY; c.beginPath(); c.roundRect(-lab.length * 10.5 - 26, 125, lab.length * 21 + 52, 50, 8); c.fill()
  c.fillStyle = YEL; c.fillText(lab, 0, 151)
  c.restore()
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

/* ---------- 등장 타이틀 — '추첨 시작!' 이 사선 리본 위로 꽂혔다가 오른쪽으로 빠짐 (리그 밖) ---------- */
function openTitle(c, t) {
  const end = Math.max(900, Math.min(1300, RUN.Ti[0] - 80))
  if (t < 40 || t > end) return
  const ip = seg(t, 40, 280), op = seg(t, end - 260, end)
  const x = 1290 + eio(op) * 1100, y = 600
  c.save(); c.globalAlpha = 1 - op * .6
  const rw = eo(seg(t, 40, 240))
  c.save(); c.translate(x, y); c.rotate(-.06); c.transform(1, 0, -.25, 1, 0, 0)
  c.fillStyle = OR; c.fillRect(-400 * rw, -74, 800 * rw, 148)
  c.fillStyle = NAVY; c.fillRect(-400 * rw, 58, 800 * rw, 16)
  c.restore()
  if (ip < 1 || op > 0) {
    const k = ip < 1 ? 1 - ip : op
    c.fillStyle = 'rgba(245,243,239,' + .55 * k + ')'
    for (let i = 0; i < 8; i++) c.fillRect(x + (op > 0 ? -900 : 300) + rnd(i + 20) * 300, y - 66 + i * 17, 260 + rnd(i + 21) * 380, 5)
  }
  if (t >= 60) {
    const s = lerp(1.9, 1, eback(ip))
    c.translate(x, y); c.rotate(lerp(-.105, -.06, eo(ip))); c.scale(s, s)
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '112px ' + FT
    outlined(c, '추첨 시작!', 0, 4, CR, NAVY, 12, NAVY, 8)
    c.font = '800 24px ' + FM; c.fillStyle = CR
    c.fillText(RUN.min + ' ~ ' + RUN.max + '  ·  ' + RUN.N + ' BALL' + (RUN.N > 1 ? 'S' : ''), 0, 92)
  }
  c.restore()
}

/* ---------- 결과 카드 (리그 밖, 사선) ---------- */
function resultCard(c, t) {
  const a = t - RUN.last, base = 520
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
  c.fillStyle = OR; c.font = '60px ' + FT; c.fillText('JACKPOT!', x0 + 48, y0 + 49)
  c.fillStyle = 'rgba(245,243,239,.75)'; c.font = '700 20px ' + FM; c.fillText('추첨 기록 #' + RUN.no, x0 + 380, y0 + 50)
  // 1) 이름 = 당첨 번호
  const np = seg(a, base + 300, base + 540), ns = lerp(1.9, 1, eback(np))
  if (np > 0) {
    c.globalAlpha = Math.min(1, np * 3)
    c.fillStyle = 'rgba(23,36,55,.6)'; c.font = '700 26px ' + FK; c.fillText('당첨 번호', x0 + 52, y0 + 126)
    // 5개 이상이면 두 줄로 (글자가 너무 작아지지 않게)
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
    c.save(); c.translate(x0 + 52, y0 + 434); c.scale(gs, gs); c.globalAlpha = Math.min(1, gp * 2)
    c.fillStyle = OR; c.beginPath(); c.roundRect(0, -30, 380, 60, 30); c.fill()
    balloonIcon(c, 32, 0, 21)
    c.fillStyle = CR; fitFont(c, label, 36, 300, FK, 900); c.fillText(label, 66, 2)
    c.restore()
  }
  // 2) 도장
  const bp = seg(a, base + 520, base + 760)
  if (bp > 0) {
    const bs = lerp(3, 1, eback(bp)), big = RUN.N >= 3 || RUN.targets.some(n => n === RUN.max), col = big ? OR : MINT
    c.save(); c.translate(x0 + w - 80, y0 + 180); c.rotate(-.2); c.scale(bs, bs); c.globalAlpha = Math.min(1, bp * 2.5)
    if (bp < 1) { c.strokeStyle = col; c.lineWidth = 6; for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(an) * 112, Math.sin(an) * 112); c.lineTo(Math.cos(an) * (130 + bp * 60), Math.sin(an) * (130 + bp * 60)); c.stroke() } }
    c.fillStyle = NAVY; c.beginPath(); c.arc(6, 8, 96, 0, Math.PI * 2); c.fill()
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 96, 0, Math.PI * 2); c.fill()
    c.strokeStyle = CR; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 82, 0, Math.PI * 2); c.stroke()
    c.textAlign = 'center'; c.fillStyle = CR; c.font = '62px ' + FT; c.fillText(big ? '대박' : '당첨', 0, -6)
    c.font = '800 17px ' + FM; c.fillText(RUN.N + ' BALL' + (RUN.N > 1 ? 'S' : ''), 0, 46)
    c.restore()
  }
  c.restore()
}

/* ---------- 효과음 박자 ---------- */
function cue(k, fn) { if (cues[k]) return; cues[k] = 1; try { fn() } catch (e) {} }
function sounds(t) {
  const { open, Ts, last, Ti, rise } = RUN
  cue('open', () => FX.sound('whoosh'))
  if (t > 420) cue('land', () => FX.sound('pop'))
  if (t > open && t < Ts) cue('spin', () => FX.spinStart())
  for (let i = 0; i < RUN.N - 1; i++) {
    if (t > Ti[i] - rise[i]) cue('rise' + i, () => FX.sound('flip'))
    if (t > Ti[i]) cue('ball' + i, () => { FX.sound('pop'); FX.sound('tick') })
  }
  if (t > Ts) cue('tension', () => { FX.spinStop(); FX.drumStart(150) })
  if (t > last) cue('impact', () => { FX.drumStop(); FX.sound('stop'); FX.flash('rgba(255,255,255,.95)') })
  if (t > last + 520) cue('card', () => FX.sound('reveal'))
  if (t > last + 820) cue('name', () => {
    FX.sound('win')
    if (RUN.N >= 3 || RUN.targets.some(n => n === RUN.max)) FX.confetti({ count: 180, x: SL.x, y: SL.y })
  })
  if (t > last + 1040) cue('stamp', () => FX.sound('stop'))
  if (t > last + 1700) cue('banner', () => FX.winner({ nick: RUN.nick, sub: '숫자 추첨 · ' + RUN.targets.join(', '), ms: 3600 }))
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
  // 판 바탕: 스튜디오 배경 (사선 조명 + 격자)
  const bg = X.createLinearGradient(0, P.y, 0, P.y + P.h); bg.addColorStop(0, '#13223a'); bg.addColorStop(1, '#070d18')
  X.fillStyle = bg; X.fillRect(P.x, P.y, P.w, P.h)
  X.save()
  X.translate(cam.sx, cam.sy); X.rotate(cam.r); X.scale(cam.z, cam.z); X.translate(-cam.fx, -cam.fy)
  X.strokeStyle = 'rgba(120,160,230,.07)'; X.lineWidth = 2
  for (let gx = -400; gx <= 2400; gx += 80) { X.beginPath(); X.moveTo(gx, -400); X.lineTo(gx, 1500); X.stroke() }
  for (let gy = -400; gy <= 1500; gy += 80) { X.beginPath(); X.moveTo(-400, gy); X.lineTo(2400, gy); X.stroke() }
  // 여운: 회전 후광 (구체 뒤)
  if (t > RUN.last + 80) {
    const ha = eo(seg(t, RUN.last + 80, RUN.last + 600)), amb = RUN.last + (t - RUN.last) * .25
    X.save(); X.translate(G.x, G.y - 120); X.rotate(amb * .0012); X.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 18; i++) {
      const an = i / 18 * Math.PI * 2
      const gr = X.createRadialGradient(0, 0, 0, 0, 0, 900); gr.addColorStop(0, 'rgba(255,200,80,' + (.42 * ha) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)')
      X.fillStyle = gr; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 900, an - .07, an + .07); X.closePath(); X.fill()
    }
    X.restore()
  }
  const mode = drawMachine(X, wt, cam)
  X.restore()
  screenFX(X, t, cam)
  X.restore()
  panelFrame(X, py, ph)
  if (rv >= 1) { hud(X, wt, cam, mode); slam(X, t); resultCard(X, t) }
  openTitle(X, t)
  X.restore()
}
function loop(now) {
  if (RUN) {
    const t = now - RUN.t0
    try { sounds(t); render(t) } catch (err) { console.warn(err) }
    if (t > RUN.end + 500) stop()
  }
  requestAnimationFrame(loop)
}
function stop() {
  RUN = null
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H)
  FX.drumStop(); FX.spinStop(); FX.hideWinner()
}
function start(ns) {
  // 진행 중이면 끊고 새 판 (엔진은 spinMs 뒤에 결과를 확정하므로 연출도 그 안에 공개)
  FX.drumStop(); FX.spinStop(); FX.hideWinner()
  cues = {}
  RUN = plan(ns)
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
