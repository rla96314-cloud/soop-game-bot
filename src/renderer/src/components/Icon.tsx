// 디자인 폴더의 24×24 SVG 아이콘(currentColor)을 인라인으로 렌더링
const RAW = import.meta.glob('../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const ICONS: Record<string, string> = {}
for (const [path, svg] of Object.entries(RAW)) {
  const name = path.split('/').pop()!.replace('.svg', '')
  ICONS[name] = svg
}

export type IconName =
  | 'broadcast' | 'calendar' | 'chart' | 'check' | 'chevron-down' | 'chevron-right' | 'clock' | 'copy'
  | 'dashboard' | 'delete' | 'download' | 'edit' | 'external' | 'filter' | 'fishing' | 'gamepad' | 'gift'
  | 'help' | 'ladder' | 'link' | 'lottery' | 'monitor' | 'number' | 'pause' | 'pickboard' | 'play' | 'plus'
  | 'quiz' | 'race' | 'refresh' | 'roulette' | 'rps' | 'search' | 'settings' | 'slot' | 'users' | 'volume'

export default function Icon({ name, size = 18, className, style }: {
  name: IconName | string
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  const svg = ICONS[name]
  if (!svg) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
