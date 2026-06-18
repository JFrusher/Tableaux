import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore.js'
import { validatePlanDoc } from '../../../server/lib/planSchema.js'

const s = () => useStore.getState()

describe('multi-room spaces', () => {
  beforeEach(() => {
    // A legacy single-rect room (no `spaces`) — exercises the migration.
    s().hydrate({ room: { width: 1000, height: 800, backgroundColour: '#FAF8F5' } })
  })

  it('migrates a legacy rectangle room into one rect space', () => {
    const spaces = s().room.spaces
    expect(Array.isArray(spaces)).toBe(true)
    expect(spaces).toHaveLength(1)
    expect(spaces[0].shape).toBe('rect')
    expect(spaces[0].width).toBeGreaterThan(0)
    expect(s().room.joins).toEqual([])
  })

  it('adds and removes spaces, keeping at least one', () => {
    const cmd = s().addSpace({ x: 80, y: 80, width: 300, height: 200 })
    const id = cmd.meta.newSpaceId
    expect(s().room.spaces).toHaveLength(2)
    const added = s().room.spaces.find((sp) => sp.id === id)
    expect(added).toMatchObject({ x: 80, y: 80, width: 300, height: 200, shape: 'rect' })

    s().removeSpace(id)
    expect(s().room.spaces).toHaveLength(1)

    // Refuses to remove the final space.
    const last = s().room.spaces[0].id
    expect(s().removeSpace(last)).toBeFalsy()
    expect(s().room.spaces).toHaveLength(1)
  })

  it('toggles a join between two spaces and cleans it up on removal', () => {
    const a = s().room.spaces[0].id
    const b = s().addSpace({ x: 500, y: 0, width: 300, height: 200 }).meta.newSpaceId

    s().joinSpaces(a, b)
    expect(s().room.joins).toHaveLength(1)
    s().joinSpaces(a, b) // toggle off
    expect(s().room.joins).toHaveLength(0)

    // A join is dropped when one of its spaces is removed.
    s().joinSpaces(a, b)
    s().removeSpace(b)
    expect(s().room.joins).toHaveLength(0)
  })

  it('resizes a rectangle space and undoes', () => {
    const id = s().addSpace({ x: 0, y: 0, width: 300, height: 200 }).meta.newSpaceId
    s().resizeSpace(id, { width: 500, height: 350 })
    let sp = s().room.spaces.find((x) => x.id === id)
    expect(sp).toMatchObject({ width: 500, height: 350 })
    s().undo()
    sp = s().room.spaces.find((x) => x.id === id)
    expect(sp).toMatchObject({ width: 300, height: 200 })
  })

  it('round-trips a polygon space through server validation', () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 150 },
      { x: 100, y: 220 },
    ]
    const id = s().addSpace({ shape: 'polygon', x: 300, y: 300, vertices: verts }).meta.newSpaceId

    const reloaded = validatePlanDoc(s().serialize())
    s().hydrate(reloaded)

    const poly = s().room.spaces.find((sp) => sp.id === id)
    expect(poly).toBeTruthy()
    expect(poly.shape).toBe('polygon')
    expect(poly.vertices).toEqual(verts)
    expect(poly.x).toBe(300)
  })
})
