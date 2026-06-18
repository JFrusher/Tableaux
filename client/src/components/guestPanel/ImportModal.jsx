import { useState, useRef, useMemo, useEffect } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import { api } from '../../api/client.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import { dietaryMeta } from '../../utils/dietary.js'
import {
  guessMapping,
  uniqueValues,
  defaultComingValues,
  buildGuests,
} from '../../utils/csvParser.js'
import styles from './ImportModal.module.css'

const FIELDS = [
  { key: 'firstName', label: 'First name', required: true },
  { key: 'lastName', label: 'Last name', recommended: true },
  { key: 'rsvp', label: 'RSVP / Attending', recommended: true },
  { key: 'dietary', label: 'Dietary', recommended: true },
  { key: 'email', label: 'Email' },
  { key: 'side', label: 'Side' },
  { key: 'notes', label: 'Notes' },
]

const SIDE_LABEL = { bride: "Bride's", groom: "Groom's", both: 'Both' }

export default function ImportModal() {
  const closeModal = useStore((s) => s.closeModal)
  const importGuests = useStore((s) => s.importGuests)
  const addToast = useStore((s) => s.addToast)
  const existingCount = useStore((s) => Object.keys(s.guests).length)

  const steps = useMemo(
    () => (existingCount > 0 ? ['upload', 'map', 'preview', 'merge'] : ['upload', 'map', 'preview']),
    [existingCount]
  )

  const [stepIndex, setStepIndex] = useState(0)
  const [parsed, setParsed] = useState(null) // { filename, headers, rows, rowCount }
  const [mapping, setMapping] = useState({})
  const [comingValues, setComingValues] = useState([])
  const [deselected, setDeselected] = useState(() => new Set())
  const [strategy, setStrategy] = useState('update')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const step = steps[stepIndex]

  // Recompute RSVP "coming" defaults whenever the mapped RSVP column changes.
  const rsvpValues = useMemo(
    () => (parsed ? uniqueValues(parsed.rows, mapping.rsvp) : []),
    [parsed, mapping.rsvp]
  )
  useEffect(() => {
    setComingValues(defaultComingValues(rsvpValues))
  }, [rsvpValues])

  const allGuests = useMemo(
    () => (parsed ? buildGuests(parsed.rows, mapping, comingValues) : []),
    [parsed, mapping, comingValues]
  )
  const confirmedGuests = useMemo(
    () => allGuests.filter((g) => g.rsvpStatus === 'confirmed'),
    [allGuests]
  )
  const notComingCount = allGuests.length - confirmedGuests.length
  const importCount = confirmedGuests.length - deselected.size

  async function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please choose a .csv file.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const data = await api.uploadCsv(file)
      if (!data.rowCount) {
        setError('That file looks empty — no rows found.')
        setParsed(null)
      } else {
        setParsed(data)
        setMapping(guessMapping(data.headers))
        setDeselected(new Set())
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const canNext =
    (step === 'upload' && !!parsed) ||
    (step === 'map' && !!mapping.firstName) ||
    (step === 'preview' && importCount > 0) ||
    step === 'merge'

  const isLastStep = stepIndex === steps.length - 1

  function finish() {
    const chosen = confirmedGuests.filter((_, i) => !deselected.has(i))
    const useStrategy = existingCount > 0 ? strategy : 'replace'
    importGuests(chosen, useStrategy)
    addToast({
      type: 'success',
      message: `${chosen.length} ${chosen.length === 1 ? 'guest' : 'guests'} imported.`,
    })
    closeModal()
  }

  const next = () => (isLastStep ? finish() : setStepIndex((i) => i + 1))
  const back = () => setStepIndex((i) => Math.max(0, i - 1))

  const setField = (key, value) => setMapping((m) => ({ ...m, [key]: value || null }))
  const toggleComing = (v) =>
    setComingValues((cv) => (cv.includes(v) ? cv.filter((x) => x !== v) : [...cv, v]))
  const toggleRow = (i) =>
    setDeselected((d) => {
      const n = new Set(d)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  return (
    <Modal
      title="Import guests"
      size="lg"
      onClose={closeModal}
      footer={
        <div className={styles.footer}>
          <span className={styles.stepCount}>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <div className={styles.footerActions}>
            {stepIndex > 0 && (
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
            )}
            <Button variant="primary" disabled={!canNext} onClick={next}>
              {isLastStep ? `Import ${importCount} ${importCount === 1 ? 'guest' : 'guests'}` : 'Next'}
            </Button>
          </div>
        </div>
      }
    >
      {step === 'upload' && (
        <div className={styles.step}>
          <div
            className={clsx(styles.dropzone, dragOver && styles.dragOver)}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files[0])
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="u-visually-hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <Icon name="upload" size={28} className={styles.dropIcon} />
            <p className={styles.dropTitle}>
              {uploading ? 'Reading…' : 'Drag a CSV here, or click to browse'}
            </p>
            <p className={styles.dropHint}>.csv files only</p>
          </div>
          {parsed && (
            <div className={styles.fileInfo}>
              <Icon name="check" size={16} className={styles.fileOk} />
              <span className={styles.fileName}>{parsed.filename}</span>
              <span className={styles.fileMeta}>
                {parsed.rowCount} {parsed.rowCount === 1 ? 'row' : 'rows'} ·{' '}
                {parsed.headers.length} columns
              </span>
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {step === 'map' && parsed && (
        <div className={styles.step}>
          <div className={styles.mapGrid}>
            {FIELDS.map((f) => {
              const unmatched = !mapping[f.key]
              return (
                <label key={f.key} className={styles.mapRow}>
                  <span className={styles.mapLabel}>
                    {f.label}
                    {f.required && <span className={styles.req}> *</span>}
                  </span>
                  <select
                    className={clsx(
                      styles.select,
                      f.required && unmatched && styles.selectError
                    )}
                    value={mapping[f.key] || ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    <option value="">— Not mapped —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>

          {!mapping.firstName && (
            <p className={styles.error}>
              We couldn&rsquo;t find a column for First name. Please select one above.
            </p>
          )}

          {mapping.rsvp && rsvpValues.length > 0 && (
            <div className={styles.comingBlock}>
              <p className={styles.subLabel}>Which values mean &ldquo;coming&rdquo;?</p>
              <div className={styles.chips}>
                {rsvpValues.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={clsx(styles.chip, comingValues.includes(v) && styles.chipActive)}
                    onClick={() => toggleComing(v)}
                  >
                    {comingValues.includes(v) && <Icon name="check" size={12} />}
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.previewWrap}>
            <p className={styles.subLabel}>Preview · first {Math.min(5, parsed.rows.length)} rows</p>
            <div className={styles.tableScroll}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    {parsed.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {parsed.headers.map((h) => (
                        <td key={h}>{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className={styles.step}>
          <p className={styles.importLine}>
            Importing <strong>{importCount}</strong> {importCount === 1 ? 'guest' : 'guests'}.
            {notComingCount > 0 && (
              <span className={styles.muted}>
                {' '}
                {notComingCount} declined or pending {notComingCount === 1 ? 'guest is' : 'guests are'}{' '}
                not shown.
              </span>
            )}
          </p>
          <div className={styles.tableScroll}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th className={styles.checkCol}></th>
                  <th>Name</th>
                  <th>Side</th>
                  <th>Dietary</th>
                </tr>
              </thead>
              <tbody>
                {confirmedGuests.map((g, i) => {
                  const diet = g.dietary ? dietaryMeta(g.dietary) : null
                  const included = !deselected.has(i)
                  return (
                    <tr
                      key={i}
                      className={clsx(!included && styles.rowExcluded)}
                      onClick={() => toggleRow(i)}
                    >
                      <td className={styles.checkCol}>
                        <span className={clsx(styles.check, included && styles.checkOn)}>
                          {included && <Icon name="check" size={12} />}
                        </span>
                      </td>
                      <td>{g.fullName}</td>
                      <td className={styles.muted}>{SIDE_LABEL[g.side] || '—'}</td>
                      <td>{diet ? diet.label : <span className={styles.muted}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'merge' && (
        <div className={styles.step}>
          <p className={styles.importLine}>
            You already have {existingCount} guests. How should we merge?
          </p>
          <div className={styles.strategyList}>
            {[
              {
                value: 'update',
                title: 'Update existing guests',
                desc: 'Match by email then name, refresh their details, and add anyone new. Keeps seating.',
              },
              {
                value: 'add',
                title: 'Add new only',
                desc: 'Skip guests that already exist; only add people not in your list.',
              },
              {
                value: 'replace',
                title: 'Replace all guests',
                desc: 'Remove the current guest list and start fresh. Clears groups and seating.',
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={clsx(styles.strategy, strategy === opt.value && styles.strategyActive)}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={opt.value}
                  checked={strategy === opt.value}
                  onChange={() => setStrategy(opt.value)}
                />
                <span>
                  <span className={styles.strategyTitle}>{opt.title}</span>
                  <span className={styles.strategyDesc}>{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
