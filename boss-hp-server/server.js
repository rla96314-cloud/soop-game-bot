const http = require('http')

const states = new Map()   // channelId → { hp data + settings }
const PORT = 4081

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'POST' && url === '/boss-hp') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const key = data.channelId || 'unknown'
        const prev = states.get(key) || {}
        states.set(key, { ...prev, ...data, updatedAt: Date.now() })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
      }
    })
    return
  }

  if (req.method === 'GET' && url === '/boss-hp') {
    const now = Date.now()
    const result = {}
    for (const [k, v] of states.entries()) {
      result[k] = { ...v, stale: now - v.updatedAt > 10000 }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  if (req.method === 'GET' && (url === '/' || url === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(DASHBOARD_HTML)
    return
  }

  res.writeHead(404); res.end()
})

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>보스전 모니터</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0 }
body { font-family: 'Noto Sans KR', sans-serif; background: #0d1117; color: #e6edf3; }
header { padding: 16px 24px; border-bottom: 1px solid #21262d; display: flex; align-items: center; gap: 16px; }
h1 { font-size: 16px; color: #58a6ff; font-weight: 700; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: #8b949e; background: none; border: 1px solid transparent; transition: all .15s; }
.tab.active { background: #21262d; color: #e6edf3; border-color: #30363d; }
.tab:hover:not(.active) { color: #c9d1d9; }
.panel { display: none; padding: 20px 24px; }
.panel.active { display: block; }

/* HP 탭 */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 16px; }
.card.stale { opacity: .35; }
.card-ch { font-size: 11px; color: #8b949e; margin-bottom: 4px; }
.card-name { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
.pct { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
.pct.hi { color: #f85149; } .pct.md { color: #f0883e; } .pct.lo { color: #3fb950; }
.bar-bg { background: #21262d; border-radius: 4px; height: 10px; overflow: hidden; margin-bottom: 8px; }
.bar { height: 100%; border-radius: 4px; transition: width .6s; }
.bar.hi { background: linear-gradient(90deg,#f85149,#da3633); }
.bar.md { background: linear-gradient(90deg,#f0883e,#d29922); }
.bar.lo { background: linear-gradient(90deg,#3fb950,#2ea043); }
.hp-txt { font-size: 12px; color: #8b949e; } .hp-txt b { color: #e6edf3; }
.meta { font-size: 11px; color: #484f58; margin-top: 8px; }
.empty { color: #484f58; font-size: 14px; padding: 40px 0; }

/* 설정 탭 */
.cfg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.cfg-card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 18px; }
.cfg-card.stale { opacity: .35; }
.cfg-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: #e6edf3; }
.cfg-ch { font-size: 11px; color: #8b949e; margin-bottom: 8px; }
.cfg-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #21262d; font-size: 12px; }
.cfg-row:last-child { border-bottom: none; }
.cfg-label { color: #8b949e; }
.cfg-val { color: #e6edf3; font-weight: 600; }
.loot-list { margin-top: 8px; }
.loot-item { font-size: 11px; color: #8b949e; padding: 2px 0; }
.loot-item b { color: #c9d1d9; }
.no-cfg { color: #484f58; font-size: 12px; padding: 8px 0; }
</style>
</head>
<body>
<header>
  <h1>보스전 모니터</h1>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('hp')">HP 모니터</button>
    <button class="tab" onclick="switchTab('cfg')">보스 설정</button>
  </div>
  <span id="ts" style="font-size:11px;color:#484f58;margin-left:auto"></span>
</header>

<div id="panel-hp" class="panel active">
  <div id="grid" class="grid"><div class="empty">데이터 없음</div></div>
</div>
<div id="panel-cfg" class="panel">
  <div id="cfg-grid" class="cfg-grid"><div class="empty">데이터 없음</div></div>
</div>

<script>
let currentTab = 'hp'
function switchTab(t) {
  currentTab = t
  document.querySelectorAll('.tab').forEach((el, i) => el.classList.toggle('active', ['hp','cfg'][i] === t))
  document.getElementById('panel-hp').classList.toggle('active', t === 'hp')
  document.getElementById('panel-cfg').classList.toggle('active', t === 'cfg')
}

function cls(pct) { return pct > 50 ? 'hi' : pct > 25 ? 'md' : 'lo' }

const STATUS_LABEL = { idle:'대기중', running:'진행중', showing_result:'결과표시' }
const STATUS_COLOR = { idle:'#484f58', running:'#3fb950', showing_result:'#f0883e' }

function renderHp(entries) {
  const grid = document.getElementById('grid')
  if (!entries.length) { grid.innerHTML = '<div class="empty">데이터 없음</div>'; return }
  grid.innerHTML = entries.map(([ch, s]) => {
    const running = s.status === 'running'
    const pct = s.maxHp > 0 ? Math.round(s.currentHp / s.maxHp * 100) : 0
    const c = running ? cls(pct) : 'hi'
    const ts = new Date(s.updatedAt).toLocaleTimeString('ko-KR')
    const statusLabel = STATUS_LABEL[s.status] || s.status || '대기중'
    const statusColor = STATUS_COLOR[s.status] || '#484f58'
    return '<div class="card' + (s.stale ? ' stale' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<div class="card-ch">' + ch + '</div>' +
        '<div style="font-size:10px;font-weight:700;color:' + statusColor + '">' + statusLabel + '</div>' +
      '</div>' +
      '<div class="card-name">' + (s.bossName || '보스') + '</div>' +
      (running
        ? '<div class="pct ' + c + '">' + pct + '%</div>' +
          '<div class="bar-bg"><div class="bar ' + c + '" style="width:' + pct + '%"></div></div>' +
          '<div class="hp-txt"><b>' + (s.currentHp||0).toLocaleString() + '</b> / ' + (s.maxHp||0).toLocaleString() + '</div>' +
          '<div class="meta">참여자 ' + (s.participants||0) + '명 · ' + ts + '</div>'
        : '<div class="meta" style="margin-top:8px">최대 HP ' + (s.maxHp||0).toLocaleString() + ' · ' + ts + '</div>'
      ) +
      '</div>'
  }).join('')
}

function renderCfg(entries) {
  const grid = document.getElementById('cfg-grid')
  if (!entries.length) { grid.innerHTML = '<div class="empty">데이터 없음</div>'; return }
  grid.innerHTML = entries.map(([ch, s]) => {
    const cfg = s.settings || {}
    const hasCfg = Object.keys(cfg).length > 0
    const loot = cfg.lootItems || []
    const ts = new Date(s.updatedAt).toLocaleTimeString('ko-KR')
    return '<div class="cfg-card' + (s.stale ? ' stale' : '') + '">' +
      '<div class="cfg-ch">' + ch + '</div>' +
      '<div class="cfg-title">' + (s.bossName || cfg.bossName || '보스') + '</div>' +
      (hasCfg ? [
        ['최대 HP',        (cfg.maxHp||0).toLocaleString()],
        ['별풍선 트리거',   (cfg.balloonThreshold||0) + '개'],
        ['주사위 데미지',   (cfg.damagePerDot||0) + ' × 주사위'],
        ['크리티컬',       cfg.critEnabled ? (Math.round((cfg.critChance||0)*100)) + '% / ' + (cfg.critMultiplier||2) + '배' : '비활성'],
        ['페이즈2 전환',   (cfg.phase2HpPercent||50) + '% 이하'],
      ].map(([l,v]) =>
        '<div class="cfg-row"><span class="cfg-label">' + l + '</span><span class="cfg-val">' + v + '</span></div>'
      ).join('') : '<div class="no-cfg">설정 데이터 없음<br>(보스전 시작 시 자동 수신)</div>') +
      (loot.length ? '<div class="loot-list"><div class="cfg-row"><span class="cfg-label">전리품</span></div>' +
        loot.map((item, i) => '<div class="loot-item"><b>' + (i+1) + '위</b> ' + (item.name||'') + (item.description ? ' — ' + item.description : '') + '</div>').join('') +
        '</div>' : '') +
      '<div class="meta" style="margin-top:10px">업데이트 ' + ts + '</div>' +
      '</div>'
  }).join('')
}

async function load() {
  try {
    const r = await fetch('/boss-hp')
    const data = await r.json()
    const entries = Object.entries(data)
    renderHp(entries)
    renderCfg(entries)
    document.getElementById('ts').textContent = new Date().toLocaleTimeString('ko-KR') + ' 기준'
  } catch {}
}

load()
setInterval(load, 1000)
</script>
</body>
</html>`

server.listen(PORT, '0.0.0.0', () => {
  console.log('boss-hp-server listening on port ' + PORT)
})
