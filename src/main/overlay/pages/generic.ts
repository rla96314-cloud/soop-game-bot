// OBS 오버레이 페이지: generic (HTML 템플릿 문자열)
// 경주 / 가위바위보 / 낚시 등 전용 페이지가 없는 게임의 공용 결과 카드
export const OVERLAY_HTML = (gameId: string, theme: string, port: number) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: transparent;
    font-family: 'Noto Sans KR', sans-serif;
    overflow: hidden;
  }
  :root {
    --navy: #172437; --navy-deep: #111a2b; --navy-light: #1e2f4a;
    --orange: #FF5B17; --cream: #F5F3EF; --mint: #00CB84; --gold: #FFC83D;
    --accent: #FF8A3D;
  }
  #overlay {
    position: fixed; bottom: 40px; right: 40px;
    transform: translateY(120px);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
    border-radius: 18px;
    filter: drop-shadow(0 14px 30px rgba(0,0,0,0.45));
  }
  #overlay.show { transform: translateY(0); opacity: 1; }

  /* 게임별 라벨 색 */
  #overlay.g-race { --accent: #7DA4FF; }
  #overlay.g-rps  { --accent: #FF8A3D; }
  #overlay.g-fish { --accent: #FF8A3D; }

  .card {
    position: relative;
    min-width: 300px; max-width: 420px;
    background:
      radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.05), transparent 60%),
      linear-gradient(165deg, var(--navy-light) 0%, var(--navy) 55%, var(--navy-deep) 100%);
    border: 2.5px solid var(--orange);
    border-radius: 16px;
    padding: 15px 22px 14px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
    overflow: hidden;
  }
  /* 은은한 사선 텍스처 */
  .card::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 9px);
    mix-blend-mode: screen;
  }
  .card > * { position: relative; }

  .game-label {
    font-size: 14px; font-weight: 800; letter-spacing: 0.02em;
    color: var(--accent);
    margin-bottom: 3px;
  }
  .result-text {
    font-size: 28px; font-weight: 900; color: #fff;
    letter-spacing: -0.02em; line-height: 1.2;
    margin-bottom: 6px;
    text-shadow: 0 2px 0 rgba(0,0,0,0.25);
  }
  .detail-text {
    font-size: 13.5px; font-weight: 500; color: #D8DEE9;
    line-height: 1.35;
  }
  .trigger-row {
    display: flex; align-items: center; gap: 9px;
    margin-top: 11px; padding-top: 10px;
    border-top: 1px solid rgba(245,243,239,0.18);
  }
  .trigger-row:empty { display: none; }
  .trigger-user { font-size: 13px; font-weight: 700; color: var(--cream); }
  .trigger-balloon { font-size: 14px; font-weight: 900; color: var(--gold); }

  /* 가위바위보: 전구 마키 프레임 */
  #overlay.marquee {
    padding: 13px;
    border: 3px solid var(--navy);
    border-radius: 24px;
    background-color: var(--orange);
    background-image:
      radial-gradient(circle, #FFE7B8 3.2px, rgba(255,231,184,0) 3.9px),
      radial-gradient(circle, #FFE7B8 3.2px, rgba(255,231,184,0) 3.9px),
      radial-gradient(circle, #FFE7B8 3.2px, rgba(255,231,184,0) 3.9px),
      radial-gradient(circle, #FFE7B8 3.2px, rgba(255,231,184,0) 3.9px);
    background-size: 26px 13px, 26px 13px, 13px 26px, 13px 26px;
    background-position: 0 0, 0 100%, 0 0, 100% 0;
    background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
    animation: marquee-blink 1.1s steps(2) infinite;
  }
  @keyframes marquee-blink {
    0%   { background-position: 0 0, 0 100%, 0 0, 100% 0; }
    100% { background-position: 13px 0, 13px 100%, 0 13px, 100% 13px; }
  }
  #overlay.marquee .card {
    border: 2px solid var(--cream);
    border-radius: 12px;
  }

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
<div id="overlay" class="g-${gameId}">
  <div class="card">
    <div class="game-label" id="game-label">SOOP GAME BOT</div>
    <div class="result-text" id="result-text">대기 중...</div>
    <div class="detail-text" id="detail-text"></div>
    <div class="trigger-row">
      <span class="trigger-user" id="trigger-user"></span>
      <span class="trigger-balloon" id="trigger-balloon"></span>
    </div>
  </div>
</div>
<script>
  const GAME_NAMES = {
    roulette:'룰렛', ladder:'사다리타기',
    quiz:'퀴즈', slot:'슬롯머신', race:'경주', rps:'가위바위보',
    fish:'낚시', lottery:'복권', number:'숫자 추첨'
  }
  const MARQUEE_GAMES = ['rps']

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

    // 게임별 스킨(라벨 색 / 마키 프레임)
    overlay.className = 'g-' + (data.gameId || '${gameId}') + (MARQUEE_GAMES.includes(data.gameId) ? ' marquee' : '')
    overlay.classList.add('show')
    if (data.result.includes('클리어') || data.result.includes('JACKPOT') || data.result.includes('레전드')) {
      launchConfetti()
    }

    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => overlay.classList.remove('show'), 6000)
  }

  function launchConfetti() {
    const colors = ['#FF5B17','#FFC83D','#00CB84','#F5F3EF','#7DA4FF','#FF4FA3']
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
    ws.onopen  = () => { if (window.__wsDown) location.reload() }  // 서버 재시작(앱 업데이트) → 새 코드 로드
  ws.onclose = () => { window.__wsDown = true; setTimeout(connect, 2000) }
  }
  connect()
<\/script>
</body>
</html>`
