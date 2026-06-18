import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore.js'
import { api } from '../../api/client.js'
import { reloadPlan } from '../../hooks/useAutoSave.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import f from '../sidebar/fields.module.css'
import styles from './SnapshotsModal.module.css'

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function SnapshotsModal() {
  // SaaS mode (table-backed snapshots) when a server plan id is present.
  const planId = useStore((s) => s.planId)
  const saas = !!planId

  const storeSnapshots = useStore((s) => s.snapshots)
  const saveSnapshot = useStore((s) => s.saveSnapshot)
  const restoreSnapshot = useStore((s) => s.restoreSnapshot)
  const deleteSnapshot = useStore((s) => s.deleteSnapshot)
  const openModal = useStore((s) => s.openModal)
  const closeModal = useStore((s) => s.closeModal)
  const addToast = useStore((s) => s.addToast)

  const [name, setName] = useState('')
  const [serverSnaps, setServerSnaps] = useState([])
  const [loading, setLoading] = useState(saas)

  const refresh = useCallback(async () => {
    if (!saas) return
    setLoading(true)
    try {
      setServerSnaps(await api.listPlanSnapshots(planId))
    } catch {
      addToast({ type: 'error', message: "Couldn't load snapshots." })
    } finally {
      setLoading(false)
    }
  }, [saas, planId, addToast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const snapshots = saas ? serverSnaps : storeSnapshots
  const limit = saas ? 20 : 10
  const atLimit = snapshots.length >= limit

  const create = async () => {
    if (saas) {
      try {
        await api.createPlanSnapshot(planId, name)
        addToast({ type: 'success', message: 'Snapshot saved.' })
        setName('')
        refresh()
      } catch {
        addToast({ type: 'error', message: "Couldn't save snapshot." })
      }
    } else {
      saveSnapshot(name)
      addToast({ type: 'success', message: 'Snapshot saved.' })
      setName('')
    }
  }

  const restore = (snap) =>
    openModal('confirm', {
      title: 'Restore snapshot?',
      message: `This replaces your current plan with "${snap.name}".`,
      confirmLabel: 'Restore',
      onConfirm: async () => {
        try {
          if (saas) {
            await api.restorePlanSnapshot(planId, snap.id)
            await reloadPlan()
          } else {
            restoreSnapshot(snap.id)
          }
          addToast({ type: 'info', message: `Restored "${snap.name}".` })
        } catch {
          addToast({ type: 'error', message: "Couldn't restore snapshot." })
        }
        closeModal()
      },
    })

  const remove = async (snap) => {
    if (saas) {
      try {
        await api.deletePlanSnapshot(planId, snap.id)
        refresh()
      } catch {
        addToast({ type: 'error', message: "Couldn't delete snapshot." })
      }
    } else {
      deleteSnapshot(snap.id)
    }
  }

  return (
    <Modal
      title="Snapshots"
      onClose={closeModal}
      footer={
        <Button variant="primary" onClick={closeModal}>
          Done
        </Button>
      }
    >
      <div className={styles.create}>
        <input
          className={f.input}
          placeholder="Name this snapshot, e.g. After Mum's edits"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !atLimit && create()}
          disabled={atLimit}
        />
        <Button variant="secondary" icon="camera" onClick={create} disabled={atLimit}>
          Save
        </Button>
      </div>
      {atLimit && (
        <p className={styles.limit}>
          You&rsquo;ve reached {limit} snapshots — delete one to add more.
        </p>
      )}

      {loading ? (
        <p className={styles.empty}>Loading snapshots…</p>
      ) : snapshots.length === 0 ? (
        <p className={styles.empty}>
          No snapshots yet. Save one before a big change so you can roll back.
        </p>
      ) : (
        <ul className={styles.list}>
          {snapshots.map((snap) => (
            <li key={snap.id} className={styles.row}>
              <div className={styles.info}>
                <span className={styles.name}>{snap.name}</span>
                <span className={styles.date}>{fmt(snap.savedAt || snap.created_at)}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => restore(snap)}>
                Restore
              </Button>
              <IconButton
                icon="trash"
                label="Delete snapshot"
                size={28}
                iconSize={14}
                onClick={() => remove(snap)}
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
