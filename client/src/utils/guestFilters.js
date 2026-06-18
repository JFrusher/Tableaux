/** Filter chips shown beneath the guest search box, and their predicates. */
export const FILTER_DEFS = [
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'bride', label: "Bride's" },
  { key: 'groom', label: "Groom's" },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'gluten-free', label: 'GF' },
  { key: 'notes', label: 'Has notes' },
]

const PREDICATES = {
  unassigned: (g) => !g.assignedTableId,
  bride: (g) => g.side === 'bride' || g.side === 'both',
  groom: (g) => g.side === 'groom' || g.side === 'both',
  vegetarian: (g) => g.dietary === 'vegetarian',
  vegan: (g) => g.dietary === 'vegan',
  'gluten-free': (g) => g.dietary === 'gluten-free',
  notes: (g) => !!(g.notes && g.notes.trim()),
}

export function matchesFilters(guest, filters) {
  if (!filters || filters.length === 0) return true
  return filters.every((f) => (PREDICATES[f] ? PREDICATES[f](guest) : true))
}

export function matchesSearch(guest, group, query) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    (guest.fullName || '').toLowerCase().includes(q) ||
    (guest.firstName || '').toLowerCase().includes(q) ||
    (guest.lastName || '').toLowerCase().includes(q) ||
    (group?.name || '').toLowerCase().includes(q)
  )
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?'

/** "Sarah M." — first name + last initial, for compact in-table name boxes. */
export const shortName = (guest) => {
  if (!guest) return '?'
  const parts = (guest.fullName || '').split(/\s+/).filter(Boolean)
  const first = guest.firstName || parts[0] || ''
  const lastSource = guest.lastName || parts.slice(1).join(' ')
  const lastInitial = lastSource ? `${lastSource[0].toUpperCase()}.` : ''
  return [first, lastInitial].filter(Boolean).join(' ') || guest.fullName || '?'
}

// Does `text` fit in `maxLines` lines of `charsPerLine`, wrapping at spaces?
// (A single word longer than a line never fits — we'd rather drop to a shorter
// label than truncate mid-word.)
const fitsLines = (text, charsPerLine, maxLines) => {
  if (charsPerLine <= 0) return false
  if (text.length <= charsPerLine) return true
  if (maxLines < 2) return false
  let used = 1
  let cur = 0
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (w.length > charsPerLine) return false
    if (cur === 0) cur = w.length
    else if (cur + 1 + w.length <= charsPerLine) cur += 1 + w.length
    else {
      used += 1
      cur = w.length
      if (used > maxLines) return false
    }
  }
  return used <= maxLines
}

/**
 * Pick the richest label that fits a name box: full name → "First L." → first
 * name → initials. Always returns at least initials so a guest is never blank.
 */
export const pickGuestLabel = (guest, charsPerLine, maxLines = 1) => {
  if (!guest) return '?'
  const fallback = initials(guest.fullName)
  const candidates = [guest.fullName, shortName(guest), guest.firstName, fallback]
  for (const c of candidates) {
    if (c && fitsLines(c, charsPerLine, maxLines)) return c
  }
  return fallback
}
