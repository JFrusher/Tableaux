import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { exportFloorPlanPdf, exportCards } from '../../utils/exportPdf.js'
import { CARD_TEMPLATE_LIST } from '../../utils/cardTemplates.js'
import Modal from '../ui/Modal.jsx'
import Icon from '../ui/Icon.jsx'
import styles from './ExportModal.module.css'

export default function PrintModal() {
  const closeModal = useStore((s) => s.closeModal)
  const addToast = useStore((s) => s.addToast)
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    if (busy) return
    setBusy(true)
    const s = useStore.getState()
    try {
      await fn(s.serialize(), s.meta.weddingName)
      closeModal()
    } catch (err) {
      addToast({ type: 'error', message: 'Could not generate the PDF. Please try again.' })
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Print &amp; PDF" size="sm" onClose={closeModal}>
      <div className={styles.options}>
        <button
          type="button"
          className={styles.option}
          disabled={busy}
          onClick={() => run((doc, name) => exportFloorPlanPdf(doc, name))}
        >
          <Icon name="maximize" size={20} className={styles.icon} />
          <span className={styles.label}>Floor plan + assignments (PDF)</span>
          <span className={styles.desc}>A to-scale floor plan and a per-table guest sheet.</span>
        </button>

        {CARD_TEMPLATE_LIST.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={styles.option}
            disabled={busy}
            onClick={() => run((doc, name) => exportCards(doc, name, tpl.id))}
          >
            <Icon name="layers" size={20} className={styles.icon} />
            <span className={styles.label}>
              {tpl.kind === 'escort' ? 'Escort cards' : 'Place cards'} (PDF)
            </span>
            <span className={styles.desc}>{tpl.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
