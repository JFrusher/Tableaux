/**
 * Action creators. Each returns a *thunk* `(state) => command`, where command
 * is `{ type, label, payload, inverse }`. The inverse is captured from the
 * current state at dispatch time, so undo is always exact.
 *
 * Components dispatch via the bound helpers on the store (e.g. `moveTable(id,
 * x, y)`), which call `dispatch(creator(...args))`. Returning `null` from a
 * thunk is a no-op (e.g. assigning a guest that doesn't exist).
 *
 * Only mutations in the brief's undoable list live here. Ephemeral UI state
 * (selection, search, pan/zoom) and free-text inspector edits are plain store
 * setters and intentionally bypass history.
 */
import { makeId, seatId } from '../utils/ids.js'
import {
  getTableType,
  clampCapacity,
  clampPerSide,
  seatCountFromPerSide,
} from '../utils/tableTypes.js'
import { deriveSizeUnits, DEFAULT_PPU } from '../utils/seatPositions.js'

// ── array helpers ───────────────────────────────────────────────────────────

const withoutGuest = (arr = [], guestId, seatMode) =>
  seatMode === 'seat'
    ? arr.map((id) => (id === guestId ? null : id))
    : arr.filter((id) => id && id !== guestId)

const withoutMembers = (arr = [], memberSet, seatMode) =>
  seatMode === 'seat'
    ? arr.map((id) => (memberSet.has(id) ? null : id))
    : arr.filter((id) => id && !memberSet.has(id))

const normaliseSeats = (arr = [], capacity) => {
  const out = new Array(capacity).fill(null)
  const overflow = []
  arr.forEach((id, i) => {
    if (i < capacity) out[i] = id ?? null
    else if (id) overflow.push(id)
  })
  return overflow.length ? [...out, ...overflow] : out
}

const nextTableLabel = (state) => {
  let max = 0
  let count = 0
  for (const t of Object.values(state.tables)) {
    count++
    const m = /^Table\s+(\d+)$/i.exec(t.label || '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `Table ${Math.max(max, count) + 1}`
}

// ── tables ──────────────────────────────────────────────────────────────────

export const addTable =
  ({ type = 'round', x = 0, y = 0, label, capacity, sizeUnits, perSideSeats, seatMode }) =>
  (state) => {
    const def = getTableType(type)
    const ppu = state.settings?.pixelsPerUnit || DEFAULT_PPU
    const base = {
      id: makeId('tbl'),
      label: label || nextTableLabel(state),
      designation: null,
      type,
      capacity: capacity ?? def.defaultCapacity,
      x: Math.round(x),
      y: Math.round(y),
      rotation: 0,
      assignedGuestIds: [],
      seatMode: seatMode || state.settings?.defaultSeatMode || 'table',
      colour: null,
      perSideSeats: perSideSeats || null,
    }
    // A preset supplies an explicit footprint/seating; a bare type derives the
    // default footprint from the preset + capacity (legacy behaviour).
    const table = { ...base, sizeUnits: sizeUnits || deriveSizeUnits(base, ppu) }
    return {
      type: 'ADD_TABLE',
      label: 'Add table',
      payload: { tables: { [table.id]: table } },
      inverse: { tables: { [table.id]: null } },
      meta: { newTableId: table.id },
    }
  }

export const removeTable = (id) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  const guestIds = (table.assignedGuestIds || []).filter(Boolean)
  const guestsForward = {}
  const guestsInverse = {}
  guestIds.forEach((gid) => {
    const g = state.guests[gid]
    if (!g) return
    guestsForward[gid] = { ...g, assignedTableId: null, assignedSeatId: null }
    guestsInverse[gid] = g
  })
  return {
    type: 'DELETE_TABLE',
    label: 'Delete table',
    payload: { tables: { [id]: null }, guests: guestsForward },
    inverse: { tables: { [id]: table }, guests: guestsInverse },
  }
}

export const duplicateTable = (id) => (state) => {
  const src = state.tables[id]
  if (!src) return null
  const copy = {
    ...src,
    id: makeId('tbl'),
    label: `${src.label} copy`,
    x: src.x + 32,
    y: src.y + 32,
    assignedGuestIds: [],
  }
  return {
    type: 'ADD_TABLE',
    label: 'Duplicate table',
    payload: { tables: { [copy.id]: copy } },
    inverse: { tables: { [copy.id]: null } },
    meta: { newTableId: copy.id },
  }
}

export const moveTable = (id, x, y) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  return {
    type: 'MOVE_TABLE',
    label: 'Move table',
    payload: { tables: { [id]: { ...table, x: Math.round(x), y: Math.round(y) } } },
    inverse: { tables: { [id]: table } },
  }
}

export const renameTable = (id, label) => (state) => {
  const table = state.tables[id]
  if (!table || table.label === label) return null
  return {
    type: 'RENAME_TABLE',
    label: 'Rename table',
    payload: { tables: { [id]: { ...table, label } } },
    inverse: { tables: { [id]: table } },
  }
}

export const changeCapacity = (id, capacity) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  const next = clampCapacity(table.type, capacity)
  if (next === table.capacity) return null
  return {
    type: 'CHANGE_CAPACITY',
    label: 'Change capacity',
    payload: { tables: { [id]: { ...table, capacity: next } } },
    inverse: { tables: { [id]: table } },
  }
}

export const changeTableType = (id, type) => (state) => {
  const table = state.tables[id]
  if (!table || table.type === type) return null
  const capacity = clampCapacity(type, table.capacity)
  // Switching to a preset shape drops any custom per-side seating and resets
  // the footprint to that type's defaults, so geometry matches the new shape.
  const ppu = state.settings?.pixelsPerUnit || DEFAULT_PPU
  const base = { ...table, type, capacity, perSideSeats: null, custom: false }
  const next = { ...base, sizeUnits: deriveSizeUnits(base, ppu) }
  return {
    type: 'CHANGE_TYPE',
    label: 'Change table type',
    payload: { tables: { [id]: next } },
    inverse: { tables: { [id]: table } },
  }
}

// Set independent seat counts per edge for a (custom) rectangle. Capacity is
// derived from the sum, and seat-level arrays are renormalised to the new size.
export const setPerSideSeats = (id, perSide) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  const clean = clampPerSide(perSide)
  const capacity = Math.max(1, seatCountFromPerSide(clean))
  let assignedGuestIds = table.assignedGuestIds || []
  if (table.seatMode === 'seat') {
    assignedGuestIds = normaliseSeats(assignedGuestIds, capacity)
  }
  return {
    type: 'SET_PER_SIDE_SEATS',
    label: 'Set seats per side',
    payload: { tables: { [id]: { ...table, perSideSeats: clean, capacity, assignedGuestIds } } },
    inverse: { tables: { [id]: table } },
  }
}

// Create a rectangle/square table with per-edge seat counts (the custom builder).
export const createCustomTable =
  ({ x = 0, y = 0, width = 200, height = 120, perSideSeats, label, seatMode } = {}) =>
  (state) => {
    const clean = clampPerSide(perSideSeats || { top: 4, right: 0, bottom: 4, left: 0 })
    const capacity = Math.max(1, seatCountFromPerSide(clean))
    const id = makeId('tbl')
    const table = {
      id,
      label: label || nextTableLabel(state),
      designation: null,
      type: 'rect',
      custom: true,
      capacity,
      x: Math.round(x),
      y: Math.round(y),
      rotation: 0,
      assignedGuestIds: [],
      seatMode: seatMode || state.settings?.defaultSeatMode || 'table',
      colour: null,
      perSideSeats: clean,
      sizeUnits: { shape: 'rect', width: Math.round(width), height: Math.round(height) },
    }
    return {
      type: 'ADD_TABLE',
      label: 'Add custom table',
      payload: { tables: { [id]: table } },
      inverse: { tables: { [id]: null } },
      meta: { newTableId: id },
    }
  }

export const setDesignation = (id, designation) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  return {
    type: 'SET_DESIGNATION',
    label: 'Set designation',
    payload: { tables: { [id]: { ...table, designation } } },
    inverse: { tables: { [id]: table } },
  }
}

export const setTableColour = (id, colour) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  return {
    type: 'SET_TABLE_COLOUR',
    label: 'Recolour table',
    payload: { tables: { [id]: { ...table, colour } } },
    inverse: { tables: { [id]: table } },
  }
}

export const rotateTable = (id, rotation) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  return {
    type: 'ROTATE_TABLE',
    label: 'Rotate table',
    payload: { tables: { [id]: { ...table, rotation } } },
    inverse: { tables: { [id]: table } },
  }
}

// Set the canvas scale (px per cm). Undoable so an accidental calibration can
// be reversed — every table/room/chair re-derives its pixels from this.
export const calibrate = (pixelsPerUnit) => (state) => {
  const prev = state.settings.pixelsPerUnit
  if (!pixelsPerUnit || pixelsPerUnit === prev) return null
  return {
    type: 'CALIBRATE',
    label: 'Calibrate scale',
    payload: { settings: { pixelsPerUnit } },
    inverse: { settings: { pixelsPerUnit: prev } },
  }
}

// Resize the room in real-world units. Stores cm (authoritative) plus derived
// px so legacy readers stay in sync.
export const setRoomSizeUnits = (widthUnits, heightUnits) => (state) => {
  const room = state.room
  const ppu = state.settings?.pixelsPerUnit || 0.7
  const next = {
    ...room,
    widthUnits: Math.round(widthUnits),
    heightUnits: Math.round(heightUnits),
    width: Math.round(widthUnits * ppu),
    height: Math.round(heightUnits * ppu),
  }
  return {
    type: 'RESIZE_ROOM',
    label: 'Resize room',
    payload: { room: next },
    inverse: { room },
  }
}

// ── table presets (venue defaults) ──────────────────────────────────────────
// A preset stores a table's footprint AND seating ("chairings") so it can be
// dropped from the palette to recreate the same table. Stored on settings so it
// persists with the plan; undoable like any settings change.

export const saveTablePreset = (id, name) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  const presets = state.settings.customTablePresets || []
  const preset = {
    id: makeId('preset'),
    name: (name || '').trim() || table.label || 'Preset',
    type: table.type,
    sizeUnits: table.sizeUnits || null,
    capacity: table.capacity,
    perSideSeats: table.perSideSeats || null,
    seatMode: table.seatMode || 'table',
  }
  return {
    type: 'SAVE_TABLE_PRESET',
    label: 'Save table preset',
    payload: { settings: { customTablePresets: [...presets, preset] } },
    inverse: { settings: { customTablePresets: presets } },
  }
}

export const deleteTablePreset = (presetId) => (state) => {
  const presets = state.settings.customTablePresets || []
  if (!presets.some((p) => p.id === presetId)) return null
  return {
    type: 'DELETE_TABLE_PRESET',
    label: 'Delete table preset',
    payload: { settings: { customTablePresets: presets.filter((p) => p.id !== presetId) } },
    inverse: { settings: { customTablePresets: presets } },
  }
}

export const resizeTable = (id, sizeUnits) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  const next = { ...(table.sizeUnits || {}), ...sizeUnits }
  return {
    type: 'RESIZE_TABLE',
    label: 'Resize table',
    payload: { tables: { [id]: { ...table, sizeUnits: next } } },
    inverse: { tables: { [id]: table } },
  }
}

export const setSeatMode = (id, mode) => (state) => {
  const table = state.tables[id]
  if (!table || table.seatMode === mode) return null
  let assignedGuestIds = table.assignedGuestIds || []
  if (mode === 'seat') {
    assignedGuestIds = normaliseSeats(assignedGuestIds.filter(Boolean), table.capacity)
  } else {
    assignedGuestIds = assignedGuestIds.filter(Boolean)
  }
  return {
    type: 'SET_SEAT_MODE',
    label: 'Toggle seat mode',
    payload: { tables: { [id]: { ...table, seatMode: mode, assignedGuestIds } } },
    inverse: { tables: { [id]: table } },
  }
}

export const clearTable = (id) => (state) => {
  const table = state.tables[id]
  if (!table) return null
  const guestIds = (table.assignedGuestIds || []).filter(Boolean)
  if (!guestIds.length) return null
  const guestsForward = {}
  const guestsInverse = {}
  guestIds.forEach((gid) => {
    const g = state.guests[gid]
    if (!g) return
    guestsForward[gid] = { ...g, assignedTableId: null, assignedSeatId: null }
    guestsInverse[gid] = g
  })
  return {
    type: 'CLEAR_TABLE',
    label: 'Clear table',
    payload: {
      tables: { [id]: { ...table, assignedGuestIds: [] } },
      guests: guestsForward,
    },
    inverse: { tables: { [id]: table }, guests: guestsInverse },
  }
}

// ── guests ──────────────────────────────────────────────────────────────────

// Create a single guest manually (e.g. a late RSVP) without re-importing a CSV.
export const addGuest = (partial = {}) => () => {
  const first = (partial.firstName || '').trim()
  const last = (partial.lastName || '').trim()
  const fullName = (partial.fullName || `${first} ${last}`).trim() || 'New guest'
  const id = makeId('g')
  const guest = {
    id,
    firstName: first,
    lastName: last,
    fullName,
    email: (partial.email || '').trim(),
    dietary: partial.dietary || '',
    dietaryRaw: partial.dietaryRaw || partial.dietary || '',
    side: partial.side ?? null,
    rsvpStatus: partial.rsvpStatus || 'confirmed',
    plusOneOf: partial.plusOneOf ?? null,
    groupId: partial.groupId ?? null,
    assignedTableId: null,
    assignedSeatId: null,
    notes: (partial.notes || '').trim(),
    tags: Array.isArray(partial.tags) ? partial.tags : [],
  }
  return {
    type: 'ADD_GUEST',
    label: 'Add guest',
    payload: { guests: { [id]: guest } },
    inverse: { guests: { [id]: null } },
    meta: { newGuestId: id },
  }
}

// Build the forward/inverse patches to remove a set of guests: deletes the
// guests, unseats them from any table, drops them from their group, and detaches
// any plus-ones that referenced them.
const buildRemoval = (state, idSet) => {
  const guestsForward = {}
  const guestsInverse = {}
  const tablesForward = {}
  const tablesInverse = {}
  const groupsForward = {}
  const groupsInverse = {}

  idSet.forEach((id) => {
    guestsForward[id] = null
    guestsInverse[id] = state.guests[id]
  })
  Object.values(state.tables).forEach((t) => {
    const arr = t.assignedGuestIds || []
    if (arr.some((gid) => idSet.has(gid))) {
      tablesInverse[t.id] = t
      tablesForward[t.id] = { ...t, assignedGuestIds: withoutMembers(arr, idSet, t.seatMode) }
    }
  })
  Object.values(state.groups).forEach((gr) => {
    const arr = gr.memberIds || []
    if (arr.some((gid) => idSet.has(gid))) {
      groupsInverse[gr.id] = gr
      groupsForward[gr.id] = { ...gr, memberIds: arr.filter((gid) => !idSet.has(gid)) }
    }
  })
  Object.values(state.guests).forEach((other) => {
    if (!idSet.has(other.id) && other.plusOneOf && idSet.has(other.plusOneOf)) {
      guestsInverse[other.id] = other
      guestsForward[other.id] = { ...other, plusOneOf: null }
    }
  })
  return {
    payload: { guests: guestsForward, tables: tablesForward, groups: groupsForward },
    inverse: { guests: guestsInverse, tables: tablesInverse, groups: groupsInverse },
  }
}

export const removeGuest = (guestId) => (state) => {
  if (!state.guests[guestId]) return null
  const { payload, inverse } = buildRemoval(state, new Set([guestId]))
  return { type: 'DELETE_GUEST', label: 'Delete guest', payload, inverse }
}

export const removeGuests = (ids) => (state) => {
  const idSet = new Set((ids || []).filter((id) => state.guests[id]))
  if (!idSet.size) return null
  const { payload, inverse } = buildRemoval(state, idSet)
  return { type: 'DELETE_GUESTS', label: `Delete ${idSet.size} guests`, payload, inverse }
}

// ── assignment ────────────────────────────────────────────────────────────

export const assignGuest =
  (guestId, tableId, seatIndex = null) =>
  (state) => {
    const guest = state.guests[guestId]
    const target = state.tables[tableId]
    if (!guest || !target) return null

    const prevTableId = guest.assignedTableId
    const affected = new Set([tableId])
    if (prevTableId) affected.add(prevTableId)

    const inverseGuests = { [guestId]: guest }
    const inverseTables = {}
    affected.forEach((tid) => {
      inverseTables[tid] = state.tables[tid]
    })

    const working = {}
    affected.forEach((tid) => {
      working[tid] = [...(state.tables[tid].assignedGuestIds || [])]
    })
    if (prevTableId) {
      working[prevTableId] = withoutGuest(
        working[prevTableId],
        guestId,
        state.tables[prevTableId].seatMode
      )
    }

    const forwardGuests = {}
    if (target.seatMode === 'seat' && seatIndex != null) {
      const arr = normaliseSeats(
        withoutGuest(working[tableId], guestId, 'seat'),
        target.capacity
      )
      const occupant = arr[seatIndex]
      if (occupant && occupant !== guestId) {
        forwardGuests[occupant] = {
          ...state.guests[occupant],
          assignedTableId: null,
          assignedSeatId: null,
        }
        inverseGuests[occupant] = state.guests[occupant]
      }
      arr[seatIndex] = guestId
      working[tableId] = arr
      forwardGuests[guestId] = {
        ...guest,
        assignedTableId: tableId,
        assignedSeatId: seatId(tableId, seatIndex),
      }
    } else {
      const arr = working[tableId].filter((id) => id && id !== guestId)
      arr.push(guestId)
      working[tableId] = arr
      forwardGuests[guestId] = { ...guest, assignedTableId: tableId, assignedSeatId: null }
    }

    const forwardTables = {}
    affected.forEach((tid) => {
      forwardTables[tid] = { ...state.tables[tid], assignedGuestIds: working[tid] }
    })

    return {
      type: 'ASSIGN_GUEST',
      label: 'Assign guest',
      payload: { guests: forwardGuests, tables: forwardTables },
      inverse: { guests: inverseGuests, tables: inverseTables },
    }
  }

// Swap two seated guests within the same seat-level table (or move one into an
// empty seat in the pair). Drag a seated guest onto an occupied seat to swap.
export const swapSeatGuests = (tableId, indexA, indexB) => (state) => {
  const table = state.tables[tableId]
  if (!table || table.seatMode !== 'seat' || indexA === indexB) return null

  const arr = normaliseSeats(table.assignedGuestIds || [], table.capacity)
  if (indexA < 0 || indexB < 0 || indexA >= arr.length || indexB >= arr.length) return null

  const a = arr[indexA] ?? null
  const b = arr[indexB] ?? null
  if (!a && !b) return null

  const next = [...arr]
  next[indexA] = b
  next[indexB] = a

  const guestsForward = {}
  const guestsInverse = {}
  if (a && state.guests[a]) {
    guestsInverse[a] = state.guests[a]
    guestsForward[a] = { ...state.guests[a], assignedTableId: tableId, assignedSeatId: seatId(tableId, indexB) }
  }
  if (b && state.guests[b]) {
    guestsInverse[b] = state.guests[b]
    guestsForward[b] = { ...state.guests[b], assignedTableId: tableId, assignedSeatId: seatId(tableId, indexA) }
  }

  return {
    type: 'SWAP_SEATS',
    label: 'Swap seats',
    payload: { tables: { [tableId]: { ...table, assignedGuestIds: next } }, guests: guestsForward },
    inverse: { tables: { [tableId]: table }, guests: guestsInverse },
  }
}

export const unassignGuest = (guestId) => (state) => {
  const guest = state.guests[guestId]
  if (!guest || !guest.assignedTableId) return null
  const tid = guest.assignedTableId
  const table = state.tables[tid]
  return {
    type: 'UNASSIGN_GUEST',
    label: 'Unassign guest',
    payload: {
      guests: { [guestId]: { ...guest, assignedTableId: null, assignedSeatId: null } },
      tables: table
        ? {
            [tid]: {
              ...table,
              assignedGuestIds: withoutGuest(table.assignedGuestIds, guestId, table.seatMode),
            },
          }
        : {},
    },
    inverse: {
      guests: { [guestId]: guest },
      ...(table ? { tables: { [tid]: table } } : {}),
    },
  }
}

export const assignGroupToTable = (groupId, tableId) => (state) => {
  const group = state.groups[groupId]
  const target = state.tables[tableId]
  if (!group || !target) return null
  const memberIds = (group.memberIds || []).filter((id) => state.guests[id])
  if (!memberIds.length) return null

  const affected = new Set([tableId])
  memberIds.forEach((gid) => {
    const t = state.guests[gid].assignedTableId
    if (t) affected.add(t)
  })

  const inverseGuests = {}
  const inverseTables = {}
  memberIds.forEach((gid) => {
    inverseGuests[gid] = state.guests[gid]
  })
  affected.forEach((tid) => {
    inverseTables[tid] = state.tables[tid]
  })

  const memberSet = new Set(memberIds)
  const working = {}
  affected.forEach((tid) => {
    working[tid] = withoutMembers(
      [...(state.tables[tid].assignedGuestIds || [])],
      memberSet,
      state.tables[tid].seatMode
    )
  })
  working[tableId] = [...working[tableId].filter(Boolean), ...memberIds]

  const forwardGuests = {}
  memberIds.forEach((gid) => {
    forwardGuests[gid] = {
      ...state.guests[gid],
      assignedTableId: tableId,
      assignedSeatId: null,
    }
  })
  const forwardTables = {}
  affected.forEach((tid) => {
    forwardTables[tid] = { ...state.tables[tid], assignedGuestIds: working[tid] }
  })

  return {
    type: 'ASSIGN_GROUP',
    label: 'Seat group',
    payload: { guests: forwardGuests, tables: forwardTables },
    inverse: { guests: inverseGuests, tables: inverseTables },
  }
}

// ── groups ──────────────────────────────────────────────────────────────────

const GROUP_COLOURS = [
  '#7B6FA0',
  '#4A7C59',
  '#C07C2A',
  '#5C7E9E',
  '#A6576A',
  '#7C6F5B',
  '#5E8A7C',
  '#9E6B4A',
]

export const createGroup =
  (memberIds, { name, colour } = {}) =>
  (state) => {
    const ids = (memberIds || []).filter((id) => state.guests[id])
    if (!ids.length) return null
    const group = {
      id: makeId('grp'),
      name: name || 'New group',
      colour: colour || GROUP_COLOURS[Object.keys(state.groups).length % GROUP_COLOURS.length],
      memberIds: ids,
    }
    const guestsForward = {}
    const guestsInverse = {}
    ids.forEach((gid) => {
      guestsInverse[gid] = state.guests[gid]
      guestsForward[gid] = { ...state.guests[gid], groupId: group.id }
    })
    return {
      type: 'CREATE_GROUP',
      label: 'Create group',
      payload: { groups: { [group.id]: group }, guests: guestsForward },
      inverse: { groups: { [group.id]: null }, guests: guestsInverse },
      meta: { newGroupId: group.id },
    }
  }

// Create an empty group (no members yet) — for the "+ New group" entry point,
// after which guests are added via drag or the inspector. createGroup requires
// at least one member; this one intentionally does not.
export const createEmptyGroup =
  ({ name, colour } = {}) =>
  (state) => {
    const group = {
      id: makeId('grp'),
      name: name || 'New group',
      colour: colour || GROUP_COLOURS[Object.keys(state.groups).length % GROUP_COLOURS.length],
      memberIds: [],
    }
    return {
      type: 'CREATE_EMPTY_GROUP',
      label: 'Create group',
      payload: { groups: { [group.id]: group } },
      inverse: { groups: { [group.id]: null } },
      meta: { newGroupId: group.id },
    }
  }

export const dissolveGroup = (groupId) => (state) => {
  const group = state.groups[groupId]
  if (!group) return null
  const guestsForward = {}
  const guestsInverse = {}
  ;(group.memberIds || []).forEach((gid) => {
    const g = state.guests[gid]
    if (!g) return
    guestsInverse[gid] = g
    guestsForward[gid] = { ...g, groupId: null }
  })
  return {
    type: 'DISSOLVE_GROUP',
    label: 'Dissolve group',
    payload: { groups: { [groupId]: null }, guests: guestsForward },
    inverse: { groups: { [groupId]: group }, guests: guestsInverse },
  }
}

export const renameGroup = (groupId, name) => (state) => {
  const group = state.groups[groupId]
  if (!group || group.name === name) return null
  return {
    type: 'RENAME_GROUP',
    label: 'Rename group',
    payload: { groups: { [groupId]: { ...group, name } } },
    inverse: { groups: { [groupId]: group } },
  }
}

export const recolourGroup = (groupId, colour) => (state) => {
  const group = state.groups[groupId]
  if (!group) return null
  return {
    type: 'RECOLOUR_GROUP',
    label: 'Recolour group',
    payload: { groups: { [groupId]: { ...group, colour } } },
    inverse: { groups: { [groupId]: group } },
  }
}

export const addToGroup = (groupId, guestId) => (state) => {
  const group = state.groups[groupId]
  const guest = state.guests[guestId]
  if (!group || !guest) return null
  const prevGroupId = guest.groupId
  const groupsForward = {}
  const groupsInverse = {}
  // remove from previous group
  if (prevGroupId && state.groups[prevGroupId]) {
    const prev = state.groups[prevGroupId]
    groupsInverse[prevGroupId] = prev
    groupsForward[prevGroupId] = {
      ...prev,
      memberIds: (prev.memberIds || []).filter((id) => id !== guestId),
    }
  }
  groupsInverse[groupId] = group
  groupsForward[groupId] = {
    ...group,
    memberIds: [...(group.memberIds || []).filter((id) => id !== guestId), guestId],
  }
  return {
    type: 'ADD_TO_GROUP',
    label: 'Add to group',
    payload: { groups: groupsForward, guests: { [guestId]: { ...guest, groupId } } },
    inverse: { groups: groupsInverse, guests: { [guestId]: guest } },
  }
}

export const removeFromGroup = (guestId) => (state) => {
  const guest = state.guests[guestId]
  if (!guest || !guest.groupId) return null
  const group = state.groups[guest.groupId]
  return {
    type: 'REMOVE_FROM_GROUP',
    label: 'Remove from group',
    payload: {
      guests: { [guestId]: { ...guest, groupId: null } },
      ...(group
        ? {
            groups: {
              [group.id]: {
                ...group,
                memberIds: (group.memberIds || []).filter((id) => id !== guestId),
              },
            },
          }
        : {}),
    },
    inverse: {
      guests: { [guestId]: guest },
      ...(group ? { groups: { [group.id]: group } } : {}),
    },
  }
}

// ── zones ───────────────────────────────────────────────────────────────────

export const addZone =
  ({ x, y, width, height, shape = 'rect', label = 'Zone', colour = '#E8E0D5' }) =>
  () => {
    const zone = {
      id: makeId('zone'),
      label,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      shape,
      colour,
    }
    return {
      type: 'ADD_ZONE',
      label: 'Add zone',
      payload: { zones: { [zone.id]: zone } },
      inverse: { zones: { [zone.id]: null } },
      meta: { newZoneId: zone.id },
    }
  }

export const removeZone = (id) => (state) => {
  const zone = state.zones[id]
  if (!zone) return null
  return {
    type: 'REMOVE_ZONE',
    label: 'Remove zone',
    payload: { zones: { [id]: null } },
    inverse: { zones: { [id]: zone } },
  }
}

export const moveZone = (id, x, y) => (state) => {
  const zone = state.zones[id]
  if (!zone) return null
  return {
    type: 'MOVE_ZONE',
    label: 'Move zone',
    payload: { zones: { [id]: { ...zone, x: Math.round(x), y: Math.round(y) } } },
    inverse: { zones: { [id]: zone } },
  }
}

export const resizeZone = (id, dims) => (state) => {
  const zone = state.zones[id]
  if (!zone) return null
  const next = { ...zone }
  for (const k of ['x', 'y', 'width', 'height']) {
    if (dims[k] != null) next[k] = Math.round(dims[k])
  }
  return {
    type: 'RESIZE_ZONE',
    label: 'Resize zone',
    payload: { zones: { [id]: next } },
    inverse: { zones: { [id]: zone } },
  }
}

export const renameZone = (id, label) => (state) => {
  const zone = state.zones[id]
  if (!zone || zone.label === label) return null
  return {
    type: 'RENAME_ZONE',
    label: 'Rename zone',
    payload: { zones: { [id]: { ...zone, label } } },
    inverse: { zones: { [id]: zone } },
  }
}

// ── room spaces (multi-room) ─────────────────────────────────────────────────
// The room is a single object holding a `spaces` array, so these actions patch
// the whole room (mirroring RESIZE_ROOM). Live move/resize/vertex-drag use
// updateRoom for smooth feedback and dispatch the final command on pointer-up.

const SPACE_COLOURS = ['#FAF8F5', '#F3EFEA', '#EEF3F1', '#F1EEF5', '#F5EFEA']

export const addSpace =
  (space = {}) =>
  (state) => {
    const room = state.room
    const count = (room.spaces || []).length
    const base =
      space.shape === 'polygon'
        ? { shape: 'polygon', vertices: space.vertices || [] }
        : { shape: 'rect', width: space.width || 400, height: space.height || 300 }
    const sp = {
      id: makeId('space'),
      label: space.label || `Space ${count + 1}`,
      x: Math.round(space.x || 0),
      y: Math.round(space.y || 0),
      backgroundColour: space.backgroundColour || SPACE_COLOURS[count % SPACE_COLOURS.length],
      ...base,
    }
    return {
      type: 'ADD_SPACE',
      label: 'Add space',
      payload: { room: { ...room, spaces: [...(room.spaces || []), sp] } },
      inverse: { room },
      meta: { newSpaceId: sp.id },
    }
  }

export const removeSpace = (id) => (state) => {
  const room = state.room
  const spaces = room.spaces || []
  if (spaces.length <= 1 || !spaces.some((s) => s.id === id)) return null // keep at least one
  return {
    type: 'REMOVE_SPACE',
    label: 'Remove space',
    payload: {
      room: {
        ...room,
        spaces: spaces.filter((s) => s.id !== id),
        joins: (room.joins || []).filter((j) => j.a !== id && j.b !== id),
      },
    },
    inverse: { room },
  }
}

const patchSpace = (type, label) => (id, patch) => (state) => {
  const room = state.room
  const spaces = room.spaces || []
  if (!spaces.some((s) => s.id === id)) return null
  return {
    type,
    label,
    payload: { room: { ...room, spaces: spaces.map((s) => (s.id === id ? { ...s, ...patch } : s)) } },
    inverse: { room },
  }
}

export const renameSpace = patchSpace('RENAME_SPACE', 'Rename space')
export const recolourSpace = patchSpace('RECOLOUR_SPACE', 'Recolour space')
export const resizeSpace = patchSpace('RESIZE_SPACE', 'Resize space')

// Toggle a join between two spaces (open boundary so they read as one floor).
export const joinSpaces = (a, b) => (state) => {
  const room = state.room
  if (a === b) return null
  const joins = room.joins || []
  const exists = joins.some((j) => (j.a === a && j.b === b) || (j.a === b && j.b === a))
  const next = exists
    ? joins.filter((j) => !((j.a === a && j.b === b) || (j.a === b && j.b === a)))
    : [...joins, { a, b }]
  return {
    type: exists ? 'UNJOIN_SPACES' : 'JOIN_SPACES',
    label: exists ? 'Separate spaces' : 'Join spaces',
    payload: { room: { ...room, joins: next } },
    inverse: { room },
  }
}

// Registry the store iterates over to create bound dispatchers.
export const actionCreators = {
  addTable,
  createCustomTable,
  setPerSideSeats,
  removeTable,
  duplicateTable,
  moveTable,
  renameTable,
  changeCapacity,
  changeTableType,
  setDesignation,
  setTableColour,
  rotateTable,
  resizeTable,
  saveTablePreset,
  deleteTablePreset,
  calibrate,
  setRoomSizeUnits,
  setSeatMode,
  clearTable,
  addGuest,
  removeGuest,
  removeGuests,
  assignGuest,
  swapSeatGuests,
  unassignGuest,
  assignGroupToTable,
  createGroup,
  createEmptyGroup,
  dissolveGroup,
  renameGroup,
  recolourGroup,
  addToGroup,
  removeFromGroup,
  addZone,
  removeZone,
  moveZone,
  resizeZone,
  renameZone,
  addSpace,
  removeSpace,
  renameSpace,
  recolourSpace,
  resizeSpace,
  joinSpaces,
}
