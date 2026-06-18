import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'

const guest = (id, first, extra = {}) => ({
  id,
  firstName: first,
  lastName: 'X',
  fullName: `${first} X`,
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
  ...extra,
})

const baseDoc = () => ({
  meta: { weddingName: 'T', venue: '', date: '', createdAt: '', updatedAt: '' },
  guests: {
    g1: guest('g1', 'A', { assignedTableId: 't1', groupId: 'grp1' }),
    g2: guest('g2', 'B', { plusOneOf: 'g1' }),
    g3: guest('g3', 'C'),
  },
  groups: { grp1: { id: 'grp1', name: 'Fam', colour: '#abc', memberIds: ['g1'] } },
  tables: {
    t1: { id: 't1', label: 'T1', type: 'round', capacity: 8, seatMode: 'table', assignedGuestIds: ['g1'] },
  },
  zones: {},
  room: { width: 1200, height: 900, backgroundColour: '#FAF8F5' },
  canvas: { zoom: 1, panX: 0, panY: 0 },
  snapshots: [],
  constraints: [],
  settings: { defaultSeatMode: 'table', gridSnap: true, gridSize: 20 },
})

const s = () => useStore.getState()
beforeEach(() => s().hydrate(baseDoc()))

describe('removeGuest', () => {
  it('deletes a guest, unseats them, degroups them and detaches plus-ones', () => {
    s().removeGuest('g1')
    expect(s().guests.g1).toBeUndefined()
    expect(s().tables.t1.assignedGuestIds).not.toContain('g1')
    expect(s().groups.grp1.memberIds).not.toContain('g1')
    expect(s().guests.g2.plusOneOf).toBeNull() // plus-one detached
  })

  it('undoes a deletion exactly', () => {
    s().removeGuest('g1')
    s().undo()
    expect(s().guests.g1).toBeDefined()
    expect(s().tables.t1.assignedGuestIds).toContain('g1')
    expect(s().groups.grp1.memberIds).toContain('g1')
    expect(s().guests.g2.plusOneOf).toBe('g1')
  })

  it('bulk-deletes selected guests', () => {
    s().removeGuests(['g1', 'g3'])
    expect(s().guests.g1).toBeUndefined()
    expect(s().guests.g3).toBeUndefined()
    expect(s().guests.g2).toBeDefined()
    expect(s().tables.t1.assignedGuestIds).not.toContain('g1')
  })
})
