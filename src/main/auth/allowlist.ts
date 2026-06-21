import https from 'https'

const SHEET_API = 'https://script.google.com/macros/s/AKfycbxOJbEdv6KcjyXv_GDz4vek74vh0Ubn2oRxhuX_dIdJ8HMrcJ6tx1WuvoraDYSI7Zwo/exec'

export interface AllowEntry { id: string; name: string }

let _cache: AllowEntry[] | null = null
let _cacheAt = 0
const CACHE_TTL = 5 * 60 * 1000

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, depth = 0) => {
      if (depth > 5) return reject(new Error('Too many redirects'))
      https.get(u, { headers: { 'User-Agent': 'soop-game-bot/0.2' } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, depth + 1)
        }
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

export async function fetchAllowlist(force = false): Promise<AllowEntry[]> {
  if (!force && _cache && Date.now() - _cacheAt < CACHE_TTL) return _cache

  const body = await httpsGet(`${SHEET_API}?action=listAllow`)
  const data = JSON.parse(body)
  if (!data.ok) throw new Error(data.error || 'listAllow 실패')

  _cache  = (data.list || []) as AllowEntry[]
  _cacheAt = Date.now()
  return _cache
}

export async function verifyUser(id: string): Promise<{ ok: boolean; user?: AllowEntry; error?: string }> {
  try {
    const list = await fetchAllowlist()
    const norm = id.trim().toLowerCase()
    const user = list.find(e =>
      (e.id   && e.id.trim().toLowerCase()   === norm) ||
      (e.name && e.name.trim().toLowerCase() === norm)
    )
    if (user) return { ok: true, user }
    return { ok: false, error: '허용되지 않은 계정입니다.' }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
