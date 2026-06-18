import { useStore } from '../store/useStore.js'

/**
 * Shared handle to the canvas viewport element so coordinate conversions and
 * pan/zoom commands work from anywhere (the pan/zoom hook, the drag controller,
 * the keyboard shortcuts). RoomCanvas registers the element.
 */
export const canvasViewportRef = { current: null }

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2
const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export const viewportRect = () => canvasViewportRef.current?.getBoundingClientRect() || null

export function screenToCanvas(clientX, clientY) {
  const r = viewportRect()
  const { zoom, panX, panY } = useStore.getState().canvas
  const left = r?.left || 0
  const top = r?.top || 0
  return { x: (clientX - left - panX) / zoom, y: (clientY - top - panY) / zoom }
}

export function canvasToScreen(x, y) {
  const r = viewportRect()
  const { zoom, panX, panY } = useStore.getState().canvas
  return { x: x * zoom + panX + (r?.left || 0), y: y * zoom + panY + (r?.top || 0) }
}

export function isWithinViewport(clientX, clientY) {
  const r = viewportRect()
  if (!r) return false
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
}

/** Zoom by `factor`, keeping the canvas point under (clientX, clientY) fixed. */
export function zoomCanvasAt(clientX, clientY, factor) {
  const vp = viewportRect()
  if (!vp) return
  const { zoom, panX, panY } = useStore.getState().canvas
  const mx = clientX - vp.left
  const my = clientY - vp.top
  const nz = clampZoom(zoom * factor)
  if (nz === zoom) return
  useStore.getState().setCanvas({
    zoom: nz,
    panX: mx - ((mx - panX) / zoom) * nz,
    panY: my - ((my - panY) / zoom) * nz,
  })
}

/** Zoom centred on the viewport. */
export function zoomCanvasBy(factor) {
  const vp = viewportRect()
  if (!vp) return
  zoomCanvasAt(vp.left + vp.width / 2, vp.top + vp.height / 2, factor)
}

/** Pan so that canvas point (x, y) sits at the centre of the viewport. */
export function centerCanvasOn(x, y) {
  const r = viewportRect()
  if (!r) return
  const { zoom } = useStore.getState().canvas
  useStore.getState().setCanvas({ panX: r.width / 2 - x * zoom, panY: r.height / 2 - y * zoom })
}

/** Fit the room + all tables/zones within the viewport. */
export function fitCanvasToContent() {
  const vp = viewportRect()
  if (!vp) return
  const { room, tables, zones } = useStore.getState()
  let minX = 0
  let minY = 0
  let maxX = room.width
  let maxY = room.height
  // Include every floor space (rectangles + polygons), not just the legacy rect.
  ;(room.spaces || []).forEach((sp) => {
    if (sp.shape === 'polygon') {
      sp.vertices.forEach((v) => {
        minX = Math.min(minX, sp.x + v.x)
        minY = Math.min(minY, sp.y + v.y)
        maxX = Math.max(maxX, sp.x + v.x)
        maxY = Math.max(maxY, sp.y + v.y)
      })
    } else {
      minX = Math.min(minX, sp.x)
      minY = Math.min(minY, sp.y)
      maxX = Math.max(maxX, sp.x + sp.width)
      maxY = Math.max(maxY, sp.y + sp.height)
    }
  })
  Object.values(tables).forEach((t) => {
    minX = Math.min(minX, t.x - 130)
    minY = Math.min(minY, t.y - 130)
    maxX = Math.max(maxX, t.x + 130)
    maxY = Math.max(maxY, t.y + 130)
  })
  Object.values(zones).forEach((z) => {
    minX = Math.min(minX, z.x)
    minY = Math.min(minY, z.y)
    maxX = Math.max(maxX, z.x + z.width)
    maxY = Math.max(maxY, z.y + z.height)
  })
  const pad = 48
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const z = clampZoom(Math.min((vp.width - pad * 2) / w, (vp.height - pad * 2) / h))
  useStore.getState().setCanvas({
    zoom: z,
    panX: (vp.width - w * z) / 2 - minX * z,
    panY: (vp.height - h * z) / 2 - minY * z,
  })
}
