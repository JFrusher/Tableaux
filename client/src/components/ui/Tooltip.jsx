import { useState, useRef, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import styles from './Tooltip.module.css'

/**
 * Lightweight tooltip. Wraps a single focusable/hoverable child and shows a
 * portalled label after a short delay. Use for elements that don't already
 * carry a native `title`.
 */
export default function Tooltip({ label, placement = 'top', delay = 350, children }) {
  const [coords, setCoords] = useState(null)
  const timer = useRef(null)

  const show = (e) => {
    const el = e.currentTarget
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const r = el.getBoundingClientRect()
      setCoords({
        x: r.left + r.width / 2,
        y: placement === 'bottom' ? r.bottom + 8 : r.top - 8,
      })
    }, delay)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setCoords(null)
  }

  if (!label) return children

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      {coords &&
        createPortal(
          <div
            className={clsx(styles.tip, styles[placement])}
            style={{ left: coords.x, top: coords.y }}
            role="tooltip"
          >
            {label}
          </div>,
          document.body
        )}
    </>
  )
}
