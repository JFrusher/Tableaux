import { useStore } from '../../store/useStore.js'
import { DEFAULT_PPU } from '../../utils/seatPositions.js'
import { toDisplay } from '../../utils/units.js'

// Alignment lines use the accent; centring/wall/equal-spacing guides use a
// distinct colour so "this edge lines up" reads differently from "these gaps
// are equal / this is centred".
const ALIGN = 'var(--accent)'
const MEASURE = '#16B8A6'
const TICK = 5 // half-length of spacing end ticks, canvas px

const colourFor = (g) => (g.variant === 'align' ? ALIGN : MEASURE)

function Spacing({ g, ppu, system }) {
  const els = []
  g.segments.forEach((seg, si) => {
    const [a, b] = seg
    if (g.axis === 'x') {
      els.push(<line key={`l${si}`} x1={a} y1={g.perp} x2={b} y2={g.perp} stroke={MEASURE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)
      els.push(<line key={`a${si}`} x1={a} y1={g.perp - TICK} x2={a} y2={g.perp + TICK} stroke={MEASURE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)
      els.push(<line key={`b${si}`} x1={b} y1={g.perp - TICK} x2={b} y2={g.perp + TICK} stroke={MEASURE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)
    } else {
      els.push(<line key={`l${si}`} x1={g.perp} y1={a} x2={g.perp} y2={b} stroke={MEASURE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)
      els.push(<line key={`a${si}`} x1={g.perp - TICK} y1={a} x2={g.perp + TICK} y2={a} stroke={MEASURE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)
      els.push(<line key={`b${si}`} x1={g.perp - TICK} y1={b} x2={g.perp + TICK} y2={b} stroke={MEASURE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)
    }
  })
  const [a0, b0] = g.segments[0]
  const label = toDisplay(g.dist / ppu, system).label
  const lx = g.axis === 'x' ? (a0 + b0) / 2 : g.perp + 8
  const ly = g.axis === 'x' ? g.perp - 8 : (a0 + b0) / 2
  els.push(
    <text
      key="lbl"
      x={lx}
      y={ly}
      fill={MEASURE}
      fontSize={11}
      textAnchor={g.axis === 'x' ? 'middle' : 'start'}
      dominantBaseline="middle"
      style={{ paintOrder: 'stroke', stroke: '#FAF8F5', strokeWidth: 3 }}
    >
      {label}
    </text>
  )
  return <g>{els}</g>
}

/**
 * SVG overlay for live alignment/spacing guides while a table is dragged. Reads
 * the ephemeral `dragGuides` set by the table-drag handler and renders inside
 * the canvas world layer so it inherits pan/zoom. Lines use a non-scaling stroke
 * to stay crisp at any zoom.
 */
export default function AlignmentGuides() {
  const guides = useStore((s) => s.dragGuides)
  const ppu = useStore((s) => s.settings.pixelsPerUnit || DEFAULT_PPU)
  const system = useStore((s) => s.settings.unitSystem || 'metric')
  if (!guides || !guides.length) return null

  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      width="1"
      height="1"
    >
      {guides.map((g, i) => {
        if (g.kind === 'spacing') return <Spacing key={i} g={g} ppu={ppu} system={system} />
        const [x1, y1, x2, y2] =
          g.axis === 'v' ? [g.pos, g.start, g.pos, g.end] : [g.start, g.pos, g.end, g.pos]
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={colourFor(g)}
            strokeWidth={1}
            strokeDasharray={g.variant === 'align' ? undefined : '5 4'}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}
