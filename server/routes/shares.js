import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { makeShareToken } from '../lib/ids.js'

const router = Router()
router.use(requireAuth)

const COLUMNS =
  'id, plan_id, token, scope, source, snapshot_id, label, show_dietary, expires_at, revoked_at, view_count, last_viewed_at, created_at'

const MAX_ACTIVE_SHARES = 25

// GET /api/shares?planId=:id — the caller's share links for a plan.
router.get('/', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const planId = req.query.planId
    if (!planId) return res.status(400).json({ error: 'planId is required' })
    const { data, error } = await supabase
      .from('plan_shares')
      .select(COLUMNS)
      .eq('owner_id', user.id)
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (e) {
    next(e)
  }
})

// POST /api/shares — create a share link for one of the caller's plans.
router.post('/', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const { planId, scope = 'view', source = 'live', snapshotId = null } = req.body || {}
    if (!planId) return res.status(400).json({ error: 'planId is required' })
    if (!['view', 'find-seat'].includes(scope)) {
      return res.status(400).json({ error: 'Invalid scope' })
    }
    if (!['live', 'snapshot'].includes(source)) {
      return res.status(400).json({ error: 'Invalid source' })
    }
    const label = (req.body?.label || '').toString().trim().slice(0, 120)
    const showDietary = !!req.body?.showDietary
    const expiresInDays = Number(req.body?.expiresInDays)
    const expires_at =
      Number.isFinite(expiresInDays) && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
        : null

    // Cap active (non-revoked) shares per owner to deter token farming.
    const active = await supabase
      .from('plan_shares')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .is('revoked_at', null)
    if (!active.error && (active.count || 0) >= MAX_ACTIVE_SHARES) {
      return res.status(429).json({ error: 'Too many active share links. Revoke some first.' })
    }

    const { data, error } = await supabase
      .from('plan_shares')
      .insert({
        plan_id: planId,
        owner_id: user.id,
        token: makeShareToken(),
        scope,
        source,
        snapshot_id: source === 'snapshot' ? snapshotId : null,
        label,
        show_dietary: showDietary,
        expires_at,
      })
      .select(COLUMNS)
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (e) {
    next(e)
  }
})

// PATCH /api/shares/:id — revoke / relabel / change expiry.
router.patch('/:id', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const patch = {}
    if (req.body?.revoked === true) patch.revoked_at = new Date().toISOString()
    if (req.body?.revoked === false) patch.revoked_at = null
    if (typeof req.body?.label === 'string') patch.label = req.body.label.slice(0, 120)
    if ('expiresAt' in (req.body || {})) patch.expires_at = req.body.expiresAt || null
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' })

    const { data, error } = await supabase
      .from('plan_shares')
      .update(patch)
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
      .select(COLUMNS)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Share not found' })
    res.json(data)
  } catch (e) {
    next(e)
  }
})

// DELETE /api/shares/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const { error } = await supabase
      .from('plan_shares')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', user.id)
    if (error) throw error
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
