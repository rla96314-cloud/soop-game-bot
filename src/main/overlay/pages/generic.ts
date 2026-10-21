// OBS 오버레이 페이지: generic (HTML 템플릿 문자열)
// 경주 / 가위바위보 / 낚시 등 전용 페이지가 없는 게임의 공용 결과 카드
// 엔진은 race/rps/fish 에 대해 game:result 만 보내므로(진행 상태 세부 없음), 카드가 스스로 2초짜리 티저를 만든 뒤 결과를 공개한다.
import { FX_SCRIPT } from './_fx'

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
  #overlay.shake { animation: card-shake .5s ease-in-out; }
  @keyframes card-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px) rotate(-.6deg); }
    40% { transform: translateX(5px) rotate(.5deg); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(3px); }
  }

  /* 게임별 라벨 색 */
  #overlay.g-race { --accent: #7DA4FF; }
  #overlay.g-rps  { --accent: #FF8A3D; }
  #overlay.g-fish { --accent: #7DA4FF; }

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
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .game-label .live {
    font-size: 11px; font-weight: 900; color: #fff; letter-spacing: .08em;
    padding: 2px 8px; border-radius: 999px; background: var(--orange);
    animation: live-blink 1s steps(2) infinite;
  }
  #overlay:not(.teasing) .game-label .live { display: none; }
  @keyframes live-blink { 50% { opacity: .35; } }

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

  /* 티저 중엔 결과 영역 숨김, 공개 시 팝인 */
  #overlay.teasing .result-wrap { display: none; }
  #overlay.revealed .result-wrap { animation: pop-in .45s cubic-bezier(.2,1.4,.3,1) both; }
  @keyframes pop-in { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  /* 무대(티저) 영역: race/rps/fish 에서만 표시 */
  .stage { display: none; margin: 4px 0 8px; }
  #overlay.has-stage .stage { display: block; }
  #overlay.has-stage .card { width: 404px; }

  /* ── 경주 트랙 ── */
  .track {
    position: relative; width: 356px; padding: 4px 0;
    background: rgba(0,0,0,.28); border-radius: 10px; overflow: hidden;
  }
  .track::after {
    content: ''; position: absolute; right: 12px; top: 0; bottom: 0; width: 8px; opacity: .9;
    background: repeating-conic-gradient(#fff 0 25%, #222 0 50%) 0 0 / 8px 8px;
  }
  .lane { position: relative; height: 26px; border-bottom: 1px dashed rgba(255,255,255,.12); }
  .lane:last-child { border-bottom: none; }
  .lane .num { position: absolute; left: 6px; top: 5px; font-size: 10px; font-weight: 800; color: rgba(255,255,255,.35); }
  .lane .runner {
    position: absolute; left: 20px; top: 1px; font-size: 20px; line-height: 24px;
    transition: transform var(--dur, 2.5s) cubic-bezier(.3,.08,.35,1); will-change: transform;
  }
  .lane .runner span { display: inline-block; animation: gallop .22s ease-in-out infinite alternate; }
  @keyframes gallop { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-3px) rotate(3deg); } }
  .track.done .lane .runner span { animation: none; }
  .track.done .lane:not(.win) { opacity: .35; }
  .track.done .lane.win .runner span { transform: scale(1.35); filter: drop-shadow(0 0 8px var(--gold)); }
  .track.done .lane.win { background: linear-gradient(90deg, transparent, rgba(255,200,61,.22)); }

  /* ── 가위바위보 무대 ── */
  .arena {
    width: 356px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px;
    padding: 6px 0 2px;
  }
  .side { text-align: center; transition: opacity .3s, filter .3s; }
  .side .who { font-size: 12px; font-weight: 800; color: #c9d1de; letter-spacing: .04em; }
  .side .hand {
    font-size: 54px; line-height: 1.1; height: 68px; display: flex; align-items: center; justify-content: center;
    transform: scale(0); opacity: 0;
  }
  .side.pump .hand { opacity: .8; animation: pump .4s ease-in-out infinite; }
  @keyframes pump { 0%, 100% { transform: scale(.85) translateY(0); } 50% { transform: scale(.95) translateY(-10px); } }
  .side.slam .hand { animation: slam .4s cubic-bezier(.2,1.4,.3,1) forwards; }
  @keyframes slam {
    0%   { transform: scale(2.6) rotate(-25deg); opacity: 0; }
    55%  { transform: scale(.88) rotate(4deg); opacity: 1; }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }
  .arena.done .side.lost { opacity: .4; filter: grayscale(.6); }
  .arena.done .side.won .hand { filter: drop-shadow(0 0 10px var(--gold)); }
  .arena.done .side.won .who { color: var(--gold); }
  .count {
    min-width: 72px; text-align: center; font-size: 30px; font-weight: 900; color: var(--gold);
    text-shadow: 0 2px 0 rgba(0,0,0,.3);
  }
  .count.beat { animation: beat .38s cubic-bezier(.2,1.2,.3,1) both; }
  @keyframes beat { from { transform: scale(1.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .count.vs { font-size: 22px; color: #c9d1de; }

  /* ── 낚시 연못 ── */
  .pond {
    position: relative; width: 356px; height: 124px; border-radius: 10px; overflow: hidden;
    background: linear-gradient(180deg, rgba(125,164,255,0) 0 48%, rgba(46,123,255,.35) 48%, rgba(20,60,140,.7) 100%);
    transition: background .4s;
  }
  .pond.legend { background: linear-gradient(180deg, rgba(255,200,61,0) 0 48%, rgba(255,200,61,.35) 48%, rgba(160,100,10,.7) 100%); }
  .pond .water { position: absolute; left: 0; right: 0; top: 59px; height: 2px; background: rgba(255,255,255,.5); }
  .pond .line  { position: absolute; left: 50%; top: 0; width: 2px; height: 42px; background: rgba(255,255,255,.55); transition: transform .18s ease-in; transform-origin: top; }
  .pond .bobber {
    position: absolute; left: 50%; top: 40px; width: 16px; height: 22px; margin-left: -8px; border-radius: 50%;
    background: linear-gradient(#ff4b4b 50%, #fff 50%); box-shadow: 0 2px 4px rgba(0,0,0,.4);
    transition: transform .18s ease-in, opacity .2s;
    animation: bob 1.6s ease-in-out infinite;
  }
  @keyframes bob { 0%, 100% { margin-top: 0; } 50% { margin-top: 3px; } }
  .pond .bobber.dip { transform: translateY(12px); }
  .pond .line.dip   { transform: scaleY(1.28); }
  .pond.jumped .bobber, .pond.jumped .line { opacity: 0; }
  .ripple {
    position: absolute; left: 50%; top: 60px; width: 24px; height: 10px; margin: -5px 0 0 -12px;
    border: 2px solid rgba(255,255,255,.65); border-radius: 50%; pointer-events: none;
    animation: ripple .8s ease-out forwards;
  }
  @keyframes ripple { to { transform: scale(6); opacity: 0; } }
  .fishjump {
    position: absolute; left: 50%; top: 52px; font-size: 56px; line-height: 1;
    transform: translate(-50%, 24px) scale(0); opacity: 0;
  }
  .fishjump.show { animation: fishjump .65s cubic-bezier(.2,1.2,.3,1) forwards; }
  @keyframes fishjump {
    0%   { transform: translate(-50%, 36px) scale(.2) rotate(35deg); opacity: 0; }
    60%  { transform: translate(-50%, -34px) scale(1.3) rotate(-12deg); opacity: 1; }
    100% { transform: translate(-50%, -26px) scale(1.05) rotate(0); opacity: 1; }
  }
  .drop {
    position: absolute; left: 50%; top: 58px; width: 6px; height: 6px; border-radius: 50%;
    background: rgba(200,225,255,.9); pointer-events: none; animation: drop .7s ease-out forwards;
  }
  @keyframes drop { to { transform: translate(var(--dx), 70px); opacity: 0; } }

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
</style>
</head>
<body>
<div id="overlay" class="g-${gameId}">
  <div class="card" id="card">
    <div class="game-label"><span id="game-label">SOOP GAME BOT</span><span class="live">LIVE</span></div>
    <div class="stage" id="stage"></div>
    <div class="result-wrap" id="result-wrap">
      <div class="result-text" id="result-text">대기 중...</div>
      <div class="detail-text" id="detail-text"></div>
      <div class="trigger-row">
        <span class="trigger-user" id="trigger-user"></span>
        <span class="trigger-balloon" id="trigger-balloon"></span>
      </div>
    </div>
  </div>
</div>
<script>${FX_SCRIPT}<\/script>
<script>
  const GAME_NAMES = {
    roulette:'룰렛', ladder:'사다리타기',
    quiz:'퀴즈', slot:'슬롯머신', race:'경주', rps:'가위바위보',
    fish:'낚시', lottery:'복권', number:'숫자 추첨'
  }
  const MARQUEE_GAMES = ['rps']
  const TEASER_MS  = 2000   // 결과 공개까지 긴장 구간
  const SHOW_MS    = 6000   // 공개 후 카드 유지 시간
  const SYSTEM_BY  = ['스트리머', 'weflab', '']

  const overlay  = document.getElementById('overlay')
  const card     = document.getElementById('card')
  const label    = document.getElementById('game-label')
  const stage    = document.getElementById('stage')
  const resultEl = document.getElementById('result-text')
  const detailEl = document.getElementById('detail-text')
  const userEl   = document.getElementById('trigger-user')
  const balloonEl= document.getElementById('trigger-balloon')

  let hideTimer = null
  let seq = 0                 // 결과가 연달아 오면 이전 티저 타이머 무효화
  let timers = []
  function later(ms, fn) { const my = seq; const t = setTimeout(() => { if (my === seq) fn() }, ms); timers.push(t); return t }
  function clearTimers() { timers.forEach(clearTimeout); timers = [] }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;') }
  function emojiOf(s) { const m = String(s || '').replace(/[\\uAC00-\\uD7A3\\w\\s!?.,:()\\-]/g, ''); return m }

  function showResult(data) {
    seq++; clearTimers()
    if (hideTimer) clearTimeout(hideTimer)
    FX.drumStop(); FX.hideWinner()

    const gid  = data.gameId || '${gameId}'
    const name = GAME_NAMES[gid] ?? gid
    label.textContent     = name
    resultEl.textContent  = data.result
    detailEl.textContent  = data.detail
    userEl.textContent    = data.triggeredBy ? '@' + data.triggeredBy : ''
    balloonEl.textContent = data.balloon ? '🎈 ' + data.balloon.toLocaleString() + '개' : ''
    userEl.parentElement.style.display = (userEl.textContent || balloonEl.textContent) ? '' : 'none'
    stage.innerHTML = ''

    // 게임별 스킨(라벨 색 / 마키 프레임)
    overlay.className = 'g-' + gid + (MARQUEE_GAMES.includes(gid) ? ' marquee' : '')
    overlay.classList.add('show')

    const tease = TEASERS[gid]
    if (tease) {
      overlay.classList.add('teasing', 'has-stage')
      tease(data, () => reveal(data, name))
    } else {
      // 전용 티저가 없는 게임: 기존 동작 + 효과음
      FX.sound('reveal')
      later(250, () => FX.sound('win'))
      if (data.result.includes('클리어') || data.result.includes('JACKPOT') || data.result.includes('레전드')) FX.confetti({ count: 120 })
      reveal(data, name)
    }
  }

  // 결과 공개: 결과 영역 팝인 + 당첨자 배너, SHOW_MS 뒤 정리
  function reveal(data, name) {
    overlay.classList.remove('teasing'); overlay.classList.add('revealed')
    const by = (data.triggeredBy || '').trim()
    later(120, () => {
      if (SYSTEM_BY.includes(by)) FX.winner({ text: data.result, sub: name + ' 결과', anchor: overlay, above: true, ms: SHOW_MS })
      else FX.winner({ nick: by, balloons: data.balloon, sub: name + ' 결과', anchor: overlay, above: true, ms: SHOW_MS })
    })
    hideTimer = setTimeout(() => { overlay.classList.remove('show', 'revealed'); FX.hideWinner() }, SHOW_MS)
  }

  // ── 게임별 티저 ──────────────────────────────────────────
  const TEASERS = {
    // 경주: 6마리가 제각각 속도로 달리고, 2초에 우승자가 결승선을 먼저 끊는다
    race(data, done) {
      const ANIMALS = ['🐎','🐇','🐢','🐊','🦊','🐆']
      const winner = emojiOf(data.result).trim() || ANIMALS[0]
      if (!ANIMALS.includes(winner)) ANIMALS[Math.floor(Math.random() * ANIMALS.length)] = winner
      const track = document.createElement('div'); track.className = 'track'
      const lanes = ANIMALS.map((a, i) => {
        const l = document.createElement('div'); l.className = 'lane' + (a === winner ? ' win' : '')
        l.innerHTML = '<span class="num">' + (i + 1) + '</span><div class="runner"><span>' + a + '</span></div>'
        track.appendChild(l); return l
      })
      stage.appendChild(track)
      FX.drumStart(130)
      const dist = track.clientWidth - 20 - 24 - 24   // 출발 오프셋 - 이모지 폭 - 결승선 여백
      requestAnimationFrame(() => requestAnimationFrame(() => {
        lanes.forEach(l => {
          const win = l.classList.contains('win')
          const dur = win ? TEASER_MS - 80 : TEASER_MS + 250 + Math.random() * 900
          const r = l.querySelector('.runner'); r.style.setProperty('--dur', dur + 'ms'); r.style.transform = 'translateX(' + dist + 'px)'
        })
      }))
      later(TEASER_MS, () => {
        track.classList.add('done')
        FX.drumStop(); FX.sound('win'); FX.confetti({ count: 120 })
        const w = track.querySelector('.lane.win .runner'); if (w) FX.burst(w, '#FFC83D')
        done()
      })
    },

    // 가위바위보: 가위 · 바위 · 보 카운트(틱 3번) → 양손 슬램 → 승패
    rps(data, done) {
      const m = String(data.detail || '').match(/스트리머:\\s*(\\S+)[\\s\\S]*?vs\\s*시청자:\\s*(\\S+)/)
      const hS = m ? m[1] : '❔', hV = m ? m[2] : '❔'
      const arena = document.createElement('div'); arena.className = 'arena'
      arena.innerHTML =
        '<div class="side pump" id="side-s"><div class="who">스트리머</div><div class="hand">✊</div></div>' +
        '<div class="count" id="count"></div>' +
        '<div class="side pump" id="side-v"><div class="who">시청자</div><div class="hand">✊</div></div>'
      stage.appendChild(arena)
      const count = arena.querySelector('#count'), sS = arena.querySelector('#side-s'), sV = arena.querySelector('#side-v')
      const beats = ['가위', '바위', '보']
      beats.forEach((w, i) => later(i * 400, () => {
        count.textContent = w; count.classList.remove('beat'); void count.offsetWidth; count.classList.add('beat'); FX.sound('tick')
      }))
      later(1300, () => {
        count.textContent = 'VS'; count.className = 'count vs'
        sS.className = 'side slam'; sV.className = 'side slam'
        sS.querySelector('.hand').textContent = hS; sV.querySelector('.hand').textContent = hV
        FX.sound('stop')
      })
      later(TEASER_MS, () => {
        arena.classList.add('done')
        const r = String(data.result || '')
        if (r.includes('시청자')) { sV.classList.add('won'); sS.classList.add('lost'); FX.sound('win'); FX.confetti({ count: 100 }); FX.burst(sV.querySelector('.hand'), '#FFC83D') }
        else if (r.includes('스트리머')) { sS.classList.add('won'); sV.classList.add('lost'); FX.sound('lose'); overlay.classList.add('shake'); setTimeout(() => overlay.classList.remove('shake'), 600) }
        else { FX.sound('pop') }
        done()
      })
    },

    // 낚시: 찌가 3번 입질(틱+물결) → 물고기 점프 → 희귀도별 축하
    fish(data, done) {
      const detail = String(data.detail || ''), res = String(data.result || '')
      let rarity = (detail.match(/\\((common|uncommon|rare|legendary)\\)/) || [])[1]
      if (!rarity) rarity = res.includes('황금') ? 'legendary' : res.includes('복어') ? 'rare' : res.includes('참치') ? 'uncommon' : 'common'
      const fishEmoji = emojiOf(res).trim() || '🐟'
      const pond = document.createElement('div'); pond.className = 'pond'
      pond.innerHTML = '<div class="water"></div><div class="line"></div><div class="bobber"></div><div class="fishjump">' + esc(fishEmoji) + '</div>'
      stage.appendChild(pond)
      const bobber = pond.querySelector('.bobber'), line = pond.querySelector('.line'), fishEl = pond.querySelector('.fishjump')
      FX.drumStart(100)
      const ripple = () => { const r = document.createElement('div'); r.className = 'ripple'; pond.appendChild(r); setTimeout(() => r.remove(), 900) }
      ;[150, 700, 1250].forEach(t => {
        later(t, () => { bobber.classList.add('dip'); line.classList.add('dip'); ripple(); FX.sound('tick') })
        later(t + 220, () => { bobber.classList.remove('dip'); line.classList.remove('dip') })
      })
      later(1650, () => {
        pond.classList.add('jumped'); fishEl.classList.add('show'); FX.sound('reveal')
        ripple(); for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'drop'; d.style.setProperty('--dx', ((Math.random() - .5) * 140) + 'px'); d.style.animationDelay = (Math.random() * .1) + 's'; pond.appendChild(d); setTimeout(() => d.remove(), 900) }
      })
      later(TEASER_MS, () => {
        FX.drumStop()
        if (rarity === 'legendary') { pond.classList.add('legend'); FX.sound('jackpot'); FX.flash('rgba(255,200,40,.6)'); FX.confetti({ count: 160, colors: ['#FFC83D','#FFE7B8','#FF5B17','#F5F3EF'] }); FX.burst(fishEl, '#FFC83D') }
        else if (rarity === 'rare') { FX.sound('win'); FX.burst(fishEl, '#7DA4FF') }
        else if (rarity === 'uncommon') { FX.sound('coin') }
        else { FX.sound('pop') }
        done()
      })
    },
  }

  // WebSocket
  function connect() {
    const ws = new WebSocket('ws://localhost:${port}/__overlay_ws__')
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        FX.handle(msg)
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
