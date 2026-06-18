import { useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import { toDisplay, parseDisplay } from '../../utils/units.js'
import { seatCountFromPerSide } from '../../utils/tableTypes.js'
import { viewportRect, screenToCanvas } from '../../utils/canvasCoords.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import TableThumbnail from '../toolbar/TableThumbnail.jsx'
import f from '../sidebar/fields.module.css'
import styles from './CustomTableModal.module.css'

const SIDES = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
]

export default function CustomTableModal() {
  const unitSystem = useStore((s) => s.settings.unitSystem || 'metric')
  const createCustomTable = useStore((s) => s.createCustomTable)
  const select = useStore((s) => s.select)
  const closeModal = useStore((s) => s.closeModal)

  const [square, setSquare] = useState(false)
  const [widthCm, setWidthCm] = useState(240)
  const [heightCm, setHeightCm] = useState(120)
  const [perSide, setPerSide] = useState({ top: 4, right: 1, bottom: 4, left: 1 })

  const w = widthCm
  const h = square ? widthCm : heightCm
  const total = seatCountFromPerSide(perSide)
  const draft = {
    type: 'rect',
    capacity: Math.max(1, total),
    perSideSeats: perSide,
    sizeUnits: { shape: 'rect', width: w, height: h },
  }

  const setSide = (key, delta) =>
    setPerSide((p) => ({ ...p, [key]: Math.max(0, Math.min(40, (p[key] || 0) + delta)) }))

  const commitDim = (setter) => (raw) => {
    const cm = parseDisplay(raw, unitSystem)
    if (cm && cm > 0) setter(Math.round(cm))
  }

  const add = () => {
    if (total < 1) return
    const vp = viewportRect()
    const center = vp
      ? screenToCanvas(vp.left + vp.width / 2, vp.top + vp.height / 2)
      : { x: 400, y: 300 }
    const cmd = createCustomTable({
      x: center.x,
      y: center.y,
      width: w,
      height: h,
      perSideSeats: perSide,
    })
    if (cmd?.meta?.newTableId) select('table', cmd.meta.newTableId)
    closeModal()
  }

  return (
    <Modal
      title="Custom table"
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" disabled={total < 1} onClick={add}>
            Add to plan
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.controls}>
          <div className={f.group}>
            <span className={f.label}>Shape</span>
            <div className={f.segmented}>
              <button
                type="button"
                className={clsx(f.segment, !square && f.segmentActive)}
                onClick={() => setSquare(false)}
              >
                Rectangle
              </button>
              <button
                type="button"
                className={clsx(f.segment, square && f.segmentActive)}
                onClick={() => setSquare(true)}
              >
                Square
              </button>
            </div>
          </div>

          <div className={f.group}>
            <span className={f.label}>{square ? 'Size' : 'Width × Depth'}</span>
            <div className={styles.dimRow}>
              <DimInput value={toDisplay(w, unitSystem).label} onCommit={commitDim(setWidthCm)} label="Width" />
              {!square && (
                <>
                  <span className={styles.dimX}>×</span>
                  <DimInput
                    value={toDisplay(h, unitSystem).label}
                    onCommit={commitDim(setHeightCm)}
                    label="Depth"
                  />
                </>
              )}
            </div>
          </div>

          <div className={f.group}>
            <span className={f.label}>Seats per side · {total} total</span>
            {SIDES.map((s) => (
              <div className={styles.sideRow} key={s.key}>
                <span className={styles.sideLabel}>{s.label}</span>
                <div className={f.stepper}>
                  <IconButton
                    icon="minus"
                    label={`Fewer ${s.label} seats`}
                    variant="ghost"
                    disabled={(perSide[s.key] || 0) <= 0}
                    onClick={() => setSide(s.key, -1)}
                  />
                  <span className={f.stepperValue}>{perSide[s.key] || 0}</span>
                  <IconButton
                    icon="plus"
                    label={`More ${s.label} seats`}
                    variant="ghost"
                    onClick={() => setSide(s.key, 1)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.preview}>
          <TableThumbnail table={draft} size={150} />
        </div>
      </div>
    </Modal>
  )
}

// Uncontrolled dimension input that commits on blur/Enter. `key={value}` resets
// it when the external value changes (unit toggle, square lock).
function DimInput({ value, onCommit, label }) {
  return (
    <input
      className={f.input}
      defaultValue={value}
      key={value}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label={label}
    />
  )
}
