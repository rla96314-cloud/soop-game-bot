// 창 크기에 맞춘 자동 배율: 기준 화면 1440×900 이 항상 다 보이도록 zoomFactor 계산
// (가로·세로 중 작은 비율 사용 → 잘리는 쪽 없음. 넓은 창은 CSS 뷰포트가 넓어져 그리드가 옆으로 늘어남)
import type { BrowserWindow } from 'electron'
import { loadSettings } from './store/settings'

export const BASE_W = 1440
export const BASE_H = 900

export function applyAutoZoom(win: BrowserWindow) {
  if (win.isDestroyed()) return
  const [w, h] = win.getContentSize()
  const fit   = Math.min(w / BASE_W, h / BASE_H)
  const scale = (loadSettings().ui?.scale ?? 100) / 100
  const z     = Math.max(0.5, Math.min(3, fit * scale))
  win.webContents.setZoomFactor(z)
}
