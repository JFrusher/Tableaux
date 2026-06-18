import { useState, useRef, memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import {
  getTableGeometry,
  fillColour,
  DEFAULT_PPU,
  SEAT_OFFSET,
  SEAT_RADIUS,
} from '../../utils/seatPositions.js'
import { getTableType } from '../../utils/tableTypes.js'
import { computeSnap, buildContainers } from '../../utils/alignmentSnap.js'
import SeatSlot from './SeatSlot.jsx'
import TableGuestBox from './TableGuestBox.jsx'
import { getTableGridLayout } from '../../utils/tableGrid.js'
import ChairNubs from './ChairNubs.jsx'
import TableHandles from './TableHandles.jsx'
import ContextMenu, { useContextMenu } from '../ui/ContextMenu.jsx'
import Icon from '../ui/Icon.jsx'
import { useTableWarnings } from '../../store/warningsContext.jsx'
import styles from './TableNode.module.css'

const RING_PAD = 7

function Shape({ geom, inflate = 0, ...props }) {
  if (geom.shape === 'circle') {
    return <circle cx={0} cy={0} r={geom.radius + inflate} {...props} />
  }
  if (geom.shape === 'rect') {
    const w = geom.width + inflate * 2
    const h = geom.height + inflate * 2
    const rx = geom.rounded ? 18 : 7
    return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} ry={rx} {...props} />
  }
  // half-circle
  const r = geom.radius + inflate
  return <path d={`M ${-r} ${geom.cy} A ${r} ${r} 0 0 1 ${r} ${geom.cy} Z`} {...props} />
}

function TableNodeBase({ tableId, screenToCanvas }) {
  const table = useStore((s) => s.tables[tableId])
  const isSelected = useStore(
    (s) => s.selection.type === 'table' && s.selection.id === tableId
  )
  const gridSnap = useStore((s) => s.settings.gridSnap)
  const gridSize = useStore((s) => s.settings.gridSize || 20)
  const snapAlign = useStore((s) => s.settings.snapAlign ?? true)
  const ppu = useStore((s) => s.settings.pixelsPerUnit || DEFAULT_PPU)
  const showChairs = useStore((s) => s.settings.showChairs ?? true)
  const chairCm = useStore((s) => s.settings.chairSizeUnits || 45)

  const select = useStore((s) => s.select)
  const dispatch = useStore((s) => s.dispatch)
  const patchEntityLive = useStore((s) => s.patchEntityLive)
  const setDragGuides = useStore((s) => s.setDragGuides)
  const renameTable = useStore((s) => s.renameTable)
  const duplicateTable = useStore((s) => s.duplicateTable)
  const removeTable = useStore((s) => s.removeTable)
  const setSeatMode = useStore((s) => s.setSeatMode)
  const openModal = useStore((s) => s.openModal)

  const warnings = useTableWarnings(tableId)
  const { menu, openAt, close } = useContextMenu()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const movedRef = useRef(false)
  const dragCtx = useRef(null)

  const { setNodeRef, isOver, active } = useDroppable({
    id: `table_${tableId}`,
    data: { type: 'table', tableId },
  })

  if (!table) return null

  const def = getTableType(table.type)
  const geom = getTableGeometry(table, ppu)
  const seated = (table.assignedGuestIds || []).filter(Boolean).length
  const capacity = table.capacity
  const ratio = capacity ? seated / capacity : 0
  const isFull = seated >= capacity
  const W = geom.width
  const H = geom.height
  const rot = table.rotation || 0
  const seatMode = table.seatMode === 'seat'

  // The label now sits ABOVE the table shape. Clear the chair nubs / seat slots
  // that overflow the node above the top edge, so the number never overlaps a
  // chair (which looked bad on long top tables). No chairs → a small gap.
  const chairsShown = seatMode || showChairs
  const labelClear =
    (chairsShown ? SEAT_OFFSET + Math.max(SEAT_RADIUS, (chairCm * ppu) / 2) : 0) + 6

  // In 'table' mode, show a grid of name boxes (one per seated guest + an empty
  // box per open seat) sized to fit *inside* the table shape, so it's easy to
  // see who's roughly at each table at a glance. The grid scales to fill the
  // interior; labels drop to initials when boxes get too small (see
  // TableGuestBox). getTableGridLayout returns null when the table is too small
  // for a grid — then we fall back to the plain count.
  const grid = seatMode ? null : getTableGridLayout(table, geom)
  const assignedIds = grid ? (table.assignedGuestIds || []).filter(Boolean) : []
  const emptyCount = grid ? Math.max(0, capacity - assignedIds.length) : 0

  const dragType = active?.data?.current?.type
  const guestDragOver = isOver && (dragType === 'guest' || dragType === 'group')
  const ringColour = guestDragOver
    ? isFull
      ? 'var(--danger)'
      : 'var(--ok)'
    : isSelected
      ? 'var(--accent)'
      : null

  const tint = table.colour || def.distinctColour || null

  const handlePointerDown = (e) => {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    const start = screenToCanvas(e.clientX, e.clientY)
    const orig = useStore.getState().tables[tableId]
    movedRef.current = false

    // Snapshot the static snap inputs once at drag start: this table's
    // half-extents, every other table's box, and the wall rectangles.
    const state = useStore.getState()
    const movingGeom = getTableGeometry(orig, ppu)
    dragCtx.current = {
      hw: movingGeom.width / 2,
      hh: movingGeom.height / 2,
      tables: Object.values(state.tables)
        .filter((t) => t.id !== tableId)
        .map((t) => {
          const g = getTableGeometry(t, ppu)
          return { id: t.id, cx: t.x, cy: t.y, hw: g.width / 2, hh: g.height / 2 }
        }),
      containers: buildContainers(state.room),
    }

    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      if (!movedRef.current && Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 2) {
        movedRef.current = true
      }
      let nx = orig.x + (p.x - start.x)
      let ny = orig.y + (p.y - start.y)

      // Alignment snapping (Alt momentarily bypasses it). Each axis that aligns
      // overrides grid snap; the other axis still falls back to the grid.
      let snappedX = false
      let snappedY = false
      if (snapAlign && !ev.altKey) {
        const ctx = dragCtx.current
        const zoom = useStore.getState().canvas.zoom || 1
        const res = computeSnap({
          moving: { cx: nx, cy: ny, hw: ctx.hw, hh: ctx.hh },
          tables: ctx.tables,
          containers: ctx.containers,
          threshold: 8 / zoom,
        })
        if (res.x != null) {
          nx = res.x
          snappedX = true
        }
        if (res.y != null) {
          ny = res.y
          snappedY = true
        }
        setDragGuides(res.guides)
      } else {
        setDragGuides([])
      }

      if (gridSnap) {
        if (!snappedX) nx = Math.round(nx / gridSize) * gridSize
        if (!snappedY) ny = Math.round(ny / gridSize) * gridSize
      }
      patchEntityLive('tables', tableId, { x: Math.round(nx), y: Math.round(ny) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDragGuides([])
      if (movedRef.current) {
        const finalTable = useStore.getState().tables[tableId]
        dispatch({
          type: 'MOVE_TABLE',
          label: 'Move table',
          payload: { tables: { [tableId]: finalTable } },
          inverse: { tables: { [tableId]: orig } },
        })
      } else {
        select('table', tableId)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const startRename = () => {
    setDraft(table.label)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }
  const commitRename = () => {
    const v = draft.trim()
    if (v) renameTable(tableId, v)
    setEditing(false)
  }

  const menuItems = [
    { label: 'Rename', icon: 'edit', onClick: startRename },
    { label: 'Duplicate', icon: 'copy', hint: '⌘D', onClick: () => duplicateTable(tableId) },
    {
      label: table.seatMode === 'seat' ? 'Switch to table mode' : 'Switch to seat mode',
      icon: 'users',
      onClick: () => setSeatMode(tableId, table.seatMode === 'seat' ? 'table' : 'seat'),
    },
    { label: 'Edit details', icon: 'settings', onClick: () => select('table', tableId) },
    { separator: true },
    {
      label: 'Delete table',
      icon: 'trash',
      danger: true,
      onClick: () =>
        openModal('confirm', {
          title: 'Delete table?',
          message: `"${table.label}" will be removed and its ${seated} seated ${
            seated === 1 ? 'guest' : 'guests'
          } returned to the waiting list.`,
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: () => removeTable(tableId),
        }),
    },
  ]

  return (
    <div
      ref={setNodeRef}
      className={clsx(styles.node, isSelected && styles.selected, guestDragOver && styles.dragOver)}
      style={{
        left: table.x,
        top: table.y,
        width: W,
        height: H,
        transform: `translate(-50%, -50%) rotate(${rot}deg)`,
      }}
      data-canvas-item
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startRename()
      }}
      onContextMenu={openAt}
    >
      <svg
        className={styles.svg}
        width={W}
        height={H}
        viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`}
      >
        <Shape geom={geom} fill={tint || 'var(--surface-raised)'} fillOpacity={tint ? 0.22 : 1} />
        <Shape geom={geom} fill="none" stroke="var(--border)" strokeWidth={1.5} />
        {seated > 0 && (
          <Shape
            geom={geom}
            fill="none"
            stroke={fillColour(ratio)}
            strokeWidth={3}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${Math.min(ratio, 1) * 100} 100`}
            transform={geom.shape === 'circle' ? 'rotate(-90)' : undefined}
          />
        )}
        {ringColour && (
          <Shape geom={geom} inflate={RING_PAD} fill="none" stroke={ringColour} strokeWidth={2} />
        )}
      </svg>

      {showChairs && !seatMode && (
        <ChairNubs seats={geom.seats} chairPx={chairCm * ppu} width={W} height={H} />
      )}

      {(seatMode || !grid) && (
        <span
          className={styles.count}
          style={{ transform: `translate(-50%, -50%) rotate(${-rot}deg)` }}
        >
          {seated}/{capacity}
        </span>
      )}

      {grid && (
        <div
          className={styles.grid}
          data-canvas-item
          style={{
            width: grid.width,
            height: grid.height,
            gap: grid.gap,
            transform: `translate(-50%, -50%) translateY(${grid.offsetY}px) rotate(${-rot}deg)`,
          }}
        >
          {grid.hasHeader && (
            <span className={styles.gridCount}>
              {seated}/{capacity}
            </span>
          )}
          <div
            className={styles.gridBoxes}
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
              gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
              gap: grid.gap,
            }}
          >
            {assignedIds.map((gid) => (
              <TableGuestBox
                key={gid}
                tableId={tableId}
                guestId={gid}
                charsPerLine={grid.charsPerLine}
                maxLines={grid.maxLines}
              />
            ))}
            {Array.from({ length: emptyCount }).map((_, i) => (
              <div
                key={`empty_${i}`}
                className={clsx(styles.emptyBox, guestDragOver && !isFull && styles.emptyBoxActive)}
              />
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <input
          ref={inputRef}
          className={styles.labelInput}
          style={{ marginBottom: labelClear, transform: `translateX(-50%) rotate(${-rot}deg)` }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span
          className={styles.label}
          style={{ marginBottom: labelClear, transform: `translateX(-50%) rotate(${-rot}deg)` }}
        >
          {table.label}
        </span>
      )}

      {guestDragOver && isFull && <span className={styles.fullBadge}>Full</span>}

      {warnings.length > 0 && (
        <span
          className={styles.warnBadge}
          title={warnings.map((w) => w.message).join('\n')}
        >
          <Icon name="alert" size={12} />
        </span>
      )}

      {seatMode &&
        geom.seats.map((s, i) => (
          <SeatSlot
            key={i}
            tableId={tableId}
            index={i}
            x={s.x}
            y={s.y}
            rotation={rot}
            occupantId={table.assignedGuestIds[i] || null}
          />
        ))}

      {isSelected && !editing && <TableHandles tableId={tableId} width={W} height={H} />}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={close} />}
    </div>
  )
}

const TableNode = memo(TableNodeBase)
export default TableNode
