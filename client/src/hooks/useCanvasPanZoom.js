import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import {
  canvasViewportRef,
  screenToCanvas,
  canvasToScreen,
  zoomCanvasAt,
  zoomCanvasBy,
  fitCanvasToContent,
} from '../utils/canvasCoords.js'

/**
 * Pan/zoom for the room canvas. The world layer is transformed with
 * `translate(panX, panY) scale(zoom)`; the maths live in canvasCoords so the
 * drag controller and keyboard shortcuts can share them.
 */
export function useCanvasPanZoom() {
  const viewportRef = useRef(null)
  const setCanvas = useStore((s) => s.setCanvas)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    const el = viewportRef.current
    canvasViewportRef.current = el
    return () => {
      if (canvasViewportRef.current === el) canvasViewportRef.current = null
    }
  }, [])

  // Wheel to zoom, centred on the cursor.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomCanvasAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const beginPan = useCallback(
    (e) => {
      if (e.button !== 0) return
      const startX = e.clientX
      const startY = e.clientY
      const start = useStore.getState().canvas
      let moved = false
      setIsPanning(true)
      const onMove = (ev) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!moved && Math.abs(dx) + Math.abs(dy) > 3) moved = true
        if (moved) setCanvas({ panX: start.panX + dx, panY: start.panY + dy })
      }
      const onUp = () => {
        setIsPanning(false)
        if (!moved) useStore.getState().clearSelection()
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setCanvas]
  )

  return {
    viewportRef,
    screenToCanvas,
    canvasToScreen,
    zoomIn: () => zoomCanvasBy(1.2),
    zoomOut: () => zoomCanvasBy(1 / 1.2),
    fitToScreen: fitCanvasToContent,
    beginPan,
    isPanning,
  }
}
