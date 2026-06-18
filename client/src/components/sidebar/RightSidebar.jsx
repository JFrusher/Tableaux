import { useStore } from '../../store/useStore.js'
import StatsPanel from './StatsPanel.jsx'
import TableInspector from './TableInspector.jsx'
import GuestInspector from './GuestInspector.jsx'
import SpaceInspector from './SpaceInspector.jsx'
import styles from './RightSidebar.module.css'

export default function RightSidebar() {
  const selection = useStore((s) => s.selection)
  const exists = useStore((s) => {
    if (selection.type === 'table') return !!s.tables[selection.id]
    if (selection.type === 'guest') return !!s.guests[selection.id]
    if (selection.type === 'space') return (s.room.spaces || []).some((sp) => sp.id === selection.id)
    return false
  })

  let body
  if (exists && selection.type === 'table') body = <TableInspector tableId={selection.id} />
  else if (exists && selection.type === 'guest') body = <GuestInspector guestId={selection.id} />
  else if (exists && selection.type === 'space') body = <SpaceInspector spaceId={selection.id} />
  else body = <StatsPanel />

  return <div className={styles.sidebar}>{body}</div>
}
