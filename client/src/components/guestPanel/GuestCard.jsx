import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import Icon from '../ui/Icon.jsx'
import { useGuestWarnings } from '../../store/warningsContext.jsx'
import { dietaryMeta } from '../../utils/dietary.js'
import styles from './GuestCard.module.css'

const SIDE = {
  bride: { letter: 'B', colour: '#A6576A', label: "Bride's side" },
  groom: { letter: 'G', colour: '#5C7E9E', label: "Groom's side" },
  both: { letter: 'B·G', colour: '#7C6F5B', label: 'Both sides' },
}

function GuestCardBase({ guest, selected = false, multiSelected = false, onContextMenu }) {
  const select = useStore((s) => s.select)
  const toggleGuestSelected = useStore((s) => s.toggleGuestSelected)
  const showBadges = useStore((s) => s.settings.showDietaryBadges)
  const showGroupColours = useStore((s) => s.settings.showGroupColours)
  // Group colour dot next to the name for at-a-glance grouping.
  const groupColour = useStore((s) =>
    showGroupColours && guest.groupId ? s.groups[guest.groupId]?.colour || null : null
  )

  const { listeners, attributes, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `guest_${guest.id}`,
    data: { type: 'guest', guestId: guest.id },
  })

  const warnings = useGuestWarnings(guest.id)
  const assigned = !!guest.assignedTableId
  const diet = guest.dietary ? dietaryMeta(guest.dietary) : null
  const side = guest.side ? SIDE[guest.side] : null

  const handleClick = (e) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) toggleGuestSelected(guest.id)
    else select('guest', guest.id)
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        styles.card,
        selected && styles.selected,
        multiSelected && styles.multi,
        assigned && styles.assigned,
        isDragging && styles.dragging
      )}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      style={groupColour ? { borderLeftColor: groupColour, borderLeftWidth: 4 } : undefined}
      data-guest-id={guest.id}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={`Drag ${guest.fullName}`}
        onClick={(e) => e.stopPropagation()}
        {...listeners}
        {...attributes}
      >
        <Icon name="grip" size={16} />
      </button>

      {groupColour && (
        <span className={styles.groupDot} style={{ background: groupColour }} aria-hidden="true" />
      )}
      <span className={styles.name}>{guest.fullName}</span>

      <span className={styles.meta}>
        {warnings.length > 0 && (
          <span
            className={styles.warn}
            title={warnings.map((w) => w.message).join('\n')}
          >
            <Icon name="alert" size={12} />
          </span>
        )}
        {showBadges && diet && (
          <span className={styles.diet} title={diet.label}>
            <span className={styles.dietDot} style={{ background: diet.colour }} />
            {diet.abbrev}
          </span>
        )}
        {side && (
          <span className={styles.side} style={{ background: side.colour }} title={side.label}>
            {side.letter}
          </span>
        )}
      </span>
    </div>
  )
}

const GuestCard = memo(GuestCardBase)
export default GuestCard
