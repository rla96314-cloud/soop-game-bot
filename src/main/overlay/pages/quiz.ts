// OBS 오버레이 페이지: quiz (HTML 템플릿 문자열)
import { FX_SCRIPT } from './_fx'
export const QUIZ_OVERLAY_HTML = (port: number) => `<!DOCTYPE html>
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
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent !important; overflow: hidden; font-family: 'Noto Sans KR', sans-serif; }

  /* ── 바깥 오렌지 프레임 (네이비 외곽선 + 크림 전구 점) ── */
  .quiz-box {
    position: fixed;
    bottom: 80px; left: 50%;
    transform: translateX(-50%) translateY(160px);
    width: 840px;
    background: var(--orange);
    border: 4px solid var(--navy);
    border-radius: 28px;
    padding: 26px;
    box-shadow: 0 18px 50px rgba(23,36,55,0.45), inset 0 0 0 3px rgba(255,255,255,0.18);
    opacity: 0;
    transition: transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
  }
  .quiz-box.show { transform: translateX(-50%) translateY(0); opacity: 1; }

  .qz-dots { position: absolute; pointer-events: none; }
  .qz-dots.top, .qz-dots.bottom {
    left: 18px; right: 18px; height: 16px;
    background: radial-gradient(circle at center, var(--cream) 5px, rgba(245,243,239,0) 5.8px) center / 34px 16px repeat-x;
  }
  .qz-dots.top    { top: 5px; }
  .qz-dots.bottom { bottom: 5px; }
  .qz-dots.left, .qz-dots.right {
    top: 18px; bottom: 18px; width: 16px;
    background: radial-gradient(circle at center, var(--cream) 5px, rgba(245,243,239,0) 5.8px) center / 16px 34px repeat-y;
  }
  .qz-dots.left  { left: 5px; }
  .qz-dots.right { right: 5px; }

  /* ── 안쪽 보드 (출제중: 크림 / 결과: 네이비) ── */
  .quiz-inner {
    position: relative;
    background: var(--cream);
    border: 3px solid var(--navy);
    border-radius: 18px;
    padding: 18px 26px 20px;
    transition: background 0.4s ease;
  }
  .quiz-box.result .quiz-inner { background: var(--navy); }

  /* 태그 — 출제중: 오렌지 알약 / 결과: 크림 알약이 프레임 위로 걸침 */
  .quiz-tag {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 15px; font-weight: 900; letter-spacing: 0.02em;
    color: var(--cream); background: var(--orange);
    border: 3px solid var(--navy); border-radius: 999px;
    padding: 3px 14px 4px; margin-bottom: 10px; line-height: 1.2;
    transition: background 0.3s, color 0.3s;
  }
  .quiz-tag .q-mark {
    display: inline-block; font-size: 15px; font-weight: 900;
    color: var(--cream); line-height: 1;
  }
  .quiz-box.result .quiz-tag {
    position: absolute; top: -40px; left: 6px; z-index: 2;
    background: var(--cream); color: var(--orange);
    box-shadow: 0 3px 0 rgba(23,36,55,0.35);
  }
  .quiz-box.result .quiz-tag .q-mark { color: var(--orange); }
  /* 문제 등장 시 보드가 올라온 뒤 태그가 톡 내려앉음 */
  .quiz-tag.land { animation: tagLand 0.45s cubic-bezier(0.2,1.5,0.4,1) 0.3s both; }
  @keyframes tagLand {
    0%   { transform: translateY(-16px) scale(0.6); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  /* 시간 초과 → 보드 한 번 흔들림 */
  .quiz-inner.shake { animation: qzShake 0.5s ease; }
  @keyframes qzShake {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-14px); }
    30% { transform: translateX(11px); }
    45% { transform: translateX(-8px); }
    60% { transform: translateX(6px); }
    75% { transform: translateX(-3px); }
  }

  .quiz-q {
    font-size: 34px; font-weight: 900; color: var(--navy);
    line-height: 1.25; margin-bottom: 14px; letter-spacing: -0.02em;
    word-break: keep-all; overflow-wrap: anywhere;
    transition: color 0.3s;
  }
  .quiz-box.result .quiz-q { color: #fff; }

  /* ── 타이머 ── */
  .timer-row { display: flex; align-items: center; gap: 12px; }
  .timer-bar {
    flex: 1; height: 30px;
    background: var(--navy);
    border: 3px solid var(--navy);
    border-radius: 999px; overflow: hidden;
    box-shadow: 0 3px 0 rgba(23,36,55,0.3);
  }
  .timer-fill {
    height: 100%; border-radius: 999px;
    background-color: var(--mint);
    background-image:
      linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%),
      repeating-linear-gradient(-55deg, rgba(23,36,55,0.16) 0 8px, rgba(23,36,55,0) 8px 20px);
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.35);
    transition: width 0.9s linear, background-color 0.5s;
  }
  .timer-num {
    font-size: 24px; font-weight: 900; color: var(--cream);
    background: var(--navy); border-radius: 14px;
    min-width: 64px; height: 42px; padding: 0 12px;
    display: flex; align-items: center; justify-content: center;
    line-height: 1; letter-spacing: 0.02em;
    box-shadow: 0 3px 0 rgba(23,36,55,0.3);
    transition: background 0.3s;
  }
  /* 마지막 5초: 초 배지가 오렌지로 바뀌고 매초 펄스 */
  .timer-num.urgent { background: var(--orange); }
  .timer-num.pulse  { animation: numPulse 0.55s cubic-bezier(0.2,1.4,0.4,1); }
  @keyframes numPulse {
    0%   { transform: scale(1.4); box-shadow: 0 3px 0 rgba(23,36,55,0.3), 0 0 0 0 rgba(255,91,23,0.75); }
    100% { transform: scale(1);   box-shadow: 0 3px 0 rgba(23,36,55,0.3), 0 0 0 18px rgba(255,91,23,0); }
  }

  /* ── 결과 ── */
  .result-row {
    margin-top: 12px; padding-top: 14px;
    border-top: 2px solid rgba(255,255,255,0.18);
    font-size: 32px; font-weight: 900; color: #fff;
    display: none; align-items: center; gap: 12px;
    line-height: 1.2;
  }
  .result-row.visible { display: flex; }
  .result-icon { font-size: 32px; line-height: 1; }
  .result-win  { color: var(--mint); text-shadow: 0 0 18px rgba(0,203,132,0.45); }
  .result-fail { color: var(--orange); text-shadow: 0 0 18px rgba(255,91,23,0.45); }
  .result-spark { width: 34px; height: 34px; flex: none; margin-left: -2px; }
  .result-spark line { stroke: #FFB020; stroke-width: 4; stroke-linecap: round; }
  .result-row.fail .result-spark line { stroke: var(--orange); }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0; }
    60%  { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  .result-row.visible { animation: pop 0.4s ease; }
  @keyframes popWin {
    0%   { transform: scale(0.4); opacity: 0; }
    55%  { transform: scale(1.14); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .result-row.visible.win { animation: popWin 0.55s cubic-bezier(0.2,1.4,0.4,1); }
</style>
</head>
<body>
<div class="quiz-box" id="box">
  <div class="qz-dots top"></div>
  <div class="qz-dots bottom"></div>
  <div class="qz-dots left"></div>
  <div class="qz-dots right"></div>
  <div class="quiz-inner">
    <div class="quiz-tag"><span class="q-mark">?</span><span>퀴즈 도전!</span></div>
    <div class="quiz-q" id="q-text">문제를 불러오는 중...</div>
    <div class="timer-row" id="timer-row">
      <div class="timer-bar"><div class="timer-fill" id="t-fill" style="width:100%"></div></div>
      <div class="timer-num" id="t-num">--</div>
    </div>
    <div class="result-row" id="result-row">
      <span class="result-icon" id="result-icon"></span>
      <span id="result-text"></span>
      <svg class="result-spark" viewBox="0 0 24 24" fill="none">
        <line x1="4" y1="12" x2="12" y2="12"/>
        <line x1="6" y1="4" x2="13" y2="8"/>
        <line x1="6" y1="20" x2="13" y2="16"/>
      </svg>
    </div>
  </div>
</div>
<script>${FX_SCRIPT}</script>
<script>
  const box      = document.getElementById('box')
  const inner    = box.querySelector('.quiz-inner')
  const tag      = box.querySelector('.quiz-tag')
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
  let popTimer = null
  let lastTickSec = -1      // 마지막 5초 카운트 효과음 — 초당 1회
  let buzzed = false        // 0초 부저 — 마감당 1회 (타이머 도달/시간초과 결과 중 먼저 온 쪽)
  let curKey = ''           // 현재 문제 식별 (문제+마감) — 상태 재전송 시 등장 연출 반복 방지
  let resKey = ''           // 결과 식별 — 결과 재전송 시 연출 반복 방지

  function show() { box.classList.add('show') }
  function hide() { box.classList.remove('show'); FX.hideWinner() }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls) }

  function startTimer(dl, limit) {
    if (dl !== deadline) { lastTickSec = -1; buzzed = false; tNum.classList.remove('urgent', 'pulse') }
    deadline = dl; totalSec = limit
    if (ticker) clearInterval(ticker)
    timerRow.style.display = ''
    resultRow.classList.remove('visible', 'win')
    box.classList.remove('result')

    const tick = () => {
      const left = Math.max(0, (deadline - Date.now()) / 1000)
      const sec = Math.ceil(left)
      tNum.textContent = sec
      tFill.style.width = (left / totalSec * 100) + '%'
      tFill.style.backgroundColor = left > totalSec * 0.35 ? '#00CB84' : '#FF5B17'
      if (left > 0 && sec <= 5) {
        tNum.classList.add('urgent')
        if (sec !== lastTickSec) { lastTickSec = sec; FX.sound('timer'); restart(tNum, 'pulse') }
      }
      if (left <= 0) {
        clearInterval(ticker); ticker = null
        if (!buzzed) { buzzed = true; FX.sound('buzzer'); restart(tNum, 'pulse') }
      }
    }
    tick()
    ticker = setInterval(tick, 200)
  }

  // 문제 등장: 휙(whoosh) + 보드 슬라이드업 + 태그 착지 팝
  function questionIntro() {
    FX.hideWinner()
    FX.sound('whoosh')
    restart(tag, 'land')
    if (popTimer) clearTimeout(popTimer)
    popTimer = setTimeout(() => FX.sound('pop'), 520)
  }

  function showResult(text, isWin) {
    if (ticker) { clearInterval(ticker); ticker = null }
    if (popTimer) { clearTimeout(popTimer); popTimer = null }
    timerRow.style.display = 'none'
    tag.classList.remove('land')
    resIcon.textContent  = isWin ? '🎉' : '⏰'
    resText.textContent  = text
    resText.className    = isWin ? 'result-win' : 'result-fail'
    resultRow.classList.toggle('fail', !isWin)
    resultRow.classList.toggle('win', isWin)
    resultRow.classList.add('visible')
    box.classList.add('result')
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(hide, 7000)
  }

  // 결과 연출 — 정답: 팡파르+플래시+색종이+당첨자 배너 / 시간초과: 부저+흔들림
  function resultFx(result, isWin) {
    if (isWin) {
      const nick = String(result.result || '').replace(/\\s*정답!?\\s*$/, '').trim() || result.triggeredBy || ''
      FX.sound('win')
      FX.flash('rgba(0,203,132,.5)')
      const r = box.getBoundingClientRect()
      FX.confetti({ x: r.left + r.width / 2, y: r.top, count: 140 })
      FX.winner({ nick, sub: '퀴즈 정답', anchor: box, above: true })
    } else {
      if (!buzzed) { buzzed = true; FX.sound('buzzer') }
      restart(inner, 'shake')
    }
  }

  function connect() {
    const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        FX.handle(msg)

        if (msg.type === 'game:state' && msg.data?.id === 'quiz') {
          const s = msg.data
          if (s.status === 'collecting' && s.quiz) {
            const key = s.quiz.question + '|' + s.quiz.deadline
            const fresh = key !== curKey || !box.classList.contains('show')
            curKey = key; resKey = ''
            qText.textContent = s.quiz.question
            if (fresh) questionIntro()
            const limitSec = Math.max(1, Math.round((s.quiz.deadline - Date.now()) / 1000))
            startTimer(s.quiz.deadline, limitSec)
            show()
          } else if (s.status === 'showing_result' && s.result) {
            const isWin = !s.result.result.includes('시간 초과')
            showResult(s.result.result, isWin)
            const key = s.result.ts + '|' + s.result.result
            if (key !== resKey) { resKey = key; resultFx(s.result, isWin) }
          } else if (s.status === 'idle') {
            if (!resultRow.classList.contains('visible')) hide()
          }
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

// ── Ladder overlay ────────────────────────────────────────────────────────────
