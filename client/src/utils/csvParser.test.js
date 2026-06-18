import { describe, it, expect } from 'vitest'
import {
  guessMapping,
  uniqueValues,
  defaultComingValues,
  buildGuests,
} from './csvParser.js'

describe('guessMapping', () => {
  it('auto-detects standard headers (case-insensitive, fuzzy)', () => {
    const m = guessMapping(['First Name', 'Last Name', 'Email', 'Attending', 'Dietary', 'Side', 'Notes'])
    expect(m).toMatchObject({
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      rsvp: 'Attending',
      dietary: 'Dietary',
      side: 'Side',
      notes: 'Notes',
    })
  })

  it('falls back to a single "Name" column when first/last are absent', () => {
    const m = guessMapping(['Name', 'RSVP', 'Food restriction'])
    expect(m.firstName).toBe('Name')
    expect(m.lastName).toBeNull()
    expect(m.rsvp).toBe('RSVP')
    expect(m.dietary).toBe('Food restriction')
  })
})

describe('uniqueValues / defaultComingValues', () => {
  const rows = [{ A: 'Yes' }, { A: 'No' }, { A: 'Yes' }, { A: 'Maybe' }, { A: '' }]

  it('returns distinct non-empty values, sorted', () => {
    expect(uniqueValues(rows, 'A')).toEqual(['Maybe', 'No', 'Yes'])
    expect(uniqueValues(rows, 'missing')).toEqual([])
  })

  it('pre-selects values that mean "coming"', () => {
    expect(defaultComingValues(['Yes', 'No', 'Confirmed', 'Maybe'])).toEqual(['Yes', 'Confirmed'])
  })
})

describe('buildGuests', () => {
  const mapping = { firstName: 'Name', rsvp: 'Att', dietary: 'Diet', side: 'Side' }

  it('splits a single name column and normalises fields', () => {
    const [g] = buildGuests([{ Name: 'Emma Clarke', Att: 'Yes', Diet: 'Vegan', Side: 'Bride' }], mapping, ['Yes'])
    expect(g).toMatchObject({
      firstName: 'Emma',
      lastName: 'Clarke',
      fullName: 'Emma Clarke',
      rsvpStatus: 'confirmed',
      dietary: 'vegan',
      dietaryRaw: 'Vegan',
      side: 'bride',
    })
  })

  it('classifies RSVP values into confirmed / declined / pending', () => {
    const rows = [
      { Name: 'A One', Att: 'Yes' },
      { Name: 'B Two', Att: 'No' },
      { Name: 'C Three', Att: 'Maybe' },
    ]
    const out = buildGuests(rows, mapping, ['Yes'])
    expect(out.map((g) => g.rsvpStatus)).toEqual(['confirmed', 'declined', 'pending'])
  })

  it('drops rows with no usable name', () => {
    const out = buildGuests([{ Name: '', Att: 'Yes' }, { Name: 'Real Guest', Att: 'Yes' }], mapping, ['Yes'])
    expect(out).toHaveLength(1)
    expect(out[0].fullName).toBe('Real Guest')
  })
})
