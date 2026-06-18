import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore.js'
import { DEFAULT_PPU } from '../../utils/seatPositions.js'
import { CM_PER_FOOT } from '../../utils/units.js'
import ContextMenu, { useContextMenu } from '../ui/ContextMenu.jsx'
import ColorPicker from '../ui/ColorPicker.jsx'
import Icon from '../ui/Icon.jsx'
import styles from './RoomSpaces.module.css'

/** Bounding box of a space in absolute canvas coords. */
function bbox(sp) {
  if (sp.shape === 'polygon') {
    const xs = sp.vertices.map((v) => sp.x + v.x)
    const ys = sp.vertices.map((v) => sp.y + v.y)
    return {
      minX: Math.min(...xs, sp.x),
      minY: Math.min(...ys, sp.y),
      maxX: Math.max(...xs, sp.x),
      maxY: Math.max(...ys, sp.y),
    }
  }
  return { minX: sp.x, minY: sp.y, maxX: sp.x + sp.width, maxY: sp.y + sp.height }
}

const polyPoints = (sp) => sp.vertices.map((v) => `${sp.x + v.x},${sp.y + v.y}`).join(' ')

/**
 * Renders all floor spaces (rectangles + polygons) and their joins as one SVG,
 * with HTML overlays for selection handles, rename and recolour. Replaces the
 * old single-rectangle RoomOutline.
 */
export default function RoomSpaces({ screenToCanvas, dashed }) {
  const room = useStore((s) => s.room)
  const ppu = useStore((s) => s.settings.pixelsPerUnit || DEFAULT_PPU)
  const unitSystem = useStore((s) => s.settings.unitSystem || 'metric')
  const gridSnap = useStore((s) => s.settings.gridSnap)
  const gridSize = useStore((s) => s.settings.gridSize || 20)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const dispatch = useStore((s) => s.dispatch)
  const updateRoom = useStore((s) => s.updateRoom)
  const removeSpace = useStore((s) => s.removeSpace)
  const renameSpace = useStore((s) => s.renameSpace)
  const recolourSpace = useStore((s) => s.recolourSpace)
  const joinSpaces = useStore((s) => s.joinSpaces)

  const { menu, openAt, close } = useContextMenu()
  const [editing, setEditing] = useState(null) // space id being renamed
  const [draft, setDraft] = useState('')
  const [recolouring, setRecolouring] = useState(null) // space id
  const inputRef = useRef(null)
  const movedRef = useRef(false)

  const spaces = room.spaces || []
  const joins = room.joins || []
  const selectedId = selection.type === 'space' ? selection.id : null

  // SVG box big enough to contain everything (overflow visible covers the rest).
  let bw = 1
  let bh = 1
  spaces.forEach((sp) => {
    const b = bbox(sp)
    bw = Math.max(bw, b.maxX + 40)
    bh = Math.max(bh, b.maxY + 40)
  })

  // ── live editing helpers (non-undoable during drag; commit on pointer-up) ──
  const liveSpace = (id, patch) => {
    const r = useStore.getState().room
    updateRoom({ spaces: r.spaces.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  }
  const commit = (orig) => {
    const r = useStore.getState().room
    dispatch({ type: 'EDIT_SPACE', label: 'Edit space', payload: { room: r }, inverse: { room: orig } })
  }
  const snap = (n) => (gridSnap ? Math.round(n / gridSize) * gridSize : Math.round(n))

  // Clicking a space's fill only SELECTS it — it never moves. Moving requires
  // grabbing the dedicated grip handle, so a near-miss when reaching for a table
  // no longer drags the whole room out from under it.
  const selectSpace = (e, sp) => {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    select('space', sp.id)
  }

  const startMove = (e, sp) => {
    if (e.button !== 0 || editing) return
    e.preventDefault()
    e.stopPropagation()
    select('space', sp.id)
    const start = screenToCanvas(e.clientX, e.clientY)
    const orig = useStore.getState().room
    const o = orig.spaces.find((s) => s.id === sp.id)
    movedRef.current = false
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      if (!movedRef.current && Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 2) {
        movedRef.current = true
      }
      liveSpace(sp.id, { x: snap(o.x + (p.x - start.x)), y: snap(o.y + (p.y - start.y)) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (movedRef.current) commit(orig)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (e, sp) => {
    e.preventDefault()
    e.stopPropagation()
    const orig = useStore.getState().room
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      liveSpace(sp.id, {
        width: Math.max(80, snap(p.x - sp.x)),
        height: Math.max(80, snap(p.y - sp.y)),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      commit(orig)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startVertexDrag = (e, sp, index) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const orig = useStore.getState().room
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      const o = useStore.getState().room.spaces.find((s) => s.id === sp.id)
      const vertices = o.vertices.map((v, i) =>
        i === index ? { x: snap(p.x - o.x), y: snap(p.y - o.y) } : v
      )
      liveSpace(sp.id, { vertices })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      commit(orig)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const deleteVertex = (sp, index) => {
    if (sp.vertices.length <= 3) return // a polygon needs at least 3 points
    const orig = useStore.getState().room
    liveSpace(sp.id, { vertices: sp.vertices.filter((_, i) => i !== index) })
    commit(orig)
  }

  // Insert a vertex on the nearest edge to the double-clicked point.
  const insertVertex = (e, sp) => {
    if (sp.shape !== 'polygon') return
    e.stopPropagation()
    const p = screenToCanvas(e.clientX, e.clientY)
    const local = { x: p.x - sp.x, y: p.y - sp.y }
    const vs = sp.vertices
    let best = { i: 0, d: Infinity }
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i]
      const b = vs[(i + 1) % vs.length]
      const d = distToSegment(local, a, b)
      if (d < best.d) best = { i, d }
    }
    const orig = useStore.getState().room
    const next = [...vs]
    next.splice(best.i + 1, 0, { x: Math.round(local.x), y: Math.round(local.y) })
    liveSpace(sp.id, { vertices: next })
    commit(orig)
  }

  const startRename = (sp) => {
    setDraft(sp.label)
    setEditing(sp.id)
    requestAnimationFrame(() => inputRef.current?.select())
  }
  const commitRename = (sp) => {
    const v = draft.trim()
    if (v) renameSpace(sp.id, { label: v })
    setEditing(null)
  }

  const menuItems = (sp) =>
    [
      { label: 'Rename', icon: 'edit', onClick: () => startRename(sp) },
      { label: 'Recolour', icon: 'square', onClick: () => setRecolouring(sp.id) },
      ...spaces
        .filter((o) => o.id !== sp.id)
        .map((o) => {
          const joined = joins.some(
            (j) => (j.a === sp.id && j.b === o.id) || (j.a === o.id && j.b === sp.id)
          )
          return {
            label: `${joined ? 'Separate from' : 'Join with'} ${o.label}`,
            icon: 'maximize',
            onClick: () => joinSpaces(sp.id, o.id),
          }
        }),
      spaces.length > 1 && { separator: true },
      spaces.length > 1 && {
        label: 'Delete space',
        icon: 'trash',
        danger: true,
        onClick: () => removeSpace(sp.id),
      },
    ].filter(Boolean)

  // Scale bar (1 m / 3 ft) anchored to the first space.
  const stepCm = unitSystem === 'imperial' ? CM_PER_FOOT * 3 : 100
  const stepPx = stepCm * ppu
  const stepLabel = unitSystem === 'imperial' ? '3 ft' : '1 m'
  const primary = spaces[0]

  return (
    <>
      <svg className={styles.svg} width={bw} height={bh} data-room-svg>
        {/* Join bridges: cover the touching borders so joined spaces read as one. */}
        {joins.map((j, i) => {
          const a = spaces.find((s) => s.id === j.a)
          const b = spaces.find((s) => s.id === j.b)
          if (!a || !b) return null
          const ba = bbox(a)
          const bb = bbox(b)
          const x1 = Math.max(ba.minX, bb.minX) - 2
          const y1 = Math.max(ba.minY, bb.minY) - 2
          const x2 = Math.min(ba.maxX, bb.maxX) + 2
          const y2 = Math.min(ba.maxY, bb.maxY) + 2
          if (x2 <= x1 || y2 <= y1) return null
          return (
            <rect
              key={`join_${i}`}
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              fill={a.backgroundColour}
            />
          )
        })}

        {spaces.map((sp) => {
          const selected = sp.id === selectedId
          const common = {
            fill: sp.backgroundColour,
            stroke: selected ? 'var(--accent)' : dashed ? 'var(--ink-muted)' : 'var(--border)',
            strokeWidth: selected ? 2 : 1.5,
            strokeDasharray: dashed ? '8 6' : undefined,
            'data-canvas-item': '',
            className: styles.space,
            onPointerDown: (e) => selectSpace(e, sp),
            onDoubleClick: (e) =>
              sp.shape === 'polygon' ? insertVertex(e, sp) : (e.stopPropagation(), startRename(sp)),
            onContextMenu: (e) => {
              select('space', sp.id)
              openAt(e)
            },
          }
          return sp.shape === 'polygon' ? (
            <polygon key={sp.id} points={polyPoints(sp)} {...common} />
          ) : (
            <rect key={sp.id} x={sp.x} y={sp.y} width={sp.width} height={sp.height} rx={10} {...common} />
          )
        })}

        {/* Vertex handles for the selected polygon. */}
        {spaces
          .filter((sp) => sp.id === selectedId && sp.shape === 'polygon')
          .map((sp) =>
            sp.vertices.map((v, i) => (
              <circle
                key={`${sp.id}_v${i}`}
                cx={sp.x + v.x}
                cy={sp.y + v.y}
                r={6}
                className={styles.vertex}
                data-canvas-item=""
                onPointerDown={(e) => startVertexDrag(e, sp, i)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  deleteVertex(sp, i)
                }}
              />
            ))
          )}

        {/* Labels (upright, in canvas coords). */}
        {spaces.map((sp) => {
          const b = bbox(sp)
          return (
            <text key={`${sp.id}_label`} x={b.minX + 10} y={b.minY + 20} className={styles.label}>
              {sp.label}
            </text>
          )
        })}
      </svg>

      {/* Move grip for the selected space — the only way to drag it. */}
      {spaces
        .filter((sp) => sp.id === selectedId)
        .map((sp) => {
          const b = bbox(sp)
          return (
            <button
              key={`${sp.id}_move`}
              type="button"
              className={styles.moveHandle}
              style={{ left: b.minX, top: b.minY }}
              aria-label={`Move ${sp.label}`}
              title="Drag to move this space"
              onPointerDown={(e) => startMove(e, sp)}
              data-canvas-item=""
            >
              <Icon name="grip" size={14} />
            </button>
          )
        })}

      {/* Resize handle for the selected rectangle space. */}
      {spaces
        .filter((sp) => sp.id === selectedId && sp.shape === 'rect')
        .map((sp) => (
          <button
            key={`${sp.id}_resize`}
            type="button"
            className={styles.handle}
            style={{ left: sp.x + sp.width, top: sp.y + sp.height }}
            aria-label="Resize space"
            onPointerDown={(e) => startResize(e, sp)}
            data-canvas-item=""
          />
        ))}

      {/* Inline rename input. */}
      {editing &&
        spaces
          .filter((sp) => sp.id === editing)
          .map((sp) => {
            const b = bbox(sp)
            return (
              <input
                key={`${sp.id}_rename`}
                ref={inputRef}
                className={styles.renameInput}
                style={{ left: b.minX + 8, top: b.minY + 6 }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitRename(sp)}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(sp)
                  if (e.key === 'Escape') setEditing(null)
                }}
                data-canvas-item=""
              />
            )
          })}

      {/* Recolour popover. */}
      {recolouring &&
        spaces
          .filter((sp) => sp.id === recolouring)
          .map((sp) => {
            const b = bbox(sp)
            return (
              <div
                key={`${sp.id}_colour`}
                className={styles.colourPop}
                style={{ left: b.minX + 8, top: b.minY + 28 }}
                data-canvas-item=""
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ColorPicker
                  value={sp.backgroundColour}
                  onChange={(c) => {
                    recolourSpace(sp.id, { backgroundColour: c })
                    setRecolouring(null)
                  }}
                />
              </div>
            )
          })}

      {/* Scale bar anchored to the first space. */}
      {primary && (
        <div
          className={styles.scaleBar}
          style={{ left: primary.x + 12, top: bbox(primary).maxY - 18, width: stepPx }}
          aria-hidden="true"
        >
          <span className={styles.scaleLabel}>{stepLabel}</span>
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(spaces.find((s) => s.id === selectedId) || spaces[0])}
          onClose={close}
        />
      )}
    </>
  )
}

// Distance from point p to segment ab (for nearest-edge vertex insertion).
function distToSegment(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = a.x + t * dx
  const cy = a.y + t * dy
  return Math.hypot(p.x - cx, p.y - cy)
}
