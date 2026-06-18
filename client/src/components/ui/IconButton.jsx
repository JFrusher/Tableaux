import { forwardRef } from 'react'
import clsx from 'clsx'
import Icon from './Icon.jsx'
import styles from './IconButton.module.css'

/**
 * A 32×32 ghost-style icon button. `label` is required and used for the
 * accessible name (and a native tooltip). Pass an icon name string or a
 * custom node via `icon`.
 */
const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    size = 32,
    iconSize = 18,
    active = false,
    variant = 'ghost',
    onDark = false,
    className,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={clsx(
        styles.iconButton,
        styles[variant],
        active && styles.active,
        onDark && styles.onDark,
        className
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      {typeof icon === 'string' ? <Icon name={icon} size={iconSize} /> : icon}
    </button>
  )
})

export default IconButton
