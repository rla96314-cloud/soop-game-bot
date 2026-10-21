import { BrowserWindow, BrowserWindowConstructorOptions, session as electronSession, type Session } from 'electron'

const SOOP_LOGIN_URL =
  'https://login.sooplive.com/afreeca/login.php?szFrom=full&request_uri=https%3A%2F%2Fwww.sooplive.com%2F'
const SOOP_COOKIE_DOMAIN = '.sooplive.com'
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

export interface SoopIdentity { id: string; name: string }

function parseTicket(value: string): SoopIdentity | null {
  let val = value
  try { val = decodeURIComponent(val) } catch {}
  const q = new URLSearchParams(val)
  const id = (q.get('uid') ?? '').trim()
  if (!id) return null
  return { id, name: (q.get('unick') ?? id).trim() }
}

export async function readSoopIdentity(ses: Session): Promise<SoopIdentity | null> {
  try {
    const cookies = await ses.cookies.get({ domain: SOOP_COOKIE_DOMAIN })
    const ut = cookies.find(c => c.name === 'UserTicket')
    return ut?.value ? parseTicket(ut.value) : null
  } catch { return null }
}

/** 로그아웃: SOOP 쿠키를 지워야 다음 로그인에서 다른 계정으로 바꿀 수 있다 */
export async function clearSoopCookies(ses: Session = electronSession.defaultSession): Promise<void> {
  try {
    const cookies = await ses.cookies.get({ domain: SOOP_COOKIE_DOMAIN })
    await Promise.all(cookies.map(c => {
      const url = `${c.secure ? 'https' : 'http'}://${(c.domain ?? 'sooplive.com').replace(/^\./, '')}${c.path ?? '/'}`
      return ses.cookies.remove(url, c.name).catch(() => {})
    }))
  } catch {}
}

/**
 * SOOP 로그인 창.
 * 완료 판정은 "login 도메인을 벗어났는지"가 아니라 UserTicket 쿠키가 생겼는지로 한다 —
 * 네이버/카카오 등 SNS 로그인은 중간에 다른 도메인을 거치므로 도메인 판정이면 창이 강제로 닫힌다.
 */
export function openSoopLoginWindow(parentWin?: BrowserWindow): Promise<SoopIdentity | null> {
  return new Promise((resolve) => {
    const ses = parentWin?.webContents.session ?? electronSession.defaultSession
    const opts: BrowserWindowConstructorOptions = {
      width: 480,
      height: 680,
      title: 'SOOP 로그인',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        session: ses,   // 메인 세션 공유 → 앱 재시작 후에도 쿠키 유지
      },
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
    }
    if (parentWin) opts.parent = parentWin

    const win = new BrowserWindow(opts)

    let resolved = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const onCookieChanged = (_e: unknown, cookie: Electron.Cookie, _cause: unknown, removed: boolean) => {
      if (removed || cookie.name !== 'UserTicket') return
      const who = parseTicket(cookie.value)
      if (who) done(who)
    }
    const done = (result: SoopIdentity | null) => {
      if (resolved) return
      resolved = true
      if (timeout) clearTimeout(timeout)
      ses.cookies.removeListener('changed', onCookieChanged)
      try { if (!win.isDestroyed()) win.close() } catch {}
      resolve(result)
    }

    ses.cookies.on('changed', onCookieChanged)
    timeout = setTimeout(() => done(null), LOGIN_TIMEOUT_MS)

    // Skip "비밀번호 변경 안내" page automatically
    const skipCampaign = () => {
      win.webContents.executeJavaScript(
        `(() => { const b = document.querySelector("#btnNextTime,.btn_pwdncg"); if (b) b.click(); })()`
      ).catch(() => {})
    }
    win.webContents.on('did-navigate', (_, url) => {
      if (/campaign_pw\.php|member\.sooplive\.com/i.test(url)) skipCampaign()
    })
    win.webContents.on('did-navigate-in-page', (_, url) => {
      if (/campaign_pw\.php|member\.sooplive\.com/i.test(url)) skipCampaign()
    })
    // 로그인 페이지가 새 창을 띄우려 하면(약관 등) 같은 창에서 열지 않고 거부
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    win.on('closed', () => done(null))

    // 이미 쿠키가 있으면(이전 세션) 바로 완료
    readSoopIdentity(ses).then(who => { if (who) done(who) })

    win.loadURL(SOOP_LOGIN_URL).catch(() => {})
  })
}
