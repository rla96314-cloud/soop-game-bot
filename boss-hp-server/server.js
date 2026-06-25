const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT          = 4081
const DATA_DIR      = '/app/data'
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

const storedSettings = loadSettingsFile()  // channelId → settings object  (+ '__shared__' key)
const states         = new Map()           // channelId → latest HP state
const commands       = new Map()           // channelId → pending command

// ── 공유 보스 설정 (영구 저장) ────────────────────────────────────
const DEFAULT_SHARED_SETTINGS = {
  bossName:         '공유 보스',
  maxHp:            1000000,
  damagePerDot:     100,
  critEnabled:      true,
  critChance:       0.15,
  critMultiplier:   2,
  phase2HpPercent:  50,
  balloonThreshold: 100,
  lootItems:        [],
  imageUrls:        { phase1: '', phase2: '', success: '' },
}
let sharedBossSettings = { ...DEFAULT_SHARED_SETTINGS, ...(storedSettings['__shared__'] || {}) }

function saveSharedSettings() {
  storedSettings['__shared__'] = { ...sharedBossSettings }
  saveSettingsFile(storedSettings)
}

// ── 공유 보스 상태 ───────────────────────────────────────────────
const sharedBoss = {
  alive:        false,
  maxHp:        0,
  currentHp:    0,
  bossName:     '공유 보스',
  participants: {},
  startedAt:    null,
}

function allChannels() {
  const set = new Set([...states.keys(), ...Object.keys(storedSettings).filter(k => k !== '__shared__')])
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
      if (data.settings && Object.keys(data.settings).length > 0) {
        storedSettings[key] = { ...(storedSettings[key]||{}), ...data.settings,
          bossName: data.bossName || storedSettings[key]?.bossName }
        saveSettingsFile(storedSettings)
      }
      const cmd = commands.get(key) || null
      if (cmd) commands.delete(key)
      json(200, { ok: true, command: cmd, sharedBoss: { currentHp: sharedBoss.currentHp, alive: sharedBoss.alive } })
    })
    return
  }

  // ── 공유 보스: 데미지 적용 ──────────────────────────────────────
  if (method === 'POST' && url === '/boss-attack') {
    body().then(data => {
      if (!data) return json(400, { ok: false })
      if (!sharedBoss.alive) return json(200, { currentHp: 0, alive: false })

      const dmg = Number(data.damage) || 0
      sharedBoss.currentHp = Math.max(0, sharedBoss.currentHp - dmg)

      const key = `${data.channelId || 'unknown'}/${data.username || '?'}`
      if (!sharedBoss.participants[key]) {
        sharedBoss.participants[key] = { totalDamage: 0, attackCount: 0, critCount: 0,
          channelId: data.channelId || 'unknown', username: data.username || '?' }
      }
      const p = sharedBoss.participants[key]
      p.totalDamage += dmg
      p.attackCount++
      if (data.isCrit) p.critCount++

      if (sharedBoss.currentHp <= 0) {
        sharedBoss.alive     = false
        sharedBoss.currentHp = 0
      }

      json(200, { currentHp: sharedBoss.currentHp, alive: sharedBoss.alive })
    })
    return
  }

  // ── 공유 보스 설정: 조회 ────────────────────────────────────────
  if (method === 'GET' && url === '/shared-boss/settings') {
    json(200, { ok: true, settings: sharedBossSettings })
    return
  }

  // ── 공유 보스 설정: 저장 ────────────────────────────────────────
  if (method === 'POST' && url === '/shared-boss/settings') {
    body().then(data => {
      if (!data) return json(400, { ok: false })
      sharedBossSettings = { ...DEFAULT_SHARED_SETTINGS, ...sharedBossSettings, ...data }
      saveSharedSettings()
      // 켜져 있는 모든 채널에 설정 동기화
      for (const ch of allChannels()) {
        commands.set(ch, { type: 'update-settings', settings: sharedBossSettings })
      }
      json(200, { ok: true, settings: sharedBossSettings })
    })
    return
  }

  // ── 공유 보스: 시작 (idempotent) ────────────────────────────────
  if (method === 'POST' && url === '/shared-boss/start') {
    body().then(data => {
      if (!sharedBoss.alive) {
        // 전달된 설정이 있으면 먼저 저장
        if (data && Object.keys(data).length > 0) {
          sharedBossSettings = { ...DEFAULT_SHARED_SETTINGS, ...sharedBossSettings, ...data }
          saveSharedSettings()
        }
        const maxHp = sharedBossSettings.maxHp || 1000000
        sharedBoss.alive        = true
        sharedBoss.maxHp        = maxHp
        sharedBoss.currentHp    = maxHp
        sharedBoss.bossName     = sharedBossSettings.bossName || '공유 보스'
        sharedBoss.participants = {}
        sharedBoss.startedAt    = Date.now()
        // 모든 채널에 설정 동기화 + 시작 명령
        for (const ch of allChannels()) {
          commands.set(ch, { type: 'update-settings', settings: sharedBossSettings })
        }
        setTimeout(() => {
          for (const ch of allChannels()) {
            if (!commands.has(ch)) commands.set(ch, { type: 'start-boss' })
          }
        }, 50)
        json(200, { ok: true, started: true, currentHp: sharedBoss.currentHp, maxHp: sharedBoss.maxHp })
      } else {
        json(200, { ok: true, started: false, currentHp: sharedBoss.currentHp, maxHp: sharedBoss.maxHp, alive: true })
      }
    })
    return
  }

  // ── 공유 보스: 리셋 ─────────────────────────────────────────────
  if (method === 'POST' && url === '/shared-boss/reset') {
    sharedBoss.alive        = false
    sharedBoss.currentHp    = 0
    sharedBoss.participants = {}
    sharedBoss.startedAt    = null
    for (const ch of allChannels()) commands.set(ch, { type: 'reset-boss' })
    json(200, { ok: true })
    return
  }

  // ── 공유 보스: 상태 조회 ────────────────────────────────────────
  if (method === 'GET' && url === '/shared-boss') {
    json(200, { ok: true, boss: sharedBoss })
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

  // ── 대시보드: 채널 명령 ─────────────────────────────────────────
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
.empty{color:#484f58;padding:32px 0}

/* 공유 보스 카드 */
.shared-boss-card{background:#161b22;border:2px solid #1f6feb;border-radius:12px;padding:18px 20px;margin-bottom:18px}
.shared-boss-title{font-size:12px;font-weight:700;color:#58a6ff;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.shared-boss-name{font-size:20px;font-weight:800;margin-bottom:10px}
.pct{font-size:28px;font-weight:800;margin-bottom:4px}
.pct.hi{color:#f85149}.pct.md{color:#f0883e}.pct.lo{color:#3fb950}
.bar-bg{background:#21262d;border-radius:4px;height:10px;overflow:hidden;margin-bottom:8px}
.bar{height:100%;border-radius:4px;transition:width .5s}
.bar.hi{background:linear-gradient(90deg,#f85149,#da3633)}.bar.md{background:linear-gradient(90deg,#f0883e,#d29922)}.bar.lo{background:linear-gradient(90deg,#3fb950,#2ea043)}
.hp-txt{font-size:13px;color:#8b949e;margin-bottom:10px}.hp-txt b{color:#e6edf3;font-size:15px}
.shared-btns{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.btn{padding:7px 16px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;white-space:nowrap}
.btn-start{background:#238636;color:#fff}.btn-start:hover{background:#2ea043}
.btn-cfg{background:#1f6feb;color:#fff}.btn-cfg:hover{background:#388bfd}
.btn-reset{background:#21262d;color:#8b949e;border:1px solid #30363d}.btn-reset:hover{color:#e6edf3}
.btn:disabled{opacity:.35;cursor:not-allowed}

/* 참여자 테이블 */
.dmg-table{width:100%;border-collapse:collapse;font-size:11px}
.dmg-table th{color:#8b949e;font-weight:600;padding:4px 6px;border-bottom:1px solid #21262d;text-align:left}
.dmg-table td{padding:4px 6px;border-bottom:1px solid #0d1117}
.dmg-table tr:last-child td{border-bottom:none}
.r1{color:#f1c40f}.r2{color:#95a5a6}.r3{color:#cd6133}

/* 채널 상태 그리드 */
.ch-section-title{font-size:12px;color:#8b949e;font-weight:600;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px}
.card.offline{border-color:#21262d;opacity:.6}
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.card-ch{font-size:11px;color:#8b949e}
.badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.b-online{color:#3fb950;background:#1a3a1a}
.b-offline{color:#484f58;background:#1a1a1a}
.b-run{color:#58a6ff;background:#0d2137}
.b-result{color:#f0883e;background:#3a2010}

/* 채널별 설정 탭 */
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

/* ── 공유 보스 설정 모달 ── */
.modal-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100;align-items:center;justify-content:center}
.modal-backdrop.open{display:flex}
.modal{background:#161b22;border:1px solid #30363d;border-radius:14px;width:540px;max-width:95vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.6)}
.modal-head{padding:16px 20px;border-bottom:1px solid #21262d;display:flex;align-items:center;justify-content:space-between;flex:none}
.modal-head h2{font-size:15px;font-weight:700;color:#e6edf3}
.modal-close{background:none;border:none;color:#484f58;cursor:pointer;font-size:20px;line-height:1;padding:0 4px}.modal-close:hover{color:#e6edf3}
.modal-body{padding:20px;overflow-y:auto;flex:1}
.modal-section{font-size:11px;font-weight:700;color:#58a6ff;letter-spacing:.06em;text-transform:uppercase;margin:16px 0 8px;padding-bottom:5px;border-bottom:1px solid #21262d}
.modal-section:first-child{margin-top:0}
.mrow{display:flex;gap:8px;margin-bottom:10px;align-items:center}
.mrow label{width:116px;flex:none;font-size:12px;color:#8b949e}
.minput{flex:1;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;padding:6px 10px;font-size:13px;font-family:inherit}
.minput:focus{outline:none;border-color:#58a6ff}
.mcheck{width:16px;height:16px;cursor:pointer;accent-color:#58a6ff;flex:none}
.munit{font-size:11px;color:#8b949e;white-space:nowrap}
.modal-footer{padding:14px 20px;border-top:1px solid #21262d;display:flex;gap:8px;flex:none}
.btn-modal-save{flex:1;padding:9px;background:#21262d;border:1px solid #30363d;border-radius:8px;color:#c9d1d9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.btn-modal-save:hover{color:#e6edf3;border-color:#58a6ff}
.btn-modal-start{flex:2;padding:9px;background:#238636;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.btn-modal-start:hover{background:#2ea043}
.modal-status{font-size:11px;color:#8b949e;text-align:center;min-height:16px;margin-top:8px}

/* 전리품 (모달) */
.mloot-row{display:flex;gap:6px;margin-bottom:6px;align-items:center}
.mloot-num{font-size:11px;color:#484f58;width:20px;flex:none;text-align:center}
.mloot-del{background:none;border:none;color:#f85149;cursor:pointer;font-size:15px;padding:0 3px;line-height:1}
.btn-mloot-add{background:none;border:1px solid #30363d;color:#8b949e;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-family:inherit}.btn-mloot-add:hover{color:#e6edf3}
</style>
</head>
<body>
<header>
  <h1>보스전 모니터</h1>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('hp')">공유 보스</button>
    <button class="tab" onclick="switchTab('cfg')">채널별 설정</button>
  </div>
  <span id="ts"></span>
</header>

<!-- ── 공유 보스 설정 모달 ── -->
<div class="modal-backdrop" id="modal-backdrop" onclick="onBackdropClick(event)">
  <div class="modal" id="modal">
    <div class="modal-head">
      <h2>공유 보스 레이드 설정</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="modal-section">기본 정보</div>
      <div class="mrow"><label>보스 이름</label><input class="minput" id="m_name" placeholder="공유 보스"></div>
      <div class="mrow"><label>최대 HP</label><input class="minput" type="number" id="m_maxhp" min="1"><span class="munit">HP</span></div>

      <div class="modal-section">전투 설정</div>
      <div class="mrow"><label>주사위 데미지</label><input class="minput" type="number" id="m_dmg" min="1"><span class="munit">× 주사위눈 (1~12)</span></div>
      <div class="mrow"><label>별풍선 트리거</label><input class="minput" type="number" id="m_thr" min="1"><span class="munit">개</span></div>
      <div class="mrow"><label>페이즈2 전환</label><input class="minput" type="number" id="m_ph2" min="1" max="99" style="max-width:70px"><span class="munit">% 이하</span></div>

      <div class="modal-section">크리티컬</div>
      <div class="mrow">
        <label>크리티컬 활성화</label>
        <input type="checkbox" class="mcheck" id="m_crit">
      </div>
      <div class="mrow" id="m_crit_rows">
        <label>확률 / 배율</label>
        <input class="minput" type="number" id="m_critp" min="1" max="99" style="max-width:60px">
        <span class="munit">%</span>
        <input class="minput" type="number" id="m_critm" min="1" style="max-width:60px;margin-left:8px">
        <span class="munit">배</span>
      </div>

      <div class="modal-section">이미지 URL</div>
      <div style="font-size:11px;color:#484f58;margin-bottom:10px">이미지 직접 링크(URL)를 입력하면 설정 저장 시 전 채널 앱에 자동 적용됩니다</div>
      <div class="mrow"><label>Phase 1 (일반)</label><input class="minput" id="m_img1" placeholder="https://..."></div>
      <div class="mrow"><label>Phase 2 (위기)</label><input class="minput" id="m_img2" placeholder="https://..."></div>
      <div class="mrow"><label>처치 성공</label><input class="minput" id="m_imgs" placeholder="https://..."></div>

      <div class="modal-section">전리품</div>
      <div id="m_loot_list"></div>
      <button class="btn-mloot-add" onclick="addModalLoot()">+ 전리품 추가</button>
    </div>
    <div class="modal-footer">
      <button class="btn-modal-save" onclick="saveModalSettings()">설정만 저장</button>
      <button class="btn-modal-start" id="m_start_btn" onclick="saveAndStart()">저장 후 레이드 시작</button>
    </div>
    <div class="modal-status" id="m_status"></div>
  </div>
</div>

<div id="panel-hp" class="panel active">
  <div class="shared-boss-card" id="shared-card">
    <div class="shared-boss-title">공유 보스 HP (전 채널 합산)</div>
    <div id="shared-content"><div class="empty" style="padding:8px 0">로딩 중...</div></div>
  </div>
  <div class="ch-section-title" id="ch-label"></div>
  <div id="hp-grid" class="grid"></div>
</div>
<div id="panel-cfg" class="panel">
  <div class="cfg-toolbar">
    <button class="btn-add-ch" onclick="addChannel()">+ 채널 추가</button>
    <span style="font-size:11px;color:#484f58">앱 오프라인 상태에서도 설정 가능 — 앱 시작 시 자동 적용</span>
  </div>
  <div id="cfg-grid" class="cfg-grid"></div>
</div>

<script>
let currentTab   = 'hp'
let latestData   = {}
let latestShared = { alive: false, maxHp: 0, currentHp: 0, bossName: '공유 보스', participants: {} }
let modalLoot    = []
const lootState  = {}

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

/* ────────────────────────────────────────────────
   모달: 설정 창
───────────────────────────────────────────────── */
async function openModal() {
  const r = await fetch('/shared-boss/settings').then(r=>r.json()).catch(()=>({ok:false}))
  const s = r.settings || {}
  document.getElementById('m_name').value  = s.bossName || '공유 보스'
  document.getElementById('m_maxhp').value = s.maxHp    || 1000000
  document.getElementById('m_dmg').value   = s.damagePerDot || 100
  document.getElementById('m_thr').value   = s.balloonThreshold || 100
  document.getElementById('m_ph2').value   = s.phase2HpPercent || 50
  document.getElementById('m_crit').checked= s.critEnabled !== false
  document.getElementById('m_critp').value = Math.round((s.critChance||0.15)*100)
  document.getElementById('m_critm').value = s.critMultiplier || 2
  const imgs = s.imageUrls || {}
  document.getElementById('m_img1').value = imgs.phase1  || ''
  document.getElementById('m_img2').value = imgs.phase2  || ''
  document.getElementById('m_imgs').value = imgs.success || ''
  modalLoot = (s.lootItems || []).map(x=>({...x}))
  renderModalLoot()
  const alive = latestShared?.alive
  document.getElementById('m_start_btn').disabled = !!alive
  document.getElementById('m_start_btn').title = alive ? '레이드 진행 중에는 시작할 수 없습니다' : ''
  document.getElementById('m_status').textContent = ''
  document.getElementById('modal-backdrop').classList.add('open')
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open')
}
function onBackdropClick(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal()
}

function renderModalLoot() {
  const el = document.getElementById('m_loot_list')
  el.innerHTML = modalLoot.map((item,i)=>
    \`<div class="mloot-row">
      <span class="mloot-num">\${i+1}</span>
      <input class="minput" placeholder="상품명" style="flex:1.2" value="\${esc(item.name||'')}" oninput="modalLoot[\${i}].name=this.value">
      <input class="minput" placeholder="설명 (선택)" value="\${esc(item.description||'')}" oninput="modalLoot[\${i}].description=this.value">
      <button class="mloot-del" onclick="modalLoot.splice(\${i},1);renderModalLoot()">×</button>
    </div>\`
  ).join('')
}
function addModalLoot() {
  modalLoot.push({ name:'', description:'' })
  renderModalLoot()
}

function collectModalSettings() {
  return {
    bossName:         document.getElementById('m_name').value.trim()  || '공유 보스',
    maxHp:            Number(document.getElementById('m_maxhp').value) || 1000000,
    damagePerDot:     Number(document.getElementById('m_dmg').value)   || 100,
    balloonThreshold: Number(document.getElementById('m_thr').value)   || 100,
    phase2HpPercent:  Number(document.getElementById('m_ph2').value)   || 50,
    critEnabled:      document.getElementById('m_crit').checked,
    critChance:       (Number(document.getElementById('m_critp').value)||15) / 100,
    critMultiplier:   Number(document.getElementById('m_critm').value) || 2,
    lootItems:        modalLoot.filter(x => x.name.trim()),
    imageUrls: {
      phase1:  document.getElementById('m_img1').value.trim(),
      phase2:  document.getElementById('m_img2').value.trim(),
      success: document.getElementById('m_imgs').value.trim(),
    },
  }
}

async function saveModalSettings() {
  const st = document.getElementById('m_status')
  st.style.color = '#8b949e'; st.textContent = '저장 중...'
  try {
    await fetch('/shared-boss/settings', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(collectModalSettings()),
    })
    st.style.color = '#3fb950'; st.textContent = '저장 완료 ✓'
    setTimeout(() => { st.textContent = '' }, 2500)
  } catch {
    st.style.color = '#f85149'; st.textContent = '저장 실패'
  }
}

async function saveAndStart() {
  const st = document.getElementById('m_status')
  st.style.color = '#8b949e'; st.textContent = '레이드 시작 중...'
  try {
    const settings = collectModalSettings()
    await fetch('/shared-boss/start', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(settings),
    })
    st.style.color = '#3fb950'; st.textContent = '레이드 시작! 전 채널에 명령 전송됨'
    setTimeout(() => { closeModal() }, 1200)
  } catch {
    st.style.color = '#f85149'; st.textContent = '시작 실패'
  }
}

/* ────────────────────────────────────────────────
   공유 보스 렌더
───────────────────────────────────────────────── */
function renderSharedBoss(boss) {
  const el = document.getElementById('shared-content')
  const btnArea = \`<div class="shared-btns">
    <button class="btn btn-cfg" onclick="openModal()">레이드 설정</button>
    <button class="btn btn-start" \${boss.alive?'disabled':''} onclick="quickStart()">▶ 레이드 시작</button>
    \${boss.alive||boss.startedAt ? \`<button class="btn btn-reset" onclick="sharedReset()">↺ 초기화</button>\` : ''}
  </div>\`

  if (!boss.alive && !boss.startedAt) {
    el.innerHTML = \`<div style="color:#484f58;font-size:12px;margin-bottom:12px">대기 중 — 레이드를 시작하거나 설정을 변경해 주세요</div>\` + btnArea
    return
  }

  const p   = pct(boss.currentHp, boss.maxHp)
  const c   = cls(p)
  const pts = Object.entries(boss.participants || {})
    .map(([k,v])=>({...v,key:k}))
    .sort((a,b)=>(b.totalDamage||0)-(a.totalDamage||0))
  const totDmg = pts.reduce((s,r)=>s+(r.totalDamage||0),0)

  el.innerHTML = \`
    <div class="shared-boss-name">\${esc(boss.bossName)}</div>
    \${boss.alive ? \`
      <div class="pct \${c}">\${p}%</div>
      <div class="bar-bg"><div class="bar \${c}" style="width:\${p}%"></div></div>
      <div class="hp-txt"><b>\${num(boss.currentHp)}</b> / \${num(boss.maxHp)}</div>
    \` : \`<div class="hp-txt" style="color:#f85149;font-weight:700;margin-bottom:10px;font-size:16px">보스 처치!</div>\`}
    \${btnArea}
    \${pts.length ? \`<table class="dmg-table">
      <tr><th>#</th><th>채널</th><th>참여자</th><th>데미지</th><th>기여</th><th>공격</th><th>크리</th></tr>
      \${pts.slice(0,15).map((r,i)=>{
        const rCls=i===0?'r1':i===1?'r2':i===2?'r3':''
        const ct=totDmg>0?Math.round((r.totalDamage||0)/totDmg*100):0
        return \`<tr><td class="\${rCls}">\${i+1}</td><td style="color:#8b949e">\${esc(r.channelId)}</td><td>\${esc(r.username)}</td><td>\${num(r.totalDamage)}</td><td>\${ct}%</td><td>\${r.attackCount||0}</td><td>\${r.critCount||0}</td></tr>\`
      }).join('')}
    </table>\` : ''}
  \`
}

function renderChannels(data) {
  const entries = Object.entries(data)
  const grid  = document.getElementById('hp-grid')
  const label = document.getElementById('ch-label')
  if (!entries.length) { grid.innerHTML=''; label.textContent=''; return }
  label.textContent = \`채널 상태 (\${entries.length}개)\`

  grid.innerHTML = entries.map(([ch, s]) => {
    const online  = s.online
    const running = online && s.status==='running'
    const result  = online && s.status==='showing_result'
    const badgeCls= !online?'b-offline':running?'b-run':result?'b-result':'b-online'
    const badgeTxt= !online?'오프라인':running?'진행중':result?'결과표시':'대기중'
    return \`<div class="card\${!online?' offline':''}">
      <div class="card-head">
        <span class="card-ch">\${esc(ch)}</span>
        <span class="badge \${badgeCls}">\${badgeTxt}</span>
      </div>
      <div style="font-size:12px;color:#c9d1d9;margin-top:2px">\${esc(s.bossName||s.settings?.bossName||'보스')}</div>
      \${online ? \`<div style="font-size:11px;color:#484f58;margin-top:4px">\${new Date(s.updatedAt).toLocaleTimeString('ko-KR')}</div>\` : ''}
    </div>\`
  }).join('')
}

async function quickStart() {
  await fetch('/shared-boss/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
}

async function sharedReset() {
  if (!confirm('공유 보스를 초기화할까요? 모든 채널에 reset 명령이 전송됩니다.')) return
  await fetch('/shared-boss/reset', { method:'POST' })
}

/* ── 채널별 설정 탭 ── */
function renderCfg() {
  const data = latestData
  const chSet = new Set([...Object.keys(data)])
  fetch('/boss-settings').then(r=>r.json()).then(j=>{
    if (j.settings) Object.keys(j.settings).filter(k=>k!=='__shared__').forEach(k=>chSet.add(k))
    const entries = [...chSet].map(ch => [ch, {
      ...(data[ch]||{}),
      settings: j.settings?.[ch] || data[ch]?.settings || {},
      online: data[ch]?.online || false,
    }])
    const grid = document.getElementById('cfg-grid')
    if (!entries.length) { grid.innerHTML='<div class="empty">채널이 없습니다</div>'; return }

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
    const [hpRes, sbRes] = await Promise.all([
      fetch('/boss-hp'),
      fetch('/shared-boss'),
    ])
    latestData   = await hpRes.json()
    const sbJson = await sbRes.json()
    latestShared = sbJson.boss || latestShared

    if (currentTab === 'hp') {
      renderSharedBoss(latestShared)
      renderChannels(latestData)
    }
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
