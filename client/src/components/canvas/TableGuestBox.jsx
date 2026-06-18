import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import ContextMenu, { useContextMenu } from '../ui/ContextMenu.jsx'
import Tooltip from '../ui/Tooltip.jsx'
import { pickGuestLabel } from '../../utils/guestFilters.js'
import { readableTextColour } from '../../utils/colour.js'
import styles from './TableGuestBox.module.css'

/**
 * A single guest's name box inside a 'table'-mode table grid. It's draggable so
 * a guest can be grabbed straight off the table and re-seated elsewhere (drop
 * handling lives in the global onDragEnd). Text is the fixed seat-level font;
 * the label shows as much of the name as fits the box (full name → "First L."
 * → first name → initials, wrapping when there's room), so it always fits
 * inside the table. Empty seats are plain placeholder divs rendered by TableNode.
 */
export default function TableGuestBox({ tableId, guestId, charsPerLine, maxLines }) {
  const guest = useStore((s) => s.guests[guestId])
  const isSelected = useStore(
    (s) => s.selection.type === 'guest' && s.selection.id === guestId
  )
  const select = useStore((s) => s.select)
  const unassignGuest = useStore((s) => s.unassignGuest)
  const showGroupColours = useStore((s) => s.settings.showGroupColours)
  // Group colour for an at-a-glance read of which group a seated guest is in.
  const groupColour = useStore((s) =>
    showGroupColours && guest?.groupId ? s.groups[guest.groupId]?.colour || null : null
  )
  const { menu, openAt, close } = useContextMenu()

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `tableguest_${tableId}_${guestId}`,
    data: { type: 'guest', guestId },
  })

  if (!guest) return null

  const label = pickGuestLabel(guest, charsPerLine, maxLines)

  return (
    <>
      <Tooltip label={guest.fullName}>
        <div
          ref={setNodeRef}
          className={clsx(styles.box, isSelected && styles.selected, isDragging && styles.dragging)}
          style={
            groupColour
              ? {
                  background: groupColour,
                  borderColor: groupColour,
                  color: readableTextColour(groupColour),
                }
              : undefined
          }
          data-canvas-item
          {...attributes}
          {...listeners}
          onPointerDown={(e) => {
            // Don't let the table-move handler on the node fire — grab the guest.
            e.stopPropagation()
            listeners?.onPointerDown?.(e)
          }}
          onClick={(e) => {
            e.stopPropagation()
            select('guest', guestId)
          }}
          onContextMenu={openAt}
        >
          <span className={styles.name}>{label}</span>
        </div>
      </Tooltip>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            { label: 'Edit guest', icon: 'user', onClick: () => select('guest', guestId) },
            {
              label: 'Remove from table',
              icon: 'x',
              danger: true,
              onClick: () => unassignGuest(guestId),
            },
          ]}
          onClose={close}
        />
      )}
    </>
  )
}
