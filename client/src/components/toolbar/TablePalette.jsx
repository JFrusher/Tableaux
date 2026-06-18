import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { TABLE_TYPE_LIST } from '../../utils/tableTypes.js'
import { useStore } from '../../store/useStore.js'
import Icon from '../ui/Icon.jsx'
import IconButton from '../ui/IconButton.jsx'
import TableThumbnail from './TableThumbnail.jsx'
import styles from './TablePalette.module.css'

function PaletteItem({ def }) {
  const { listeners, attributes, setNodeRef, isDragging } = useDraggable({
    id: `palette_${def.id}`,
    data: { type: 'palette', tableType: def.id },
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={clsx(styles.item, isDragging && styles.dragging)}
      title={`Drag a ${def.label.toLowerCase()} table onto the canvas`}
      {...listeners}
      {...attributes}
    >
      <span className={styles.thumb}>
        <TableThumbnail type={def.id} size={30} />
      </span>
      <span className={styles.label}>{def.label}</span>
    </button>
  )
}

function PresetItem({ preset, onDelete }) {
  const { listeners, attributes, setNodeRef, isDragging } = useDraggable({
    id: `palette_preset_${preset.id}`,
    data: { type: 'palette-preset', presetId: preset.id },
  })
  return (
    <div className={clsx(styles.item, styles.presetItem, isDragging && styles.dragging)}>
      <button
        ref={setNodeRef}
        type="button"
        className={styles.presetGrab}
        title={`Drag "${preset.name}" onto the canvas`}
        {...listeners}
        {...attributes}
      >
        <span className={styles.thumb}>
          <TableThumbnail type={preset.type} size={30} />
        </span>
        <span className={styles.label}>{preset.name}</span>
      </button>
      <IconButton
        icon="x"
        label={`Delete preset ${preset.name}`}
        size={18}
        iconSize={11}
        className={styles.presetDelete}
        onClick={() => onDelete(preset.id)}
      />
    </div>
  )
}

export default function TablePalette() {
  const openModal = useStore((s) => s.openModal)
  const presets = useStore((s) => s.settings.customTablePresets || [])
  const deleteTablePreset = useStore((s) => s.deleteTablePreset)
  return (
    <div className={styles.palette} role="list" aria-label="Table types — drag onto the canvas">
      {TABLE_TYPE_LIST.map((def) => (
        <PaletteItem key={def.id} def={def} />
      ))}
      <button
        type="button"
        className={styles.item}
        title="Build a custom rectangle/square table with seats per side"
        onClick={() => openModal('customTable')}
      >
        <span className={styles.thumb}>
          <Icon name="plus" size={20} />
        </span>
        <span className={styles.label}>Custom</span>
      </button>
      {presets.map((preset) => (
        <PresetItem key={preset.id} preset={preset} onDelete={deleteTablePreset} />
      ))}
    </div>
  )
}
