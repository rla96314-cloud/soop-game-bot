const http = require('http')

// channelId → latest boss state
const states = new Map()

const PORT = 4081

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // POST /boss-hp — 앱에서 1초마다 푸시
  if (req.method === 'POST' && url === '/boss-hp') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const key = data.channelId || 'unknown'
        states.set(key, { ...data, updatedAt: Date.now() })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
      }
    })
    return
  }

  // GET /boss-hp — 현재 전체 상태 JSON
  if (req.method === 'GET' && url === '/boss-hp') {
    const now = Date.now()
    // 10초 이상 업데이트 없으면 stale 표시
    const result = {}
    for (const [k, v] of states.entries()) {
      result[k] = { ...v, stale: now - v.updatedAt > 10000 }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  // GET / — 대시보드 HTML
  if (req.method === 'GET' && (url === '/' || url === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(DASHBOARD_HTML)
    return
  }

  res.writeHead(404)
  res.end()
})

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>보스전 HP 모니터</title>
<meta http-equiv="refresh" content="1">
<style>
  body{font-family:'Noto Sans KR',sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:24px}
  h1{font-size:18px;color:#58a6ff;margin:0 0 20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:18px}
  .card.stale{opacity:.4}
  .card.idle{border-color:#30363d}
  .name{font-size:16px;font-weight:700;margin-bottom:12px;color:#e6edf3}
  .channel{font-size:11px;color:#8b949e;margin-bottom:8px}
  .bar-wrap{background:#21262d;border-radius:6px;height:18px;overflow:hidden;margin-bottom:8px}
  .bar{height:100%;border-radius:6px;transition:width .5s;background:linear-gradient(90deg,#f85149,#da3633)}
  .bar.half{background:linear-gradient(90deg,#f0883e,#d29922)}
  .bar.low{background:linear-gradient(90deg,#3fb950,#2ea043)}
  .hp{font-size:13px;color:#8b949e}
  .hp b{color:#e6edf3}
  .pct{font-size:22px;font-weight:800;color:#f85149;margin-bottom:4px}
  .pct.half{color:#f0883e}
  .pct.low{color:#3fb950}
  .participants{font-size:11px;color:#8b949e;margin-top:8px}
  .ts{font-size:10px;color:#484f58;margin-top:6px}
  .empty{color:#484f58;font-size:14px}
</style>
</head>
<body>
<h1>보스전 HP 모니터</h1>
<div id="grid" class="grid"><div class="empty">데이터 없음</div></div>
<script>
async function load() {
  try {
    const r = await fetch('/boss-hp')
    const data = await r.json()
    const entries = Object.entries(data)
    const grid = document.getElementById('grid')
    if (entries.length === 0) { grid.innerHTML = '<div class="empty">데이터 없음</div>'; return }
    grid.innerHTML = entries.map(([ch, s]) => {
      const pct = s.maxHp > 0 ? Math.round(s.currentHp / s.maxHp * 100) : 0
      const cls = pct > 50 ? '' : pct > 25 ? 'half' : 'low'
      const ts = new Date(s.updatedAt).toLocaleTimeString('ko-KR')
      return '<div class="card' + (s.stale ? ' stale' : '') + '">' +
        '<div class="channel">' + ch + '</div>' +
        '<div class="name">' + (s.bossName || '보스') + '</div>' +
        '<div class="pct ' + cls + '">' + pct + '%</div>' +
        '<div class="bar-wrap"><div class="bar ' + cls + '" style="width:' + pct + '%"></div></div>' +
        '<div class="hp"><b>' + (s.currentHp || 0).toLocaleString() + '</b> / ' + (s.maxHp || 0).toLocaleString() + '</div>' +
        '<div class="participants">참여자 ' + (s.participants || 0) + '명</div>' +
        '<div class="ts">업데이트 ' + ts + '</div>' +
        '</div>'
    }).join('')
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
