import RecentHistory from './RecentHistory'
import GameGrid      from './GameGrid'
import TodayStats    from './TodayStats'
import Schedule      from './Schedule'
import StatsHeader   from './StatsHeader'
import styles from './Dashboard.module.css'

export default function Dashboard({ onNavigateToGame }: { onNavigateToGame: (id: string) => void }) {
  return (
    <div className={styles.page}>
      <StatsHeader />
      <div className={styles.content}>
        <div className={styles.columns}>
          <div className={styles.colLeft}>
            <RecentHistory />
          </div>
          <div className={styles.colMid}>
            <GameGrid onNavigateToGame={onNavigateToGame} />
          </div>
          <div className={styles.colRight}>
            <TodayStats />
            <Schedule />
          </div>
        </div>
      </div>
    </div>
  )
}
