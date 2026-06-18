import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import IconButton from './IconButton.jsx'
import styles from './Modal.module.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Generic modal: portalled to <body>, backdrop click to dismiss, Escape to
 * close, and a contained focus trap that restores focus on unmount.
 */
export default function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className,
}) {
  const ref = useRef(null)
  const restoreFocus = useRef(null)
  const titleId = useId()

  useEffect(() => {
    restoreFocus.current = document.activeElement
    const node = ref.current
    const focusables = node.querySelectorAll(FOCUSABLE)
    ;(focusables[0] || node).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab') {
        const items = node.querySelectorAll(FOCUSABLE)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      restoreFocus.current?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        // Name the dialog from its visible heading; fall back to a generic name.
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        className={clsx(styles.modal, styles[size], className)}
        tabIndex={-1}
      >
        {title && (
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {onClose && <IconButton icon="x" label="Close" onClick={onClose} />}
          </header>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}
