import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicApi } from '../api/publicClient.js'
import StaticRoomCanvas from '../components/canvas/StaticRoomCanvas.jsx'
import FindSeatBox from './FindSeatBox.jsx'
import PublicFooter from './PublicFooter.jsx'
import styles from './PublicPages.module.css'

/** Read-only public view of a shared plan: to-scale floor plan + seat lookup. */
export default function PublicShareView() {
  const { token } = useParams()
  const [meta, setMeta] = useState(undefined)
  const [doc, setDoc] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([publicApi.shareMeta(token), publicApi.shareDoc(token)])
      .then(([m, d]) => {
        if (!live) return
        setMeta(m)
        setDoc(d)
      })
      .catch(() => live && setMeta(null))
    return () => {
      live = false
    }
  }, [token])

  if (meta === undefined) return <div className={styles.center}>Loading…</div>
  if (meta === null)
    return (
      <div className={styles.center}>
        <h1 className={styles.seatTitle}>Link unavailable</h1>
        <p className={styles.seatSub}>This seating link is no longer active.</p>
      </div>
    )

  return (
    <div className={styles.viewPage}>
      <header className={styles.viewHeader}>
        <div>
          {meta.weddingName && <h1 className={styles.viewTitle}>{meta.weddingName}</h1>}
          {(meta.venue || meta.date) && (
            <p className={styles.seatSub}>{[meta.venue, meta.date].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className={styles.viewFind}>
          <FindSeatBox token={token} />
        </div>
      </header>
      <div className={styles.viewCanvas}>{doc && <StaticRoomCanvas doc={doc} />}</div>
      <PublicFooter />
    </div>
  )
}
