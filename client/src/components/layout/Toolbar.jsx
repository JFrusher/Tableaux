import clsx from 'clsx'
import { useStore, selectCanUndo, selectCanRedo } from '../../store/useStore.js'
import { useWarnings } from '../../store/warningsContext.jsx'
import { saveNow } from '../../hooks/useAutoSave.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { supabase } from '../../api/supabase.js'
import IconButton from '../ui/IconButton.jsx'
import Icon from '../ui/Icon.jsx'
import TablePalette from '../toolbar/TablePalette.jsx'
import styles from './Toolbar.module.css'

function AccountControl() {
  const { authEnabled, session } = useAuth()
  const openModal = useStore((s) => s.openModal)
  if (!authEnabled || !session) return null
  return (
    <>
      <span className={styles.divider} />
      <div className={styles.group}>
        <span className={styles.saveStatus} title={session.user.email}>
          {session.user.email}
        </span>
        <IconButton icon="settings" label="Account & data" onClick={() => openModal('account')} />
        <IconButton icon="log-out" label="Sign out" onClick={() => supabase.auth.signOut()} />
      </div>
    </>
  )
}

function WarningsButton() {
  const { list } = useWarnings()
  const openModal = useStore((s) => s.openModal)
  const count = list.length
  return (
    <button
      type="button"
      className={styles.warnBtn}
      onClick={() => openModal('warnings')}
      aria-label={`Warnings (${count})`}
      title="Warnings"
    >
      <Icon name="alert" size={18} />
      {count > 0 && <span className={styles.warnCount}>{count}</span>}
    </button>
  )
}

const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function SaveIndicator() {
  const save = useStore((s) => s.save)
  if (save.status === 'saving') return <span className={styles.saveStatus}>Saving…</span>
  if (save.status === 'conflict')
    return <span className={clsx(styles.saveStatus, styles.saveError)}>Sync conflict</span>
  if (save.status === 'error')
    return <span className={clsx(styles.saveStatus, styles.saveError)}>Save failed</span>
  if (save.status === 'saved' && save.lastSavedAt)
    return <span className={styles.saveStatus}>Saved {fmtTime(save.lastSavedAt)}</span>
  return <span className={styles.saveStatus} />
}

export default function Toolbar() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore(selectCanUndo)
  const canRedo = useStore(selectCanRedo)
  const openModal = useStore((s) => s.openModal)
  const togglePanel = useStore((s) => s.togglePanel)
  const weddingName = useStore((s) => s.meta.weddingName)

  return (
    <header className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.logo}>Tableaux</span>
        {weddingName && <span className={styles.subtitle}>{weddingName}</span>}
      </div>

      <div className={styles.center}>
        <TablePalette />
      </div>

      <div className={styles.right}>
        <SaveIndicator />
        <div className={styles.group}>
          <IconButton icon="undo" label="Undo (⌘Z)" disabled={!canUndo} onClick={undo} />
          <IconButton icon="redo" label="Redo (⌘⇧Z)" disabled={!canRedo} onClick={redo} />
          <IconButton icon="save" label="Save (⌘S)" onClick={() => saveNow({ manual: true })} />
        </div>
        <span className={styles.divider} />
        <WarningsButton />
        <span className={styles.divider} />
        <div className={styles.group}>
          <IconButton icon="camera" label="Snapshots" onClick={() => openModal('snapshots')} />
          <IconButton icon="share" label="Share links" onClick={() => openModal('share')} />
          <IconButton icon="printer" label="Print &amp; PDF" onClick={() => openModal('print')} />
          <IconButton icon="download" label="Export" onClick={() => openModal('export')} />
          <IconButton icon="settings" label="Settings" onClick={() => openModal('settings')} />
        </div>
        <span className={styles.divider} />
        <div className={styles.group}>
          <IconButton
            icon="panel-left"
            label="Toggle guest panel"
            onClick={() => togglePanel('left')}
          />
          <IconButton
            icon="panel-right"
            label="Toggle details panel"
            onClick={() => togglePanel('right')}
          />
        </div>
        <AccountControl />
      </div>
    </header>
  )
}
