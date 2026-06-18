import { describe, it, expect } from 'vitest'
import { applyPatch } from './undoMiddleware.js'

describe('applyPatch', () => {
  it('adds and replaces entities in a collection', () => {
    const state = { tables: { t1: { id: 't1', x: 0 } } }
    const update = applyPatch(state, { tables: { t2: { id: 't2' } } })
    expect(update.tables).toHaveProperty('t2')
    expect(update.tables).toHaveProperty('t1') // preserved
  })

  it('deletes an entity when the value is null', () => {
    const state = { tables: { t1: { id: 't1' }, t2: { id: 't2' } } }
    const update = applyPatch(state, { tables: { t1: null } })
    expect(update.tables).not.toHaveProperty('t1')
    expect(update.tables).toHaveProperty('t2')
  })

  it('shallow-merges singleton slices', () => {
    const update = applyPatch({ meta: { a: 1, b: 2 } }, { meta: { b: 3 } })
    expect(update.meta).toEqual({ a: 1, b: 3 })
  })

  it('replaces the constraints and snapshots arrays wholesale', () => {
    const update = applyPatch({ constraints: [1], snapshots: [9] }, { constraints: [2, 3] })
    expect(update.constraints).toEqual([2, 3])
    expect(update.snapshots).toBeUndefined() // untouched key not returned
  })

  it('never mutates the input state (inverses stay valid)', () => {
    const original = { tables: { t1: { id: 't1', x: 0 } } }
    const snapshot = JSON.stringify(original)
    applyPatch(original, { tables: { t1: { id: 't1', x: 99 }, t2: { id: 't2' } } })
    expect(JSON.stringify(original)).toBe(snapshot)
  })

  it('returns an empty update for a missing patch', () => {
    expect(applyPatch({}, null)).toEqual({})
  })
})
