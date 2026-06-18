import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { parseDisplay, ppuFromCalibration, toDisplay } from '../../utils/units.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import f from '../sidebar/fields.module.css'
import styles from './SettingsModal.module.css'

/**
 * Finishes the calibration flow: the user has drawn a line of known real-world
 * length on the canvas (props.pixelDistance, in canvas px). They enter what
 * that line measures in the real venue; we derive a new pixels-per-cm scale so
 * the whole plan becomes to-scale.
 */
export default function CalibrationModal({ pixelDistance = 0 }) {
  const unitSystem = useStore((s) => s.settings.unitSystem || 'metric')
  const calibrate = useStore((s) => s.calibrate)
  const closeModal = useStore((s) => s.closeModal)
  const [value, setValue] = useState(unitSystem === 'imperial' ? `3'` : '1 m')

  const realCm = parseDisplay(value, unitSystem)
  const nextPpu = realCm ? ppuFromCalibration(pixelDistance, realCm) : null
  const valid = !!nextPpu

  const apply = () => {
    if (!valid) return
    calibrate(nextPpu)
    closeModal()
  }

  return (
    <Modal
      title="Calibrate scale"
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={apply}>
            Apply scale
          </Button>
        </>
      }
    >
      <p className={styles.sectionLabel} style={{ marginBottom: 8 }}>
        How long is the line you just drew in real life?
      </p>
      <input
        className={f.input}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        placeholder={unitSystem === 'imperial' ? `e.g. 10' or 3'6"` : 'e.g. 3 m or 250 cm'}
        aria-label="Real-world length"
      />
      <p className={styles.rowLabel} style={{ marginTop: 12 }}>
        {valid
          ? `Scale: ${toDisplay(unitSystem === 'imperial' ? 30.48 : 100, unitSystem).label} = ${Math.round(
              (unitSystem === 'imperial' ? 30.48 : 100) * nextPpu
            )} px`
          : 'Enter a valid length (e.g. 3 m, 250 cm, 10′).'}
      </p>
    </Modal>
  )
}
