import { downloadFile, slug } from './exportJson.js'

// Cells beginning with these characters can be executed as formulas by Excel /
// Google Sheets; prefix with a quote to neutralise spreadsheet injection.
const FORMULA_LEAD = /^[=+\-@\t\r]/
export const escCsvCell = (v) => {
  let s = v == null ? '' : String(v)
  if (FORMULA_LEAD.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const esc = escCsvCell
export const toCsv = (headers, rows) =>
  [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'

const sideLabel = (side) => ({ bride: "Bride's", groom: "Groom's", both: 'Both' })[side] || ''

/** Caterer-friendly assignment rows, ordered by table then seat. */
export function buildAssignmentTable(state) {
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
        g.fullName,
        sideLabel(g.side),
        g.rsvpStatus || '',
        g.dietary || '',
        groups[g.groupId]?.name || '',
        g.notes || '',
      ])
    }
  }

  Object.values(guests)
    .filter((g) => !seated.has(g.id) && g.rsvpStatus !== 'declined')
    .sort((a, b) => String(a.fullName).localeCompare(b.fullName))
    .forEach((g) => {
      rows.push([
        '(Unassigned)',
        '',
        g.fullName,
        sideLabel(g.side),
        g.rsvpStatus || '',
        g.dietary || '',
        groups[g.groupId]?.name || '',
        g.notes || '',
      ])
    })

  return { headers, rows }
}

export function buildAssignmentCsv(state) {
  const { headers, rows } = buildAssignmentTable(state)
  return toCsv(headers, rows)
}

export function exportCsv(state, name) {
  downloadFile(`${slug(name)}-assignments.csv`, buildAssignmentCsv(state), 'text/csv')
}
