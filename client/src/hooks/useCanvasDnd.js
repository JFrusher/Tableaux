import { useState, useCallback } from 'react'
import { useStore } from '../store/useStore.js'
import { screenToCanvas, isWithinViewport } from '../utils/canvasCoords.js'

/**
 * App-root drag controller. Handles:
 *   - palette → canvas: create a table at the drop point
 *   - guest/group → table or seat: assignment (Phase 4)
 *
 * The drop point is reconstructed from the activator event + delta so it works
 * regardless of which droppable (if any) reported `over`.
 */
export function useCanvasDnd() {
  const [activeDrag, setActiveDrag] = useState(null)

  const onDragStart = useCallback((e) => {
    setActiveDrag(e.active?.data?.current || null)
  }, [])

  const onDragCancel = useCallback(() => setActiveDrag(null), [])

  const onDragEnd = useCallback((e) => {
    const data = e.active?.data?.current
    setActiveDrag(null)
    if (!data) return

    const store = useStore.getState()
    const { activatorEvent, delta, over } = e
    const clientX = (activatorEvent?.clientX || 0) + (delta?.x || 0)
    const clientY = (activatorEvent?.clientY || 0) + (delta?.y || 0)
    const overData = over?.data?.current

    // Palette → create a table at the drop position.
    if (data.type === 'palette') {
      if (!isWithinViewport(clientX, clientY)) return
      const p = screenToCanvas(clientX, clientY)
      const cmd = store.addTable({ type: data.tableType, x: p.x, y: p.y })
      if (cmd?.meta?.newTableId) store.select('table', cmd.meta.newTableId)
      return
    }

    // Saved preset → recreate its full footprint + seating at the drop position.
    if (data.type === 'palette-preset') {
      if (!isWithinViewport(clientX, clientY)) return
      const preset = (store.settings.customTablePresets || []).find((pr) => pr.id === data.presetId)
      if (!preset) return
      const p = screenToCanvas(clientX, clientY)
      const cmd = store.addTable({
        type: preset.type,
        x: p.x,
        y: p.y,
        capacity: preset.capacity,
        sizeUnits: preset.sizeUnits || undefined,
        perSideSeats: preset.perSideSeats || undefined,
        seatMode: preset.seatMode,
      })
      if (cmd?.meta?.newTableId) store.select('table', cmd.meta.newTableId)
      return
    }

    // Guest → seat (seat-level)
    if (data.type === 'guest' && overData?.type === 'seat') {
      assignGuestToSeat(store, data.guestId, overData.tableId, overData.index)
      return
    }

    // Guest → table (table-level)
    if (data.type === 'guest' && overData?.type === 'table') {
      assignGuestToTable(store, data.guestId, overData.tableId)
      return
    }

    // Group → table
    if (data.type === 'group' && overData?.type === 'table') {
      assignGroupToTable(store, data.groupId, overData.tableId)
      return
    }
  }, [])

  return { activeDrag, onDragStart, onDragEnd, onDragCancel }
}

function tableFullToast(store, table) {
  store.addToast({
    type: 'error',
    message: `${table.label} is full — ${table.capacity} of ${table.capacity} seats taken.`,
  })
}

function assignGuestToTable(store, guestId, tableId) {
  const table = store.tables[tableId]
  const guest = store.guests[guestId]
  if (!table || !guest) return
  const seated = (table.assignedGuestIds || []).filter(Boolean).length
  // Dropping a guest back onto the table they already sit at (e.g. releasing a
  // name box over its own table) is a no-op — avoid a redundant history entry.
  if (guest.assignedTableId === tableId) return
  if (seated >= table.capacity) {
    tableFullToast(store, table)
    return
  }
  store.assignGuest(guestId, tableId)
}

function assignGuestToSeat(store, guestId, tableId, index) {
  const table = store.tables[tableId]
  if (!table) return
  const occupant = table.assignedGuestIds?.[index] ?? null
  if (occupant === guestId) return // dropped back onto its own seat — no-op
  if (occupant) {
    // Seat taken. If the dragged guest already sits at this table, swap the two;
    // otherwise leave the occupant be and tell the user.
    const fromIndex = (table.assignedGuestIds || []).indexOf(guestId)
    if (fromIndex !== -1) {
      store.swapSeatGuests(tableId, fromIndex, index)
      return
    }
    store.addToast({ type: 'warning', message: `Seat ${index + 1} is already taken.` })
    return
  }
  store.assignGuest(guestId, tableId, index)
}

function assignGroupToTable(store, groupId, tableId) {
  const table = store.tables[tableId]
  const group = store.groups[groupId]
  if (!table || !group) return
  const members = (group.memberIds || []).filter((id) => store.guests[id])
  const here = new Set((table.assignedGuestIds || []).filter(Boolean))
  const incoming = members.filter((id) => !here.has(id)).length
  const seated = here.size
  if (seated + incoming > table.capacity) {
    store.addToast({
      type: 'error',
      message: `${table.label} can't fit the whole group (${seated + incoming}/${table.capacity}).`,
    })
    return
  }
  store.assignGroupToTable(groupId, tableId)
}
