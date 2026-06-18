import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'

const emptyDoc = () => ({
  meta: { weddingName: 'Test', venue: '', date: '', createdAt: '', updatedAt: '' },
  guests: {},
  groups: {},
  tables: {},
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
  s().hydrate(emptyDoc())
})

describe('addGuest', () => {
  it('creates a confirmed, unseated guest and is undoable', () => {
    const cmd = s().addGuest({ firstName: 'Sam', lastName: 'Lee', dietaryRaw: 'Vegan' })
    const id = cmd.meta.newGuestId
    const g = s().guests[id]
    expect(g.fullName).toBe('Sam Lee')
    expect(g.rsvpStatus).toBe('confirmed')
    expect(g.assignedTableId).toBeNull()
    expect(g.dietary).toBe('') // raw is stored verbatim; normalisation happens on edit

    s().undo()
    expect(s().guests[id]).toBeUndefined()
  })

  it('falls back to a placeholder name when called with no details', () => {
    const id = s().addGuest().meta.newGuestId
    expect(s().guests[id].fullName).toBe('New guest')
  })
})
