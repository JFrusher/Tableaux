import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'

const baseDoc = () => ({
  meta: { weddingName: 'Imported', venue: '', date: '', createdAt: '', updatedAt: '' },
  guests: {
    g1: {
      id: 'g1',
      firstName: 'A',
      lastName: 'X',
      fullName: 'A X',
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
    },
  },
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
  s().hydrate(baseDoc())
})

describe('importPlan', () => {
  it('round-trips an exported document', () => {
    // Export the current plan, mutate the live store, then re-import the export.
    const exported = s().serialize()
    s().addTable({ type: 'round', x: 0, y: 0 })
    expect(Object.keys(s().tables)).toHaveLength(1)

    s().importPlan(exported)
    expect(Object.keys(s().tables)).toHaveLength(0)
    expect(s().meta.weddingName).toBe('Imported')
    expect(s().guests.g1.fullName).toBe('A X')
  })

  it('marks the store dirty so the import gets auto-saved', () => {
    expect(s().isDirty()).toBe(false) // just hydrated → clean
    s().importPlan({ ...baseDoc(), meta: { ...baseDoc().meta, weddingName: 'Restored' } })
    expect(s().isDirty()).toBe(true)
    expect(s().meta.weddingName).toBe('Restored')
  })

  it('ignores unknown keys, keeping only the document shape', () => {
    s().importPlan({ ...baseDoc(), hackerKey: 'nope', selection: { type: 'x', id: 'y' } })
    expect(s().hackerKey).toBeUndefined()
    // selection is ephemeral UI state, reset by import — not taken from the file.
    expect(s().selection).toEqual({ type: null, id: null })
  })
})
