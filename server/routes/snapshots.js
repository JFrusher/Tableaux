import { Router } from 'express'
import { readState, writeState } from '../lib/persistence.js'
import { makeId } from '../lib/ids.js'

const router = Router()

const MAX_SNAPSHOTS = 10

// Snapshot metadata without the (large) state blob.
const stripBlobs = (snaps = []) =>
  // eslint-disable-next-line no-unused-vars
  snaps.map(({ state, ...meta }) => meta)

// GET /api/snapshots — metadata list only
router.get('/', async (req, res, next) => {
  try {
    const state = await readState()
    res.json(stripBlobs(state.snapshots))
  } catch (e) {
    next(e)
  }
})

// POST /api/snapshots — capture a named point-in-time copy
router.post('/', async (req, res, next) => {
  try {
    const name = (req.body?.name || '').toString().trim() || 'Untitled snapshot'
    const state = await readState()
    // Clone everything except the snapshots array itself (avoids nesting blobs).
    // eslint-disable-next-line no-unused-vars
    const { snapshots: _existing, ...rest } = state
    const snap = {
      id: makeId('snap'),
      name,
      savedAt: new Date().toISOString(),
      state: rest,
    }
    const snapshots = [snap, ...(state.snapshots || [])].slice(0, MAX_SNAPSHOTS)
    await writeState({ ...state, snapshots })
    res.status(201).json(stripBlobs(snapshots))
  } catch (e) {
    next(e)
  }
})

// DELETE /api/snapshots/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const state = await readState()
    const snapshots = (state.snapshots || []).filter((s) => s.id !== req.params.id)
    await writeState({ ...state, snapshots })
    res.json(stripBlobs(snapshots))
  } catch (e) {
    next(e)
  }
})

export default router
