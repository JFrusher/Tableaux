import { useDroppable, useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import ContextMenu, { useContextMenu } from '../ui/ContextMenu.jsx'
import Tooltip from '../ui/Tooltip.jsx'
import { initials } from '../../utils/guestFilters.js'
import { SEAT_RADIUS } from '../../utils/seatPositions.js'
import { readableTextColour } from '../../utils/colour.js'
import styles from './SeatSlot.module.css'

/**
 * A single seat — a circular drop zone positioned around a table. Empty seats
 * show "+"; occupied seats show the guest's initials. Drop handling lives in
 * the global onDragEnd (Phase 4); this registers the droppable + the visuals.
 */
export default function SeatSlot({ tableId, index, x, y, occupantId, rotation = 0 }) {
  const occupant = useStore((s) => (occupantId ? s.guests[occupantId] : null))
  const select = useStore((s) => s.select)
  const unassignGuest = useStore((s) => s.unassignGuest)
  const showGroupColours = useStore((s) => s.settings.showGroupColours)
  // Group colour ring on occupied seats for an at-a-glance read of groupings.
  const groupColour = useStore((s) => {
    if (!showGroupColours || !occupantId) return null
    const g = s.guests[occupantId]
    return g?.groupId ? s.groups[g.groupId]?.colour || null : null
  })
  const { menu, openAt, close } = useContextMenu()

  const { setNodeRef: setDropRef, isOver, active } = useDroppable({
    id: `seat_${tableId}_${index}`,
    data: { type: 'seat', tableId, index },
  })

  // An occupied seat is itself draggable, so guests can be moved or swapped
  // directly between seats on the canvas (not only from the guest panel).
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `seatguest_${tableId}_${index}`,
    data: { type: 'guest', guestId: occupantId, fromSeat: { tableId, index } },
    disabled: !occupant,
  })

  const setNodeRef = (node) => {
    setDropRef(node)
    setDragRef(node)
  }

  const dragType = active?.data?.current?.type
  const dragging = dragType === 'guest' || dragType === 'group'
  const draggingGuestId = active?.data?.current?.guestId
  // The table the dragged guest currently sits at (if any). A drop onto an
  // occupied seat swaps the two only when the dragged guest is already at this
  // table — match the highlight to that exact rule (see useCanvasDnd).
  const draggingGuestTableId = useStore((s) =>
    draggingGuestId ? (s.guests[draggingGuestId]?.assignedTableId ?? null) : null
  )
  const sameTableSwap =
    !!occupant &&
    dragType === 'guest' &&
    draggingGuestId !== occupantId &&
    draggingGuestTableId === tableId
  const canDrop = dragging && (!occupant || sameTableSwap)

  return (
    <>
      <Tooltip label={occupant ? occupant.fullName : `Seat ${index + 1}`}>
        <div
          ref={setNodeRef}
          className={clsx(
            styles.seat,
            occupant && styles.occupied,
            isOver && canDrop && styles.over,
            isOver && occupant && !sameTableSwap && dragging && styles.blocked,
            isDragging && styles.dragging
          )}
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            width: SEAT_RADIUS * 2,
            height: SEAT_RADIUS * 2,
            // Occupied seats fill with their group colour (readable text) for an
            // at-a-glance read of who's grouped where.
            ...(groupColour
              ? {
                  background: groupColour,
                  borderColor: groupColour,
                  color: readableTextColour(groupColour),
                }
              : null),
          }}
          data-canvas-item
          {...(occupant ? attributes : {})}
          {...(occupant ? listeners : {})}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (occupant) listeners?.onPointerDown?.(e)
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (occupant) select('guest', occupant.id)
          }}
          onContextMenu={(e) => occupant && openAt(e)}
        >
          <span style={rotation ? { display: 'inline-block', transform: `rotate(${-rotation}deg)` } : undefined}>
            {occupant ? initials(occupant.fullName) : '+'}
          </span>
        </div>
      </Tooltip>
      {menu && occupant && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            { label: 'Edit guest', icon: 'user', onClick: () => select('guest', occupant.id) },
            {
              label: 'Remove from seat',
              icon: 'x',
              danger: true,
              onClick: () => unassignGuest(occupant.id),
            },
          ]}
          onClose={close}
        />
      )}
    </>
  )
}
