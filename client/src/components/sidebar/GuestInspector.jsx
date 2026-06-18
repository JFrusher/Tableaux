import { useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import { DIETARY_META, normaliseDietary } from '../../utils/dietary.js'
import Icon from '../ui/Icon.jsx'
import IconButton from '../ui/IconButton.jsx'
import TextField from './TextField.jsx'
import f from './fields.module.css'
import styles from './GuestInspector.module.css'

const SIDES = [
  { value: 'bride', label: 'Bride' },
  { value: 'groom', label: 'Groom' },
  { value: 'both', label: 'Both' },
]
const RSVPS = ['confirmed', 'pending', 'declined']

export default function GuestInspector({ guestId }) {
  const guest = useStore((s) => s.guests[guestId])
  const groups = useStore((s) => s.groups)
  const table = useStore((s) => (guest?.assignedTableId ? s.tables[guest.assignedTableId] : null))
  const updateGuest = useStore((s) => s.updateGuest)
  const addToGroup = useStore((s) => s.addToGroup)
  const createGroup = useStore((s) => s.createGroup)
  const removeFromGroup = useStore((s) => s.removeFromGroup)
  const unassignGuest = useStore((s) => s.unassignGuest)
  const select = useStore((s) => s.select)
  const clearSelection = useStore((s) => s.clearSelection)

  const [tagDraft, setTagDraft] = useState('')

  if (!guest) return null

  const seatIndex =
    guest.assignedSeatId && table
      ? (table.assignedGuestIds || []).indexOf(guest.id)
      : -1

  const addTag = () => {
    const t = tagDraft.trim()
    if (!t) return
    if (!(guest.tags || []).includes(t)) updateGuest(guestId, { tags: [...(guest.tags || []), t] })
    setTagDraft('')
  }
  const removeTag = (t) =>
    updateGuest(guestId, { tags: (guest.tags || []).filter((x) => x !== t) })

  return (
    <div className={styles.inspector}>
      <header className={styles.header}>
        <span className={f.label}>Guest</span>
        <IconButton icon="x" label="Close" size={32} iconSize={15} onClick={clearSelection} />
      </header>

      <div className={f.group}>
        <div className={f.row}>
          <div className={clsx(f.field, f.grow)}>
            <span className={f.label}>First</span>
            <TextField
              className={f.input}
              aria-label="First name"
              value={guest.firstName}
              onCommit={(v) => updateGuest(guestId, { firstName: v })}
            />
          </div>
          <div className={clsx(f.field, f.grow)}>
            <span className={f.label}>Last</span>
            <TextField
              className={f.input}
              aria-label="Last name"
              value={guest.lastName}
              onCommit={(v) => updateGuest(guestId, { lastName: v })}
            />
          </div>
        </div>
        <div className={f.field}>
          <span className={f.label}>Email</span>
          <TextField
            className={f.input}
            type="email"
            aria-label="Guest email"
            value={guest.email}
            onCommit={(v) => updateGuest(guestId, { email: v })}
          />
        </div>
      </div>

      <div className={f.group}>
        <div className={f.field}>
          <span className={f.label}>Dietary</span>
          <TextField
            className={f.input}
            list="diet-suggestions"
            aria-label="Dietary requirements"
            placeholder="None"
            value={guest.dietaryRaw || ''}
            onCommit={(v) =>
              updateGuest(guestId, { dietaryRaw: v, dietary: normaliseDietary(v) })
            }
          />
          <datalist id="diet-suggestions">
            {Object.values(DIETARY_META)
              .filter((d) => d.key !== 'other')
              .map((d) => (
                <option key={d.key} value={d.label} />
              ))}
          </datalist>
        </div>

        <div className={f.field}>
          <span className={f.label}>Side</span>
          <div className={f.segmented}>
            {SIDES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={clsx(f.segment, guest.side === s.value && f.segmentActive)}
                onClick={() =>
                  updateGuest(guestId, { side: guest.side === s.value ? null : s.value })
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={f.field}>
          <span className={f.label}>RSVP</span>
          <select
            className={f.select}
            aria-label="RSVP status"
            value={guest.rsvpStatus}
            onChange={(e) => updateGuest(guestId, { rsvpStatus: e.target.value })}
          >
            {RSVPS.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className={f.field}>
          <span className={f.label}>Group</span>
          <select
            className={f.select}
            aria-label="Group"
            value={guest.groupId || ''}
            onChange={(e) => {
              const v = e.target.value
              // Sentinel: create a brand-new group containing this guest.
              if (v === '__new__') createGroup([guestId])
              else if (v) addToGroup(v, guestId)
              else removeFromGroup(guestId)
            }}
          >
            <option value="">No group</option>
            {Object.values(groups).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="__new__">+ New group…</option>
          </select>
        </div>
      </div>

      <div className={f.group}>
        <span className={f.label}>Seating</span>
        {table ? (
          <div className={styles.assignment}>
            <button
              type="button"
              className={styles.tableLink}
              onClick={() => select('table', table.id)}
            >
              <Icon name="maximize" size={14} />
              {table.label}
              {seatIndex >= 0 && <span className={styles.seatNo}>· seat {seatIndex + 1}</span>}
            </button>
            <IconButton
              icon="x"
              label="Remove from table"
              size={26}
              iconSize={14}
              onClick={() => unassignGuest(guestId)}
            />
          </div>
        ) : (
          <p className={styles.unassigned}>Not seated. Drag onto a table to assign.</p>
        )}
      </div>

      <div className={f.group}>
        <span className={f.label}>Notes</span>
        <TextField
          as="textarea"
          className={f.textarea}
          aria-label="Notes"
          placeholder="Allergies, accessibility, who they should sit near…"
          value={guest.notes || ''}
          onCommit={(v) => updateGuest(guestId, { notes: v })}
        />
      </div>

      <div className={f.group}>
        <span className={f.label}>Tags</span>
        <div className={styles.tags}>
          {(guest.tags || []).map((t) => (
            <button key={t} type="button" className={styles.tag} onClick={() => removeTag(t)}>
              {t}
              <Icon name="x" size={11} />
            </button>
          ))}
        </div>
        <input
          className={f.input}
          aria-label="Add a tag"
          placeholder="Add a tag, press Enter"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
        />
      </div>
    </div>
  )
}
