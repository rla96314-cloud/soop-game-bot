import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './Overlay.module.css'

const GAMES = [
  { id: 'roulette', icon: '🎡', name: '룰렛'     },
  { id: 'ladder',   icon: '🪜', name: '사다리타기' },
  { id: 'boss',     icon: '👾', name: '보스전'    },
  { id: 'gacha',    icon: '🎁', name: '뽑기'     },
  { id: 'quiz',     icon: '❓', name: '퀴즈'     },
  { id: 'slot',     icon: '🎰', name: '슬롯머신'  },
  { id: 'race',     icon: '🏁', name: '경주'     },
  { id: 'rps',      icon: '✊', name: '가위바위보' },
  { id: 'fish',     icon: '🎣', name: '낚시'     },
  { id: 'lottery',  icon: '🎟️', name: '복권'     },
  { id: 'number',   icon: '🔢', name: '숫자 추첨' },
]

export default function OverlayPage() {
  const { settings } = useApp()
  const port = (settings?.overlay as Record<string, unknown> | undefined)?.port ?? 3939

  const [copied, setCopied] = useState('')

  const copy = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const openInBrowser = (gameId: string, url: string) => {
    const el = (window as unknown as Record<string, unknown>).electron as Record<string, (...args: unknown[]) => unknown>
    if (el?.overlayOpen) el.overlayOpen(gameId)
    else window.open(url, '_blank')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>OBS 오버레이</h1>
        <p className={styles.sub}>각 게임의 URL을 OBS 브라우저 소스에 추가하세요.</p>
      </div>

      <div className={styles.infoBox}>
        <span className={styles.infoIcon}>💡</span>
        <div>
          OBS에서 <strong>소스 추가 → 브라우저 소스</strong>를 클릭하고 아래 URL을 붙여넣으세요.{' '}
          권장 해상도: <strong>1920 × 1080</strong> / 배경 투명 설정 필요
          {port !== 3939 && (
            <span className={styles.portNote}> · 현재 포트: {String(port)}</span>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {GAMES.map(g => {
          const url      = `http://localhost:${port}/overlay/${g.id}`
          const isCopied = copied === g.id
          return (
            <div key={g.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.gameIcon}>{g.icon}</span>
                <span className={styles.gameName}>{g.name}</span>
              </div>
              <div className={styles.urlBox}>{url}</div>
              <div className={styles.cardActions}>
                <button
                  className={`${styles.copyBtn} ${isCopied ? styles.copyBtnDone : ''}`}
                  onClick={() => copy(url, g.id)}
                >
                  {isCopied ? '✓ 복사됨' : '📋 URL 복사'}
                </button>
                <button
                  className={styles.previewBtn}
                  onClick={() => openInBrowser(g.id, url)}
                >
                  미리보기
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
