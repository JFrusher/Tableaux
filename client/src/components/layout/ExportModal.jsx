import { useRef } from 'react'
import { useStore } from '../../store/useStore.js'
import Modal from '../ui/Modal.jsx'
import Icon from '../ui/Icon.jsx'
import { exportJson } from '../../utils/exportJson.js'
import { exportCsv } from '../../utils/exportCsv.js'
import { exportReportCsv } from '../../utils/exportReports.js'
import styles from './ExportModal.module.css'

// A minimal shape check so we only import plausible Tableaux plan exports.
const isPlanDoc = (d) =>
  !!d &&
  typeof d === 'object' &&
  !Array.isArray(d) &&
  !!d.guests &&
  typeof d.guests === 'object' &&
  !!d.tables &&
  typeof d.tables === 'object'

export default function ExportModal() {
  const closeModal = useStore((s) => s.closeModal)
  const openModal = useStore((s) => s.openModal)
  const importPlan = useStore((s) => s.importPlan)
  const addToast = useStore((s) => s.addToast)
  const fileRef = useRef(null)

  const handleJson = () => {
    const s = useStore.getState()
    exportJson(s.serialize(), s.meta.weddingName)
    closeModal()
  }
  const handleCsv = () => {
    const s = useStore.getState()
    exportCsv(s, s.meta.weddingName)
    closeModal()
  }
  const handleReport = () => {
    const s = useStore.getState()
    exportReportCsv(s, s.meta.weddingName)
    closeModal()
  }
  const handleImportFile = async (file) => {
    if (!file) return
    try {
      const doc = JSON.parse(await file.text())
      if (!isPlanDoc(doc)) throw new Error('not a plan')
      openModal('confirm', {
        title: 'Replace current plan?',
        message: `Importing "${file.name}" replaces your entire current plan and can't be undone. Consider exporting or taking a snapshot first.`,
        confirmLabel: 'Import plan',
        danger: true,
        onConfirm: () => {
          importPlan(doc)
          addToast({ type: 'success', message: 'Plan imported.' })
          closeModal()
        },
      })
    } catch {
      addToast({
        type: 'error',
        message: "That file isn't a valid Tableaux plan export.",
      })
    }
  }

  return (
    <Modal title="Export &amp; restore" size="sm" onClose={closeModal}>
      <div className={styles.options}>
        <button type="button" className={styles.option} onClick={handleCsv}>
          <Icon name="download" size={20} className={styles.icon} />
          <span className={styles.label}>Table assignments (CSV)</span>
          <span className={styles.desc}>
            A caterer-friendly sheet of who&rsquo;s at each table.
          </span>
        </button>
        <button type="button" className={styles.option} onClick={handleReport}>
          <Icon name="download" size={20} className={styles.icon} />
          <span className={styles.label}>Dietary &amp; headcount report (CSV)</span>
          <span className={styles.desc}>
            Dietary totals and a per-table summary for caterers.
          </span>
        </button>
        <button type="button" className={styles.option} onClick={handleJson}>
          <Icon name="layers" size={20} className={styles.icon} />
          <span className={styles.label}>Full plan (JSON)</span>
          <span className={styles.desc}>
            A complete backup of your plan, including the layout.
          </span>
        </button>
        <button
          type="button"
          className={styles.option}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="upload" size={20} className={styles.icon} />
          <span className={styles.label}>Import plan (JSON)</span>
          <span className={styles.desc}>
            Restore a plan from a previously exported JSON backup.
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="u-visually-hidden"
          onChange={(e) => handleImportFile(e.target.files[0])}
        />
      </div>
    </Modal>
  )
}
