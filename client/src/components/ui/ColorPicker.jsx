import clsx from 'clsx'
import styles from './ColorPicker.module.css'

export const SWATCHES = [
  '#7B6FA0',
  '#4A7C59',
  '#C07C2A',
  '#5C7E9E',
  '#A6576A',
  '#7C6F5B',
  '#5E8A7C',
  '#9E6B4A',
]

export default function ColorPicker({
  value,
  onChange,
  presets = SWATCHES,
  allowCustom = true,
  allowClear = false,
}) {
  return (
    <div className={styles.picker}>
      {allowClear && (
        <button
          type="button"
          className={clsx(styles.swatch, styles.clear, !value && styles.active)}
          onClick={() => onChange(null)}
          aria-label="No colour"
          title="No colour"
        />
      )}
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          className={clsx(styles.swatch, value === c && styles.active)}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
        />
      ))}
      {allowCustom && (
        <input
          type="color"
          className={styles.custom}
          value={value || '#7C6F5B'}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom colour"
        />
      )}
    </div>
  )
}
