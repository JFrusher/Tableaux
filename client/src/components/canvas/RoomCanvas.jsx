import { useMemo, useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import { useStore, selectCanUndo, selectCanRedo } from '../../store/useStore.js'
import { useCanvasPanZoom } from '../../hooks/useCanvasPanZoom.js'
import CanvasGrid from './CanvasGrid.jsx'
import RoomSpaces from './RoomSpaces.jsx'
import TableNode from './TableNode.jsx'
import ZoneLabel from './ZoneLabel.jsx'
import AlignmentGuides from './AlignmentGuides.jsx'
import IconButton from '../ui/IconButton.jsx'
import Icon from '../ui/Icon.jsx'
import styles from './RoomCanvas.module.css'

const GRID_CYCLE = { dots: 'lines', lines: 'off', off: 'dots' }
const normRect = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
})

function CanvasControls({ zoomIn, zoomOut, fitToScreen }) {
  const zoom = useStore((s) => s.canvas.zoom)
  const gridStyle = useStore((s) => s.settings.gridStyle || 'dots')
  const snapAlign = useStore((s) => s.settings.snapAlign ?? true)
  const activeTool = useStore((s) => s.activeTool)
  const updateSettings = useStore((s) => s.updateSettings)
  const setActiveTool = useStore((s) => s.setActiveTool)
  const addSpace = useStore((s) => s.addSpace)
  const select = useStore((s) => s.select)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore(selectCanUndo)
  const canRedo = useStore(selectCanRedo)

  const addRectSpace = () => {
    const cmd = addSpace({ x: 80, y: 80, width: 400, height: 300 })
    if (cmd?.meta?.newSpaceId) select('space', cmd.meta.newSpaceId)
  }

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <IconButton icon="minus" label="Zoom out (-)" onClick={zoomOut} />
        <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <IconButton icon="plus" label="Zoom in (+)" onClick={zoomIn} />
      </div>
      <div className={styles.controlGroup}>
        <IconButton icon="maximize" label="Fit to screen (F)" onClick={fitToScreen} />
        <IconButton
          icon="grid"
          label={`Grid: ${gridStyle}`}
          active={gridStyle !== 'off'}
          onClick={() => updateSettings({ gridStyle: GRID_CYCLE[gridStyle] })}
        />
        <IconButton
          icon="magnet"
          label={`Alignment snap: ${snapAlign ? 'on' : 'off'} · hold Alt to bypass`}
          active={snapAlign}
          onClick={() => updateSettings({ snapAlign: !snapAlign })}
        />
        <IconButton
          icon="square"
          label="Draw a zone"
          active={activeTool === 'zone'}
          onClick={() => setActiveTool(activeTool === 'zone' ? 'select' : 'zone')}
        />
      </div>
      <div className={styles.controlGroup}>
        <IconButton icon="plus" label="Add a rectangular space" onClick={addRectSpace} />
        <IconButton
          icon="layers"
          label="Draw a room shape (polygon)"
          active={activeTool === 'room-draw'}
          onClick={() => setActiveTool(activeTool === 'room-draw' ? 'select' : 'room-draw')}
        />
      </div>
      <div className={styles.controlGroup}>
        <IconButton icon="undo" label="Undo" disabled={!canUndo} onClick={undo} />
        <IconButton icon="redo" label="Redo" disabled={!canRedo} onClick={redo} />
      </div>
    </div>
  )
}

export default function RoomCanvas() {
  const { viewportRef, screenToCanvas, beginPan, isPanning, zoomIn, zoomOut, fitToScreen } =
    useCanvasPanZoom()

  const canvas = useStore((s) => s.canvas)
  const gridSize = useStore((s) => s.settings.gridSize || 20)
  const gridStyle = useStore((s) => s.settings.gridStyle || 'dots')
  const tables = useStore((s) => s.tables)
  const zones = useStore((s) => s.zones)
  const activeTool = useStore((s) => s.activeTool)
  const addZone = useStore((s) => s.addZone)
  const addSpace = useStore((s) => s.addSpace)
  const select = useStore((s) => s.select)
  const setActiveTool = useStore((s) => s.setActiveTool)
  const openModal = useStore((s) => s.openModal)
  const loaded = useStore((s) => s.loaded)

  const [draftZone, setDraftZone] = useState(null)
  const [draftLine, setDraftLine] = useState(null)
  // Polygon room being drawn: a list of canvas-coord vertices + the live cursor.
  const [draftPoly, setDraftPoly] = useState(null) // { points: [{x,y}], cursor: {x,y} }
  const draftRef = useRef(null)

  const tableIds = useMemo(() => Object.keys(tables), [tables])
  const zoneIds = useMemo(() => Object.keys(zones), [zones])
  const hasTables = tableIds.length > 0
  const transform = useMemo(
    () => `translate(${canvas.panX}px, ${canvas.panY}px) scale(${canvas.zoom})`,
    [canvas.panX, canvas.panY, canvas.zoom]
  )

  const startZoneDraw = (e) => {
    const start = screenToCanvas(e.clientX, e.clientY)
    const onMove = (ev) => {
      const rect = normRect(start, screenToCanvas(ev.clientX, ev.clientY))
      draftRef.current = rect
      setDraftZone(rect)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const r = draftRef.current
      if (r && r.width > 16 && r.height > 16) {
        addZone({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          label: 'Zone',
          shape: 'rect',
        })
      }
      draftRef.current = null
      setDraftZone(null)
      setActiveTool('select')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startCalibrate = (e) => {
    const start = screenToCanvas(e.clientX, e.clientY)
    let line = null
    const onMove = (ev) => {
      const end = screenToCanvas(ev.clientX, ev.clientY)
      line = { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
      setDraftLine(line)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDraftLine(null)
      setActiveTool('select')
      if (line) {
        const dist = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
        if (dist > 8) openModal('calibrate', { pixelDistance: dist })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── polygon room drawing: click to drop vertices, Enter/click-start to close ──
  const finishPoly = () => {
    const pts = draftPoly?.points || []
    if (pts.length >= 3) {
      const cmd = addSpace({ shape: 'polygon', x: 0, y: 0, vertices: pts })
      if (cmd?.meta?.newSpaceId) select('space', cmd.meta.newSpaceId)
    }
    setDraftPoly(null)
    setActiveTool('select')
  }
  const cancelPoly = () => {
    setDraftPoly(null)
    setActiveTool('select')
  }

  const addPolyPoint = (e) => {
    const p = screenToCanvas(e.clientX, e.clientY)
    const pts = draftPoly?.points || []
    // Click near the first point (with ≥3 points) closes the polygon.
    if (pts.length >= 3) {
      const first = pts[0]
      if (Math.hypot(p.x - first.x, p.y - first.y) < 12 / (useStore.getState().canvas.zoom || 1)) {
        finishPoly()
        return
      }
    }
    setDraftPoly({ points: [...pts, { x: Math.round(p.x), y: Math.round(p.y) }], cursor: p })
  }

  useEffect(() => {
    if (activeTool !== 'room-draw') {
      if (draftPoly) setDraftPoly(null)
      return
    }
    const onKey = (e) => {
      if (e.key === 'Enter') finishPoly()
      if (e.key === 'Escape') cancelPoly()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, draftPoly])

  const handlePointerDown = (e) => {
    if (e.target.closest('[data-canvas-item]')) return
    if (activeTool === 'zone') {
      startZoneDraw(e)
      return
    }
    if (activeTool === 'room-draw') {
      addPolyPoint(e)
      return
    }
    if (activeTool === 'calibrate') {
      startCalibrate(e)
      return
    }
    beginPan(e)
  }

  const handlePointerMove = (e) => {
    if (activeTool === 'room-draw' && draftPoly) {
      const p = screenToCanvas(e.clientX, e.clientY)
      setDraftPoly((d) => (d ? { ...d, cursor: p } : d))
    }
  }

  return (
    <div
      ref={viewportRef}
      className={clsx(
        styles.viewport,
        isPanning && styles.panning,
        (activeTool === 'zone' || activeTool === 'calibrate' || activeTool === 'room-draw') &&
          styles.drawing
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <CanvasGrid
        panX={canvas.panX}
        panY={canvas.panY}
        zoom={canvas.zoom}
        gridSize={gridSize}
        style={gridStyle}
      />

      <div className={styles.world} style={{ transform }}>
        <RoomSpaces screenToCanvas={screenToCanvas} dashed={!hasTables} />
        {zoneIds.map((id) => (
          <ZoneLabel key={id} zoneId={id} screenToCanvas={screenToCanvas} />
        ))}
        {tableIds.map((id) => (
          <TableNode key={id} tableId={id} screenToCanvas={screenToCanvas} />
        ))}
        <AlignmentGuides />
        {draftZone && (
          <div
            className={styles.draftZone}
            style={{
              left: draftZone.x,
              top: draftZone.y,
              width: draftZone.width,
              height: draftZone.height,
            }}
          />
        )}
        {draftLine && (
          <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width="1" height="1">
            <line
              x1={draftLine.x1}
              y1={draftLine.y1}
              x2={draftLine.x2}
              y2={draftLine.y2}
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </svg>
        )}
        {draftPoly && draftPoly.points.length > 0 && (
          <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width="1" height="1">
            <polyline
              points={[...draftPoly.points, draftPoly.cursor]
                .filter(Boolean)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')}
              fill="rgba(124,111,91,0.08)"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            {draftPoly.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 6 : 4} fill="var(--accent)" />
            ))}
          </svg>
        )}
      </div>

      {loaded && !hasTables && (
        <div className={styles.empty}>
          <Icon name="chevron-down" size={22} className={styles.emptyArrow} />
          <p className={styles.emptyText}>
            Drag table types from the toolbar to start building your room.
          </p>
        </div>
      )}

      {activeTool === 'zone' && (
        <div className={styles.toolHint}>Click and drag to draw a zone · Esc to cancel</div>
      )}

      {activeTool === 'room-draw' && (
        <div className={styles.toolHint}>
          Click to add corners · click the first point or press Enter to finish · Esc to cancel
        </div>
      )}

      {activeTool === 'calibrate' && (
        <div className={styles.toolHint}>
          Drag along something of known length (a wall, the dance floor) · Esc to cancel
        </div>
      )}

      <CanvasControls zoomIn={zoomIn} zoomOut={zoomOut} fitToScreen={fitToScreen} />
    </div>
  )
}
