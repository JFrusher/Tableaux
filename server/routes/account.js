import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { serviceClient } from '../lib/supabase.js'

const router = Router()
router.use(requireAuth)

// GET /api/account/export — download all of the caller's data (plans +
// snapshots) as a single JSON file. Uses the RLS-scoped client, so it can only
// ever return the caller's own rows.
router.get('/export', async (req, res, next) => {
  try {
    const { supabase, user } = req
    const plans = await supabase.from('plans').select('id, name, doc, rev, created_at, updated_at')
    if (plans.error) throw plans.error
    const snaps = await supabase
      .from('plan_snapshots')
      .select('id, plan_id, name, doc, created_at')
    if (snaps.error) throw snaps.error
    res.setHeader('Content-Disposition', 'attachment; filename="tableaux-my-data.json"')
    res.json({
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      plans: plans.data,
      snapshots: snaps.data,
    })
  } catch (e) {
    next(e)
  }
})

// DELETE /api/account — GDPR account deletion. Removing the auth user cascades
// to plans, snapshots and shares (all FK `on delete cascade`). This is the one
// request path that legitimately uses the service role, gated hard on the
// verified JWT identity (never anything from the request body).
router.delete('/', async (req, res, next) => {
  try {
    const userId = req.user.id
    const admin = serviceClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
