import { memo } from 'react'
import styles from './CanvasGrid.module.css'

/**
 * Infinite background grid drawn on a viewport-fixed layer. The pattern is
 * offset by the pan and scaled by the zoom so it tracks the world without
 * needing an enormous DOM element.
 */
function CanvasGrid({ panX, panY, zoom, gridSize = 20, style = 'dots' }) {
  if (style === 'off') return null
  const g = gridSize * zoom
  const position = `${panX}px ${panY}px`

  const bg =
    style === 'lines'
      ? {
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: `${g}px ${g}px`,
          backgroundPosition: position,
        }
      : {
          backgroundImage:
            'radial-gradient(circle, var(--grid-dot) 1.2px, transparent 1.2px)',
          backgroundSize: `${g}px ${g}px`,
          backgroundPosition: position,
        }

  return <div className={styles.grid} style={bg} aria-hidden="true" />
}

export default memo(CanvasGrid)
