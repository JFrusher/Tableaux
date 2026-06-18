import { getTableType } from '../../utils/tableTypes.js'
import { getTableGeometry } from '../../utils/seatPositions.js'

/**
 * Schematic SVG of a table type, derived from the real seat geometry so the
 * thumbnail always matches the table it creates. Used in the palette, the drag
 * preview, and the table inspector's type selector.
 */
export default function TableThumbnail({ type, table, size = 30, seatColour = 'var(--accent)' }) {
  const resolved = table || { type, capacity: Math.min(getTableType(type).defaultCapacity, 8) }
  const def = getTableType(resolved.type)
  const geom = getTableGeometry(resolved)

  let minX = -geom.width / 2
  let maxX = geom.width / 2
  let minY = -geom.height / 2
  let maxY = geom.height / 2
  const dot = 4
  geom.seats.forEach((s) => {
    minX = Math.min(minX, s.x - dot)
    maxX = Math.max(maxX, s.x + dot)
    minY = Math.min(minY, s.y - dot)
    maxY = Math.max(maxY, s.y + dot)
  })
  const bw = maxX - minX
  const bh = maxY - minY

  let shape
  if (geom.shape === 'circle') {
    shape = <circle cx={0} cy={0} r={geom.radius} />
  } else if (geom.shape === 'rect') {
    shape = (
      <rect
        x={-geom.width / 2}
        y={-geom.height / 2}
        width={geom.width}
        height={geom.height}
        rx={geom.rounded ? 14 : 6}
      />
    )
  } else {
    shape = <path d={`M ${-geom.radius} ${geom.cy} A ${geom.radius} ${geom.radius} 0 0 1 ${geom.radius} ${geom.cy} Z`} />
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${minX} ${minY} ${bw} ${bh}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill={def.distinctColour ? def.distinctColour : 'var(--surface-subtle)'} fillOpacity={def.distinctColour ? 0.35 : 1} stroke="var(--ink-soft)" strokeWidth={1.5}>
        {shape}
      </g>
      <g fill={seatColour}>
        {geom.seats.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={dot} />
        ))}
      </g>
    </svg>
  )
}
