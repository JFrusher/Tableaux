import { describe, it, expect } from 'vitest'
import {
  toDisplay,
  parseDisplay,
  formatDimensions,
  ppuFromCalibration,
  CM_PER_FOOT,
  CM_PER_INCH,
} from './units.js'

describe('toDisplay', () => {
  it('shows metres past 1m, centimetres below', () => {
    expect(toDisplay(150, 'metric').label).toBe('1.5 m')
    expect(toDisplay(80, 'metric').label).toBe('80 cm')
  })

  it('formats imperial as feet and inches', () => {
    expect(toDisplay(CM_PER_FOOT * 5, 'imperial').label).toBe("5′ 0″")
    // 5'6" → 167.64 cm
    expect(toDisplay(5 * CM_PER_FOOT + 6 * CM_PER_INCH, 'imperial').label).toBe("5′ 6″")
  })

  it('carries 12 inches up to the next foot', () => {
    // 11.6 inches rounds to 12 → should display as 1' 0"
    expect(toDisplay(11.6 * CM_PER_INCH, 'imperial').label).toBe("1′ 0″")
  })
})

describe('parseDisplay', () => {
  it('parses feet + inches', () => {
    expect(parseDisplay(`5'6"`, 'imperial')).toBeCloseTo(5 * CM_PER_FOOT + 6 * CM_PER_INCH, 2)
    expect(parseDisplay(`5'`, 'imperial')).toBeCloseTo(5 * CM_PER_FOOT, 2)
    expect(parseDisplay(`6"`, 'imperial')).toBeCloseTo(6 * CM_PER_INCH, 2)
  })

  it('parses explicit metric units', () => {
    expect(parseDisplay('1.5m', 'metric')).toBe(150)
    expect(parseDisplay('150cm', 'metric')).toBe(150)
  })

  it('interprets a bare number by the active system', () => {
    expect(parseDisplay('150', 'metric')).toBe(150) // cm
    expect(parseDisplay('60', 'imperial')).toBeCloseTo(60 * CM_PER_INCH, 2) // inches
  })

  it('returns null for garbage', () => {
    expect(parseDisplay('abc', 'metric')).toBeNull()
    expect(parseDisplay('', 'metric')).toBeNull()
    expect(parseDisplay(null, 'metric')).toBeNull()
  })

  it('round-trips through toDisplay/parseDisplay', () => {
    for (const cm of [80, 150, 244, 305]) {
      expect(parseDisplay(toDisplay(cm, 'metric').label, 'metric')).toBeCloseTo(cm, 0)
    }
  })
})

describe('formatDimensions', () => {
  it('uses a diameter symbol for round tables', () => {
    expect(formatDimensions({ shape: 'circle', diameter: 150 }, 'metric')).toBe('Ø 1.5 m')
  })
  it('uses width × height for rectangles', () => {
    expect(formatDimensions({ shape: 'rect', width: 220, height: 130 }, 'metric')).toBe('2.2 m × 1.3 m')
  })
})

describe('ppuFromCalibration', () => {
  it('computes pixels per cm from a measured span', () => {
    expect(ppuFromCalibration(200, 100)).toBe(2)
  })
  it('rejects invalid input', () => {
    expect(ppuFromCalibration(0, 100)).toBeNull()
    expect(ppuFromCalibration(200, 0)).toBeNull()
  })
})
