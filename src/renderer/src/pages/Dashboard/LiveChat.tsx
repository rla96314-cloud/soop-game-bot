import { useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import styles from './LiveChat.module.css'

const AVATARS = ['🐱','⭐','🎮','🍀','🌊','🎲','🍗','💨','🌙','💻','🍉','😊','🧙','✨','🔥']
const avatarFor = (user: string) => AVATARS[user.charCodeAt(0) % AVATARS.length]

const PAGE_SIZE = 7

export default function LiveChat() {
  const { chat } = useApp()
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(chat.length / PAGE_SIZE))
  const items = chat.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const fmtTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>실시간 채팅 &amp; 후원</span>
        <button className={styles.more} onClick={() => setPage(0)}>새로고침</button>
      </div>

      <div className={styles.list}>
        {items.length === 0 && (
          <div className={styles.empty}>SOOP 채팅 연결 대기 중...</div>
        )}
        {items.map((item, i) => (
          <div key={i} className={`${styles.row} ${item.isBalloon ? styles.balloonRow : ''}`}>
            <div className={styles.avatar}>{avatarFor(item.user)}</div>
            <span className={styles.user}>{item.user}</span>
            {item.isBalloon && (
              <div className={styles.balloon}>
                <span className={styles.star}>⭐</span>
                <span className={styles.amount}>{item.amount?.toLocaleString()}</span>
              </div>
            )}
            <span className={styles.cmd}>{item.message}</span>
            <span className={styles.time}>{fmtTime(item.ts)}</span>
          </div>
        ))}
      </div>

      <div className={styles.pagination}>
        <button
          className={styles.pageBtn}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >‹</button>
        <span className={styles.pageInfo}>{page + 1}/{totalPages}</span>
        <button
          className={styles.pageBtn}
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page === totalPages - 1}
        >›</button>
      </div>
    </div>
  )
}
