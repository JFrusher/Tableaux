import { useStore } from '../../store/useStore.js'
import { canvasToScreen } from '../../utils/canvasCoords.js'
import { deriveSizeUnits, getTableGeometry, DEFAULT_PPU } from '../../utils/seatPositions.js'
import styles from './TableHandles.module.css'

const norm360 = (deg) => ((Math.round(deg) % 360) + 360) % 360

function snapAngle(deg, e) {
  if (e.altKey || e.metaKey) return norm360(deg) // free rotation
  const step = e.shiftKey ? 45 : 15
  return norm360(Math.round(deg / step) * step)
}

/**
 * Selection handles drawn inside the (rotated) TableNode container: a rotate
 * knob above the table and resize handles on the edges/corners. Because these
 * are children of the rotated node, they ride along with the table's
 * orientation, and pointer math is done in screen space so it stays correct
 * regardless of rotation.
 */
export default function TableHandles({ tableId, width, height }) {
  const dispatch = useStore((s) => s.dispatch)
  const patchEntityLive = useStore((s) => s.patchEntityLive)
  const ppu = useStore((s) => s.settings.pixelsPerUnit || DEFAULT_PPU)

  const startRotate = (e) => {
    if (e.button != null && e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const orig = useStore.getState().tables[tableId]
    const center = canvasToScreen(orig.x, orig.y)

    const onMove = (ev) => {
      const dx = ev.clientX - center.x
      const dy = ev.clientY - center.y
      // The knob marks the table's "up" direction; up = -90° in screen space.
      const deg = snapAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90, ev)
      patchEntityLive('tables', tableId, { rotation: deg })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const final = useStore.getState().tables[tableId]
      if (norm360(final.rotation || 0) !== norm360(orig.rotation || 0)) {
        dispatch({
          type: 'ROTATE_TABLE',
          label: 'Rotate table',
          payload: { tables: { [tableId]: final } },
          inverse: { tables: { [tableId]: orig } },
        })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Resize: drag a handle to change the table's real-world footprint. Screen
  // deltas are projected onto the table's local (un-rotated) axes so resizing
  // feels natural even when the table is rotated.
  const startResize = (corner) => (e) => {
    if (e.button != null && e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const orig = useStore.getState().tables[tableId]
    const baseUnits = orig.sizeUnits || deriveSizeUnits(orig, ppu)
    const isRound = baseUnits.shape === 'circle' || baseUnits.shape === 'half-circle'
    const start = canvasToScreen(orig.x, orig.y)
    const rad = ((orig.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const signX = corner.includes('e') ? 1 : corner.includes('w') ? -1 : 0
    const signY = corner.includes('s') ? 1 : corner.includes('n') ? -1 : 0

    const onMove = (ev) => {
      // pointer delta from table centre, in screen px → canvas px → local axes
      const sx = (ev.clientX - start.x) / useStore.getState().canvas.zoom
      const sy = (ev.clientY - start.y) / useStore.getState().canvas.zoom
      const localX = sx * cos + sy * sin
      const localY = -sx * sin + sy * cos
      let next
      if (isRound) {
        // distance from centre on the active axis drives the diameter
        const reach = Math.max(Math.abs(localX) || 0, Math.abs(localY) || 0)
        const diameter = Math.max(20, (reach * 2) / ppu)
        next = { ...baseUnits, diameter: Math.round(diameter) }
      } else {
        const w = signX ? Math.max(20, (Math.abs(localX) * 2) / ppu) : baseUnits.width
        const h = signY ? Math.max(20, (Math.abs(localY) * 2) / ppu) : baseUnits.height
        next = { ...baseUnits, width: Math.round(w), height: Math.round(h) }
      }
      patchEntityLive('tables', tableId, { sizeUnits: next })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const final = useStore.getState().tables[tableId]
      dispatch({
        type: 'RESIZE_TABLE',
        label: 'Resize table',
        payload: { tables: { [tableId]: final } },
        inverse: { tables: { [tableId]: orig } },
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const table = useStore((s) => s.tables[tableId])
  const geom = getTableGeometry(table, ppu)
  const isRound = geom.shape === 'circle' || geom.shape === 'half-circle'
  // Resize handle positions in node-box coordinates (0,0 = top-left of the box).
  const corners = isRound
    ? [{ key: 'se', x: width, y: height }]
    : [
        { key: 'nw', x: 0, y: 0 },
        { key: 'ne', x: width, y: 0 },
        { key: 'sw', x: 0, y: height },
        { key: 'se', x: width, y: height },
      ]

  return (
    <>
      <div className={styles.rotateLine} style={{ left: width / 2 }} />
      <button
        type="button"
        className={styles.rotateKnob}
        style={{ left: width / 2 }}
        title="Drag to rotate · Shift = 45° · Alt = free"
        aria-label="Rotate table"
        data-canvas-item
        onPointerDown={startRotate}
      />
      {corners.map((c) => (
        <button
          key={c.key}
          type="button"
          className={styles.resizeHandle}
          style={{ left: c.x, top: c.y }}
          title="Drag to resize"
          aria-label="Resize table"
          data-canvas-item
          onPointerDown={startResize(c.key)}
        />
      ))}
    </>
  )
}
