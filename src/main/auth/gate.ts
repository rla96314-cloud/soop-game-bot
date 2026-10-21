// 인증 게이트 — 메인 프로세스가 로그인 상태를 판단한다 (렌더러 화면만 믿지 않음)
//
//  - 저장된 user 가 있고
//  - 마지막 검증(verifiedAt)이 OFFLINE_GRACE_MS 안이면 인증됨
//  재검증이 네트워크 오류로 실패해도 유예 기간 안에서는 계속 쓸 수 있고, 지나면 다시 로그인.
import { loadSettings, patchSettings, type AuthUser } from '../store/settings'
import { verifyUser, type VerifyResult } from './allowlist'

export const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000

export function currentUser(): AuthUser | null {
  return loadSettings().user ?? null
}

export function isAuthed(now = Date.now()): boolean {
  const u = currentUser()
  if (!u?.id) return false
  const at = u.verifiedAt ?? 0
  return now - at < OFFLINE_GRACE_MS
}

export function setAuthedUser(user: { id: string; name: string } | null) {
  patchSettings({ user: user ? { ...user, verifiedAt: Date.now() } : null })
}

/** 저장된 사용자를 다시 검증. 네트워크 오류면 유예 기간 안에서는 ok 로 취급 */
export async function recheckSaved(): Promise<VerifyResult & { grace?: boolean }> {
  const u = currentUser()
  if (!u?.id) return { ok: false, reason: 'denied', error: '저장된 사용자 없음' }
  const r = await verifyUser(u.id)
  if (r.ok) { setAuthedUser(r.user); return r }
  if (r.reason === 'denied') { setAuthedUser(null); return r }
  // network
  if (isAuthed()) return { ok: true, user: { id: u.id, name: u.name }, grace: true }
  setAuthedUser(null)
  return { ok: false, reason: 'network', error: `${r.error} — 오프라인 유예 기간(24시간)이 지나 다시 로그인해야 합니다.` }
}
