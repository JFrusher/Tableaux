import { getTableType } from './tableTypes.js'

/**
 * Pure rules engine. Given the document, returns a flat list of warnings:
 *   { id, level: 'warn' | 'info', kind, message, tableId?, guestId? }
 * Surfaced as amber badges on tables/cards and in the warnings panel; never
 * blocks the user.
 */
export function computeWarnings(state) {
  const { guests = {}, tables = {}, constraints = [] } = state
  const guestList = Object.values(guests)
  const tableList = Object.values(tables)
  const out = []

  for (const t of tableList) {
    const ids = (t.assignedGuestIds || []).filter(Boolean)
    const seated = ids.length

    if (seated > t.capacity) {
      out.push({
        id: `cap_${t.id}`,
        level: 'warn',
        kind: 'over-capacity',
        tableId: t.id,
        message: `${t.label} is over capacity (${seated}/${t.capacity}).`,
      })
    }

    const gs = ids.map((id) => guests[id]).filter(Boolean)
    const withDiet = gs.filter((g) => g.dietary).length
    const without = gs.filter((g) => !g.dietary).length
    if (withDiet > 0 && without > 0) {
      out.push({
        id: `diet_${t.id}`,
        level: 'info',
        kind: 'dietary-check',
        tableId: t.id,
        message: `${t.label}: ${without} ${
          without === 1 ? 'guest has' : 'guests have'
        } no dietary note while others do — worth checking.`,
      })
    }

    const isSpecial =
      t.type === 'sweetheart' || t.type === 'top-table' || t.designation === 'top-table'
    if (isSpecial && seated === 0) {
      out.push({
        id: `special_${t.id}`,
        level: 'info',
        kind: 'empty-special',
        tableId: t.id,
        message: `${t.label} (your ${getTableType(t.type).label.toLowerCase()}) has no one seated yet.`,
      })
    }
  }

  const eligible = guestList.filter((g) => g.rsvpStatus !== 'declined')
  const unassigned = eligible.filter((g) => !g.assignedTableId).length
  if (eligible.length > 0 && unassigned / eligible.length > 0.3) {
    out.push({
      id: 'unassigned',
      level: 'info',
      kind: 'unassigned',
      message: `${unassigned} of ${eligible.length} guests (${Math.round(
        (unassigned / eligible.length) * 100
      )}%) are still unseated.`,
    })
  }

  for (const c of constraints) {
    const [a, b] = c.guestIds || []
    const ga = guests[a]
    const gb = guests[b]
    if (!ga || !gb) continue
    if (
      c.kind === 'apart' &&
      ga.assignedTableId &&
      ga.assignedTableId === gb.assignedTableId
    ) {
      out.push({
        id: `cst_${c.id}`,
        level: 'warn',
        kind: 'apart',
        tableId: ga.assignedTableId,
        guestId: a,
        message: `${ga.fullName} and ${gb.fullName} shouldn't sit together — both are at ${tables[ga.assignedTableId]?.label}.`,
      })
    }
    if (
      c.kind === 'together' &&
      ga.assignedTableId &&
      gb.assignedTableId &&
      ga.assignedTableId !== gb.assignedTableId
    ) {
      out.push({
        id: `cst_${c.id}`,
        level: 'warn',
        kind: 'together',
        guestId: a,
        message: `${ga.fullName} and ${gb.fullName} should sit together, but they're at different tables.`,
      })
    }
  }

  return out
}

export function buildWarningIndex(list) {
  const byTable = new Map()
  const byGuest = new Map()
  for (const w of list) {
    if (w.tableId) {
      if (!byTable.has(w.tableId)) byTable.set(w.tableId, [])
      byTable.get(w.tableId).push(w)
    }
    if (w.guestId) {
      if (!byGuest.has(w.guestId)) byGuest.set(w.guestId, [])
      byGuest.get(w.guestId).push(w)
    }
  }
  return { byTable, byGuest }
}
