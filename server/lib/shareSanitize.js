/**
 * Sanitization for public (unauthenticated) share reads. This is the security
 * boundary between a private plan document and what an account-less viewer is
 * allowed to see. Everything served to `/api/share/...` MUST pass through here.
 */

// Fields on a guest that are safe to expose on a read-only canvas view.
const SAFE_GUEST_FIELDS = ['id', 'firstName', 'lastName', 'fullName', 'side', 'groupId', 'assignedTableId', 'assignedSeatId']

/**
 * Reduce a full plan doc to what a `scope='view'` link may show: tables, zones,
 * room, wedding header, and a minimal guest map. Strips emails, notes,
 * dietaryRaw, tags, plus-ones, RSVP status, constraints and settings.
 * `showDietary` (owner opt-in) controls whether the canonical dietary key is
 * included (never the raw free-text).
 */
export function sanitizeDocForView(doc, { showDietary = false } = {}) {
  if (!doc || typeof doc !== 'object') return null
  const guests = {}
  for (const [id, g] of Object.entries(doc.guests || {})) {
    const out = {}
    for (const f of SAFE_GUEST_FIELDS) if (g[f] !== undefined) out[f] = g[f]
    if (showDietary && g.dietary) out.dietary = g.dietary
    guests[id] = out
  }
  const groups = {}
  for (const [id, gr] of Object.entries(doc.groups || {})) {
    groups[id] = { id: gr.id, name: gr.name, colour: gr.colour }
  }
  return {
    meta: {
      weddingName: doc.meta?.weddingName || '',
      venue: doc.meta?.venue || '',
      date: doc.meta?.date || '',
    },
    guests,
    groups,
    tables: doc.tables || {},
    zones: doc.zones || {},
    room: doc.room || {},
    settings: {
      pixelsPerUnit: doc.settings?.pixelsPerUnit,
      unitSystem: doc.settings?.unitSystem,
      showChairs: doc.settings?.showChairs,
      chairSizeUnits: doc.settings?.chairSizeUnits,
    },
  }
}

const COMBINING_MARKS = /[̀-ͯ]/g
const normaliseName = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Find a guest's table by name search, for the "find my seat" flow. Returns at
 * most `limit` matches and never the full guest list — only the matched
 * guest's display name, table label and seat number. No PII beyond the name the
 * searcher already typed.
 */
export function findGuestSeat(doc, query, { limit = 5 } = {}) {
  const q = normaliseName(query)
  if (q.length < 2) return []
  const guests = doc?.guests || {}
  const tables = doc?.tables || {}
  const tableById = {}
  for (const t of Object.values(tables)) tableById[t.id] = t

  const matches = []
  for (const g of Object.values(guests)) {
    const name = normaliseName(g.fullName || `${g.firstName || ''} ${g.lastName || ''}`)
    if (!name.includes(q)) continue
    const t = g.assignedTableId ? tableById[g.assignedTableId] : null
    let seatNumber = null
    if (t && t.seatMode === 'seat') {
      const idx = (t.assignedGuestIds || []).indexOf(g.id)
      if (idx >= 0) seatNumber = idx + 1
    }
    matches.push({
      fullName: g.fullName || `${g.firstName || ''} ${g.lastName || ''}`.trim(),
      tableLabel: t ? t.label : null,
      seatNumber,
    })
    if (matches.length >= limit) break
  }
  return matches
}
