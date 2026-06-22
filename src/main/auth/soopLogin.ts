import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

const SOOP_LOGIN_URL =
  'https://login.sooplive.com/afreeca/login.php?szFrom=full&request_uri=https%3A%2F%2Fwww.sooplive.com%2F'

export interface SoopIdentity { id: string; name: string }

export function openSoopLoginWindow(parentWin?: BrowserWindow): Promise<SoopIdentity | null> {
  return new Promise((resolve) => {
    const opts: BrowserWindowConstructorOptions = {
      width: 480,
      height: 680,
      title: 'SOOP 로그인',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Reuse main session so cookies persist between app launches
        session: parentWin?.webContents.session,
      },
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
    }
    if (parentWin) opts.parent = parentWin

    const win = new BrowserWindow(opts)

    let resolved = false
    const done = (result: SoopIdentity | null) => {
      if (resolved) return
      resolved = true
      try { if (!win.isDestroyed()) win.close() } catch {}
      resolve(result)
    }

    const tryExtract = async (): Promise<boolean> => {
      try {
        const cookies = await win.webContents.session.cookies.get({ domain: '.sooplive.com' })
        const ut = cookies.find(c => c.name === 'UserTicket')
        if (!ut?.value) return false
        let val = ut.value
        try { val = decodeURIComponent(val) } catch {}
        const q = new URLSearchParams(val)
        const id = (q.get('uid') ?? '').trim()
        const name = (q.get('unick') ?? id).trim()
        if (id) { done({ id, name }); return true }
      } catch {}
      return false
    }

    // Skip "비밀번호 변경 안내" page automatically (same as byulpung app)
    const skipCampaign = () => {
      win.webContents.executeJavaScript(
        `(() => { const b = document.querySelector("#btnNextTime,.btn_pwdncg"); if (b) b.click(); })()`
      ).catch(() => {})
    }

    win.webContents.on('did-navigate', async (_, url) => {
      if (/campaign_pw\.php|member\.sooplive\.com/i.test(url)) {
        skipCampaign()
        return
      }
      // Left login domain → login complete
      if (!/login\.sooplive\.com/i.test(url)) {
        const ok = await tryExtract()
        if (!ok) {
          // Cookies may not have settled yet — retry after short delay
          setTimeout(async () => { if (!await tryExtract()) done(null) }, 1500)
        }
      }
    })

    win.webContents.on('did-navigate-in-page', (_, url) => {
      if (/campaign_pw\.php|member\.sooplive\.com/i.test(url)) skipCampaign()
    })

    win.on('closed', () => done(null))

    win.loadURL(SOOP_LOGIN_URL)
  })
}
