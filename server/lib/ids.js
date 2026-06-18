import { randomBytes } from 'crypto'

let counter = 0

/** Collision-resistant, human-readable ids, e.g. snap_lq3f8k2a1. */
export function makeId(prefix = 'id') {
  counter = (counter + 1) % 1000000
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${time}${counter.toString(36)}${rand}`
}

/**
 * Cryptographically strong, URL-safe share token (~192 bits of entropy). Used
 * as a bearer capability for public share links — must NOT use makeId, which is
 * predictable.
 */
export function makeShareToken() {
  return randomBytes(24).toString('base64url')
}
