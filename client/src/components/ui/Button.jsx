import clsx from 'clsx'
import Icon from './Icon.jsx'
import styles from './Button.module.css'

/**
 * variant: primary | secondary | ghost | danger
 * size:    md (36px) | sm (28px)
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={clsx(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children && <span className={styles.label}>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 16} />}
    </button>
  )
}
