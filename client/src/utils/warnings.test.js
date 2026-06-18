import { describe, it, expect } from 'vitest'
import { computeWarnings, buildWarningIndex } from './warnings.js'

const guest = (id, over = {}) => ({
  id,
  fullName: id,
  dietary: '',
  rsvpStatus: 'confirmed',
  assignedTableId: null,
  ...over,
})
const table = (id, over = {}) => ({
  id,
  label: id,
  type: 'round',
  capacity: 8,
  designation: null,
  assignedGuestIds: [],
  ...over,
})

describe('computeWarnings', () => {
  it('flags an over-capacity table', () => {
    const state = {
      guests: { a: guest('a'), b: guest('b'), c: guest('c') },
      tables: { t: table('t', { capacity: 2, assignedGuestIds: ['a', 'b', 'c'] }) },
      constraints: [],
    }
    const w = computeWarnings(state)
    expect(w.some((x) => x.kind === 'over-capacity' && x.tableId === 't')).toBe(true)
  })

  it('nudges to check guests with no dietary note among others who have one', () => {
    const state = {
      guests: {
        a: guest('a', { dietary: 'vegan', assignedTableId: 't' }),
        b: guest('b', { assignedTableId: 't' }),
      },
      tables: { t: table('t', { assignedGuestIds: ['a', 'b'] }) },
      constraints: [],
    }
    expect(computeWarnings(state).some((x) => x.kind === 'dietary-check')).toBe(true)
  })

  it('warns when more than 30% of guests are unseated', () => {
    const guests = {}
    for (let i = 0; i < 10; i++) guests[`g${i}`] = guest(`g${i}`, { assignedTableId: i < 6 ? 't' : null })
    const w = computeWarnings({ guests, tables: { t: table('t') }, constraints: [] })
    expect(w.some((x) => x.kind === 'unassigned')).toBe(true)
  })

  it('honours "apart" and "together" constraints', () => {
    const apart = computeWarnings({
      guests: { a: guest('a', { assignedTableId: 't' }), b: guest('b', { assignedTableId: 't' }) },
      tables: { t: table('t', { assignedGuestIds: ['a', 'b'] }) },
      constraints: [{ id: 'c1', kind: 'apart', guestIds: ['a', 'b'] }],
    })
    expect(apart.some((x) => x.kind === 'apart')).toBe(true)

    const together = computeWarnings({
      guests: { a: guest('a', { assignedTableId: 't1' }), b: guest('b', { assignedTableId: 't2' }) },
      tables: { t1: table('t1', { assignedGuestIds: ['a'] }), t2: table('t2', { assignedGuestIds: ['b'] }) },
      constraints: [{ id: 'c2', kind: 'together', guestIds: ['a', 'b'] }],
    })
    expect(together.some((x) => x.kind === 'together')).toBe(true)
  })

  it('reports a clean plan with no warnings', () => {
    const state = {
      guests: { a: guest('a', { assignedTableId: 't', dietary: 'vegan' }) },
      tables: { t: table('t', { assignedGuestIds: ['a'] }) },
      constraints: [],
    }
    expect(computeWarnings(state)).toHaveLength(0)
  })
})

describe('buildWarningIndex', () => {
  it('indexes warnings by table and guest', () => {
    const { byTable, byGuest } = buildWarningIndex([
      { id: 'w1', tableId: 't', message: 'x' },
      { id: 'w2', guestId: 'g', message: 'y' },
    ])
    expect(byTable.get('t')).toHaveLength(1)
    expect(byGuest.get('g')).toHaveLength(1)
  })
})
