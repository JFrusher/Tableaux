import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import f from '../sidebar/fields.module.css'
import styles from './ConstraintsModal.module.css'

export default function ConstraintsModal() {
  const guests = useStore((s) => s.guests)
  const constraints = useStore((s) => s.constraints)
  const addConstraint = useStore((s) => s.addConstraint)
  const removeConstraint = useStore((s) => s.removeConstraint)
  const closeModal = useStore((s) => s.closeModal)

  const sorted = useMemo(
    () => Object.values(guests).sort((a, b) => String(a.fullName).localeCompare(b.fullName)),
    [guests]
  )

  const [kind, setKind] = useState('apart')
  const [a, setA] = useState('')
  const [b, setB] = useState('')

  const add = () => {
    if (!a || !b || a === b) return
    addConstraint({ kind, guestIds: [a, b] })
    setA('')
    setB('')
  }

  const nameOf = (id) => guests[id]?.fullName || 'Unknown'

  return (
    <Modal
      title="Seating rules"
      onClose={closeModal}
      footer={
        <Button variant="primary" onClick={closeModal}>
          Done
        </Button>
      }
    >
      <p className={styles.intro}>
        Add rules and Tableaux will flag a warning if a plan breaks them — it never blocks you.
      </p>

      <div className={styles.builder}>
        <div className={f.segmented}>
          <button
            type="button"
            className={clsx(f.segment, kind === 'apart' && f.segmentActive)}
            onClick={() => setKind('apart')}
          >
            Shouldn&rsquo;t sit together
          </button>
          <button
            type="button"
            className={clsx(f.segment, kind === 'together' && f.segmentActive)}
            onClick={() => setKind('together')}
          >
            Should sit together
          </button>
        </div>
        <div className={styles.pair}>
          <select className={f.select} value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Choose a guest…</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </select>
          <span className={styles.amp}>and</span>
          <select className={f.select} value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Choose a guest…</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </select>
          <Button variant="secondary" icon="plus" disabled={!a || !b || a === b} onClick={add}>
            Add
          </Button>
        </div>
      </div>

      {constraints.length > 0 ? (
        <ul className={styles.list}>
          {constraints.map((c) => (
            <li key={c.id} className={styles.rule}>
              <span className={clsx(styles.tag, c.kind === 'apart' ? styles.apart : styles.together)}>
                {c.kind === 'apart' ? 'Apart' : 'Together'}
              </span>
              <span className={styles.names}>
                {nameOf(c.guestIds[0])} &amp; {nameOf(c.guestIds[1])}
              </span>
              <IconButton
                icon="trash"
                label="Remove rule"
                size={26}
                iconSize={14}
                onClick={() => removeConstraint(c.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.none}>No rules yet.</p>
      )}
    </Modal>
  )
}
