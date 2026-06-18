import { Router } from 'express'
import { readState, writeState } from '../lib/persistence.js'

const router = Router()

// GET /api/state — full plan
router.get('/', async (req, res, next) => {
  try {
    res.json(await readState())
  } catch (e) {
    next(e)
  }
})

// POST /api/state — replace the full plan, return what was saved
router.post('/', async (req, res, next) => {
  try {
    const incoming = req.body
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      const err = new Error('Request body must be a state object')
      err.status = 400
      throw err
    }
    const saved = await writeState(incoming)
    res.json(saved)
  } catch (e) {
    next(e)
  }
})

export default router
