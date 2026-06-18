import { describe, it, expect } from 'vitest'
import { sanitizeDocForView, findGuestSeat } from './shareSanitize.js'

const doc = () => ({
  meta: { weddingName: 'A & B', venue: 'The Barn', date: '2026-09-01', createdAt: 'x' },
  guests: {
    g1: {
      id: 'g1',
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      notes: 'ex of g2',
      dietary: 'vegan',
      dietaryRaw: 'VEGAN pls',
      tags: ['vip'],
      plusOneOf: null,
      rsvpStatus: 'confirmed',
      side: 'bride',
      groupId: 'grp1',
      assignedTableId: 't1',
      assignedSeatId: 't1#2',
    },
    g2: {
      id: 'g2',
      firstName: 'John',
      lastName: 'Roe',
      fullName: 'John Roe',
      email: 'john@example.com',
      assignedTableId: null,
    },
  },
  groups: { grp1: { id: 'grp1', name: 'College', colour: '#abc', memberIds: ['g1'] } },
  tables: { t1: { id: 't1', label: 'Table 5', seatMode: 'seat', assignedGuestIds: [null, null, 'g1'] } },
  zones: {},
  room: { width: 1200 },
  constraints: [{ type: 'apart', a: 'g1', b: 'g2' }],
  settings: { pixelsPerUnit: 0.7, unitSystem: 'metric', defaultSeatMode: 'seat' },
})

describe('sanitizeDocForView', () => {
  it('strips PII from guests', () => {
    const out = sanitizeDocForView(doc())
    const g = out.guests.g1
    expect(g.fullName).toBe('Jane Doe')
    expect(g.email).toBeUndefined()
    expect(g.notes).toBeUndefined()
    expect(g.dietaryRaw).toBeUndefined()
    expect(g.tags).toBeUndefined()
    expect(g.plusOneOf).toBeUndefined()
    expect(g.rsvpStatus).toBeUndefined()
    expect(g.dietary).toBeUndefined() // showDietary defaults off
  })

  it('includes the dietary key only when opted in', () => {
    const out = sanitizeDocForView(doc(), { showDietary: true })
    expect(out.guests.g1.dietary).toBe('vegan')
  })

  it('drops constraints and excess settings', () => {
    const out = sanitizeDocForView(doc())
    expect(out.constraints).toBeUndefined()
    expect(out.settings.defaultSeatMode).toBeUndefined()
    expect(out.settings.pixelsPerUnit).toBe(0.7)
  })

  it('serializes without any email appearing anywhere', () => {
    const json = JSON.stringify(sanitizeDocForView(doc(), { showDietary: true }))
    expect(json).not.toContain('@example.com')
    expect(json).not.toContain('ex of g2')
  })
})

describe('findGuestSeat', () => {
  it('returns only the matched guest with table + seat', () => {
    const matches = findGuestSeat(doc(), 'jane')
    expect(matches).toHaveLength(1)
    expect(matches[0]).toEqual({ fullName: 'Jane Doe', tableLabel: 'Table 5', seatNumber: 3 })
  })

  it('requires at least 2 characters', () => {
    expect(findGuestSeat(doc(), 'j')).toEqual([])
  })

  it('returns empty (not the list) for no match', () => {
    expect(findGuestSeat(doc(), 'zzz')).toEqual([])
  })

  it('is diacritic-insensitive and case-insensitive', () => {
    const d = doc()
    d.guests.g1.fullName = 'Jané Doe'
    expect(findGuestSeat(d, 'JANE')).toHaveLength(1)
  })
})
