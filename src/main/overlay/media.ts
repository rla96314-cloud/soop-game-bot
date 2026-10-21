// 사용자 미디어 폴더: <userData>/data/media/<game>/ — 오버레이가 영상·이미지 클립을 재생할 때 사용
import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

export const MEDIA_TYPES: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
}

export function mediaDir(game: string): string {
  const safe = game.replace(/[^a-z]/g, '')
  const dir  = join(app.getPath('userData'), 'data', 'media', safe)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listMedia(game: string): string[] {
  try {
    return readdirSync(mediaDir(game)).filter(f => MEDIA_TYPES[f.split('.').pop()?.toLowerCase() ?? '']).sort()
  } catch { return [] }
}
