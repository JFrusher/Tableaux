import clsx from 'clsx'
import styles from './Badge.module.css'

/**
 * Small label used for dietary requirements, tags and side indicators.
 * Pass `dot` for a custom colour swatch, or a `variant` for a tinted pill.
 */
export default function Badge({
  label,
  dot,
  variant = 'neutral',
  size = 'sm',
  title,
  className,
}) {
  return (
    <span
      className={clsx(styles.badge, styles[variant], size === 'xs' && styles.xs, className)}
      title={title}
    >
      {dot && <span className={styles.dot} style={{ background: dot }} />}
      {label != null && <span className={styles.label}>{label}</span>}
    </span>
  )
}
