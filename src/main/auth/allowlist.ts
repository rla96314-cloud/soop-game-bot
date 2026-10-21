import https from 'https'

const SHEET_API = 'https://script.google.com/macros/s/AKfycbwHzJgDCwHEPRrNXk0Q8puWely5U15Rd71JyCvFdNjvAUdUgk9-7INlps-lYuf3UW7h/exec'
const TIMEOUT_MS = 10000

export interface AllowEntry { id: string; name: string }

/** 검증 실패 종류 — 네트워크 오류와 "목록에 없음"을 구분해야 오프라인 유예 판단이 가능 */
export type VerifyResult =
  | { ok: true;  user: AllowEntry }
  | { ok: false; reason: 'denied' | 'network'; error: string }

let _cache: AllowEntry[] | null = null
let _cacheAt = 0
const CACHE_TTL = 5 * 60 * 1000

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, depth = 0) => {
      if (depth > 5) return reject(new Error('Too many redirects'))
      const req = https.get(u, { headers: { 'User-Agent': 'soop-game-bot/2' }, timeout: TIMEOUT_MS }, res => {
        const code = res.statusCode ?? 0
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume()
          return follow(res.headers.location, depth + 1)
        }
        if (code < 200 || code >= 300) {
          res.resume()
          return reject(new Error(`HTTP ${code}`))
        }
        let body = ''
        res.setEncoding('utf-8')
        res.on('data', d => { body += d })
        res.on('end', () => resolve(body))
        res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.on('error', reject)
    }
    follow(url)
  })
}

export async function fetchAllowlist(force = false): Promise<AllowEntry[]> {
  if (!force && _cache && Date.now() - _cacheAt < CACHE_TTL) return _cache

  const body = await httpsGet(`${SHEET_API}?action=listAllow`)
  const data = JSON.parse(body)
  if (!data.ok) throw new Error(data.error || 'listAllow 실패')

  _cache  = ((data.list || []) as AllowEntry[]).filter(e => e && typeof e.id === 'string')
  _cacheAt = Date.now()
  return _cache
}

/** SOOP 아이디로만 비교한다 — 이름(닉네임) 비교는 uid 가 우연히 같은 외부인을 통과시킴 */
export async function verifyUser(id: string): Promise<VerifyResult> {
  const norm = (id ?? '').trim().toLowerCase()
  if (!norm) return { ok: false, reason: 'denied', error: '아이디가 비어 있습니다.' }
  try {
    const list = await fetchAllowlist()
    const user = list.find(e => e.id.trim().toLowerCase() === norm)
    if (user) return { ok: true, user: { id: user.id.trim(), name: (user.name ?? user.id).trim() } }
    return { ok: false, reason: 'denied', error: '허용되지 않은 계정입니다.' }
  } catch (err) {
    return { ok: false, reason: 'network', error: `허용 목록을 확인할 수 없습니다 (${String((err as Error).message ?? err)})` }
  }
}
