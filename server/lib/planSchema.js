import { z } from 'zod'

// Hard caps to stop a malicious or buggy client from persisting an unbounded
// document. The client owns the rich per-entity shape; the server enforces
// types and ceilings so a save can't become a storage-abuse vector.
export const LIMITS = {
  guests: 5000,
  tables: 1000,
  zones: 500,
  groups: 1000,
  constraints: 5000,
  snapshots: 50,
}

const entityMap = (max, label) =>
  z
    .record(z.string(), z.object({}).passthrough())
    .refine((m) => Object.keys(m).length <= max, { message: `Too many ${label} (max ${max})` })

export const planDocSchema = z
  .object({
    meta: z.object({}).passthrough().optional(),
    guests: entityMap(LIMITS.guests, 'guests').optional(),
    groups: entityMap(LIMITS.groups, 'groups').optional(),
    tables: entityMap(LIMITS.tables, 'tables').optional(),
    zones: entityMap(LIMITS.zones, 'zones').optional(),
    room: z.object({}).passthrough().optional(),
    canvas: z.object({}).passthrough().optional(),
    constraints: z.array(z.object({}).passthrough()).max(LIMITS.constraints).optional(),
    settings: z.object({}).passthrough().optional(),
    snapshots: z.array(z.object({}).passthrough()).max(LIMITS.snapshots).optional(),
  })
  .passthrough()

// Absolute serialized-size ceiling: stops a few entities with huge string fields
// from bloating storage even when entity counts are within their caps.
export const MAX_DOC_BYTES = 8 * 1024 * 1024

/** Validate an incoming plan document. Throws a 400-tagged error on failure. */
export function validatePlanDoc(doc) {
  const parsed = planDocSchema.safeParse(doc)
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message || 'Invalid plan document'
    const err = new Error(msg)
    err.status = 400
    throw err
  }
  const bytes = Buffer.byteLength(JSON.stringify(parsed.data))
  if (bytes > MAX_DOC_BYTES) {
    const err = new Error('Plan document is too large')
    err.status = 400
    throw err
  }
  return parsed.data
}
