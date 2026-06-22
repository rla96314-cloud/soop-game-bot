import https from 'https'

const SHEET_ID = '1BsAtW0sfSRjyJOQAe3mgVzYuRLa6rUasWOfPca1kEQw'

export interface MemberSchedule {
  name:    string
  time:    string   // "4PM", "2pm", "X", "???", ""
  content: string   // activity description
  isOff:   boolean  // true when time is "X" / "x"
}

export interface DaySchedule {
  weekRange: string          // "0622 ~ 0628"
  dayName:   string          // "월" | "화" | ...
  date:      string          // "2026-06-22"
  members:   MemberSchedule[]
  fetchedAt: number
}

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache: DaySchedule | null = null
let _cacheTtl = 0
const CACHE_MS = 30 * 60 * 1000

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2 }
      else if (ch === '"')                    { inQuotes = false; i++ }
      else                                    { field += ch; i++ }
    } else {
      if      (ch === '"')  { inQuotes = true; i++ }
      else if (ch === ',')  { row.push(field); field = ''; i++ }
      else if (ch === '\r') { i++ }
      else if (ch === '\n') {
        row.push(field); rows.push(row)
        row = []; field = ''; i++
      } else { field += ch; i++ }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()                 // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function toSheetName(date: Date): string {
  const monday = getMondayOf(date)
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${mm}${dd}`
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, depth = 0) => {
      if (depth > 5) return reject(new Error('Too many redirects'))
      https.get(u, { headers: { 'User-Agent': 'soop-game-bot/1.0' } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.headers.location)
          return follow(res.headers.location, depth + 1)
        let body = ''
        res.setEncoding('utf-8')
        res.on('data', d => { body += d })
        res.on('end', () => resolve(body))
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

// ── Main fetch ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// Column index map: getDay() → CSV column index
// CSV cols: 2=월, 3=화, 4=수, 5=목, 6=금, 7=토, 8=일
function dayColIdx(dow: number): number {
  return dow === 0 ? 8 : dow + 1
}

export async function fetchTodaySchedule(force = false): Promise<DaySchedule> {
  if (!force && _cache && Date.now() < _cacheTtl) return _cache

  const today    = new Date()
  const dow      = today.getDay()
  const colIdx   = dayColIdx(dow)
  const dateStr  = today.toISOString().slice(0, 10)
  const dayName  = DAY_NAMES[dow]
  const sheet    = toSheetName(today)
  const url      = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheet}`

  const csv  = await httpsGet(url)
  const rows = parseCSV(csv)

  // Row 0: ["", "MMDD ~ MMDD", ...]
  const weekRange = rows[0]?.[1]?.trim() ?? sheet

  const members: MemberSchedule[] = []
  let i = 2   // skip week-range row (0) and header row (1)

  while (i < rows.length) {
    const nameRow    = rows[i]     ?? []
    const contentRow = rows[i + 1] ?? []

    const name = nameRow[1]?.trim()
    if (!name) { i++; continue }

    const time    = nameRow[colIdx]?.trim()    ?? ''
    const content = contentRow[colIdx]?.trim() ?? ''
    const isOff   = time.toLowerCase() === 'x' || time === ''

    members.push({ name, time, content, isOff })
    i += 2
  }

  const result: DaySchedule = { weekRange, dayName, date: dateStr, members, fetchedAt: Date.now() }
  _cache    = result
  _cacheTtl = Date.now() + CACHE_MS
  return result
}
