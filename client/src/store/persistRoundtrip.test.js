import { describe, it, expect } from 'vitest'
import { useStore } from './useStore.js'
import { validatePlanDoc } from '../../../server/lib/planSchema.js'

// A deliberately rich document touching every field that has been suspected of
// "not persisting": table rotation, seat-level assignments (incl. gaps), seat
// mode, resized dimensions, per-side seat distribution, zones, groups (colour +
// membership), room sizing/background and canvas pan/zoom.
const richDoc = () => ({
  meta: { weddingName: 'Round Trip', venue: 'Barn', date: '2026-09-01' },
  guests: {
    g1: {
      id: 'g1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      dietary: 'vegetarian',
      dietaryRaw: 'veggie',
      side: 'bride',
      rsvpStatus: 'confirmed',
      plusOneOf: null,
      groupId: 'grp1',
      assignedTableId: 't1',
      assignedSeatId: 'seat-0',
      notes: 'window seat',
      tags: ['vip'],
    },
    g2: {
      id: 'g2',
      firstName: 'Alan',
      lastName: 'Turing',
      fullName: 'Alan Turing',
      email: '',
      dietary: '',
      dietaryRaw: '',
      side: 'groom',
      rsvpStatus: 'pending',
      plusOneOf: null,
      groupId: null,
      assignedTableId: 't1',
      assignedSeatId: 'seat-2',
      notes: '',
      tags: [],
    },
  },
  groups: {
    grp1: { id: 'grp1', name: 'College friends', colour: '#4A7C59', memberIds: ['g1'] },
  },
  tables: {
    t1: {
      id: 't1',
      label: 'Top Table',
      type: 'rect',
      capacity: 8,
      x: 400,
      y: 300,
      rotation: 45,
      seatMode: 'seat',
      assignedGuestIds: ['g1', null, 'g2'],
      colour: '#C07C2A',
      designation: 'head',
      perSideSeats: { top: 0, right: 2, bottom: 6, left: 0 },
      sizeUnits: { shape: 'rect', width: 240, height: 90 },
    },
  },
  zones: {
    z1: { id: 'z1', label: 'Dance floor', x: 100, y: 100, width: 200, height: 200, shape: 'rect', colour: '#5C7E9E' },
  },
  room: { widthUnits: 1714.29, heightUnits: 1285.71, backgroundColour: '#FAF8F5' },
  canvas: { zoom: 1.4, panX: -120, panY: 60 },
  snapshots: [],
  constraints: [],
  settings: {
    defaultSeatMode: 'seat',
    showDietaryBadges: true,
    showGroupColours: true,
    gridSnap: true,
    gridSize: 20,
    pixelsPerUnit: 0.7,
  },
})

const s = () => useStore.getState()

describe('persistence round-trip', () => {
  it('preserves every field through serialize → server validation → hydrate', () => {
    s().hydrate(richDoc())
    const a = s().serialize() // already normalised by hydrate

    // Push through the exact server-side validation used on save…
    const validated = validatePlanDoc(a)
    // …and reload it, as a fresh session would.
    s().hydrate(validated)
    const b = s().serialize()

    // Whole-document idempotency: nothing dropped or mutated on the way through.
    expect(b).toEqual(a)

    // Targeted spot-checks for the fields the TODO worried about.
    expect(b.tables.t1.rotation).toBe(45)
    expect(b.tables.t1.seatMode).toBe('seat')
    expect(b.tables.t1.assignedGuestIds).toEqual(['g1', null, 'g2'])
    expect(b.tables.t1.sizeUnits).toEqual({ shape: 'rect', width: 240, height: 90 })
    expect(b.tables.t1.perSideSeats).toEqual({ top: 0, right: 2, bottom: 6, left: 0 })
    expect(b.groups.grp1.colour).toBe('#4A7C59')
    expect(b.groups.grp1.memberIds).toEqual(['g1'])
    expect(b.zones.z1.label).toBe('Dance floor')
    expect(b.canvas).toEqual({ zoom: 1.4, panX: -120, panY: 60 })
    expect(b.room.backgroundColour).toBe('#FAF8F5')
  })

  it('createEmptyGroup creates a fillable group that persists and undoes', () => {
    s().hydrate(richDoc())
    const before = Object.keys(s().groups).length
    s().createEmptyGroup({ name: 'Family', colour: '#A6576A' })
    const ids = Object.keys(s().groups)
    expect(ids.length).toBe(before + 1)
    const created = Object.values(s().groups).find((g) => g.name === 'Family')
    expect(created).toBeTruthy()
    expect(created.memberIds).toEqual([])

    // Survives a save→reload round-trip.
    const reloaded = validatePlanDoc(s().serialize())
    s().hydrate(reloaded)
    expect(Object.values(s().groups).some((g) => g.name === 'Family')).toBe(true)

    // …and the creation is undoable.
    s().hydrate(richDoc())
    s().createEmptyGroup({ name: 'Temp' })
    expect(Object.keys(s().groups).length).toBe(before + 1)
    s().undo()
    expect(Object.keys(s().groups).length).toBe(before)
  })
})
