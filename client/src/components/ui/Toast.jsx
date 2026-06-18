import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import Icon from './Icon.jsx'
import IconButton from './IconButton.jsx'
import styles from './Toast.module.css'

const ICON_FOR = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  error: 'alert',
}

function Toast({ toast }) {
  const dismissToast = useStore((s) => s.dismissToast)
  const [leaving, setLeaving] = useState(false)

  const close = useCallback(() => {
    setLeaving(true)
    setTimeout(() => dismissToast(toast.id), 180)
  }, [dismissToast, toast.id])

  useEffect(() => {
    if (!toast.duration) return // 0 / null → persists until dismissed
    const t = setTimeout(close, toast.duration)
    return () => clearTimeout(t)
  }, [toast.duration, close])

  return (
    <div
      className={clsx(styles.toast, styles[toast.type], leaving && styles.leaving)}
      role="status"
    >
      <Icon name={ICON_FOR[toast.type] || 'info'} size={16} className={styles.icon} />
      <span className={styles.message}>{toast.message}</span>
      <IconButton icon="x" label="Dismiss" size={32} iconSize={14} onClick={close} />
    </div>
  )
}

export default function ToastViewport() {
  const toasts = useStore((s) => s.toasts)
  if (!toasts.length) return null
  return createPortal(
    <div className={styles.viewport} aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>,
    document.body
  )
}
