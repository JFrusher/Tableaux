import { useStore } from '../../store/useStore.js'
import Icon from '../ui/Icon.jsx'
import TableThumbnail from '../toolbar/TableThumbnail.jsx'
import styles from './DragPreview.module.css'

/** The element that follows the cursor during a drag (rendered in DragOverlay). */
export default function DragPreview({ drag }) {
  const guest = useStore((s) => (drag?.type === 'guest' ? s.guests[drag.guestId] : null))
  const group = useStore((s) => (drag?.type === 'group' ? s.groups[drag.groupId] : null))
  const preset = useStore((s) =>
    drag?.type === 'palette-preset'
      ? (s.settings.customTablePresets || []).find((p) => p.id === drag.presetId)
      : null
  )

  if (!drag) return null

  if (drag.type === 'palette') {
    return (
      <div className={styles.table}>
        <TableThumbnail type={drag.tableType} size={46} />
      </div>
    )
  }

  if (drag.type === 'palette-preset' && preset) {
    return (
      <div className={styles.table}>
        <TableThumbnail type={preset.type} size={46} />
      </div>
    )
  }

  if (drag.type === 'guest' && guest) {
    return (
      <div className={styles.chip}>
        <Icon name="grip" size={14} className={styles.grip} />
        <span>{guest.fullName}</span>
      </div>
    )
  }

  if (drag.type === 'group' && group) {
    return (
      <div className={styles.chip}>
        {group.colour ? (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: group.colour,
              flex: 'none',
            }}
          />
        ) : (
          <Icon name="users" size={14} className={styles.grip} />
        )}
        <span>
          Group: {group.name} ({group.memberIds.length})
        </span>
      </div>
    )
  }

  return null
}
