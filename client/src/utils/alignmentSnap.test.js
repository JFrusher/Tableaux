import { describe, it, expect } from 'vitest'
import { computeSnap, buildContainers } from './alignmentSnap.js'

const box = (cx, cy, hw = 10, hh = 10) => ({ cx, cy, hw, hh })

describe('computeSnap — table-to-table alignment', () => {
  it('snaps centre-to-centre on X within threshold', () => {
    const res = computeSnap({
      moving: box(105, 200),
      tables: [box(100, 200)],
      threshold: 8,
    })
    expect(res.x).toBe(100)
    expect(res.y).toBe(200) // identical cy ⇒ also centre-aligned
    expect(res.guides.length).toBeGreaterThan(0)
  })

  it('snaps near-edge to near-edge when centres are too far apart', () => {
    // other: hw 30 ⇒ left edge at 70; moving hw 10 near 83 ⇒ left-left target 80
    const res = computeSnap({
      moving: box(83, 500, 10),
      tables: [box(100, 500, 30)],
      threshold: 8,
    })
    expect(res.x).toBe(80)
  })

  it('snaps flush (right edge to left edge) for butting tables', () => {
    // other centre 100 hw 10 ⇒ right edge 110; moving hw 10 flush-after ⇒ 120
    const res = computeSnap({
      moving: box(118, 500, 10),
      tables: [box(100, 500, 10)],
      threshold: 8,
    })
    expect(res.x).toBe(120)
  })

  it('solves X and Y independently', () => {
    const res = computeSnap({
      moving: box(105, 305),
      tables: [box(100, 300)],
      threshold: 8,
    })
    expect(res.x).toBe(100)
    expect(res.y).toBe(300)
  })

  it('does not snap outside the threshold but snaps at the boundary', () => {
    expect(computeSnap({ moving: box(109, 999), tables: [box(100, 999)], threshold: 8 }).x).toBeNull()
    expect(computeSnap({ moving: box(108, 999), tables: [box(100, 999)], threshold: 8 }).x).toBe(100)
  })
})

describe('computeSnap — walls (containers)', () => {
  const room = [{ left: 0, top: 0, right: 200, bottom: 200 }]

  it('centres a table between two walls', () => {
    const res = computeSnap({
      moving: box(105, 300), // cy far away ⇒ only X (horizontal centring) snaps
      tables: [],
      containers: room,
      threshold: 8,
    })
    expect(res.x).toBe(100)
    expect(res.guides.some((g) => g.variant === 'center')).toBe(true)
  })

  it('snaps a table flush to a wall face', () => {
    const res = computeSnap({
      moving: box(193, 300, 10),
      tables: [],
      containers: room,
      threshold: 8,
    })
    expect(res.x).toBe(190) // right wall 200 − half 10
  })
})

describe('computeSnap — equal spacing', () => {
  it('centres a table with equal gaps between two neighbours', () => {
    const res = computeSnap({
      moving: box(103, 100, 10),
      tables: [box(0, 100, 10), box(200, 100, 10)],
      threshold: 8,
    })
    expect(res.x).toBe(100)
    const spacing = res.guides.find((g) => g.kind === 'spacing')
    expect(spacing).toBeTruthy()
    expect(spacing.dist).toBe(80)
  })

  it('matches the adjacent gap to extend an even row', () => {
    // two tables 40px apart (edges 110→150); moving should land 40px before the first
    const res = computeSnap({
      moving: box(43, 100, 10),
      tables: [box(100, 100, 10), box(160, 100, 10)],
      threshold: 8,
    })
    expect(res.x).toBe(40)
    expect(res.guides.find((g) => g.kind === 'spacing')?.dist).toBe(40)
  })

  it('ignores neighbours that are not in the same row', () => {
    const res = computeSnap({
      moving: box(103, 100, 10),
      tables: [box(0, 100, 10), box(200, 500, 10)], // second is far on Y
      threshold: 8,
    })
    expect(res.x).toBeNull()
  })
})

describe('buildContainers', () => {
  it('includes the legacy room rect and rect spaces', () => {
    const out = buildContainers({
      width: 1200,
      height: 900,
      spaces: [{ shape: 'rect', x: 50, y: 60, width: 400, height: 300 }],
    })
    expect(out).toContainEqual({ left: 0, top: 0, right: 1200, bottom: 900 })
    expect(out).toContainEqual({ left: 50, top: 60, right: 450, bottom: 360 })
  })

  it('builds an AABB for polygon spaces', () => {
    const out = buildContainers({
      spaces: [
        {
          shape: 'polygon',
          x: 100,
          y: 100,
          vertices: [
            { x: 0, y: 0 },
            { x: 300, y: -50 },
            { x: 400, y: 200 },
          ],
        },
      ],
    })
    expect(out[0]).toEqual({ left: 100, top: 50, right: 500, bottom: 300 })
  })
})
