import { useStore } from '../../store/useStore.js'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import ImportModal from '../guestPanel/ImportModal.jsx'
import WarningsPanel from './WarningsPanel.jsx'
import ConstraintsModal from './ConstraintsModal.jsx'
import SnapshotsModal from './SnapshotsModal.jsx'
import ExportModal from './ExportModal.jsx'
import SettingsModal from './SettingsModal.jsx'
import CalibrationModal from './CalibrationModal.jsx'
import CustomTableModal from './CustomTableModal.jsx'
import PrintModal from './PrintModal.jsx'
import ShareModal from './ShareModal.jsx'
import AccountModal from './AccountModal.jsx'

/**
 * Renders the single store-driven modal. New modal types are added to the
 * switch as their features are built (import, settings, snapshots, …).
 */
export default function ModalRoot() {
  const modal = useStore((s) => s.modal)
  const closeModal = useStore((s) => s.closeModal)

  if (!modal) return null
  const { name, props = {} } = modal

  switch (name) {
    case 'import':
      return <ImportModal />
    case 'warnings':
      return <WarningsPanel />
    case 'constraints':
      return <ConstraintsModal />
    case 'snapshots':
      return <SnapshotsModal />
    case 'export':
      return <ExportModal />
    case 'settings':
      return <SettingsModal />
    case 'calibrate':
      return <CalibrationModal {...props} />
    case 'customTable':
      return <CustomTableModal />
    case 'print':
      return <PrintModal />
    case 'share':
      return <ShareModal />
    case 'account':
      return <AccountModal />
    case 'confirm':
      return (
        <ConfirmDialog
          {...props}
          onConfirm={() => {
            props.onConfirm?.()
            if (!props.keepOpen) closeModal()
          }}
          onCancel={() => {
            props.onCancel?.()
            closeModal()
          }}
        />
      )
    default:
      return null
  }
}
