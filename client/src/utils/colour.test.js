import { describe, it, expect } from 'vitest'
import { readableTextColour } from './colour.js'

describe('readableTextColour', () => {
  it('returns white on dark backgrounds', () => {
    expect(readableTextColour('#7B6FA0')).toBe('#fff') // muted purple
    expect(readableTextColour('#4A7C59')).toBe('#fff') // muted green
    expect(readableTextColour('#000000')).toBe('#fff')
  })

  it('returns near-black on light backgrounds', () => {
    expect(readableTextColour('#FFFFFF')).toBe('#1a1a1a')
    expect(readableTextColour('#EDE8E1')).toBe('#1a1a1a') // accent-light
  })

  it('supports shorthand hex and falls back to white for junk', () => {
    expect(readableTextColour('#fff')).toBe('#1a1a1a')
    expect(readableTextColour('not-a-colour')).toBe('#fff')
    expect(readableTextColour(null)).toBe('#fff')
  })
})
