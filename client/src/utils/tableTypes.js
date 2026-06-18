/**
 * The single source of truth for table types. Used by the palette (thumbnails),
 * TableNode (SVG rendering), seatPositions (seat geometry) and the store
 * (default capacity on create). All sizes are in unscaled canvas pixels.
 *
 * seatLayout values:
 *   around      — seats evenly distributed around a circle
 *   perimeter   — seats on all four sides of a rectangle
 *   long-sides  — seats on the two long sides only
 *   one-side    — seats on a single long side (top table, facing guests)
 *   curved      — seats along the curved edge of a half-circle
 *   none        — no individual seats shown (sweetheart)
 */
export const TABLE_TYPES = {
  round: {
    id: 'round',
    label: 'Round',
    shape: 'circle',
    seatLayout: 'around',
    defaultCapacity: 8,
    minCapacity: 2,
    maxCapacity: 14,
    baseRadius: 52,
  },
  rect: {
    id: 'rect',
    label: 'Rectangle',
    shape: 'rect',
    seatLayout: 'perimeter',
    defaultCapacity: 10,
    minCapacity: 4,
    maxCapacity: 16,
    width: 150,
    height: 92,
  },
  banquet: {
    id: 'banquet',
    label: 'Banquet',
    shape: 'rect',
    seatLayout: 'long-sides',
    defaultCapacity: 16,
    minCapacity: 6,
    maxCapacity: 24,
    width: 260,
    height: 74,
  },
  'top-table': {
    id: 'top-table',
    label: 'Top Table',
    shape: 'rect',
    seatLayout: 'one-side',
    defaultCapacity: 12,
    minCapacity: 2,
    maxCapacity: 16,
    width: 280,
    height: 64,
  },
  sweetheart: {
    id: 'sweetheart',
    label: 'Sweetheart',
    shape: 'circle',
    seatLayout: 'none',
    defaultCapacity: 2,
    minCapacity: 2,
    maxCapacity: 2,
    baseRadius: 34,
  },
  cabaret: {
    id: 'cabaret',
    label: 'Cabaret',
    shape: 'half-circle',
    seatLayout: 'curved',
    defaultCapacity: 6,
    minCapacity: 3,
    maxCapacity: 9,
    baseRadius: 60,
  },
  kids: {
    id: 'kids',
    label: 'Kids',
    shape: 'rect',
    seatLayout: 'perimeter',
    rounded: true,
    distinctColour: '#C9A24B',
    defaultCapacity: 8,
    minCapacity: 4,
    maxCapacity: 12,
    width: 140,
    height: 88,
  },
}

export const TABLE_TYPE_LIST = Object.values(TABLE_TYPES)

export const DESIGNATIONS = [
  { id: null, label: 'None' },
  { id: 'top-table', label: 'Top table' },
  { id: 'vip', label: 'VIP' },
  { id: 'kids', label: 'Kids' },
  { id: 'band-bar', label: 'Band / Bar' },
]

export const getTableType = (type) => TABLE_TYPES[type] || TABLE_TYPES.round

export const defaultCapacityFor = (type) => getTableType(type).defaultCapacity

export const clampCapacity = (type, capacity) => {
  const t = getTableType(type)
  return Math.max(t.minCapacity, Math.min(t.maxCapacity, Math.round(capacity || 0)))
}

// ── custom (per-side) rectangle tables ──────────────────────────────────────

const SIDES = ['top', 'right', 'bottom', 'left']

/** Total seat count implied by a per-side seat distribution. */
export const seatCountFromPerSide = (perSide) =>
  SIDES.reduce((sum, side) => sum + Math.max(0, Math.round(perSide?.[side] || 0)), 0)

/** Coerce a per-side object into clean non-negative integers for all four edges. */
export const clampPerSide = (perSide) => {
  const out = {}
  SIDES.forEach((side) => {
    out[side] = Math.max(0, Math.min(40, Math.round(perSide?.[side] || 0)))
  })
  return out
}
