import { useState, useRef } from 'react'
import { publicApi } from '../api/publicClient.js'
import styles from './PublicPages.module.css'

/**
 * Privacy-first seat lookup: a single name search that reveals only the matched
 * guest's table — never the full guest list. Shared by the find-my-seat page
 * and the read-only viewer.
 */
export default function FindSeatBox({ token, autoFocus }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const search = (value) => {
    setQ(value)
    clearTimeout(timer.current)
    if (value.trim().length < 2) {
      setResults(null)
      return
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { matches } = await publicApi.findSeat(token, value.trim())
        setResults(matches)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  return (
    <div className={styles.findBox}>
      <input
        className={styles.findInput}
        value={q}
        autoFocus={autoFocus}
        placeholder="Type your name…"
        onChange={(e) => search(e.target.value)}
        aria-label="Find your seat by name"
      />
      {loading && <p className={styles.findHint}>Searching…</p>}
      {results && results.length === 0 && !loading && (
        <p className={styles.findHint}>No match — try your full name as it appears on the invite.</p>
      )}
      {results && results.length > 0 && (
        <ul className={styles.findResults}>
          {results.map((m, i) => (
            <li key={i} className={styles.findResult}>
              <span className={styles.findName}>{m.fullName}</span>
              <span className={styles.findTable}>
                {m.tableLabel ? m.tableLabel : 'Not yet seated'}
                {m.seatNumber ? ` · seat ${m.seatNumber}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
