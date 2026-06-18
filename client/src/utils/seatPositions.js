import { getTableType } from './tableTypes.js'

/**
 * Table geometry + seat placement. Returns, for a given table, the bounding
 * box of its shape (canvas px, centred on the table's x/y) and the position of
 * every seat relative to the centre.
 *
 *   circle      → seats evenly around the circumference (polar)
 *   half-circle → seats fanned along the curved (top) edge
 *   rect        → seats distributed along the configured edges (or per-side)
 *
 * Seat order matches assignedGuestIds indices for seat-level tables.
 *
 * Footprint sizing has two modes:
 *   - Legacy (no `table.sizeUnits`): size derived from the type preset +
 *     capacity, exactly as before — keeps old plans and tests pixel-identical.
 *   - Real-units (`table.sizeUnits` present, cm): size = cm × pixelsPerUnit,
 *     clamped up to the minimum that fits the seats so they never overlap.
 * Rotation is intentionally NOT applied here — it is a presentational CSS
 * transform on the table node, so local seat coordinates stay rotation-free
 * and @dnd-kit drop targets rotate with the DOM for free.
 */
const SEAT_PITCH = 30 // spacing between seat centres along an edge
export const SEAT_OFFSET = 19 // distance from table edge to seat centre
export const SEAT_RADIUS = 14 // seat slot radius (px)

// Locked default scale: pixels per centimetre. Chosen so legacy plans (whose
// sizes were authored in these px) read as realistic real-world dimensions
// (a default round ≈ 1.5 m). NEVER recompute this for existing plans — changing
// it would rescale every stored layout. New plans may override via calibration.
export const DEFAULT_PPU = 0.7
// Standard banquet chair footprint diameter (cm), used for always-on chair nubs.
export const DEFAULT_CHAIR_CM = 45

// ── seat-count distribution for rectangles ──────────────────────────────────

/** Split a capacity across rectangle edges according to the preset's layout. */
function sidesFromLayout(cap, def) {
  const layout = def.seatLayout
  let top = 0
  let bottom = 0
  let left = 0
  let right = 0
  if (layout === 'one-side') {
    bottom = cap
  } else if (layout === 'long-sides') {
    top = Math.ceil(cap / 2)
    bottom = Math.floor(cap / 2)
  } else {
    // perimeter — put one seat on each short end when there's room
    const ends = cap >= 6 ? 2 : 0
    left = ends ? 1 : 0
    right = ends ? 1 : 0
    const rem = cap - ends
    top = Math.ceil(rem / 2)
    bottom = Math.floor(rem / 2)
  }
  return { top, bottom, left, right }
}

/** Minimum px box that fits the given per-side seat counts (and preset min). */
function minRectSize(sides, def) {
  const perLong = Math.max(sides.top, sides.bottom, 1)
  const perShort = Math.max(sides.left, sides.right, 0)
  return {
    width: Math.max(def.width || 0, perLong * SEAT_PITCH + 24),
    height: Math.max(def.height || 0, perShort * SEAT_PITCH + 24),
  }
}

/** Minimum radius that fits `cap` seats around a circle (and preset baseRadius). */
function minRoundRadius(cap, def) {
  return Math.max(def.baseRadius || 0, (cap * SEAT_PITCH) / (2 * Math.PI))
}

function minHalfRadius(cap, def) {
  return Math.max(def.baseRadius || 0, (cap * SEAT_PITCH) / Math.PI)
}

// ── seat-fit-only minimums (real-units path) ────────────────────────────────
// When a table carries explicit `sizeUnits`, the only hard floor is "seats must
// not overlap" — the preset's cosmetic size (def.width/height/baseRadius) is
// NOT a floor, so the user can shrink a table right down to its seating. A small
// absolute floor keeps seatless / tiny tables visible and clickable.
const SEAT_FIT_FLOOR = 16

/** Smallest radius that fits `cap` seats around a circle (seats only). */
function seatFitRadius(cap) {
  return Math.max(SEAT_FIT_FLOOR, (cap * SEAT_PITCH) / (2 * Math.PI))
}

function seatFitHalfRadius(cap) {
  return Math.max(SEAT_FIT_FLOOR, (cap * SEAT_PITCH) / Math.PI)
}

/** Smallest px box that fits the given per-side seat counts (seats only). */
function seatFitRect(sides) {
  const perLong = Math.max(sides.top, sides.bottom, 1)
  const perShort = Math.max(sides.left, sides.right, 0)
  return {
    width: Math.max(SEAT_FIT_FLOOR, perLong * SEAT_PITCH + 24),
    height: Math.max(SEAT_FIT_FLOOR, perShort * SEAT_PITCH + 24),
  }
}

// ── seat coordinate emitters (take explicit px geometry) ────────────────────

function roundSeatsAt(cap, radius) {
  const seatR = radius + SEAT_OFFSET
  const seats = []
  for (let i = 0; i < cap; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / cap
    seats.push({ x: Math.cos(angle) * seatR, y: Math.sin(angle) * seatR })
  }
  return seats
}

function halfCircleSeatsAt(cap, radius, cy) {
  const seatR = radius + SEAT_OFFSET
  const seats = []
  for (let i = 0; i < cap; i++) {
    const t = (i + 0.5) / cap
    const angle = Math.PI - t * Math.PI // π (left) → 0 (right) across the top
    seats.push({ x: Math.cos(angle) * seatR, y: cy - Math.sin(angle) * seatR })
  }
  return seats
}

/**
 * Place seats on the edges of a rect of the given px size, in the order
 * top → bottom → left → right (matching assignedGuestIds indices).
 */
export function rectSeatsFromSides(sides, width, height) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = sides || {}
  const seats = []
  const row = (n, edge) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      if (edge === 'top') seats.push({ x: -width / 2 + t * width, y: -height / 2 - SEAT_OFFSET })
      else if (edge === 'bottom')
        seats.push({ x: -width / 2 + t * width, y: height / 2 + SEAT_OFFSET })
      else if (edge === 'left')
        seats.push({ x: -width / 2 - SEAT_OFFSET, y: -height / 2 + t * height })
      else seats.push({ x: width / 2 + SEAT_OFFSET, y: -height / 2 + t * height })
    }
  }
  row(top, 'top')
  row(bottom, 'bottom')
  row(left, 'left')
  row(right, 'right')
  return seats
}

// ── main entry ──────────────────────────────────────────────────────────────

export function getTableGeometry(table, pixelsPerUnit = DEFAULT_PPU) {
  const def = getTableType(table.type)
  const cap = Math.max(1, table.capacity || def.defaultCapacity)
  const shape = table.sizeUnits?.shape || def.shape
  const ppu = pixelsPerUnit || DEFAULT_PPU
  const su = table.sizeUnits

  if (shape === 'circle') {
    const noSeats = def.seatLayout === 'none'
    const minR = noSeats ? def.baseRadius : minRoundRadius(cap, def)
    // Real-units: clamp only to the seat-fit minimum so tables can shrink below
    // the cosmetic preset size. Legacy (no sizeUnits): keep the preset min.
    const seatFloor = noSeats ? SEAT_FIT_FLOOR : seatFitRadius(cap)
    const radius = su ? Math.max((su.diameter * ppu) / 2, seatFloor) : minR
    return {
      shape: 'circle',
      width: radius * 2,
      height: radius * 2,
      radius,
      seats: noSeats ? [] : roundSeatsAt(cap, radius),
    }
  }

  if (shape === 'half-circle') {
    const minR = minHalfRadius(cap, def)
    const radius = su ? Math.max((su.diameter * ppu) / 2, seatFitHalfRadius(cap)) : minR
    const cy = radius / 2
    return {
      shape: 'half-circle',
      width: radius * 2,
      height: radius,
      radius,
      cy,
      seats: halfCircleSeatsAt(cap, radius, cy),
    }
  }

  // rect — either per-side custom counts or the preset layout distribution
  const sides = table.perSideSeats || sidesFromLayout(cap, def)
  const min = minRectSize(sides, def)
  const fit = seatFitRect(sides)
  const width = su ? Math.max((su.width || def.width) * ppu, fit.width) : min.width
  const height = su ? Math.max((su.height || def.height) * ppu, fit.height) : min.height
  return {
    shape: 'rect',
    width,
    height,
    rounded: !!def.rounded,
    radius: 0,
    seats: rectSeatsFromSides(sides, width, height),
  }
}

/**
 * Derive real-world `sizeUnits` (cm) for a table from its current legacy
 * (preset + capacity) geometry. Used to migrate older plans so the first render
 * is pixel-identical: `sizeUnits × ppu` reproduces the legacy px footprint.
 */
export function deriveSizeUnits(table, pixelsPerUnit = DEFAULT_PPU) {
  const ppu = pixelsPerUnit || DEFAULT_PPU
  const g = getTableGeometry({ ...table, sizeUnits: undefined, perSideSeats: null }, ppu)
  const r2 = (n) => Math.round((n / ppu) * 100) / 100
  if (g.shape === 'circle' || g.shape === 'half-circle') {
    return { shape: g.shape, diameter: r2(g.radius * 2) }
  }
  return { shape: 'rect', width: r2(g.width), height: r2(g.height) }
}

/** Fill-level colour for the capacity ring: green → amber → red. */
export function fillColour(ratio) {
  if (ratio > 1) return 'var(--danger)'
  if (ratio >= 0.85) return 'var(--warn)'
  return 'var(--ok)'
}
