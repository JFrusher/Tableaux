import styles from './PublicPages.module.css'

/** Legal links shown at the foot of the public (guest-facing) pages. */
export default function PublicFooter() {
  return (
    <footer className={styles.publicFooter}>
      <a href="/privacy-policy.html">Privacy</a>
      <span aria-hidden="true">·</span>
      <a href="/terms-of-service.html">Terms</a>
    </footer>
  )
}
