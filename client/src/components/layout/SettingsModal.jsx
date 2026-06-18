import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import { toDisplay } from '../../utils/units.js'
import { DEFAULT_PPU, DEFAULT_CHAIR_CM } from '../../utils/seatPositions.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import f from '../sidebar/fields.module.css'
import styles from './SettingsModal.module.css'

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={clsx(styles.switch, checked && styles.switchOn)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}

const GRID_STYLES = ['dots', 'lines', 'off']

export default function SettingsModal() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setActiveTool = useStore((s) => s.setActiveTool)
  const openModal = useStore((s) => s.openModal)
  const closeModal = useStore((s) => s.closeModal)

  const gridSize = settings.gridSize || 20
  const unitSystem = settings.unitSystem || 'metric'
  const ppu = settings.pixelsPerUnit || DEFAULT_PPU
  const chairCm = settings.chairSizeUnits || DEFAULT_CHAIR_CM
  const scaleUnitCm = unitSystem === 'imperial' ? 30.48 : 100
  const scaleUnitLabel = unitSystem === 'imperial' ? '1 ft' : '1 m'

  return (
    <Modal
      title="Settings"
      onClose={closeModal}
      footer={
        <Button variant="primary" onClick={closeModal}>
          Done
        </Button>
      }
    >
      <section className={styles.section}>
        <p className={styles.sectionLabel}>Canvas</p>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Snap tables to grid</span>
          <Switch
            checked={settings.gridSnap}
            onChange={(v) => updateSettings({ gridSnap: v })}
            label="Snap to grid"
          />
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Grid style</span>
          <div className={clsx(f.segmented, styles.segmentedNarrow)}>
            {GRID_STYLES.map((g) => (
              <button
                key={g}
                type="button"
                className={clsx(f.segment, (settings.gridStyle || 'dots') === g && f.segmentActive)}
                onClick={() => updateSettings({ gridStyle: g })}
              >
                {g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Grid size</span>
          <div className={styles.stepper}>
            <IconButton
              icon="minus"
              label="Smaller grid"
              size={26}
              iconSize={14}
              disabled={gridSize <= 10}
              onClick={() => updateSettings({ gridSize: Math.max(10, gridSize - 5) })}
            />
            <span className={styles.stepperValue}>{gridSize}px</span>
            <IconButton
              icon="plus"
              label="Larger grid"
              size={26}
              iconSize={14}
              disabled={gridSize >= 40}
              onClick={() => updateSettings({ gridSize: Math.min(40, gridSize + 5) })}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Tables</p>
        <div className={styles.row}>
          <span className={styles.rowLabel}>New tables default to</span>
          <div className={clsx(f.segmented, styles.segmentedNarrow)}>
            <button
              type="button"
              className={clsx(f.segment, settings.defaultSeatMode === 'table' && f.segmentActive)}
              onClick={() => updateSettings({ defaultSeatMode: 'table' })}
            >
              Table
            </button>
            <button
              type="button"
              className={clsx(f.segment, settings.defaultSeatMode === 'seat' && f.segmentActive)}
              onClick={() => updateSettings({ defaultSeatMode: 'seat' })}
            >
              Seat
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Units &amp; scale</p>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Measurement units</span>
          <div className={clsx(f.segmented, styles.segmentedNarrow)}>
            <button
              type="button"
              className={clsx(f.segment, unitSystem === 'metric' && f.segmentActive)}
              onClick={() => updateSettings({ unitSystem: 'metric' })}
            >
              Metric
            </button>
            <button
              type="button"
              className={clsx(f.segment, unitSystem === 'imperial' && f.segmentActive)}
              onClick={() => updateSettings({ unitSystem: 'imperial' })}
            >
              Imperial
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Show chairs around tables</span>
          <Switch
            checked={settings.showChairs ?? true}
            onChange={(v) => updateSettings({ showChairs: v })}
            label="Show chairs around tables"
          />
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Chair size</span>
          <div className={styles.stepper}>
            <IconButton
              icon="minus"
              label="Smaller chairs"
              size={26}
              iconSize={14}
              disabled={chairCm <= 25}
              onClick={() => updateSettings({ chairSizeUnits: Math.max(25, chairCm - 5) })}
            />
            <span className={styles.stepperValue}>{toDisplay(chairCm, unitSystem).label}</span>
            <IconButton
              icon="plus"
              label="Larger chairs"
              size={26}
              iconSize={14}
              disabled={chairCm >= 90}
              onClick={() => updateSettings({ chairSizeUnits: Math.min(90, chairCm + 5) })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>
            Scale · {scaleUnitLabel} = {Math.round(scaleUnitCm * ppu)} px
          </span>
          <Button
            variant="secondary"
            icon="maximize"
            onClick={() => {
              setActiveTool('calibrate')
              closeModal()
            }}
          >
            Calibrate…
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Display</p>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Show dietary badges</span>
          <Switch
            checked={settings.showDietaryBadges}
            onChange={(v) => updateSettings({ showDietaryBadges: v })}
            label="Show dietary badges"
          />
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Show group colours</span>
          <Switch
            checked={settings.showGroupColours}
            onChange={(v) => updateSettings({ showGroupColours: v })}
            label="Show group colours"
          />
        </div>
      </section>

      <section className={styles.sectionLast}>
        <Button variant="secondary" icon="users" fullWidth onClick={() => openModal('constraints')}>
          Manage seating rules
        </Button>
      </section>
    </Modal>
  )
}
