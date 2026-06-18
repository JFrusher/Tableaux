/**
 * Small colour helpers for UI contrast decisions.
 */

/** Parse a #rgb / #rrggbb hex string into [r, g, b] (0–255), or null. */
function parseHex(hex) {
  if (typeof hex !== 'string') return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Pick a readable text colour (near-black or white) for a given background,
 * using the perceptual YIQ luminance threshold. Defaults to white for unknown
 * inputs (group colours are mid-to-dark, so white reads well).
 */
export function readableTextColour(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return '#fff'
  const [r, g, b] = rgb
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#1a1a1a' : '#fff'
}
