import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import Toolbar from './Toolbar.jsx'
import GuestPanel from '../guestPanel/GuestPanel.jsx'
import RoomCanvas from '../canvas/RoomCanvas.jsx'
import RightSidebar from '../sidebar/RightSidebar.jsx'
import ErrorBoundary from '../ui/ErrorBoundary.jsx'
import styles from './AppShell.module.css'

export default function AppShell() {
  const panels = useStore((s) => s.panels)

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Toolbar />
      <div className={styles.body}>
        <aside
          className={clsx('panel-dark', styles.left, !panels.left && styles.collapsedLeft)}
        >
          <ErrorBoundary label="The guest panel hit a snag">
            <GuestPanel />
          </ErrorBoundary>
        </aside>

        <main id="main-content" className={styles.center}>
          <ErrorBoundary label="The canvas hit a snag">
            <RoomCanvas />
          </ErrorBoundary>
        </main>

        <aside className={clsx(styles.right, !panels.right && styles.collapsedRight)}>
          <RightSidebar />
        </aside>
      </div>
    </div>
  )
}
