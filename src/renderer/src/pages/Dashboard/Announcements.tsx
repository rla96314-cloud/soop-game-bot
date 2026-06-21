import styles from './Announcements.module.css'

const NOTICES = [
  { icon: '🎮', text: "신규 게임 '경주' 추가!", date: '05-20', type: 'new' },
  { icon: '🎉', text: '이벤트 : 주말 보너스!', date: '05-18', type: 'event' },
  { icon: '🔧', text: '점검 안내 (5/25 오전 2시~4시)', date: '05-15', type: 'notice' },
  { icon: '📢', text: '봇 업데이트 v1.3.0 안내', date: '05-10', type: 'update' },
]

export default function Announcements() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>공지사항</span>
        <button className={styles.more}>더보기 ›</button>
      </div>
      <div className={styles.list}>
        {NOTICES.map((n, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.icon}>{n.icon}</span>
            <span className={styles.text}>{n.text}</span>
            <span className={styles.date}>{n.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
