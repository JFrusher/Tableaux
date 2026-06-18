import { Router } from 'express'
import { readState } from '../lib/persistence.js'
import { toCsv } from '../lib/csv.js'

const router = Router()

const sideLabel = (side) =>
  ({ bride: "Bride's", groom: "Groom's", both: 'Both' })[side] || ''

// GET /api/export/csv — caterer-friendly assignment sheet, ordered by table.
router.get('/csv', async (req, res, next) => {
  try {
    const state = await readState()
    const { guests = {}, tables = {}, groups = {} } = state
    const headers = ['Table', 'Seat', 'Guest', 'Side', 'RSVP', 'Dietary', 'Group', 'Notes']
    const rows = []

    const tableList = Object.values(tables).sort((a, b) =>
      String(a.label).localeCompare(String(b.label), undefined, { numeric: true })
    )

    const seated = new Set()
    for (const t of tableList) {
      for (const [idx, gid] of (t.assignedGuestIds || []).entries()) {
        const g = guests[gid]
        if (!g) continue
        seated.add(gid)
        rows.push([
          t.label,
          t.seatMode === 'seat' ? String(idx + 1) : '',
          g.fullName || `${g.firstName} ${g.lastName}`.trim(),
          sideLabel(g.side),
          g.rsvpStatus || '',
          g.dietary || '',
          groups[g.groupId]?.name || '',
          g.notes || '',
        ])
      }
    }

    // Confirmed but unassigned guests, listed last.
    Object.values(guests)
      .filter((g) => !seated.has(g.id) && g.rsvpStatus !== 'declined')
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)))
      .forEach((g) => {
        rows.push([
          '(Unassigned)',
          '',
          g.fullName || `${g.firstName} ${g.lastName}`.trim(),
          sideLabel(g.side),
          g.rsvpStatus || '',
          g.dietary || '',
          groups[g.groupId]?.name || '',
          g.notes || '',
        ])
      })

    const csv = toCsv(headers, rows)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="tableaux-assignments.csv"')
    res.send(csv)
  } catch (e) {
    next(e)
  }
})

export default router
