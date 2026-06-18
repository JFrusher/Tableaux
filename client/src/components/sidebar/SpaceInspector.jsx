import { useStore } from '../../store/useStore.js'
import { DEFAULT_PPU } from '../../utils/seatPositions.js'
import { toDisplay, parseDisplay } from '../../utils/units.js'
import IconButton from '../ui/IconButton.jsx'
import Button from '../ui/Button.jsx'
import ColorPicker from '../ui/ColorPicker.jsx'
import TextField from './TextField.jsx'
import f from './fields.module.css'
import styles from './TableInspector.module.css'

/**
 * Inspector for a selected floor space (room). Mirrors TableInspector: rename,
 * numeric width/height (rectangles only — polygons resize by dragging vertices),
 * colour and delete. Sizes are stored as canvas px; we display/parse them in the
 * user's real-world units via `px = cm * pixelsPerUnit`, the same convention
 * tables use.
 */
export default function SpaceInspector({ spaceId }) {
  const space = useStore((s) => (s.room.spaces || []).find((sp) => sp.id === spaceId))
  const spaceCount = useStore((s) => (s.room.spaces || []).length)
  const renameSpace = useStore((s) => s.renameSpace)
  const recolourSpace = useStore((s) => s.recolourSpace)
  const resizeSpace = useStore((s) => s.resizeSpace)
  const removeSpace = useStore((s) => s.removeSpace)
  const clearSelection = useStore((s) => s.clearSelection)
  const unitSystem = useStore((s) => s.settings.unitSystem || 'metric')
  const ppu = useStore((s) => s.settings.pixelsPerUnit || DEFAULT_PPU)

  if (!space) return null
  const isRect = space.shape !== 'polygon'
  const dim = (px) => toDisplay(px / ppu, unitSystem).label
  const onDim = (key) => (v) => {
    const cm = parseDisplay(v, unitSystem)
    if (cm && cm > 0) resizeSpace(spaceId, { [key]: Math.max(80, Math.round(cm * ppu)) })
  }

  return (
    <div className={styles.inspector}>
      <header className={styles.header}>
        <span className={f.label}>Space</span>
        <IconButton icon="x" label="Close" size={32} iconSize={15} onClick={clearSelection} />
      </header>

      <div className={f.group}>
        <TextField
          className={f.input}
          value={space.label}
          onCommit={(v) => v.trim() && renameSpace(spaceId, { label: v.trim() })}
          aria-label="Space name"
        />
      </div>

      {isRect ? (
        <div className={f.group}>
          <span className={f.label}>Size</span>
          <div className={styles.dimRow}>
            <TextField
              className={f.input}
              value={dim(space.width)}
              onCommit={onDim('width')}
              aria-label="Width"
            />
            <span className={styles.dimX}>×</span>
            <TextField
              className={f.input}
              value={dim(space.height)}
              onCommit={onDim('height')}
              aria-label="Height"
            />
          </div>
        </div>
      ) : (
        <div className={f.group}>
          <span className={f.label}>Shape</span>
          <p className={styles.emptySeated}>
            Drag the vertices on the canvas to reshape this space.
          </p>
        </div>
      )}

      <div className={f.group}>
        <span className={f.label}>Background colour</span>
        <ColorPicker
          value={space.backgroundColour}
          onChange={(c) => recolourSpace(spaceId, { backgroundColour: c })}
        />
      </div>

      {spaceCount > 1 && (
        <div className={styles.footer}>
          <Button variant="ghost" icon="trash" fullWidth onClick={() => removeSpace(spaceId)}>
            Delete space
          </Button>
        </div>
      )}
    </div>
  )
}
