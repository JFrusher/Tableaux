import { useEffect, useState, useCallback } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../api/client.js'
import { makeQrDataUrl } from '../../utils/qr.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import f from '../sidebar/fields.module.css'
import styles from './ShareModal.module.css'

const shareUrl = (s) =>
  `${window.location.origin}/${s.scope === 'find-seat' ? 'seat' : 'share'}/${s.token}`

const EXPIRY = [
  { label: 'No expiry', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
]

export default function ShareModal() {
  const planId = useStore((s) => s.planId)
  const closeModal = useStore((s) => s.closeModal)
  const addToast = useStore((s) => s.addToast)

  const [shares, setShares] = useState([])
  const [scope, setScope] = useState('view')
  const [days, setDays] = useState(0)
  const [showDietary, setShowDietary] = useState(false)
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState({}) // shareId -> dataUrl

  const refresh = useCallback(async () => {
    if (!planId) return
    try {
      setShares(await api.listShares(planId))
    } catch {
      /* ignore */
    }
  }, [planId])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!planId) {
    return (
      <Modal title="Share" size="sm" onClose={closeModal}>
        <p className={styles.note}>
          Sharing needs an account. Sign in to create read-only links you can send to
          family and vendors.
        </p>
      </Modal>
    )
  }

  const create = async () => {
    setBusy(true)
    try {
      await api.createShare({ planId, scope, expiresInDays: days, showDietary })
      await refresh()
    } catch (e) {
      addToast({ type: 'error', message: e.message || 'Could not create the link.' })
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id) => {
    try {
      await api.updateShare(id, { revoked: true })
      await refresh()
    } catch {
      addToast({ type: 'error', message: 'Could not revoke the link.' })
    }
  }

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      addToast({ type: 'success', message: 'Link copied.' })
    } catch {
      addToast({ type: 'info', message: url })
    }
  }

  const toggleQr = async (s) => {
    if (qr[s.id]) {
      setQr((q) => ({ ...q, [s.id]: null }))
      return
    }
    try {
      const dataUrl = await makeQrDataUrl(shareUrl(s))
      setQr((q) => ({ ...q, [s.id]: dataUrl }))
    } catch {
      addToast({ type: 'error', message: 'Could not generate the QR code.' })
    }
  }

  const active = shares.filter((s) => !s.revoked_at)

  return (
    <Modal title="Share your plan" onClose={closeModal}>
      <section className={styles.create}>
        <div className={f.group}>
          <span className={f.label}>Link type</span>
          <div className={f.segmented}>
            <button
              type="button"
              className={clsx(f.segment, scope === 'view' && f.segmentActive)}
              onClick={() => setScope('view')}
            >
              View floor plan
            </button>
            <button
              type="button"
              className={clsx(f.segment, scope === 'find-seat' && f.segmentActive)}
              onClick={() => setScope('find-seat')}
            >
              Find my seat only
            </button>
          </div>
        </div>

        <div className={f.group}>
          <span className={f.label}>Expires</span>
          <div className={f.segmented}>
            {EXPIRY.map((e) => (
              <button
                key={e.days}
                type="button"
                className={clsx(f.segment, days === e.days && f.segmentActive)}
                onClick={() => setDays(e.days)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {scope === 'view' && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={showDietary}
              onChange={(e) => setShowDietary(e.target.checked)}
            />
            Show dietary tags on the shared plan
          </label>
        )}

        <Button variant="primary" icon="link" disabled={busy} onClick={create}>
          Create link
        </Button>
      </section>

      <section className={styles.list}>
        {active.length === 0 ? (
          <p className={styles.note}>No active links yet.</p>
        ) : (
          active.map((s) => (
            <div key={s.id} className={styles.share}>
              <div className={styles.shareTop}>
                <span className={styles.scope}>
                  {s.scope === 'find-seat' ? 'Find my seat' : 'Floor plan'}
                  {s.expires_at ? ' · expires' : ''}
                </span>
                <div className={styles.shareActions}>
                  <IconButton
                    icon="copy"
                    label="Copy link"
                    size={32}
                    onClick={() => copy(shareUrl(s))}
                  />
                  <IconButton
                    icon="grid"
                    label="QR code"
                    size={32}
                    onClick={() => toggleQr(s)}
                  />
                  <IconButton
                    icon="trash"
                    label="Revoke link"
                    size={32}
                    onClick={() => revoke(s.id)}
                  />
                </div>
              </div>
              <code className={styles.url}>{shareUrl(s)}</code>
              {qr[s.id] && (
                <img
                  className={styles.qr}
                  src={qr[s.id]}
                  alt="QR code for this link"
                  width="240"
                  height="240"
                />
              )}
            </div>
          ))
        )}
      </section>
    </Modal>
  )
}
