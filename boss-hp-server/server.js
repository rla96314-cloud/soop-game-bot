const http = require('http')

const states   = new Map()   // channelId → latest state
const commands = new Map()   // channelId → pending command
const PORT = 4081

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // POST /boss-hp — 앱 1초 푸시. 응답에 pending command 포함
  if (req.method === 'POST' && url === '/boss-hp') {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const key  = data.channelId || 'unknown'
        const prev = states.get(key) || {}
        states.set(key, { ...prev, ...data, updatedAt: Date.now() })
        const cmd  = commands.get(key) || null
        if (cmd) commands.delete(key)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, command: cmd }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
      }
    })
    return
  }

  // POST /boss-command/:channelId — 대시보드에서 명령 전송
  if (req.method === 'POST' && url.startsWith('/boss-command/')) {
    const channelId = decodeURIComponent(url.slice('/boss-command/'.length))
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try {
        const cmd = JSON.parse(body)
        commands.set(channelId, cmd)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
      }
    })
    return
  }

  // GET /boss-hp
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
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#0d1117;color:#e6edf3;font-size:13px}
header{padding:14px 20px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:12px}
h1{font-size:15px;color:#58a6ff;font-weight:700;flex:none}
.tabs{display:flex;gap:3px}
.tab{padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;color:#8b949e;background:none;border:1px solid transparent}
.tab.active{background:#21262d;color:#e6edf3;border-color:#30363d}
.tab:hover:not(.active){color:#c9d1d9}
#ts{font-size:11px;color:#484f58;margin-left:auto}
.panel{display:none;padding:16px 20px}.panel.active{display:block}

/* 공통 그리드 */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px}
.card.stale{opacity:.35}
.empty{color:#484f58;padding:32px 0}

/* HP 카드 */
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.card-ch{font-size:11px;color:#8b949e}
.status-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.sb-idle{color:#484f58;background:#21262d}
.sb-running{color:#3fb950;background:#1a3a1a}
.sb-result{color:#f0883e;background:#3a2a1a}
.card-name{font-size:14px;font-weight:700;margin-bottom:8px}
.pct{font-size:22px;font-weight:800;margin-bottom:4px}
.pct.hi{color:#f85149}.pct.md{color:#f0883e}.pct.lo{color:#3fb950}.pct.idle{color:#484f58}
.bar-bg{background:#21262d;border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px}
.bar{height:100%;border-radius:4px;transition:width .5s}
.bar.hi{background:linear-gradient(90deg,#f85149,#da3633)}
.bar.md{background:linear-gradient(90deg,#f0883e,#d29922)}
.bar.lo{background:linear-gradient(90deg,#3fb950,#2ea043)}
.hp-txt{font-size:12px;color:#8b949e;margin-bottom:8px}
.hp-txt b{color:#e6edf3}
.btns{display:flex;gap:6px;margin-top:8px}
.btn{flex:1;padding:6px 0;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit}
.btn-start{background:#238636;color:#fff}.btn-start:hover{background:#2ea043}
.btn-reset{background:#21262d;color:#8b949e;border:1px solid #30363d}.btn-reset:hover{color:#e6edf3}
.btn-start:disabled,.btn-reset:disabled{opacity:.4;cursor:not-allowed}

/* 데미지 테이블 */
.dmg-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
.dmg-table th{color:#8b949e;font-weight:600;padding:4px 6px;border-bottom:1px solid #21262d;text-align:left}
.dmg-table td{padding:4px 6px;border-bottom:1px solid #161b22}
.dmg-table tr:last-child td{border-bottom:none}
.rank1{color:#f1c40f}.rank2{color:#95a5a6}.rank3{color:#cd6133}

/* 설정 탭 */
.cfg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
.cfg-card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px}
.cfg-title{font-size:14px;font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
.cfg-subtitle{font-size:11px;color:#8b949e;font-weight:400}
.frow{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.frow label{width:110px;flex:none;font-size:12px;color:#8b949e}
.finput{flex:1;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;padding:5px 8px;font-size:12px;font-family:inherit}
.finput:focus{outline:none;border-color:#58a6ff}
.fcheck{width:16px;height:16px;cursor:pointer}
.loot-list{margin-top:4px}
.loot-row{display:flex;gap:6px;margin-bottom:6px;align-items:center}
.loot-row .finput{flex:2}
.loot-row .finput.sm{flex:1}
.loot-del{background:none;border:none;color:#f85149;cursor:pointer;font-size:14px;padding:0 4px}
.btn-loot-add{background:#21262d;border:1px solid #30363d;color:#8b949e;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit;margin-top:4px}
.btn-loot-add:hover{color:#e6edf3}
.btn-save{width:100%;margin-top:12px;padding:8px;background:#1f6feb;border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-save:hover{background:#388bfd}
.save-status{font-size:11px;text-align:center;height:16px;margin-top:4px;color:#8b949e}
.sep{border:none;border-top:1px solid #21262d;margin:10px 0}
</style>
</head>
<body>
<header>
  <h1>보스전 모니터</h1>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('hp')">HP 모니터</button>
    <button class="tab" onclick="switchTab('cfg')">보스 설정</button>
  </div>
  <span id="ts"></span>
</header>

<div id="panel-hp" class="panel active">
  <div id="hp-grid" class="grid"><div class="empty">앱 실행 후 데이터가 표시됩니다</div></div>
</div>
<div id="panel-cfg" class="panel">
  <div id="cfg-grid" class="cfg-grid"><div class="empty">앱 실행 후 데이터가 표시됩니다</div></div>
</div>

<script>
let currentTab = 'hp'
let latestData = {}

function switchTab(t) {
  currentTab = t
  document.querySelectorAll('.tab').forEach((el,i) => el.classList.toggle('active', ['hp','cfg'][i] === t))
  document.getElementById('panel-hp').classList.toggle('active', t==='hp')
  document.getElementById('panel-cfg').classList.toggle('active', t==='cfg')
}

function pct(cur, max) { return max > 0 ? Math.round(cur / max * 100) : 0 }
function cls(p) { return p > 50 ? 'hi' : p > 25 ? 'md' : 'lo' }
function num(n) { return (n||0).toLocaleString() }

async function sendCmd(ch, cmd) {
  await fetch('/boss-command/' + encodeURIComponent(ch), {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(cmd)
  })
}

/* ── HP 탭 ── */
function renderHp(entries) {
  const grid = document.getElementById('hp-grid')
  if (!entries.length) { grid.innerHTML = '<div class="empty">앱 실행 후 데이터가 표시됩니다</div>'; return }
  grid.innerHTML = entries.map(([ch, s]) => {
    const running = s.status === 'running'
    const idle    = !s.status || s.status === 'idle'
    const p       = pct(s.currentHp, s.maxHp)
    const c       = running ? cls(p) : 'idle'
    const sbCls   = idle ? 'sb-idle' : running ? 'sb-running' : 'sb-result'
    const sbTxt   = idle ? '대기중' : running ? '진행중' : '결과표시'
    const ts      = new Date(s.updatedAt).toLocaleTimeString('ko-KR')

    // 데미지 랭킹
    const parts = s.participants && typeof s.participants === 'object' ? s.participants : {}
    const ranked = Object.entries(parts)
      .map(([u, d]) => ({u, ...d}))
      .sort((a, b) => (b.totalDamage||0) - (a.totalDamage||0))
    const total = ranked.reduce((s, r) => s + (r.totalDamage||0), 0)

    return \`<div class="card\${s.stale?' stale':''}">
      <div class="card-head">
        <div class="card-ch">\${ch}</div>
        <div class="status-badge \${sbCls}">\${sbTxt}</div>
      </div>
      <div class="card-name">\${s.bossName||'보스'}</div>
      \${running || s.status==='showing_result' ? \`
        <div class="pct \${c}">\${p}%</div>
        <div class="bar-bg"><div class="bar \${c}" style="width:\${p}%"></div></div>
        <div class="hp-txt"><b>\${num(s.currentHp)}</b> / \${num(s.maxHp)}</div>
      \` : \`<div class="hp-txt" style="margin-bottom:8px">최대 HP \${num(s.maxHp)}</div>\`}
      <div class="btns">
        <button class="btn btn-start" \${running?'disabled':''} onclick="sendCmd('\${ch}',{type:'start-boss'})">▶ 레이드 시작</button>
        <button class="btn btn-reset" onclick="sendCmd('\${ch}',{type:'reset-boss'})">↺ 초기화</button>
      </div>
      \${ranked.length ? \`
        <table class="dmg-table">
          <tr><th>#</th><th>참여자</th><th>데미지</th><th>기여</th><th>공격</th><th>크리</th></tr>
          \${ranked.slice(0,10).map((r,i) => {
            const rnkCls = i===0?'rank1':i===1?'rank2':i===2?'rank3':''
            const contrib = total > 0 ? Math.round((r.totalDamage||0)/total*100) : 0
            return \`<tr>
              <td class="\${rnkCls}">\${i+1}</td>
              <td>\${r.u}</td>
              <td>\${num(r.totalDamage)}</td>
              <td>\${contrib}%</td>
              <td>\${r.attackCount||0}</td>
              <td>\${r.critCount||0}</td>
            </tr>\`
          }).join('')}
        </table>
      \` : \`<div style="font-size:11px;color:#484f58;margin-top:8px">업데이트 \${ts}</div>\`}
    </div>\`
  }).join('')
}

/* ── 설정 탭 ── */
const cfgState = {}  // channelId → loot array

function renderCfg(entries) {
  const grid = document.getElementById('cfg-grid')
  if (!entries.length) { grid.innerHTML = '<div class="empty">앱 실행 후 데이터가 표시됩니다</div>'; return }
  grid.innerHTML = entries.map(([ch, s]) => {
    const cfg = s.settings || {}
    if (!cfgState[ch]) cfgState[ch] = (cfg.lootItems||[]).map(x=>({...x}))
    const loot = cfgState[ch]
    const id = ch.replace(/[^a-z0-9]/gi,'_')
    return \`<div class="cfg-card\${s.stale?' stale':''}">
      <div class="cfg-title">
        \${s.bossName||cfg.bossName||'보스'}
        <span class="cfg-subtitle">\${ch}</span>
      </div>
      <div class="frow"><label>보스 이름</label><input class="finput" id="cfg_name_\${id}" value="\${cfg.bossName||'보스'}"></div>
      <div class="frow"><label>최대 HP</label><input class="finput" id="cfg_maxhp_\${id}" type="number" value="\${cfg.maxHp||100000}"></div>
      <div class="frow"><label>별풍선 트리거</label><input class="finput" id="cfg_thr_\${id}" type="number" value="\${cfg.balloonThreshold||100}"></div>
      <div class="frow"><label>주사위 데미지</label><input class="finput" id="cfg_dmg_\${id}" type="number" value="\${cfg.damagePerDot||100}"></div>
      <hr class="sep">
      <div class="frow">
        <label>크리티컬</label>
        <input type="checkbox" class="fcheck" id="cfg_crit_\${id}" \${cfg.critEnabled?'checked':''}>
        <span style="font-size:11px;color:#8b949e;margin-left:4px">확률</span>
        <input class="finput" id="cfg_critp_\${id}" type="number" min="1" max="99" style="width:54px;flex:none" value="\${Math.round((cfg.critChance||0.15)*100)}">
        <span style="font-size:11px;color:#8b949e">%  배율</span>
        <input class="finput" id="cfg_critm_\${id}" type="number" min="1" style="width:50px;flex:none" value="\${cfg.critMultiplier||2}">
        <span style="font-size:11px;color:#8b949e">배</span>
      </div>
      <div class="frow"><label>페이즈2 전환</label><input class="finput" id="cfg_ph2_\${id}" type="number" min="1" max="99" value="\${cfg.phase2HpPercent||50}"><span style="font-size:11px;color:#8b949e;margin-left:4px">% 이하</span></div>
      <hr class="sep">
      <div style="font-size:11px;color:#8b949e;margin-bottom:6px">전리품</div>
      <div class="loot-list" id="loot_\${id}"></div>
      <button class="btn-loot-add" onclick="addLoot('\${ch}','\${id}')">+ 전리품 추가</button>
      <button class="btn-save" onclick="saveCfg('\${ch}','\${id}')">저장 (앱에 전송)</button>
      <div class="save-status" id="ss_\${id}"></div>
    </div>\`
  }).join('')

  // 전리품 렌더
  entries.forEach(([ch]) => {
    const id = ch.replace(/[^a-z0-9]/gi,'_')
    renderLoot(ch, id)
  })
}

function renderLoot(ch, id) {
  const loot = cfgState[ch] || []
  const el = document.getElementById('loot_' + id)
  if (!el) return
  el.innerHTML = loot.map((item, i) =>
    \`<div class="loot-row">
      <span style="color:#484f58;font-size:11px;width:20px;flex:none">\${i+1}</span>
      <input class="finput" placeholder="상품명" value="\${esc(item.name||'')}" oninput="cfgState['\${ch}'][\${i}].name=this.value">
      <input class="finput sm" placeholder="설명" value="\${esc(item.description||'')}" oninput="cfgState['\${ch}'][\${i}].description=this.value">
      <button class="loot-del" onclick="cfgState['\${ch}'].splice(\${i},1);renderLoot('\${ch}','\${id}')">×</button>
    </div>\`
  ).join('')
}
function addLoot(ch, id) {
  if (!cfgState[ch]) cfgState[ch] = []
  cfgState[ch].push({name:'',description:''})
  renderLoot(ch, id)
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;') }

async function saveCfg(ch, id) {
  const g = s => document.getElementById(s + '_' + id)
  const settings = {
    bossName:         g('cfg_name').value || '보스',
    maxHp:            Number(g('cfg_maxhp').value) || 100000,
    balloonThreshold: Number(g('cfg_thr').value) || 100,
    damagePerDot:     Number(g('cfg_dmg').value) || 100,
    critEnabled:      g('cfg_crit').checked,
    critChance:       (Number(g('cfg_critp').value) || 15) / 100,
    critMultiplier:   Number(g('cfg_critm').value) || 2,
    phase2HpPercent:  Number(g('cfg_ph2').value) || 50,
    lootItems:        cfgState[ch] || [],
  }
  const ss = document.getElementById('ss_' + id)
  ss.textContent = '전송 중...'
  try {
    await sendCmd(ch, { type: 'update-settings', settings })
    ss.style.color = '#3fb950'
    ss.textContent = '전송 완료 ✓ (1초 내 앱에 적용)'
  } catch {
    ss.style.color = '#f85149'
    ss.textContent = '전송 실패'
  }
  setTimeout(() => { ss.textContent = ''; ss.style.color = '#8b949e' }, 3000)
}

/* ── 메인 루프 ── */
async function load() {
  try {
    const r = await fetch('/boss-hp')
    const data = await r.json()
    latestData = data
    const entries = Object.entries(data)
    renderHp(entries)
    // 설정 탭은 활성 시에만 렌더 (포커스 잃지 않으려고)
    if (currentTab === 'cfg') renderCfg(entries)
    document.getElementById('ts').textContent = new Date().toLocaleTimeString('ko-KR')
  } catch {}
}

// 설정 탭 전환 시 렌더
const origSwitch = switchTab
window.switchTab = function(t) {
  origSwitch(t)
  if (t === 'cfg') renderCfg(Object.entries(latestData))
}

load()
setInterval(load, 1000)
</script>
</body>
</html>`

server.listen(PORT, '0.0.0.0', () => {
  console.log('boss-hp-server listening on port ' + PORT)
})
