import { useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import { TABLE_TYPE_LIST, DESIGNATIONS, getTableType } from '../../utils/tableTypes.js'
import { deriveSizeUnits, DEFAULT_PPU } from '../../utils/seatPositions.js'
import { toDisplay, parseDisplay, formatDimensions } from '../../utils/units.js'
import IconButton from '../ui/IconButton.jsx'
import Button from '../ui/Button.jsx'
import ColorPicker from '../ui/ColorPicker.jsx'
import TableThumbnail from '../toolbar/TableThumbnail.jsx'
import TextField from './TextField.jsx'
import f from './fields.module.css'
import styles from './TableInspector.module.css'

const norm360 = (deg) => ((Math.round(deg) % 360) + 360) % 360

export default function TableInspector({ tableId }) {
  const table = useStore((s) => s.tables[tableId])
  const guests = useStore((s) => s.guests)
  const renameTable = useStore((s) => s.renameTable)
  const changeCapacity = useStore((s) => s.changeCapacity)
  const changeTableType = useStore((s) => s.changeTableType)
  const setDesignation = useStore((s) => s.setDesignation)
  const setSeatMode = useStore((s) => s.setSeatMode)
  const setTableColour = useStore((s) => s.setTableColour)
  const clearTable = useStore((s) => s.clearTable)
  const unassignGuest = useStore((s) => s.unassignGuest)
  const rotateTable = useStore((s) => s.rotateTable)
  const resizeTable = useStore((s) => s.resizeTable)
  const setPerSideSeats = useStore((s) => s.setPerSideSeats)
  const saveTablePreset = useStore((s) => s.saveTablePreset)
  const select = useStore((s) => s.select)
  const clearSelection = useStore((s) => s.clearSelection)
  const unitSystem = useStore((s) => s.settings.unitSystem || 'metric')
  const ppu = useStore((s) => s.settings.pixelsPerUnit || DEFAULT_PPU)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')

  if (!table) return null
  const def = getTableType(table.type)
  const seatedIds = (table.assignedGuestIds || []).filter(Boolean)
  const rot = table.rotation || 0
  const sizeUnits = table.sizeUnits || deriveSizeUnits(table, ppu)
  const isRound = sizeUnits.shape === 'circle' || sizeUnits.shape === 'half-circle'
  const isRect = sizeUnits.shape === 'rect'
  const perSide = table.perSideSeats
  const dim = (cm) => toDisplay(cm, unitSystem).label
  const onDim = (key) => (v) => {
    const cm = parseDisplay(v, unitSystem)
    if (cm && cm > 0) resizeTable(tableId, { [key]: cm })
  }
  const bumpSide = (key, delta) =>
    setPerSideSeats(tableId, { ...perSide, [key]: Math.max(0, (perSide[key] || 0) + delta) })
  const enablePerSide = () =>
    setPerSideSeats(tableId, {
      top: Math.ceil(table.capacity / 2),
      bottom: Math.floor(table.capacity / 2),
      left: 0,
      right: 0,
    })
  const commitPreset = () => {
    saveTablePreset(tableId, presetName)
    setPresetName('')
    setSavingPreset(false)
  }

  return (
    <div className={styles.inspector}>
      <header className={styles.header}>
        <span className={f.label}>Table</span>
        <IconButton icon="x" label="Close" size={32} iconSize={15} onClick={clearSelection} />
      </header>

      <div className={f.group}>
        <TextField
          className={f.input}
          value={table.label}
          onCommit={(v) => v.trim() && renameTable(tableId, v.trim())}
          aria-label="Table name"
        />
      </div>

      <div className={f.group}>
        <span className={f.label}>Type</span>
        <div className={styles.typeGrid}>
          {TABLE_TYPE_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              className={clsx(styles.typeBtn, table.type === t.id && styles.typeActive)}
              onClick={() => changeTableType(tableId, t.id)}
              title={t.label}
            >
              <TableThumbnail type={t.id} size={26} />
            </button>
          ))}
        </div>
      </div>

      {!perSide && (
        <div className={f.group}>
          <span className={f.label}>Capacity</span>
          <div className={f.stepper}>
            <IconButton
              icon="minus"
              label="Decrease capacity"
              variant="ghost"
              disabled={table.capacity <= def.minCapacity}
              onClick={() => changeCapacity(tableId, table.capacity - 1)}
            />
            <span className={f.stepperValue}>{table.capacity}</span>
            <IconButton
              icon="plus"
              label="Increase capacity"
              variant="ghost"
              disabled={table.capacity >= def.maxCapacity}
              onClick={() => changeCapacity(tableId, table.capacity + 1)}
            />
          </div>
        </div>
      )}

      {isRect && (
        <div className={f.group}>
          <span className={f.label}>Seats per side · {table.capacity} total</span>
          {perSide ? (
            <div className={styles.perSide}>
              {['top', 'right', 'bottom', 'left'].map((side) => (
                <div className={styles.perSideRow} key={side}>
                  <span className={styles.perSideLabel}>{side[0].toUpperCase() + side.slice(1)}</span>
                  <div className={f.stepper}>
                    <IconButton
                      icon="minus"
                      label={`Fewer ${side} seats`}
                      variant="ghost"
                      disabled={(perSide[side] || 0) <= 0}
                      onClick={() => bumpSide(side, -1)}
                    />
                    <span className={f.stepperValue}>{perSide[side] || 0}</span>
                    <IconButton
                      icon="plus"
                      label={`More ${side} seats`}
                      variant="ghost"
                      onClick={() => bumpSide(side, 1)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Button variant="ghost" fullWidth onClick={enablePerSide}>
              Use per-side seating
            </Button>
          )}
        </div>
      )}

      <div className={f.group}>
        <span className={f.label}>Size · {formatDimensions(sizeUnits, unitSystem)}</span>
        {isRound ? (
          <TextField
            className={f.input}
            value={dim(sizeUnits.diameter)}
            onCommit={onDim('diameter')}
            aria-label="Diameter"
          />
        ) : (
          <div className={styles.dimRow}>
            <TextField
              className={f.input}
              value={dim(sizeUnits.width)}
              onCommit={onDim('width')}
              aria-label="Width"
            />
            <span className={styles.dimX}>×</span>
            <TextField
              className={f.input}
              value={dim(sizeUnits.height)}
              onCommit={onDim('height')}
              aria-label="Height"
            />
          </div>
        )}
      </div>

      <div className={f.group}>
        {savingPreset ? (
          <div className={styles.dimRow}>
            <input
              className={f.input}
              value={presetName}
              placeholder="Preset name"
              autoFocus
              aria-label="Preset name"
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPreset()
                if (e.key === 'Escape') setSavingPreset(false)
              }}
            />
            <IconButton icon="check" label="Save preset" onClick={commitPreset} />
          </div>
        ) : (
          <Button
            variant="ghost"
            icon="copy"
            fullWidth
            onClick={() => {
              setPresetName(table.label || '')
              setSavingPreset(true)
            }}
          >
            Save as preset
          </Button>
        )}
      </div>

      <div className={f.group}>
        <span className={f.label}>Rotation · {Math.round(rot)}°</span>
        <div className={f.stepper}>
          <IconButton
            icon="undo"
            label="Rotate 15° counter-clockwise"
            variant="ghost"
            onClick={() => rotateTable(tableId, norm360(rot - 15))}
          />
          <span className={f.stepperValue}>{Math.round(rot)}°</span>
          <IconButton
            icon="redo"
            label="Rotate 15° clockwise"
            variant="ghost"
            onClick={() => rotateTable(tableId, norm360(rot + 15))}
          />
          <IconButton
            icon="x"
            label="Reset rotation"
            variant="ghost"
            disabled={rot === 0}
            onClick={() => rotateTable(tableId, 0)}
          />
        </div>
      </div>

      <div className={f.group}>
        <span className={f.label}>Designation</span>
        <select
          className={f.select}
          value={table.designation || ''}
          onChange={(e) => setDesignation(tableId, e.target.value || null)}
        >
          {DESIGNATIONS.map((d) => (
            <option key={d.label} value={d.id || ''}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className={f.group}>
        <span className={f.label}>Seating mode</span>
        <div className={f.segmented}>
          <button
            type="button"
            className={clsx(f.segment, table.seatMode === 'table' && f.segmentActive)}
            onClick={() => setSeatMode(tableId, 'table')}
          >
            Table-level
          </button>
          <button
            type="button"
            className={clsx(f.segment, table.seatMode === 'seat' && f.segmentActive)}
            onClick={() => setSeatMode(tableId, 'seat')}
          >
            Seat-level
          </button>
        </div>
      </div>

      <div className={f.group}>
        <span className={f.label}>Table colour</span>
        <ColorPicker
          value={table.colour}
          onChange={(c) => setTableColour(tableId, c)}
          allowClear
        />
      </div>

      <div className={f.group}>
        <span className={f.label}>
          Seated · {seatedIds.length}/{table.capacity}
        </span>
        {seatedIds.length === 0 ? (
          <p className={styles.emptySeated}>No one seated here yet.</p>
        ) : (
          <ul className={styles.seatedList}>
            {seatedIds.map((gid) => {
              const g = guests[gid]
              if (!g) return null
              return (
                <li key={gid} className={styles.seatedRow}>
                  <button
                    type="button"
                    className={styles.seatedName}
                    onClick={() => select('guest', gid)}
                  >
                    {g.fullName}
                  </button>
                  <IconButton
                    icon="x"
                    label={`Remove ${g.fullName}`}
                    size={24}
                    iconSize={13}
                    onClick={() => unassignGuest(gid)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {seatedIds.length > 0 && (
        <div className={styles.footer}>
          <Button variant="ghost" icon="trash" fullWidth onClick={() => clearTable(tableId)}>
            Clear table
          </Button>
        </div>
      )}
    </div>
  )
}
