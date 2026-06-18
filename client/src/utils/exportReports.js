import { DIETARY_META } from './dietary.js'
import { getTableType } from './tableTypes.js'
import { toCsv } from './exportCsv.js'
import { downloadFile, slug } from './exportJson.js'

/**
 * Vendor/caterer reporting built purely from the live document — works in both
 * SaaS and local modes since it never touches the server. Each builder returns
 * `{ headers, rows }` (arrays of arrays) so the same data shapes back both the
 * CSV report and the XLSX workbook (single source of truth).
 */

const isCounted = (g) => g.rsvpStatus !== 'declined'

/** Headcount by dietary requirement among non-declined guests. */
export function buildDietaryTotals(state) {
  const { guests = {} } = state
  const counts = {}
  let standard = 0
  let total = 0
  for (const g of Object.values(guests)) {
    if (!isCounted(g)) continue
    total++
    const key = g.dietary || ''
    if (!key) standard++
    else counts[key] = (counts[key] || 0) + 1
  }
  const rows = []
  rows.push(['Standard / no requirement', standard])
  Object.keys(DIETARY_META)
    .filter((k) => counts[k])
    .forEach((k) => rows.push([DIETARY_META[k].label, counts[k]]))
  // any unknown keys not in DIETARY_META
  Object.keys(counts)
    .filter((k) => !DIETARY_META[k])
    .forEach((k) => rows.push([k, counts[k]]))
  rows.push(['Total attending', total])
  return { headers: ['Dietary requirement', 'Guests'], rows }
}

/** Per-table summary: occupancy, capacity, dietary breakdown, side mix. */
export function buildPerTableSummary(state) {
  const { guests = {}, tables = {} } = state
  const headers = ['Table', 'Seated', 'Capacity', 'Dietary', "Bride's", "Groom's"]
  const rows = []
  const tableList = Object.values(tables).sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { numeric: true })
  )
  for (const t of tableList) {
    const ids = (t.assignedGuestIds || []).filter(Boolean)
    const diet = {}
    let bride = 0
    let groom = 0
    for (const gid of ids) {
      const g = guests[gid]
      if (!g) continue
      if (g.dietary) {
        const ab = DIETARY_META[g.dietary]?.abbrev || g.dietary
        diet[ab] = (diet[ab] || 0) + 1
      }
      if (g.side === 'bride') bride++
      else if (g.side === 'groom') groom++
    }
    const dietStr = Object.entries(diet)
      .map(([ab, n]) => `${n} ${ab}`)
      .join(', ')
    rows.push([
      t.label,
      ids.length,
      t.capacity ?? getTableType(t.type).defaultCapacity,
      dietStr,
      bride || '',
      groom || '',
    ])
  }
  return { headers, rows }
}

/** A single CSV report combining dietary totals and the per-table summary. */
export function buildReportCsv(state) {
  const diet = buildDietaryTotals(state)
  const perTable = buildPerTableSummary(state)
  return (
    toCsv(diet.headers, diet.rows) +
    '\r\n' +
    toCsv(perTable.headers, perTable.rows)
  )
}

export function exportReportCsv(state, name) {
  downloadFile(`${slug(name)}-report.csv`, buildReportCsv(state), 'text/csv')
}
