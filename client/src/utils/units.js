/**
 * Real-world unit conversion + formatting.
 *
 * The document stores every physical dimension in CENTIMETRES (the canonical
 * base unit). Pixels are derived at render time via `cm * settings.pixelsPerUnit`.
 * This module is the single home for converting cm to/from a user-facing
 * display string and for picking a sensible default unit system by locale.
 *
 * `unitSystem` is purely a display/input preference — it never changes what is
 * stored, so toggling between metric and imperial is lossless.
 */

export const CM_PER_INCH = 2.54
export const CM_PER_FOOT = 30.48

const round2 = (n) => Math.round(n * 100) / 100

/** Best-effort locale default: imperial for US/Liberia/Myanmar, else metric. */
export function localeDefaultUnitSystem() {
  try {
    const lang =
      (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || ''
    const region = new Intl.Locale(lang).maximize().region || ''
    return ['US', 'LR', 'MM'].includes(region) ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

/**
 * Format a centimetre value for display.
 * Returns `{ value, label }` — `value` is the primary numeric magnitude in the
 * chosen system (handy for inputs), `label` is the full human string.
 */
export function toDisplay(cm, system = 'metric') {
  const v = Number(cm) || 0
  if (system === 'imperial') {
    const totalInches = v / CM_PER_INCH
    let feet = Math.floor(totalInches / 12)
    let inches = Math.round(totalInches - feet * 12)
    if (inches === 12) {
      feet += 1
      inches = 0
    }
    const label = feet > 0 ? `${feet}′ ${inches}″` : `${inches}″`
    return { value: round2(totalInches), label }
  }
  // metric — show metres past 1m, else centimetres
  if (v >= 100) return { value: round2(v / 100), label: `${round2(v / 100)} m` }
  return { value: Math.round(v), label: `${Math.round(v)} cm` }
}

/**
 * Parse a user-entered dimension string into centimetres, or null if invalid.
 * Accepts explicit units (`5'6"`, `1.5m`, `150cm`, `60in`, `8ft`). A bare
 * number is interpreted by `system`: inches for imperial, centimetres for metric.
 */
export function parseDisplay(input, system = 'metric') {
  if (input == null) return null
  const str = String(input).trim().toLowerCase().replace(/[″”]/g, '"').replace(/[′’]/g, "'")
  if (!str) return null

  // feet + optional inches: 5'6", 5' 6, 5'
  const ftIn = str.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?$/)
  if (ftIn) {
    const ft = parseFloat(ftIn[1])
    const inch = ftIn[2] ? parseFloat(ftIn[2]) : 0
    return round2(ft * CM_PER_FOOT + inch * CM_PER_INCH)
  }
  const inchOnly = str.match(/^(\d+(?:\.\d+)?)\s*"$/)
  if (inchOnly) return round2(parseFloat(inchOnly[1]) * CM_PER_INCH)

  const m = str.match(/^(\d+(?:\.\d+)?)\s*(m|cm|mm|in|inch|inches|ft|feet|foot)$/)
  if (m) {
    const n = parseFloat(m[1])
    switch (m[2]) {
      case 'm':
        return round2(n * 100)
      case 'cm':
        return round2(n)
      case 'mm':
        return round2(n / 10)
      case 'in':
      case 'inch':
      case 'inches':
        return round2(n * CM_PER_INCH)
      case 'ft':
      case 'feet':
      case 'foot':
        return round2(n * CM_PER_FOOT)
      default:
        return null
    }
  }

  const bare = parseFloat(str)
  if (Number.isNaN(bare)) return null
  return system === 'imperial' ? round2(bare * CM_PER_INCH) : round2(bare)
}

/** Compact label for a table's footprint, e.g. "Ø 1.5 m" or "2.2 × 1.3 m". */
export function formatDimensions(sizeUnits, system = 'metric') {
  if (!sizeUnits) return ''
  if (sizeUnits.shape === 'circle' || sizeUnits.shape === 'half-circle') {
    return `Ø ${toDisplay(sizeUnits.diameter, system).label}`
  }
  return `${toDisplay(sizeUnits.width, system).label} × ${toDisplay(sizeUnits.height, system).label}`
}

/** Derive a pixels-per-cm scale from a measured pixel distance over a known real length. */
export function ppuFromCalibration(pixelDistance, realCm) {
  if (!pixelDistance || !realCm) return null
  const ppu = pixelDistance / realCm
  return Number.isFinite(ppu) && ppu > 0 ? ppu : null
}
