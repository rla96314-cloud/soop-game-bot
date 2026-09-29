import { useEffect, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import GameLibrary from './GameLibrary'
import GameConfig from './GameConfig'
import GamePreview from './GamePreview'
import styles from './Games.module.css'

export default function GamesPage({ initialSelected, onHelp }: { initialSelected?: string; onHelp?: () => void }) {
  const { settings } = useApp()
  const [selected, setSelected] = useState<string>(initialSelected ?? 'roulette')
  useEffect(() => { if (initialSelected) setSelected(initialSelected) }, [initialSelected])
  const port = ((settings?.overlay as Record<string, unknown> | undefined)?.port as number) ?? 3939

  return (
    <div className={styles.layout}>
      <GameLibrary selected={selected} onSelect={setSelected} />
      <GameConfig key={selected} gameId={selected} port={port} onHelp={onHelp} />
      <GamePreview key={`pv-${selected}`} gameId={selected} port={port} />
    </div>
  )
}
