import { describe, it, expect } from 'vitest'
import { getTableGridLayout, getTableInterior } from './tableGrid.js'
import { shortName, pickGuestLabel } from './guestFilters.js'

const rect = (width, height) => ({ shape: 'rect', width, height })
const circle = (radius) => ({ shape: 'circle', radius, width: radius * 2, height: radius * 2 })

describe('getTableInterior', () => {
  it('insets a rectangle by the margin on every edge', () => {
    const i = getTableInterior(rect(200, 120))
    expect(i.width).toBe(184)
    expect(i.height).toBe(104) // 120 - 2·8
    expect(i.offsetY).toBe(0)
  })

  it('inscribes a square inside a circle', () => {
    const i = getTableInterior(circle(60))
    // side = r·√2 − 2·margin
    expect(i.width).toBeCloseTo(60 * Math.SQRT2 - 16, 5)
    expect(i.width).toBe(i.height)
  })
})

describe('getTableGridLayout', () => {
  it('returns null when the table is too small for a grid', () => {
    expect(getTableGridLayout({ capacity: 8 }, circle(16))).toBeNull()
  })

  it('lays out enough cells to hold every seat, clamped to capacity', () => {
    for (const cap of [2, 6, 8, 10, 12, 16, 24]) {
      const g = getTableGridLayout({ capacity: cap }, rect(260, 200))
      expect(g).not.toBeNull()
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(cap)
      expect(g.cols).toBeLessThanOrEqual(cap)
      expect(g.cols).toBeGreaterThanOrEqual(1)
    }
  })

  it('reads wider for wide tables than for square ones', () => {
    const square = getTableGridLayout({ capacity: 12 }, rect(200, 200))
    const wide = getTableGridLayout({ capacity: 12 }, rect(480, 120))
    expect(wide.cols).toBeGreaterThanOrEqual(square.cols)
  })

  it('keeps the grid within the table interior', () => {
    const geom = rect(260, 200)
    const interior = getTableInterior(geom)
    const g = getTableGridLayout({ capacity: 10 }, geom)
    expect(g.width).toBeLessThanOrEqual(interior.width)
    expect(g.height).toBeLessThanOrEqual(interior.height)
  })

  it('uses the fewest columns (widest boxes) that fit vertically', () => {
    // A tall, narrow interior should stack into a single wide column.
    const tall = getTableGridLayout({ capacity: 6 }, rect(90, 320))
    expect(tall.cols).toBe(1)
    // A wider interior fits more text per box (more chars per line) than a
    // cramped one, at the same fixed font.
    const wide = getTableGridLayout({ capacity: 8 }, rect(420, 320))
    const tight = getTableGridLayout({ capacity: 8 }, circle(40))
    expect(wide.charsPerLine).toBeGreaterThan(tight.charsPerLine)
  })

  it('reports at least one character and line per box', () => {
    const g = getTableGridLayout({ capacity: 12 }, circle(50))
    expect(g.charsPerLine).toBeGreaterThanOrEqual(1)
    expect(g.maxLines).toBeGreaterThanOrEqual(1)
    expect(g.maxLines).toBeLessThanOrEqual(2)
  })

  it('drops the header row on short interiors', () => {
    expect(getTableGridLayout({ capacity: 8 }, circle(30)).hasHeader).toBe(false)
    expect(getTableGridLayout({ capacity: 8 }, rect(300, 240)).hasHeader).toBe(true)
  })
})

describe('pickGuestLabel', () => {
  const g = { firstName: 'Sarah', lastName: 'Marshall', fullName: 'Sarah Marshall' }

  it('shows the full name when it fits on one line', () => {
    expect(pickGuestLabel(g, 20, 1)).toBe('Sarah Marshall')
  })

  it('wraps the full name across two lines when allowed', () => {
    // Too long for one 9-char line, but "Sarah" / "Marshall" fit two lines.
    expect(pickGuestLabel(g, 9, 2)).toBe('Sarah Marshall')
  })

  it('drops to "First L." then first name then initials as space shrinks', () => {
    expect(pickGuestLabel(g, 9, 1)).toBe('Sarah M.') // "Sarah Marshall" won't fit one line
    expect(pickGuestLabel(g, 6, 1)).toBe('Sarah') // even "Sarah M." (8) won't fit
    expect(pickGuestLabel(g, 3, 1)).toBe('SM') // nothing but initials fits
  })

  it('always returns at least initials', () => {
    expect(pickGuestLabel(g, 1, 1)).toBe('SM')
    expect(pickGuestLabel(null, 10, 2)).toBe('?')
  })
})

describe('shortName', () => {
  it('renders first name + last initial', () => {
    expect(shortName({ firstName: 'Sarah', lastName: 'Marshall', fullName: 'Sarah Marshall' })).toBe(
      'Sarah M.'
    )
  })

  it('falls back to fullName parts when first/last are absent', () => {
    expect(shortName({ fullName: 'Jane Doe' })).toBe('Jane D.')
  })

  it('handles a single-word name', () => {
    expect(shortName({ firstName: 'Cher', fullName: 'Cher' })).toBe('Cher')
  })

  it('is safe for null/empty input', () => {
    expect(shortName(null)).toBe('?')
    expect(shortName({})).toBe('?')
  })
})
