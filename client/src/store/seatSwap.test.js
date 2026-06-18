import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'
import { seatId } from '../utils/ids.js'

const mkGuest = (id, first, last) => ({
  id,
  firstName: first,
  lastName: last,
  fullName: `${first} ${last}`,
  email: '',
  dietary: '',
  dietaryRaw: '',
  side: null,
  rsvpStatus: 'confirmed',
  plusOneOf: null,
  groupId: null,
  assignedTableId: null,
  assignedSeatId: null,
  notes: '',
  tags: [],
})

const fixture = () => ({
  meta: { weddingName: 'Test', venue: '', date: '', createdAt: '', updatedAt: '' },
  guests: { g1: mkGuest('g1', 'A', 'X'), g2: mkGuest('g2', 'B', 'Y') },
  groups: {},
  tables: {
    t1: {
      id: 't1',
      label: 'Table 1',
      designation: null,
      type: 'round',
      capacity: 8,
      x: 0,
      y: 0,
      rotation: 0,
      assignedGuestIds: [],
      seatMode: 'seat',
      colour: null,
    },
  },
  zones: {},
  room: { width: 1200, height: 900, backgroundColour: '#FAF8F5' },
  canvas: { zoom: 1, panX: 0, panY: 0 },
  snapshots: [],
  constraints: [],
  settings: {
    defaultSeatMode: 'table',
    showDietaryBadges: true,
    showGroupColours: true,
    gridSnap: true,
    gridSize: 20,
  },
})

const s = () => useStore.getState()

beforeEach(() => {
  const st = useStore.getState()
  st.hydrate(fixture())
  // Seat g1 at index 0 and g2 at index 1.
  st.assignGuest('g1', 't1', 0)
  st.assignGuest('g2', 't1', 1)
})

describe('swapSeatGuests', () => {
  it('swaps two seated guests and keeps table + guest seat ids in sync', () => {
    s().swapSeatGuests('t1', 0, 1)

    expect(s().tables.t1.assignedGuestIds[0]).toBe('g2')
    expect(s().tables.t1.assignedGuestIds[1]).toBe('g1')
    expect(s().guests.g1.assignedSeatId).toBe(seatId('t1', 1))
    expect(s().guests.g2.assignedSeatId).toBe(seatId('t1', 0))
    // Both stay at the same table.
    expect(s().guests.g1.assignedTableId).toBe('t1')
    expect(s().guests.g2.assignedTableId).toBe('t1')
  })

  it('is exactly reversible via undo / redo', () => {
    s().swapSeatGuests('t1', 0, 1)
    s().undo()

    expect(s().tables.t1.assignedGuestIds[0]).toBe('g1')
    expect(s().tables.t1.assignedGuestIds[1]).toBe('g2')
    expect(s().guests.g1.assignedSeatId).toBe(seatId('t1', 0))
    expect(s().guests.g2.assignedSeatId).toBe(seatId('t1', 1))

    s().redo()
    expect(s().tables.t1.assignedGuestIds[0]).toBe('g2')
    expect(s().guests.g1.assignedSeatId).toBe(seatId('t1', 1))
  })

  it('moves a guest into an empty seat when the target is unoccupied', () => {
    s().swapSeatGuests('t1', 0, 5) // seat 5 is empty
    expect(s().tables.t1.assignedGuestIds[0] ?? null).toBeNull()
    expect(s().tables.t1.assignedGuestIds[5]).toBe('g1')
    expect(s().guests.g1.assignedSeatId).toBe(seatId('t1', 5))
  })

  it('is a no-op for equal indices, two empty seats, or a table-mode table', () => {
    expect(s().swapSeatGuests('t1', 0, 0)).toBeNull()
    expect(s().swapSeatGuests('t1', 4, 5)).toBeNull() // both empty
    s().setSeatMode('t1', 'table')
    expect(s().swapSeatGuests('t1', 0, 1)).toBeNull()
  })
})
