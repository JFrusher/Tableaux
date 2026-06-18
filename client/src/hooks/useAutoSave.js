import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { api } from '../api/client.js'
import { authEnabled } from '../api/supabase.js'

let inFlight = false
// SaaS mode tracks the server-side plan id + revision for optimistic concurrency.
let planId = null
let serverRev = 0

const backupKey = (id) => `tableaux:backup:${id || 'local'}`

/** Write a crash/offline backup of the current document to localStorage. */
function writeBackup() {
  try {
    const s = useStore.getState()
    localStorage.setItem(
      backupKey(planId),
      JSON.stringify({ doc: s.serialize(), at: Date.now(), rev: s._rev })
    )
  } catch {
    /* storage full / unavailable — best effort only */
  }
}

function clearBackup() {
  try {
    localStorage.removeItem(backupKey(planId))
  } catch {
    /* ignore */
  }
}

export async function reloadPlan() {
  const { hydrate } = useStore.getState()
  const plan = await api.loadPlan()
  planId = plan.id
  serverRev = plan.rev
  hydrate(plan.doc || {})
  useStore.setState({ planId })
}

/**
 * Persist the current document to the backend. Skips no-op saves unless
 * `manual` is set (Cmd/Ctrl+S and the save button always save).
 */
export async function saveNow({ manual = false } = {}) {
  const s = useStore.getState()
  if (!s.loaded) return
  if (!manual && !s.isDirty()) return
  if (inFlight) return

  inFlight = true
  const revAtSave = s._rev
  s.setSaveStatus('saving')
  try {
    if (authEnabled && planId) {
      const saved = await api.savePlan(planId, s.serialize(), serverRev)
      serverRev = saved.rev
    } else {
      await api.saveState(s.serialize())
    }
    useStore.setState({
      save: { status: 'saved', lastSavedAt: new Date().toISOString(), lastSavedRev: revAtSave },
    })
    clearBackup()
  } catch (e) {
    useStore.setState((st) => ({ save: { ...st.save, status: 'error' } }))
    if (e.status === 409) {
      // Someone else (another tab/device) saved since we loaded. Don't silently
      // discard the user's work — let them choose which version wins.
      const localDoc = s.serialize()
      writeBackup()
      useStore.setState((st) => ({ save: { ...st.save, status: 'conflict' } }))
      s.openModal('confirm', {
        title: 'This plan changed elsewhere',
        message:
          'It looks like this plan was edited in another tab or device. Keep your version (overwrites the other changes), or load the latest and discard your unsaved edits?',
        confirmLabel: 'Keep my version',
        cancelLabel: 'Load latest',
        onConfirm: async () => {
          try {
            const plan = await api.loadPlan() // fresh rev to overwrite with
            planId = plan.id
            serverRev = plan.rev
            const saved = await api.savePlan(planId, localDoc, serverRev)
            serverRev = saved.rev
            clearBackup()
            useStore.setState({
              save: {
                status: 'saved',
                lastSavedAt: new Date().toISOString(),
                lastSavedRev: useStore.getState()._rev,
              },
            })
            s.addToast({ type: 'success', message: 'Your version was saved.' })
          } catch {
            s.addToast({ type: 'error', message: 'Could not save your version.' })
          }
        },
        onCancel: async () => {
          try {
            await reloadPlan()
            clearBackup()
          } catch {
            /* surfaced on next save */
          }
        },
      })
    } else {
      // Network/server failure — keep a local backup so work isn't lost.
      writeBackup()
      s.addToast({
        type: 'error',
        message: navigator.onLine
          ? "Couldn't save — we'll keep trying. Your changes are backed up locally."
          : 'You appear to be offline. Changes are saved locally and will sync when you reconnect.',
        duration: 6000,
      })
    }
  } finally {
    inFlight = false
  }
}

/**
 * Loads state once on mount, then auto-saves every `intervalMs` if the
 * document has changed. Also flushes a best-effort save when the tab hides.
 */
export function useAutoSave(intervalMs = 30000) {
  useEffect(() => {
    let cancelled = false
    const { hydrate, addToast } = useStore.getState()

    const load = authEnabled
      ? reloadPlan()
      : api.getState().then((doc) => {
          if (!cancelled) hydrate(doc)
        })

    // After loading the server copy, offer to restore a newer local backup
    // (left behind by an offline session or a crash).
    load
      .then(() => {
        if (cancelled) return
        try {
          const raw = localStorage.getItem(backupKey(planId))
          if (!raw) return
          const backup = JSON.parse(raw)
          if (backup?.doc && backup.rev > useStore.getState()._rev) {
            useStore.getState().openModal('confirm', {
              title: 'Restore unsaved changes?',
              message: 'We found changes from a previous session that were never saved. Restore them?',
              confirmLabel: 'Restore',
              cancelLabel: 'Discard',
              onConfirm: () => useStore.getState().importPlan(backup.doc),
              onCancel: () => clearBackup(),
            })
          } else {
            clearBackup()
          }
        } catch {
          /* ignore malformed backup */
        }
      })
      .catch(() => {})

    load.catch(() => {
      if (cancelled) return
      // Boot into an empty (but usable) plan; the server may just be warming up.
      useStore.setState({ loaded: true })
      addToast({
        type: 'error',
        message: "Couldn't reach the server — start it with npm run dev.",
        duration: 6000,
      })
    })

    const timer = setInterval(() => saveNow({ manual: false }), intervalMs)

    // Legacy mode can use a fire-and-forget beacon (no auth header needed).
    // In SaaS mode we save on tab-hide instead, since a beacon can't carry the
    // bearer token.
    const flushLegacy = () => {
      const s = useStore.getState()
      if (!authEnabled && s.loaded && s.isDirty() && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(s.serialize())], { type: 'application/json' })
        navigator.sendBeacon(`${import.meta.env.VITE_API_BASE || '/api'}/state`, blob)
      }
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveNow({ manual: false })
    }
    // Flush queued changes as soon as connectivity returns.
    const onOnline = () => saveNow({ manual: false })
    window.addEventListener('beforeunload', flushLegacy)
    window.addEventListener('online', onOnline)
    if (authEnabled) document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('beforeunload', flushLegacy)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [intervalMs])
}
