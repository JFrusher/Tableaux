import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicApi } from '../api/publicClient.js'
import FindSeatBox from './FindSeatBox.jsx'
import PublicFooter from './PublicFooter.jsx'
import styles from './PublicPages.module.css'

/** Mobile-first public page where a guest looks up their table by name. */
export default function FindMySeat() {
  const { token } = useParams()
  const [meta, setMeta] = useState(undefined) // undefined = loading, null = unavailable

  useEffect(() => {
    let live = true
    publicApi
      .shareMeta(token)
      .then((m) => live && setMeta(m))
      .catch(() => live && setMeta(null))
    return () => {
      live = false
    }
  }, [token])

  if (meta === undefined) return <div className={styles.center}>Loading…</div>
  if (meta === null) return <Unavailable />

  return (
    <div className={styles.seatPage}>
      <header className={styles.seatHeader}>
        {meta.weddingName && <h1 className={styles.seatTitle}>{meta.weddingName}</h1>}
        <p className={styles.seatSub}>Find your seat</p>
      </header>
      <FindSeatBox token={token} autoFocus />
      <PublicFooter />
    </div>
  )
}

function Unavailable() {
  return (
    <div className={styles.center}>
      <h1 className={styles.seatTitle}>Link unavailable</h1>
      <p className={styles.seatSub}>This seating link is no longer active.</p>
    </div>
  )
}
