import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'
import { getTableGeometry } from '../utils/seatPositions.js'

const baseDoc = () => ({
  meta: { weddingName: 'T', venue: '', date: '', createdAt: '', updatedAt: '' },
  guests: {},
  groups: {},
  tables: {},
  zones: {},
  room: { width: 1200, height: 900, backgroundColour: '#FAF8F5' },
  canvas: { zoom: 1, panX: 0, panY: 0 },
  snapshots: [],
  constraints: [],
  settings: { defaultSeatMode: 'table', gridSnap: true, gridSize: 20 },
})

const s = () => useStore.getState()

beforeEach(() => {
  s().hydrate(baseDoc())
})

describe('table geometry actions', () => {
  it('new tables carry real-world sizeUnits', () => {
    const id = s().addTable({ type: 'round', x: 0, y: 0 }).meta.newTableId
    const t = s().tables[id]
    expect(t.sizeUnits).toBeTruthy()
    expect(t.sizeUnits.shape).toBe('circle')
    expect(t.sizeUnits.diameter).toBeGreaterThan(0)
  })

  it('resizeTable changes the footprint and undoes', () => {
    const id = s().addTable({ type: 'round', x: 0, y: 0 }).meta.newTableId
    const before = getTableGeometry(s().tables[id], s().settings.pixelsPerUnit).radius
    s().resizeTable(id, { diameter: s().tables[id].sizeUnits.diameter * 2 })
    const after = getTableGeometry(s().tables[id], s().settings.pixelsPerUnit).radius
    expect(after).toBeGreaterThan(before)
    s().undo()
    expect(s().tables[id].sizeUnits.diameter).toBeCloseTo(before * 2 / s().settings.pixelsPerUnit, 0)
  })

  it('rotateTable stores degrees and undoes', () => {
    const id = s().addTable({ type: 'rect', x: 0, y: 0 }).meta.newTableId
    s().rotateTable(id, 45)
    expect(s().tables[id].rotation).toBe(45)
    s().undo()
    expect(s().tables[id].rotation).toBe(0)
  })

  it('createCustomTable derives capacity from per-side seats', () => {
    const cmd = s().createCustomTable({
      x: 100,
      y: 100,
      width: 240,
      height: 120,
      perSideSeats: { top: 3, right: 1, bottom: 3, left: 1 },
    })
    const t = s().tables[cmd.meta.newTableId]
    expect(t.custom).toBe(true)
    expect(t.capacity).toBe(8)
    expect(getTableGeometry(t, s().settings.pixelsPerUnit).seats).toHaveLength(8)
  })

  it('setPerSideSeats recomputes capacity', () => {
    const id = s().addTable({ type: 'rect', x: 0, y: 0 }).meta.newTableId
    s().setPerSideSeats(id, { top: 5, right: 0, bottom: 5, left: 2 })
    expect(s().tables[id].capacity).toBe(12)
    s().undo()
    expect(s().tables[id].perSideSeats).toBeNull()
  })

  it('changeTableType clears per-side seating', () => {
    const id = s().createCustomTable({ perSideSeats: { top: 2, bottom: 2 } }).meta.newTableId
    s().changeTableType(id, 'round')
    expect(s().tables[id].perSideSeats).toBeNull()
    expect(s().tables[id].type).toBe('round')
  })

  it('calibrate updates the scale and undoes', () => {
    const before = s().settings.pixelsPerUnit
    s().calibrate(before * 2)
    expect(s().settings.pixelsPerUnit).toBe(before * 2)
    s().undo()
    expect(s().settings.pixelsPerUnit).toBe(before)
  })
})

describe('table presets', () => {
  it('saves a table as a preset capturing size + seating, then recreates it', () => {
    const srcId = s()
      .createCustomTable({ width: 240, height: 120, perSideSeats: { top: 3, right: 1, bottom: 3, left: 1 } })
      .meta.newTableId
    const src = s().tables[srcId]

    s().saveTablePreset(srcId, 'Banquet 8')
    const presets = s().settings.customTablePresets
    expect(presets).toHaveLength(1)
    expect(presets[0]).toMatchObject({
      name: 'Banquet 8',
      type: src.type,
      capacity: src.capacity,
      sizeUnits: src.sizeUnits,
      perSideSeats: src.perSideSeats,
    })

    // Dropping the preset reproduces the footprint and seating.
    const preset = presets[0]
    const newId = s()
      .addTable({
        type: preset.type,
        x: 50,
        y: 50,
        capacity: preset.capacity,
        sizeUnits: preset.sizeUnits,
        perSideSeats: preset.perSideSeats,
        seatMode: preset.seatMode,
      })
      .meta.newTableId
    const made = s().tables[newId]
    expect(made.sizeUnits).toEqual(src.sizeUnits)
    expect(made.perSideSeats).toEqual(src.perSideSeats)
    expect(made.capacity).toBe(src.capacity)
  })

  it('deletes a preset and undoes the save', () => {
    const id = s().addTable({ type: 'round', x: 0, y: 0 }).meta.newTableId
    s().saveTablePreset(id, 'Round')
    const presetId = s().settings.customTablePresets[0].id
    s().deleteTablePreset(presetId)
    expect(s().settings.customTablePresets).toHaveLength(0)
    s().undo() // undo delete
    expect(s().settings.customTablePresets).toHaveLength(1)
    s().undo() // undo save
    expect(s().settings.customTablePresets).toHaveLength(0)
  })
})
