/**
 * Name-grid layout for 'table' seat mode.
 *
 * In 'table' mode we render a grid of name boxes *inside* the table shape — one
 * box per seated guest, plus an empty box per open seat — so it's easy to see
 * who's roughly assigned to each table at a glance.
 *
 * Text is rendered at the seat-level font (var(--text-xs) = 11px, semibold) and
 * is NOT scaled, so it always matches the seats. To fit as much of each name as
 * possible at that fixed size, the layout picks the FEWEST columns — hence the
 * WIDEST boxes — whose rows still fit the table interior, and reports how many
 * characters/lines fit per box. TableGuestBox then shows the richest label that
 * fits (full name → "First L." → first name → initials), wrapping if there's
 * room. The grid always stays within the table shape.
 *
 * Kept separate from seatPositions.js (footprint geometry) so it has no
 * dependency on the seat-placement maths and can evolve independently.
 */
const MARGIN = 8 // inset from the table edge so boxes never touch the border
const GAP = 3 // gap between boxes (px) — small so the grid fills tight shapes
const HEADER_H = 16 // "seated/capacity" header row height (px)
const MIN_INTERIOR = 22 // below this the grid is dropped in favour of a count

// Seat-level text metrics (must match SeatSlot / var(--text-xs)).
export const GRID_FONT_PX = 11
const LINE_H = 1.15 // line-height multiple
const CHAR_W = 0.56 // average glyph width as a fraction of the font size
const BOX_PAD_X = 3 // inner horizontal padding per side (px)
const BOX_PAD_Y = 1 // inner vertical padding per side (px)
const BORDER = 1 // box border width (px)
const MAX_LINES = 2 // wrap a name across at most this many lines
const TARGET_BOX_W = 84 // preferred box width (px) — wide enough for most names

const minRowH = Math.ceil(GRID_FONT_PX * LINE_H) + 2 * BOX_PAD_Y + 2 * BORDER + 2

/**
 * The largest axis-aligned rectangle that fits inside a table shape, inset by a
 * small margin, plus a vertical offset from the shape centre (non-zero only for
 * half-circles, whose fillable area hugs the flat bottom edge).
 */
export function getTableInterior(geom) {
  if (!geom) return { width: 0, height: 0, offsetY: 0 }
  if (geom.shape === 'circle') {
    // Inscribed square: side = r·√2.
    const side = geom.radius * Math.SQRT2 - 2 * MARGIN
    return { width: Math.max(0, side), height: Math.max(0, side), offsetY: 0 }
  }
  if (geom.shape === 'half-circle') {
    // Max rectangle in a semicircle (flat side down): w = r·√2, h = r/√2,
    // sitting on the diameter. The shape's flat edge is at y = +r/2.
    const w = geom.radius * Math.SQRT2 - 2 * MARGIN
    const h = geom.radius / Math.SQRT2 - 2 * MARGIN
    const bottom = geom.radius / 2 - MARGIN
    const offsetY = bottom - Math.max(0, h) / 2
    return { width: Math.max(0, w), height: Math.max(0, h), offsetY }
  }
  // rect
  return {
    width: Math.max(0, geom.width - 2 * MARGIN),
    height: Math.max(0, geom.height - 2 * MARGIN),
    offsetY: 0,
  }
}

/**
 * Lay out the name grid so it fills the table interior at the fixed seat font.
 * Returns null when the interior is too small to hold a grid (caller shows a
 * plain count instead).
 *
 * @param {{capacity:number}} table
 * @param {{shape:string,width:number,height:number,radius?:number}} geom
 * @returns {{cols:number, rows:number, gap:number, hasHeader:boolean,
 *            width:number, height:number, offsetY:number,
 *            charsPerLine:number, maxLines:number} | null}
 */
export function getTableGridLayout(table, geom) {
  const cap = Math.max(1, table.capacity || 1)
  const interior = getTableInterior(geom)
  if (interior.width < MIN_INTERIOR || interior.height < MIN_INTERIOR) return null

  const hasHeader = interior.height >= 64
  const availH = interior.height - (hasHeader ? HEADER_H + GAP : 0)

  // Fill the shape with boxes around a comfortable target width (so wide tables
  // get several columns rather than one giant one), but never use more rows than
  // fit vertically — `minCols` guarantees every row has room at the fixed font.
  const maxRows = Math.max(1, Math.floor((availH + GAP) / (minRowH + GAP)))
  const minCols = Math.max(1, Math.ceil(cap / maxRows))
  const colsByWidth = Math.max(1, Math.round(interior.width / TARGET_BOX_W))
  const cols = Math.min(cap, Math.max(minCols, colsByWidth))
  const rows = Math.ceil(cap / cols)

  const boxW = (interior.width - (cols - 1) * GAP) / cols
  const boxH = (availH - (rows - 1) * GAP) / rows

  const innerW = Math.max(0, boxW - 2 * BOX_PAD_X - 2 * BORDER)
  const innerH = Math.max(0, boxH - 2 * BOX_PAD_Y - 2 * BORDER)
  const charsPerLine = Math.max(1, Math.floor(innerW / (GRID_FONT_PX * CHAR_W)))
  const maxLines = Math.max(1, Math.min(MAX_LINES, Math.floor(innerH / (GRID_FONT_PX * LINE_H))))

  return {
    cols,
    rows,
    gap: GAP,
    hasHeader,
    width: interior.width,
    height: interior.height,
    offsetY: interior.offsetY,
    charsPerLine,
    maxLines,
  }
}
