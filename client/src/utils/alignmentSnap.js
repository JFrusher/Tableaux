/**
 * Alignment snapping geometry. Pure functions — no React, no store — so the
 * logic stays unit-testable and the caller (the table-drag handler) just feeds
 * in plain boxes and gets back a snapped position plus the guide lines to draw.
 *
 * All coordinates are CANVAS pixels. The dragged table and every other table are
 * described by a CENTRE (cx, cy) and half-extents (hw, hh) — the unrotated
 * axis-aligned box from getTableGeometry. "Containers" (walls — room spaces and
 * the legacy room rect) are { left, top, right, bottom } rectangles.
 *
 * Snapping is solved independently per axis: a table can centre-align on X while
 * edge-aligning on Y. Within an axis we gather every candidate target centre
 * (alignment to other tables, centring/flush to walls, equal spacing) and pick
 * the one nearest the free position, as long as it is within `threshold`.
 */

const loOf = (box, axis) => (axis === 'x' ? box.cx - box.hw : box.cy - box.hh)
const hiOf = (box, axis) => (axis === 'x' ? box.cx + box.hw : box.cy + box.hh)
const midOf = (box, axis) => (axis === 'x' ? box.cx : box.cy)
const halfOf = (box, axis) => (axis === 'x' ? box.hw : box.hh)

const cLoOf = (c, axis) => (axis === 'x' ? c.left : c.top)
const cHiOf = (c, axis) => (axis === 'x' ? c.right : c.bottom)

/** Do two boxes overlap on the axis PERPENDICULAR to `axis`? (same row/column) */
function perpOverlap(a, b, axis) {
  const other = axis === 'x' ? 'y' : 'x'
  return loOf(a, other) < hiOf(b, other) && loOf(b, other) < hiOf(a, other)
}

/** Equal-spacing (distribution) candidates for one axis. */
function spacingCandidates(axis, moving, tables, half) {
  const out = []
  const neigh = tables.filter((t) => perpOverlap(moving, t, axis))
  if (!neigh.length) return out
  const cur = midOf(moving, axis)
  const left = neigh
    .filter((t) => hiOf(t, axis) <= cur)
    .sort((a, b) => midOf(b, axis) - midOf(a, axis)) // nearest first
  const right = neigh
    .filter((t) => loOf(t, axis) >= cur)
    .sort((a, b) => midOf(a, axis) - midOf(b, axis)) // nearest first

  const ref = (segments, gap) => ({
    type: 'spacing',
    axis,
    perp: axis === 'x' ? moving.cy : moving.cx,
    segments,
    dist: gap,
  })

  // Centred between one neighbour on each side: equal gap left and right.
  if (left[0] && right[0]) {
    const L = left[0]
    const R = right[0]
    const avail = loOf(R, axis) - hiOf(L, axis) - 2 * half
    if (avail > 0) {
      const gap = avail / 2
      const coord = hiOf(L, axis) + gap + half
      out.push({
        coord,
        ref: ref(
          [
            [hiOf(L, axis), hiOf(L, axis) + gap],
            [coord + half, coord + half + gap],
          ],
          gap
        ),
      })
    }
  }
  // Match the adjacent gap on the right (≥2 stationary neighbours to the right).
  if (right[0] && right[1]) {
    const gap = loOf(right[1], axis) - hiOf(right[0], axis)
    if (gap > 0) {
      const coord = loOf(right[0], axis) - gap - half
      out.push({
        coord,
        ref: ref(
          [
            [coord + half, coord + half + gap],
            [hiOf(right[0], axis), hiOf(right[0], axis) + gap],
          ],
          gap
        ),
      })
    }
  }
  // Match the adjacent gap on the left (≥2 stationary neighbours to the left).
  if (left[0] && left[1]) {
    const gap = loOf(left[0], axis) - hiOf(left[1], axis)
    if (gap > 0) {
      const coord = hiOf(left[0], axis) + gap + half
      out.push({
        coord,
        ref: ref(
          [
            [hiOf(left[1], axis), hiOf(left[1], axis) + gap],
            [hiOf(left[0], axis), hiOf(left[0], axis) + gap],
          ],
          gap
        ),
      })
    }
  }
  return out
}

/** Solve one axis: returns { coord, ref } or { coord: null, ref: null }. */
function solveAxis(axis, moving, tables, containers, threshold) {
  const half = halfOf(moving, axis)
  const cur = midOf(moving, axis)
  const cands = []
  const push = (coord, pos, ref) => {
    const delta = Math.abs(coord - cur)
    if (delta <= threshold) cands.push({ coord, delta, ref: { ...ref, pos } })
  }

  for (const t of tables) {
    const tlo = loOf(t, axis)
    const tmid = midOf(t, axis)
    const thi = hiOf(t, axis)
    push(tmid, tmid, { type: 'align', axis, others: [t] }) // centre ↔ centre
    push(tlo + half, tlo, { type: 'align', axis, others: [t] }) // near edge ↔ near edge
    push(thi - half, thi, { type: 'align', axis, others: [t] }) // far edge ↔ far edge
    push(thi + half, thi, { type: 'align', axis, others: [t] }) // flush after
    push(tlo - half, tlo, { type: 'align', axis, others: [t] }) // flush before
  }

  for (const c of containers) {
    const clo = cLoOf(c, axis)
    const chi = cHiOf(c, axis)
    push((clo + chi) / 2, (clo + chi) / 2, { type: 'center', axis, container: c }) // centred between walls
    push(clo + half, clo, { type: 'wall', axis, container: c }) // flush to near wall
    push(chi - half, chi, { type: 'wall', axis, container: c }) // flush to far wall
  }

  for (const sp of spacingCandidates(axis, moving, tables, half)) {
    const delta = Math.abs(sp.coord - cur)
    if (delta <= threshold) cands.push({ coord: sp.coord, delta, ref: sp.ref })
  }

  if (!cands.length) return { coord: null, ref: null }
  cands.sort((a, b) => a.delta - b.delta)
  return { coord: cands[0].coord, ref: cands[0].ref }
}

/** Turn a chosen snap reference into renderable guide(s), given the final box. */
function buildGuides(ref, moving) {
  if (ref.type === 'spacing') {
    return [{ kind: 'spacing', axis: ref.axis, perp: ref.perp, segments: ref.segments, dist: ref.dist }]
  }
  const variant = ref.type // 'align' | 'center' | 'wall'
  if (ref.axis === 'x') {
    let lo = moving.cy - moving.hh
    let hi = moving.cy + moving.hh
    if (ref.container) {
      lo = ref.container.top
      hi = ref.container.bottom
    } else {
      for (const o of ref.others) {
        lo = Math.min(lo, o.cy - o.hh)
        hi = Math.max(hi, o.cy + o.hh)
      }
    }
    return [{ kind: 'line', axis: 'v', pos: ref.pos, start: lo, end: hi, variant }]
  }
  let lo = moving.cx - moving.hw
  let hi = moving.cx + moving.hw
  if (ref.container) {
    lo = ref.container.left
    hi = ref.container.right
  } else {
    for (const o of ref.others) {
      lo = Math.min(lo, o.cx - o.hw)
      hi = Math.max(hi, o.cx + o.hw)
    }
  }
  return [{ kind: 'line', axis: 'h', pos: ref.pos, start: lo, end: hi, variant }]
}

/**
 * Compute the snapped position for a dragged table.
 * @returns {{ x: number|null, y: number|null, guides: Array }}
 *   x/y are the snapped centre on each axis, or null when that axis didn't snap.
 */
export function computeSnap({ moving, tables = [], containers = [], threshold = 8 }) {
  const xr = solveAxis('x', moving, tables, containers, threshold)
  const yr = solveAxis('y', moving, tables, containers, threshold)
  const final = {
    cx: xr.coord != null ? xr.coord : moving.cx,
    cy: yr.coord != null ? yr.coord : moving.cy,
    hw: moving.hw,
    hh: moving.hh,
  }
  const guides = []
  if (xr.ref) guides.push(...buildGuides(xr.ref, final))
  if (yr.ref) guides.push(...buildGuides(yr.ref, final))
  return { x: xr.coord, y: yr.coord, guides }
}

/** Build axis-aligned wall rectangles from the room model (spaces + legacy rect). */
export function buildContainers(room) {
  const out = []
  if (room?.width && room?.height) {
    out.push({ left: 0, top: 0, right: room.width, bottom: room.height })
  }
  for (const sp of room?.spaces || []) {
    if (sp.shape === 'polygon' && Array.isArray(sp.vertices) && sp.vertices.length) {
      const xs = sp.vertices.map((v) => sp.x + v.x)
      const ys = sp.vertices.map((v) => sp.y + v.y)
      out.push({ left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) })
    } else if (sp.width != null && sp.height != null) {
      out.push({ left: sp.x, top: sp.y, right: sp.x + sp.width, bottom: sp.y + sp.height })
    }
  }
  return out
}
