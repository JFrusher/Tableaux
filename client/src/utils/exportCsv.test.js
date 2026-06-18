import { describe, it, expect } from 'vitest'
import { buildAssignmentCsv } from './exportCsv.js'

const guest = (id, fullName, extra = {}) => ({
  id,
  fullName,
  firstName: '',
  lastName: '',
  side: null,
  rsvpStatus: 'confirmed',
  dietary: '',
  notes: '',
  groupId: null,
  assignedTableId: null,
  ...extra,
})

describe('buildAssignmentCsv', () => {
  it('neutralises spreadsheet formula injection in guest fields', () => {
    const csv = buildAssignmentCsv({
      guests: { g1: guest('g1', '=1+1') },
      tables: {},
      groups: {},
    })
    expect(csv).toContain("'=1+1") // prefixed with a quote
    expect(csv).not.toMatch(/(^|,)=1\+1/m) // never a bare formula at a cell start
  })

  it('lists seated guests under their table', () => {
    const csv = buildAssignmentCsv({
      guests: { g1: guest('g1', 'Amy', { assignedTableId: 't1' }) },
      tables: { t1: { id: 't1', label: 'Table 1', seatMode: 'table', assignedGuestIds: ['g1'] } },
      groups: {},
    })
    expect(csv).toContain('Table 1')
    expect(csv).toContain('Amy')
  })
})
