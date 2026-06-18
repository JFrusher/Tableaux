import { useMemo, useState } from 'react'
import { buildFloorPlanSvg } from '../../utils/floorPlanSvg.js'
import styles from './StaticRoomCanvas.module.css'

/**
 * Read-only, store-free render of a (sanitized) plan document for the public
 * share viewer. Reuses the same to-scale geometry the editor and PDF use via
 * buildFloorPlanSvg. Labels are escaped in the builder, so inlining the SVG is
 * safe. Pinch/scroll-friendly: the SVG fits the width and a zoom control scales
 * a wrapper.
 */
export default function StaticRoomCanvas({ doc }) {
  const [zoom, setZoom] = useState(1)
  const { svg } = useMemo(() => buildFloorPlanSvg(doc, { showSeats: true }), [doc])

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} aria-label="Zoom out">
          –
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} aria-label="Zoom in">
          +
        </button>
      </div>
      <div className={styles.scroller}>
        <div
          className={styles.plan}
          style={{ width: `${zoom * 100}%` }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  )
}
