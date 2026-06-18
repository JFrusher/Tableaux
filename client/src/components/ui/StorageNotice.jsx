import { useState } from 'react'

const KEY = 'tableaux:storage-notice-dismissed'

/**
 * One-time informational notice that the app uses strictly-necessary local
 * storage (auth session + autosave). No consent buttons — under PECR,
 * strictly-necessary storage doesn't require opt-in; this is disclosure only.
 */
export default function StorageNotice() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return true // storage blocked → nothing to disclose / nowhere to persist
    }
  })

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore — still hide for this session */
    }
    setDismissed(true)
  }

  return (
    <div role="note" aria-label="Storage notice" style={styles.bar}>
      <span style={styles.text}>
        Tableaux stores a sign-in session and an autosave copy of your plan in your browser
        (strictly necessary — no tracking).{' '}
        <a href="/privacy-policy.html" style={styles.link}>
          Learn more
        </a>
        .
      </span>
      <button type="button" onClick={dismiss} style={styles.button} aria-label="Dismiss notice">
        Got it
      </button>
    </div>
  )
}

const styles = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '10px 16px',
    background: '#1e1c1a',
    color: '#f5f1ea',
    fontSize: 13,
    lineHeight: 1.4,
  },
  text: { maxWidth: 720 },
  link: { color: '#d9c7a8' },
  button: {
    flexShrink: 0,
    padding: '6px 14px',
    minHeight: 36,
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 8,
    background: 'transparent',
    color: '#f5f1ea',
    cursor: 'pointer',
  },
}
