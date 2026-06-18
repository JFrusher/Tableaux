import { normaliseDietary } from './dietary.js'

/**
 * Client-side CSV column mapping + normalisation. The raw parse (headers +
 * row objects) is done server-side by /api/upload/csv; this module guesses the
 * column mapping, surfaces RSVP values, and turns rows into guest objects.
 */

const lc = (s) => String(s || '').toLowerCase()

function findHeader(headers, patterns) {
  for (const p of patterns) {
    const hit = headers.find((h) => lc(h).includes(p))
    if (hit) return hit
  }
  return null
}

export function guessMapping(headers = []) {
  const firstName = findHeader(headers, ['first name', 'firstname', 'first', 'given', 'fname'])
  const lastName = findHeader(headers, [
    'last name',
    'lastname',
    'surname',
    'last',
    'family',
    'lname',
  ])
  const fullName = !firstName && !lastName ? findHeader(headers, ['full name', 'name', 'guest']) : null
  return {
    firstName: firstName || fullName || null,
    lastName: lastName || null,
    email: findHeader(headers, ['email', 'e-mail', 'mail']),
    rsvp: findHeader(headers, ['rsvp', 'attending', 'attend', 'coming', 'response', 'status']),
    dietary: findHeader(headers, ['dietary', 'diet', 'food', 'restriction', 'allerg', 'meal']),
    side: findHeader(headers, ['side', 'party', 'guest of', 'relation']),
    notes: findHeader(headers, ['notes', 'note', 'comment', 'remark']),
  }
}

export function uniqueValues(rows = [], header) {
  if (!header) return []
  const set = new Set()
  for (const r of rows) {
    const v = (r[header] ?? '').trim()
    if (v) set.add(v)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export const COMING_HINTS = [
  'yes',
  'y',
  'confirmed',
  'confirm',
  'true',
  '1',
  'attending',
  'coming',
  'accepted',
  'going',
]

const DECLINED_HINTS = [
  'no',
  'n',
  'declined',
  'decline',
  'false',
  '0',
  'not attending',
  'not coming',
  'regret',
  'regrets',
  "can't",
  'cannot',
]

/** Pre-select the RSVP values that most likely mean "coming". */
export function defaultComingValues(values = []) {
  return values.filter((v) => COMING_HINTS.includes(lc(v).trim()))
}

function normaliseSide(raw) {
  const s = lc(raw)
  if (!s) return null
  if (s.includes('both')) return 'both'
  if (s.includes('bride')) return 'bride'
  if (s.includes('groom')) return 'groom'
  return null
}

/**
 * Build normalised guest objects from raw rows + a column mapping.
 * `comingValues` is the set of raw RSVP strings that count as confirmed.
 */
export function buildGuests(rows = [], mapping = {}, comingValues = []) {
  const comingSet = new Set(comingValues.map((v) => lc(v).trim()))
  const hasRsvp = !!mapping.rsvp

  return rows
    .map((r) => {
      const get = (key) => (mapping[key] ? (r[mapping[key]] ?? '').trim() : '')

      let first = get('firstName')
      let last = get('lastName')
      // If only a single name column was mapped, split on the first space.
      if (!mapping.lastName && first) {
        const parts = first.split(/\s+/)
        if (parts.length > 1) {
          last = parts.slice(1).join(' ')
          first = parts[0]
        }
      }
      const fullName = `${first} ${last}`.trim()

      const dietaryRaw = get('dietary')
      const rsvpRaw = get('rsvp')
      let rsvpStatus = 'confirmed'
      if (hasRsvp) {
        const v = lc(rsvpRaw).trim()
        if (comingSet.has(v)) rsvpStatus = 'confirmed'
        else if (DECLINED_HINTS.includes(v)) rsvpStatus = 'declined'
        else rsvpStatus = 'pending'
      }

      return {
        firstName: first,
        lastName: last,
        fullName,
        email: get('email'),
        dietary: normaliseDietary(dietaryRaw),
        dietaryRaw,
        side: normaliseSide(get('side')),
        rsvpStatus,
        notes: get('notes'),
      }
    })
    .filter((g) => g.fullName)
}
