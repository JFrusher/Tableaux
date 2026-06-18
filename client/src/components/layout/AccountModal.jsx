import { useStore } from '../../store/useStore.js'
import { api } from '../../api/client.js'
import { supabase } from '../../api/supabase.js'
import { downloadFile } from '../../utils/exportJson.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import styles from './ExportModal.module.css'

/** Account & data lifecycle: export my data, delete this plan, delete account. */
export default function AccountModal() {
  const planId = useStore((s) => s.planId)
  const closeModal = useStore((s) => s.closeModal)
  const openModal = useStore((s) => s.openModal)
  const addToast = useStore((s) => s.addToast)

  const exportData = async () => {
    try {
      const data = await api.exportMyData()
      downloadFile('tableaux-my-data.json', JSON.stringify(data, null, 2), 'application/json')
    } catch {
      addToast({ type: 'error', message: 'Could not export your data.' })
    }
  }

  const deletePlan = () => {
    if (!planId) return
    openModal('confirm', {
      title: 'Delete this plan?',
      message: 'This permanently deletes the current plan and its snapshots. Export a backup first if unsure.',
      confirmLabel: 'Delete plan',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deletePlan(planId)
          window.location.reload()
        } catch {
          addToast({ type: 'error', message: 'Could not delete the plan.' })
        }
      },
    })
  }

  const deleteAccount = () => {
    openModal('confirm', {
      title: 'Delete your account?',
      message:
        'This permanently deletes your account and ALL your plans, snapshots and share links. This cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteAccount()
          await supabase.auth.signOut()
          window.location.reload()
        } catch {
          addToast({ type: 'error', message: 'Could not delete your account.' })
        }
      },
    })
  }

  return (
    <Modal title="Account &amp; data" size="sm" onClose={closeModal}>
      <div className={styles.options}>
        <button type="button" className={styles.option} onClick={exportData}>
          <span className={styles.label}>Export my data (JSON)</span>
          <span className={styles.desc}>Download everything we store for your account.</span>
        </button>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="ghost" icon="trash" fullWidth onClick={deletePlan} disabled={!planId}>
          Delete this plan
        </Button>
        <Button variant="ghost" icon="trash" fullWidth onClick={deleteAccount}>
          Delete my account
        </Button>
      </div>
      <p style={{ marginTop: 16, fontSize: 12, textAlign: 'center' }}>
        <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        {' · '}
        <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>
      </p>
    </Modal>
  )
}
