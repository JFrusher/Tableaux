/**
 * Dietary requirement normalisation + display metadata. Free-text CSV values
 * are mapped onto a small canonical set; everything else falls back to "other".
 */
export const DIETARY_META = {
  vegetarian: { key: 'vegetarian', label: 'Vegetarian', abbrev: 'V', colour: '#4A7C59' },
  vegan: { key: 'vegan', label: 'Vegan', abbrev: 'VG', colour: '#3E7C46' },
  'gluten-free': { key: 'gluten-free', label: 'Gluten-free', abbrev: 'GF', colour: '#C07C2A' },
  'nut-allergy': { key: 'nut-allergy', label: 'Nut allergy', abbrev: 'N', colour: '#A63228' },
  'dairy-free': { key: 'dairy-free', label: 'Dairy-free', abbrev: 'DF', colour: '#5C7E9E' },
  pescatarian: { key: 'pescatarian', label: 'Pescatarian', abbrev: 'P', colour: '#5E8A7C' },
  halal: { key: 'halal', label: 'Halal', abbrev: 'H', colour: '#7B6FA0' },
  kosher: { key: 'kosher', label: 'Kosher', abbrev: 'K', colour: '#9A6BA0' },
  other: { key: 'other', label: 'Other', abbrev: '•', colour: '#A8A29E' },
}

const NONE_VALUES = new Set(['', 'none', 'n/a', 'na', 'no', 'nil', '-', 'standard', 'normal'])

export function normaliseDietary(raw) {
  if (!raw) return ''
  const s = String(raw).trim().toLowerCase()
  if (NONE_VALUES.has(s)) return ''
  if (/\bvegan\b|\bvg\b|\bvgn\b/.test(s)) return 'vegan'
  if (/vegetarian|veggie|\bveg\b|\bv\b/.test(s)) return 'vegetarian'
  if (/gluten|coeliac|celiac|\bgf\b/.test(s)) return 'gluten-free'
  if (/\bnut|peanut/.test(s)) return 'nut-allergy'
  if (/dairy|lactose|\bdf\b/.test(s)) return 'dairy-free'
  // Match the actual word — "shellfish" allergy must not read as pescatarian.
  if (/pescat|pescet/.test(s)) return 'pescatarian'
  if (/halal/.test(s)) return 'halal'
  if (/kosher/.test(s)) return 'kosher'
  return 'other'
}

export const dietaryMeta = (key) => DIETARY_META[key] || null
export const dietaryLabel = (key) => DIETARY_META[key]?.label || key
export const DIETARY_KEYS = Object.keys(DIETARY_META)
