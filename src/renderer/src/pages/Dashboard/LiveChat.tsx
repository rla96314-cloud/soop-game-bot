import { useState } from 'react'
import styles from './LiveChat.module.css'

const CHAT_PAGES = [
  [
    { user: '도라이몽', amount: 1000, cmd: '룰렛 가자!', time: '14:22', avatar: '🐱' },
    { user: '별하늘', amount: 500, cmd: '보스전 공략!!', time: '14:21', avatar: '⭐' },
    { user: '게임사랑', amount: 100, cmd: '!퀴즈', time: '14:21', avatar: '🎮' },
    { user: '행운아', amount: 300, cmd: '!뽑기', time: '14:20', avatar: '🍀' },
    { user: '바다소년', amount: 200, cmd: '!사다리', time: '14:20', avatar: '🌊' },
    { user: '랜더걸', amount: 1000, cmd: '대박 기원!', time: '14:19', avatar: '🎲' },
    { user: '치킨좋아', amount: 100, cmd: '!슬롯', time: '14:19', avatar: '🍗' },
  ],
  [
    { user: '하늘바람', amount: 500, cmd: '!룰렛', time: '14:18', avatar: '💨' },
    { user: '달빛소녀', amount: 1500, cmd: '스핀 해줘!', time: '14:17', avatar: '🌙' },
    { user: '코딩왕자', amount: 200, cmd: '!보스전', time: '14:17', avatar: '💻' },
    { user: '수박좋아', amount: 300, cmd: '!뽑기', time: '14:16', avatar: '🍉' },
    { user: '행복이', amount: 100, cmd: '!퀴즈', time: '14:15', avatar: '😊' },
    { user: '마법사', amount: 700, cmd: '룰렛 부탁!', time: '14:14', avatar: '🧙' },
    { user: '별빛', amount: 50, cmd: '!사다리', time: '14:13', avatar: '✨' },
  ],
]

export default function LiveChat() {
  const [page, setPage] = useState(0)
  const totalPages = CHAT_PAGES.length
  const items = CHAT_PAGES[page]

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>실시간 채팅 &amp; 후원</span>
        <button className={styles.more}>더보기 ›</button>
      </div>

      <div className={styles.list}>
        {items.map((item, i) => (
          <div key={i} className={styles.row}>
            <div className={styles.avatar}>{item.avatar}</div>
            <span className={styles.user}>{item.user}</span>
            <div className={styles.balloon}>
              <span className={styles.star}>⭐</span>
              <span className={styles.amount}>{item.amount.toLocaleString()}</span>
            </div>
            <span className={styles.cmd}>{item.cmd}</span>
            <span className={styles.time}>{item.time}</span>
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
