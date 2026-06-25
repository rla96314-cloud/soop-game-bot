const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT         = 4081
const DATA_DIR     = '/app/data'
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

// ── 영구 설정 저장/로드 ──────────────────────────────────────────
function loadSettingsFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
  } catch {}
  return {}
}
function saveSettingsFile(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) { console.error('settings save error:', e) }
}

const storedSettings = loadSettingsFile()  // channelId → settings object
const states         = new Map()           // channelId → latest HP state
const commands       = new Map()           // channelId → pending command

function allChannels() {
  const set = new Set([...states.keys(), ...Object.keys(storedSettings)])
  return [...set]
}

// ── HTTP 서버 ────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url    = req.url.split('?')[0]
  const method = req.method

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(obj))
  }
  const body = () => new Promise(resolve => {
    let b = ''
    req.on('data', c => { b += c })
    req.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve(null) } })
  })

  // ── 앱 1초 푸시 ──────────────────────────────────────────────
  if (method === 'POST' && url === '/boss-hp') {
    body().then(data => {
      if (!data) return json(400, { ok: false })
      const key  = data.channelId || 'unknown'
      const prev = states.get(key) || {}
      states.set(key, { ...prev, ...data, updatedAt: Date.now() })
      // 앱이 보낸 settings로 저장 업데이트 (app이 켜진 경우)
      if (data.settings && Object.keys(data.settings).length > 0) {
        storedSettings[key] = { ...(storedSettings[key]||{}), ...data.settings,
          bossName: data.bossName || storedSettings[key]?.bossName }
        saveSettingsFile(storedSettings)
      }
      const cmd = commands.get(key) || null
      if (cmd) commands.delete(key)
      json(200, { ok: true, command: cmd })
    })
    return
  }

  // ── 앱 시작 시 설정 pull ──────────────────────────────────────
  if (method === 'GET' && url.startsWith('/boss-settings/')) {
    const channelId = decodeURIComponent(url.slice('/boss-settings/'.length))
    json(200, { ok: true, settings: storedSettings[channelId] || null })
    return
  }

  // ── 대시보드: 설정 전체 조회 ────────────────────────────────────
  if (method === 'GET' && url === '/boss-settings') {
    json(200, { ok: true, settings: storedSettings })
    return
  }

  // ── 대시보드: 설정 저장 ─────────────────────────────────────────
  if (method === 'POST' && url.startsWith('/boss-settings/')) {
    const channelId = decodeURIComponent(url.slice('/boss-settings/'.length))
    body().then(data => {
      if (!data) return json(400, { ok: false })
      storedSettings[channelId] = { ...(storedSettings[channelId]||{}), ...data }
      saveSettingsFile(storedSettings)
      // 앱이 켜져 있으면 command로도 즉시 반영
      commands.set(channelId, { type: 'update-settings', settings: data })
      json(200, { ok: true })
    })
    return
  }

  // ── 대시보드: 채널 삭제 ─────────────────────────────────────────
  if (method === 'DELETE' && url.startsWith('/boss-settings/')) {
    const channelId = decodeURIComponent(url.slice('/boss-settings/'.length))
    delete storedSettings[channelId]
    states.delete(channelId)
    saveSettingsFile(storedSettings)
    json(200, { ok: true })
    return
  }

  // ── 대시보드: 명령 ──────────────────────────────────────────────
  if (method === 'POST' && url.startsWith('/boss-command/')) {
    const channelId = decodeURIComponent(url.slice('/boss-command/'.length))
    body().then(cmd => {
      if (!cmd) return json(400, { ok: false })
      commands.set(channelId, cmd)
      json(200, { ok: true })
    })
    return
  }

  // ── HP 상태 JSON ────────────────────────────────────────────────
  if (method === 'GET' && url === '/boss-hp') {
    const now = Date.now()
    const result = {}
    for (const ch of allChannels()) {
      const s = states.get(ch) || {}
      result[ch] = {
        ...s,
        settings:  storedSettings[ch] || s.settings || {},
        bossName:  s.bossName || storedSettings[ch]?.bossName || '보스',
        maxHp:     s.maxHp   || storedSettings[ch]?.maxHp    || 0,
        stale:     !s.updatedAt || now - s.updatedAt > 10000,
        online:    !!s.updatedAt && now - s.updatedAt <= 10000,
      }
    }
    json(200, result)
    return
  }

  if (method === 'GET' && (url === '/' || url === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(DASHBOARD_HTML)
    return
  }

  res.writeHead(404); res.end()
})

// ── 대시보드 HTML ─────────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>보스전 모니터</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#0d1117;color:#e6edf3;font-size:13px}
header{padding:12px 20px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:10px}
h1{font-size:15px;color:#58a6ff;font-weight:700}
.tabs{display:flex;gap:3px}
.tab{padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;color:#8b949e;background:none;border:1px solid transparent;font-family:inherit}
.tab.active{background:#21262d;color:#e6edf3;border-color:#30363d}
.tab:hover:not(.active){color:#c9d1d9}
#ts{font-size:11px;color:#484f58;margin-left:auto}
.panel{display:none;padding:16px 20px}.panel.active{display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px}
.card.offline{border-color:#21262d;opacity:.7}
.empty{color:#484f58;padding:32px 0}

/* 온라인 뱃지 */
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
.card-ch{font-size:11px;color:#8b949e}
.badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.b-online{color:#3fb950;background:#1a3a1a}
.b-offline{color:#484f58;background:#1a1a1a}
.b-run{color:#58a6ff;background:#0d2137}
.b-result{color:#f0883e;background:#3a2010}
.card-name{font-size:14px;font-weight:700;margin-bottom:8px}
.pct{font-size:22px;font-weight:800;margin-bottom:4px}
.pct.hi{color:#f85149}.pct.md{color:#f0883e}.pct.lo{color:#3fb950}
.bar-bg{background:#21262d;border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px}
.bar{height:100%;border-radius:4px;transition:width .5s}
.bar.hi{background:linear-gradient(90deg,#f85149,#da3633)}.bar.md{background:linear-gradient(90deg,#f0883e,#d29922)}.bar.lo{background:linear-gradient(90deg,#3fb950,#2ea043)}
.hp-txt{font-size:12px;color:#8b949e;margin-bottom:6px}.hp-txt b{color:#e6edf3}
.btns{display:flex;gap:6px;margin-top:8px}
.btn{flex:1;padding:6px 0;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit}
.btn-start{background:#238636;color:#fff}.btn-start:hover{background:#2ea043}
.btn-reset{background:#21262d;color:#8b949e;border:1px solid #30363d}.btn-reset:hover{color:#e6edf3}
.btn:disabled{opacity:.35;cursor:not-allowed}
.dmg-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
.dmg-table th{color:#8b949e;font-weight:600;padding:4px 6px;border-bottom:1px solid #21262d;text-align:left}
.dmg-table td{padding:4px 6px;border-bottom:1px solid #0d1117}
.dmg-table tr:last-child td{border-bottom:none}
.r1{color:#f1c40f}.r2{color:#95a5a6}.r3{color:#cd6133}

/* 설정 탭 */
.cfg-toolbar{display:flex;gap:8px;margin-bottom:14px;align-items:center}
.btn-add-ch{padding:6px 14px;background:#1f6feb;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-add-ch:hover{background:#388bfd}
.cfg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
.cfg-card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px;position:relative}
.cfg-card.offline{border-color:#21262d}
.cfg-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.cfg-title{font-size:14px;font-weight:700}
.cfg-ch-badge{font-size:10px;color:#484f58}
.btn-del-ch{background:none;border:none;color:#484f58;cursor:pointer;font-size:16px;padding:0 4px;line-height:1}.btn-del-ch:hover{color:#f85149}
.frow{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.frow label{width:108px;flex:none;font-size:12px;color:#8b949e}
.finput{flex:1;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;padding:5px 8px;font-size:12px;font-family:inherit}
.finput:focus{outline:none;border-color:#58a6ff}
.fcheck{width:15px;height:15px;cursor:pointer;accent-color:#58a6ff}
.sep{border:none;border-top:1px solid #21262d;margin:10px 0}
.loot-list{margin-top:4px}
.loot-row{display:flex;gap:6px;margin-bottom:6px;align-items:center}
.loot-num{font-size:11px;color:#484f58;width:18px;flex:none;text-align:center}
.loot-del{background:none;border:none;color:#f85149;cursor:pointer;font-size:14px;padding:0 2px;line-height:1}
.btn-loot-add{background:none;border:1px solid #30363d;color:#8b949e;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit;margin-top:2px}.btn-loot-add:hover{color:#e6edf3}
.btn-save{width:100%;margin-top:12px;padding:8px;background:#1f6feb;border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.btn-save:hover{background:#388bfd}
.save-st{font-size:11px;text-align:center;height:16px;margin-top:4px}
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
  <div class="cfg-toolbar">
    <button class="btn-add-ch" onclick="addChannel()">+ 채널 추가</button>
    <span style="font-size:11px;color:#484f58">앱 오프라인 상태에서도 설정 가능 — 앱 시작 시 자동 적용</span>
  </div>
  <div id="cfg-grid" class="cfg-grid"></div>
</div>

<script>
let currentTab = 'hp'
let latestData = {}
const lootState = {}   // channelId → [{name,description}]

function switchTab(t) {
  currentTab = t
  document.querySelectorAll('.tab').forEach((el,i) => el.classList.toggle('active', ['hp','cfg'][i]===t))
  document.getElementById('panel-hp').classList.toggle('active', t==='hp')
  document.getElementById('panel-cfg').classList.toggle('active', t==='cfg')
  if (t==='cfg') renderCfg()
}

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
const num = n => (n||0).toLocaleString()
function cls(p){return p>50?'hi':p>25?'md':'lo'}
function pct(cur,max){return max>0?Math.round(cur/max*100):0}

/* ── 명령 전송 ── */
async function sendCmd(ch, cmd) {
  await fetch('/boss-command/'+encodeURIComponent(ch), {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(cmd)
  })
}

/* ── HP 탭 ── */
function renderHp(data) {
  const entries = Object.entries(data)
  const grid = document.getElementById('hp-grid')
  if (!entries.length) { grid.innerHTML='<div class="empty">채널이 없습니다 — 보스 설정 탭에서 채널을 추가하세요</div>'; return }

  grid.innerHTML = entries.map(([ch, s]) => {
    const online  = s.online
    const running = online && s.status==='running'
    const result  = online && s.status==='showing_result'
    const p       = pct(s.currentHp, s.maxHp)
    const c       = cls(p)
    const bName   = s.bossName || s.settings?.bossName || '보스'
    const mHp     = s.maxHp || s.settings?.maxHp || 0
    const parts   = (running||result) && s.participants && typeof s.participants==='object' ? s.participants : {}
    const ranked  = Object.entries(parts).map(([u,d])=>({u,...d})).sort((a,b)=>(b.totalDamage||0)-(a.totalDamage||0))
    const totDmg  = ranked.reduce((s,r)=>s+(r.totalDamage||0),0)
    const badgeCls= !online?'b-offline':running?'b-run':result?'b-result':'b-online'
    const badgeTxt= !online?'오프라인':running?'진행중':result?'결과표시':'대기중'
    const ts = s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString('ko-KR') : '-'

    return \`<div class="card\${!online?' offline':''}">
      <div class="card-head">
        <span class="card-ch">\${esc(ch)}</span>
        <span class="badge \${badgeCls}">\${badgeTxt}</span>
      </div>
      <div class="card-name">\${esc(bName)}</div>
      \${running ? \`
        <div class="pct \${c}">\${p}%</div>
        <div class="bar-bg"><div class="bar \${c}" style="width:\${p}%"></div></div>
        <div class="hp-txt"><b>\${num(s.currentHp)}</b> / \${num(mHp)}</div>
      \` : \`<div class="hp-txt" style="margin-bottom:6px">최대 HP \${num(mHp)}</div>\`}
      <div class="btns">
        <button class="btn btn-start" \${running||!online?'disabled':''} onclick="sendCmd('\${esc(ch)}',{type:'start-boss'})">▶ 레이드 시작</button>
        <button class="btn btn-reset" \${!online?'disabled':''} onclick="sendCmd('\${esc(ch)}',{type:'reset-boss'})">↺ 초기화</button>
      </div>
      \${ranked.length ? \`<table class="dmg-table">
        <tr><th>#</th><th>참여자</th><th>데미지</th><th>기여</th><th>공격</th><th>크리</th></tr>
        \${ranked.slice(0,8).map((r,i)=>{
          const rCls=i===0?'r1':i===1?'r2':i===2?'r3':''
          const ct=totDmg>0?Math.round((r.totalDamage||0)/totDmg*100):0
          return \`<tr><td class="\${rCls}">\${i+1}</td><td>\${esc(r.u)}</td><td>\${num(r.totalDamage)}</td><td>\${ct}%</td><td>\${r.attackCount||0}</td><td>\${r.critCount||0}</td></tr>\`
        }).join('')}
      </table>\` : \`<div style="font-size:11px;color:#484f58;margin-top:8px">\${ts}</div>\`}
    </div>\`
  }).join('')
}

/* ── 설정 탭 ── */
function renderCfg() {
  const data = latestData
  const chSet = new Set([...Object.keys(data)])
  // 저장된 설정 기반 채널도 포함 (오프라인)
  fetch('/boss-settings').then(r=>r.json()).then(j=>{
    if (j.settings) Object.keys(j.settings).forEach(k=>chSet.add(k))
    const entries = [...chSet].map(ch => [ch, {
      ...(data[ch]||{}),
      settings: j.settings?.[ch] || data[ch]?.settings || {},
      online: data[ch]?.online || false,
    }])
    const grid = document.getElementById('cfg-grid')
    if (!entries.length) { grid.innerHTML='<div class="empty">채널이 없습니다</div>'; return }

    // 새 채널은 lootState 초기화
    entries.forEach(([ch, s]) => {
      if (!lootState[ch]) lootState[ch] = (s.settings.lootItems||[]).map(x=>({...x}))
    })

    grid.innerHTML = entries.map(([ch, s]) => {
      const cfg = s.settings || {}
      const id  = 'cfg_' + ch.replace(/[^a-z0-9]/gi,'_')
      return \`<div class="cfg-card\${!s.online?' offline':''}">
        <div class="cfg-head">
          <div>
            <div class="cfg-title">\${esc(cfg.bossName||s.bossName||'보스')}</div>
            <div class="cfg-ch-badge">\${esc(ch)}\${!s.online?' · 오프라인':''}</div>
          </div>
          <button class="btn-del-ch" title="채널 삭제" onclick="delChannel('\${esc(ch)}')">×</button>
        </div>
        <div class="frow"><label>보스 이름</label><input class="finput" id="\${id}_name" value="\${esc(cfg.bossName||'보스')}"></div>
        <div class="frow"><label>최대 HP</label><input class="finput" type="number" id="\${id}_maxhp" value="\${cfg.maxHp||100000}"></div>
        <div class="frow"><label>별풍선 트리거</label><input class="finput" type="number" id="\${id}_thr" value="\${cfg.balloonThreshold||100}"><span style="font-size:11px;color:#8b949e;margin-left:4px">개</span></div>
        <div class="frow"><label>주사위 데미지</label><input class="finput" type="number" id="\${id}_dmg" value="\${cfg.damagePerDot||100}"><span style="font-size:11px;color:#8b949e;margin-left:4px">× 주사위</span></div>
        <hr class="sep">
        <div class="frow">
          <label>크리티컬</label>
          <input type="checkbox" class="fcheck" id="\${id}_crit" \${cfg.critEnabled?'checked':''}>
          <span style="font-size:11px;color:#8b949e;margin-left:6px">확률</span>
          <input class="finput" type="number" id="\${id}_critp" min="1" max="99" style="width:52px;flex:none" value="\${Math.round((cfg.critChance||0.15)*100)}">
          <span style="font-size:11px;color:#8b949e">%  배율</span>
          <input class="finput" type="number" id="\${id}_critm" min="1" style="width:48px;flex:none" value="\${cfg.critMultiplier||2}">
          <span style="font-size:11px;color:#8b949e">배</span>
        </div>
        <div class="frow"><label>페이즈2 전환</label><input class="finput" type="number" id="\${id}_ph2" min="1" max="99" value="\${cfg.phase2HpPercent||50}"><span style="font-size:11px;color:#8b949e;margin-left:4px">% 이하</span></div>
        <hr class="sep">
        <div style="font-size:11px;color:#8b949e;margin-bottom:6px">전리품</div>
        <div class="loot-list" id="\${id}_loot"></div>
        <button class="btn-loot-add" onclick="addLoot('\${esc(ch)}','\${id}')">+ 전리품 추가</button>
        <button class="btn-save" onclick="saveCfg('\${esc(ch)}','\${id}')">저장</button>
        <div class="save-st" id="\${id}_st"></div>
      </div>\`
    }).join('')

    entries.forEach(([ch]) => renderLoot(ch, 'cfg_'+ch.replace(/[^a-z0-9]/gi,'_')))
  }).catch(()=>{})
}

function renderLoot(ch, id) {
  const loot = lootState[ch] || []
  const el = document.getElementById(id+'_loot')
  if (!el) return
  el.innerHTML = loot.map((item,i)=>
    \`<div class="loot-row">
      <span class="loot-num">\${i+1}</span>
      <input class="finput" placeholder="상품명" value="\${esc(item.name)}" oninput="lootState['\${esc(ch)}'][\${i}].name=this.value">
      <input class="finput" placeholder="설명" style="flex:.8" value="\${esc(item.description)}" oninput="lootState['\${esc(ch)}'][\${i}].description=this.value">
      <button class="loot-del" onclick="lootState['\${esc(ch)}'].splice(\${i},1);renderLoot('\${esc(ch)}','\${id}')">×</button>
    </div>\`
  ).join('')
}
function addLoot(ch,id){ if(!lootState[ch])lootState[ch]=[]; lootState[ch].push({name:'',description:''}); renderLoot(ch,id) }

async function saveCfg(ch, id) {
  const g = k => document.getElementById(id+'_'+k)
  const settings = {
    bossName:         g('name').value || '보스',
    maxHp:            Number(g('maxhp').value) || 100000,
    balloonThreshold: Number(g('thr').value)   || 100,
    damagePerDot:     Number(g('dmg').value)   || 100,
    critEnabled:      g('crit').checked,
    critChance:       (Number(g('critp').value)||15)/100,
    critMultiplier:   Number(g('critm').value) || 2,
    phase2HpPercent:  Number(g('ph2').value)   || 50,
    lootItems:        lootState[ch] || [],
  }
  const st = document.getElementById(id+'_st')
  st.style.color='#8b949e'; st.textContent='저장 중...'
  try {
    await fetch('/boss-settings/'+encodeURIComponent(ch), {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(settings)
    })
    st.style.color='#3fb950'; st.textContent='저장 완료 ✓'
  } catch {
    st.style.color='#f85149'; st.textContent='저장 실패'
  }
  setTimeout(()=>{st.textContent=''},3000)
}

async function addChannel() {
  const ch = prompt('채널 ID를 입력하세요 (SOOP 채널 ID)')
  if (!ch || !ch.trim()) return
  lootState[ch.trim()] = []
  await fetch('/boss-settings/'+encodeURIComponent(ch.trim()), {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ bossName:'보스', maxHp:100000, balloonThreshold:100, damagePerDot:100,
      critEnabled:true, critChance:0.15, critMultiplier:2, phase2HpPercent:50, lootItems:[] })
  })
  renderCfg()
}

async function delChannel(ch) {
  if (!confirm(ch + ' 채널을 삭제할까요?')) return
  await fetch('/boss-settings/'+encodeURIComponent(ch), { method:'DELETE' })
  delete lootState[ch]
  await load()
  if (currentTab==='cfg') renderCfg()
}

/* ── 메인 루프 ── */
async function load() {
  try {
    const r = await fetch('/boss-hp')
    latestData = await r.json()
    renderHp(latestData)
    document.getElementById('ts').textContent = new Date().toLocaleTimeString('ko-KR')
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
