import { describe, it, expect } from 'vitest'
import {
  getTableGeometry,
  fillColour,
  rectSeatsFromSides,
  deriveSizeUnits,
  DEFAULT_PPU,
} from './seatPositions.js'

describe('getTableGeometry', () => {
  it('places one seat per capacity around a round table', () => {
    const g = getTableGeometry({ type: 'round', capacity: 8 })
    expect(g.shape).toBe('circle')
    expect(g.seats).toHaveLength(8)
    // seats sit outside the table radius
    g.seats.forEach((s) => {
      expect(Math.hypot(s.x, s.y)).toBeGreaterThan(g.radius)
    })
  })

  it('distributes rectangle seats across the configured edges', () => {
    expect(getTableGeometry({ type: 'rect', capacity: 10 }).seats).toHaveLength(10)
    expect(getTableGeometry({ type: 'banquet', capacity: 16 }).seats).toHaveLength(16)
    expect(getTableGeometry({ type: 'top-table', capacity: 12 }).seats).toHaveLength(12)
    expect(getTableGeometry({ type: 'kids', capacity: 8 }).seats).toHaveLength(8)
  })

  it('fans cabaret seats along a half-circle', () => {
    const g = getTableGeometry({ type: 'cabaret', capacity: 6 })
    expect(g.shape).toBe('half-circle')
    expect(g.seats).toHaveLength(6)
    expect(g.cy).toBeTypeOf('number')
  })

  it('shows no individual seats for a sweetheart table', () => {
    const g = getTableGeometry({ type: 'sweetheart', capacity: 2 })
    expect(g.shape).toBe('circle')
    expect(g.seats).toHaveLength(0)
  })

  it('grows the radius as capacity increases', () => {
    const small = getTableGeometry({ type: 'round', capacity: 6 }).radius
    const large = getTableGeometry({ type: 'round', capacity: 14 }).radius
    expect(large).toBeGreaterThan(small)
  })
})

describe('real-world units (sizeUnits + ppu)', () => {
  it('reverse-derives sizeUnits that reproduce the legacy pixel footprint', () => {
    for (const t of [
      { type: 'round', capacity: 8 },
      { type: 'round', capacity: 12 },
      { type: 'rect', capacity: 10 },
      { type: 'banquet', capacity: 16 },
      { type: 'cabaret', capacity: 6 },
      { type: 'sweetheart', capacity: 2 },
    ]) {
      const legacy = getTableGeometry(t)
      const migrated = getTableGeometry({ ...t, sizeUnits: deriveSizeUnits(t) })
      expect(migrated.width).toBeCloseTo(legacy.width, 1)
      expect(migrated.height).toBeCloseTo(legacy.height, 1)
      expect(migrated.seats).toHaveLength(legacy.seats.length)
    }
  })

  it('scales the footprint with the diameter in cm', () => {
    const small = getTableGeometry({ type: 'round', capacity: 8, sizeUnits: { shape: 'circle', diameter: 150 } })
    const large = getTableGeometry({ type: 'round', capacity: 8, sizeUnits: { shape: 'circle', diameter: 300 } })
    expect(large.radius).toBeGreaterThan(small.radius)
    expect(large.width).toBeCloseTo(300 * DEFAULT_PPU, 5)
  })

  it('clamps a too-small footprint up so seats never overlap', () => {
    // 10cm round can't hold 8 seats — geometry must grow to the seat-fit minimum.
    const g = getTableGeometry({ type: 'round', capacity: 8, sizeUnits: { shape: 'circle', diameter: 10 } })
    expect(g.radius).toBeGreaterThan((10 * DEFAULT_PPU) / 2)
  })

  it('lets a round table shrink below the cosmetic preset size (the sizing bug)', () => {
    const legacy = getTableGeometry({ type: 'round', capacity: 8 })
    // A diameter that still fits 8 seats but is smaller than the preset default.
    const shrunk = getTableGeometry({
      type: 'round',
      capacity: 8,
      sizeUnits: { shape: 'circle', diameter: 120 },
    })
    expect(shrunk.radius).toBeLessThan(legacy.radius)
    // It honours the requested size exactly (no longer clamped to baseRadius).
    expect(shrunk.radius).toBeCloseTo((120 * DEFAULT_PPU) / 2, 5)
  })

  it('lets a rectangle shrink below the preset width in real units', () => {
    const legacy = getTableGeometry({ type: 'rect', capacity: 10 })
    const shrunk = getTableGeometry({
      type: 'rect',
      capacity: 10,
      sizeUnits: { shape: 'rect', width: 210, height: 110 },
    })
    expect(shrunk.width).toBeLessThan(legacy.width)
    expect(shrunk.width).toBeCloseTo(210 * DEFAULT_PPU, 5)
  })

  it('still applies the preset minimum for legacy tables (no sizeUnits)', () => {
    // baseRadius=52 keeps old plans pixel-identical.
    expect(getTableGeometry({ type: 'round', capacity: 8 }).radius).toBe(52)
  })

  it('ignores rotation — local seat coordinates are rotation-free', () => {
    const a = getTableGeometry({ type: 'round', capacity: 8, rotation: 0 })
    const b = getTableGeometry({ type: 'round', capacity: 8, rotation: 137 })
    expect(b.seats).toEqual(a.seats)
  })
})

describe('rectSeatsFromSides (custom per-side tables)', () => {
  it('places the requested number of seats per edge', () => {
    const seats = rectSeatsFromSides({ top: 3, bottom: 3, left: 1, right: 1 }, 200, 100)
    expect(seats).toHaveLength(8)
  })

  it('drives capacity for a per-side custom rectangle', () => {
    const g = getTableGeometry({
      type: 'rect',
      capacity: 8,
      perSideSeats: { top: 3, bottom: 3, left: 1, right: 1 },
      sizeUnits: { shape: 'rect', width: 200, height: 120 },
    })
    expect(g.seats).toHaveLength(8)
    // top-edge seats sit above the box, bottom below
    const above = g.seats.filter((s) => s.y < 0)
    const below = g.seats.filter((s) => s.y > 0)
    expect(above.length).toBeGreaterThan(0)
    expect(below.length).toBeGreaterThan(0)
  })
})

describe('fillColour', () => {
  it('transitions green → amber → red by fill ratio', () => {
    expect(fillColour(0.5)).toBe('var(--ok)')
    expect(fillColour(0.9)).toBe('var(--warn)')
    expect(fillColour(1)).toBe('var(--warn)')
    expect(fillColour(1.2)).toBe('var(--danger)')
  })
})
