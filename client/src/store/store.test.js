import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'

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
      seatMode: 'table',
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
const countTables = () => Object.keys(s().tables).length

beforeEach(() => {
  useStore.getState().hydrate(fixture())
})

describe('tables', () => {
  it('adds a table and supports undo / redo', () => {
    const cmd = s().addTable({ type: 'round', x: 10, y: 10 })
    expect(cmd.meta.newTableId).toBeTruthy()
    expect(countTables()).toBe(2)

    s().undo()
    expect(countTables()).toBe(1)
    s().redo()
    expect(countTables()).toBe(2)
  })

  it('deleting a table unassigns its guests, and undo restores both', () => {
    s().assignGuest('g1', 't1')
    expect(s().guests.g1.assignedTableId).toBe('t1')

    s().removeTable('t1')
    expect(s().tables.t1).toBeUndefined()
    expect(s().guests.g1.assignedTableId).toBeNull()

    s().undo()
    expect(s().tables.t1).toBeDefined()
    expect(s().guests.g1.assignedTableId).toBe('t1')
  })
})

describe('assignment', () => {
  it('assigns and unassigns a guest, keeping table + guest in sync', () => {
    s().assignGuest('g1', 't1')
    expect(s().tables.t1.assignedGuestIds).toContain('g1')

    s().undo()
    expect(s().guests.g1.assignedTableId).toBeNull()
    expect(s().tables.t1.assignedGuestIds).not.toContain('g1')
  })

  it('moving a guest to another table clears the original', () => {
    const t2 = s().addTable({ type: 'round', x: 5, y: 5 }).meta.newTableId
    s().assignGuest('g1', 't1')
    s().assignGuest('g1', t2)
    expect(s().tables.t1.assignedGuestIds).not.toContain('g1')
    expect(s().tables[t2].assignedGuestIds).toContain('g1')
  })
})

describe('history stack', () => {
  it('tracks past / future across undo and redo', () => {
    expect(s()._history.past).toHaveLength(0)
    s().addTable({ type: 'round', x: 0, y: 0 })
    expect(s()._history.past).toHaveLength(1)
    expect(s()._history.future).toHaveLength(0)
    s().undo()
    expect(s()._history.past).toHaveLength(0)
    expect(s()._history.future).toHaveLength(1)
  })
})

describe('groups', () => {
  it('creates a group and dissolves it via undo', () => {
    s().createGroup(['g1', 'g2'], { name: 'Family' })
    const gid = Object.keys(s().groups)[0]
    expect(s().guests.g1.groupId).toBe(gid)
    expect(s().guests.g2.groupId).toBe(gid)

    s().undo()
    expect(Object.keys(s().groups)).toHaveLength(0)
    expect(s().guests.g1.groupId).toBeNull()
  })
})

describe('import', () => {
  it('replace strategy resets the guest list', () => {
    s().importGuests(
      [{ firstName: 'New', lastName: 'Person', fullName: 'New Person', rsvpStatus: 'confirmed' }],
      'replace'
    )
    expect(Object.keys(s().guests)).toHaveLength(1)
    expect(Object.values(s().guests)[0].fullName).toBe('New Person')
  })
})

describe('snapshots', () => {
  it('captures and restores a point-in-time copy', () => {
    s().addTable({ type: 'round', x: 1, y: 1 }) // now 2 tables
    const snap = s().saveSnapshot('checkpoint')
    expect(s().snapshots).toHaveLength(1)

    s().addTable({ type: 'round', x: 2, y: 2 }) // now 3 tables
    expect(countTables()).toBe(3)

    s().restoreSnapshot(snap.id)
    expect(countTables()).toBe(2)
    expect(s().snapshots).toHaveLength(1) // snapshot list preserved
  })
})
