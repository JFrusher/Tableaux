import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validatePlanDoc } from '../lib/planSchema.js'

const router = Router()
router.use(requireAuth)

const COLUMNS = 'id, name, doc, rev, updated_at'

// GET /api/plans/current — the caller's plan, creating an empty one on first use.
router.get('/current', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const found = await supabase
      .from('plans')
      .select(COLUMNS)
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (found.error) throw found.error

    if (found.data) return res.json(found.data)

    const created = await supabase
      .from('plans')
      .insert({ owner_id: user.id })
      .select(COLUMNS)
      .single()
    if (created.error) throw created.error
    res.status(201).json(created.data)
  } catch (e) {
    next(e)
  }
})

// PUT /api/plans/:id — optimistic-concurrency update of the plan document.
// The client sends the `rev` it last read; a mismatch (someone else saved in
// between) returns 409 instead of silently clobbering their changes.
router.put('/:id', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const { doc, rev } = req.body || {}
    if (!Number.isInteger(rev)) {
      return res.status(400).json({ error: 'A numeric rev is required for concurrency control' })
    }
    const cleanDoc = validatePlanDoc(doc)

    const { data, error } = await supabase
      .from('plans')
      .update({ doc: cleanDoc })
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
      .eq('rev', rev)
      .select(COLUMNS)
      .maybeSingle()
    if (error) throw error
    if (data) return res.json(data)

    // No row updated: either it isn't the caller's plan, or the rev was stale.
    const exists = await supabase
      .from('plans')
      .select('rev')
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!exists.data) return res.status(404).json({ error: 'Plan not found' })
    return res
      .status(409)
      .json({ error: 'This plan changed since you loaded it. Reload before saving.', rev: exists.data.rev })
  } catch (e) {
    next(e)
  }
})

// DELETE /api/plans/:id — delete a plan (snapshots + shares cascade via FK).
router.delete('/:id', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
    if (error) throw error
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

// ── snapshots (stored in their own table, not inside the plan document) ──────
const MAX_SNAPSHOTS = 20
const SNAP_COLUMNS = 'id, name, created_at'

// GET /api/plans/:id/snapshots — metadata list (no doc blobs).
router.get('/:id/snapshots', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const { data, error } = await supabase
      .from('plan_snapshots')
      .select(SNAP_COLUMNS)
      .eq('plan_id', req.params.id)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (e) {
    next(e)
  }
})

// POST /api/plans/:id/snapshots — capture the plan's current document.
router.post('/:id/snapshots', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const name = (req.body?.name || '').toString().trim().slice(0, 120) || 'Untitled snapshot'

    const plan = await supabase
      .from('plans')
      .select('doc')
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (plan.error) throw plan.error
    if (!plan.data) return res.status(404).json({ error: 'Plan not found' })

    const created = await supabase
      .from('plan_snapshots')
      .insert({ plan_id: req.params.id, owner_id: user.id, name, doc: plan.data.doc })
      .select(SNAP_COLUMNS)
      .single()
    if (created.error) throw created.error

    // Trim to the most recent MAX_SNAPSHOTS.
    const all = await supabase
      .from('plan_snapshots')
      .select('id')
      .eq('plan_id', req.params.id)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (!all.error && all.data.length > MAX_SNAPSHOTS) {
      const stale = all.data.slice(MAX_SNAPSHOTS).map((s) => s.id)
      await supabase.from('plan_snapshots').delete().in('id', stale)
    }
    res.status(201).json(created.data)
  } catch (e) {
    next(e)
  }
})

// POST /api/plans/:id/snapshots/:snapId/restore — overwrite the plan with a snapshot.
router.post('/:id/snapshots/:snapId/restore', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const snap = await supabase
      .from('plan_snapshots')
      .select('doc')
      .eq('id', req.params.snapId)
      .eq('plan_id', req.params.id)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (snap.error) throw snap.error
    if (!snap.data) return res.status(404).json({ error: 'Snapshot not found' })

    const updated = await supabase
      .from('plans')
      .update({ doc: snap.data.doc })
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
      .select(COLUMNS)
      .maybeSingle()
    if (updated.error) throw updated.error
    if (!updated.data) return res.status(404).json({ error: 'Plan not found' })
    res.json(updated.data)
  } catch (e) {
    next(e)
  }
})

// DELETE /api/plans/:id/snapshots/:snapId
router.delete('/:id/snapshots/:snapId', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const { error } = await supabase
      .from('plan_snapshots')
      .delete()
      .eq('id', req.params.snapId)
      .eq('plan_id', req.params.id)
      .eq('owner_id', user.id)
    if (error) throw error
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
