let counter = 0

/**
 * Short, readable, collision-resistant ids — e.g. `tbl_lq3f8k2a1b`.
 * Prefix convention is used across the app: g_ guest, grp_ group,
 * tbl_ table, zone_ zone, seat_ seat, snap_ snapshot, cst_ constraint.
 */
export function makeId(prefix = 'id') {
  counter = (counter + 1) % 1000000
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${time}${counter.toString(36)}${rand}`
}

/** Stable seat id for a table + seat index. */
export const seatId = (tableId, index) => `seat_${tableId}_${index}`
