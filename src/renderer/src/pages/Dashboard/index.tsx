import StatsHeader from './StatsHeader'
import LiveChat from './LiveChat'
import GameShortcuts from './GameShortcuts'
import RecentHistory from './RecentHistory'
import TodayStats from './TodayStats'
import Announcements from './Announcements'
import GameGrid from './GameGrid'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  return (
    <div className={styles.page}>
      <StatsHeader />
      <div className={styles.content}>
        {/* 3-column layout */}
        <div className={styles.columns}>
          <div className={styles.colLeft}>
            <LiveChat />
          </div>
          <div className={styles.colMid}>
            <GameShortcuts />
            <RecentHistory />
          </div>
          <div className={styles.colRight}>
            <TodayStats />
            <Announcements />
          </div>
        </div>
        {/* Game grid */}
        <GameGrid />
      </div>
    </div>
  )
}
