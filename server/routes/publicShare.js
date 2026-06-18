import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { serviceClient, supabaseConfigured } from '../lib/supabase.js'
import { sanitizeDocForView, findGuestSeat } from '../lib/shareSanitize.js'

const router = Router()

// All public share endpoints require Supabase (they read via the service role).
router.use((req, res, next) => {
  if (!supabaseConfigured()) {
    return res.status(503).json({ error: 'Sharing is not configured on this server.' })
  }
  next()
})

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

// Resolve + validate a share by token. Returns the share row, or null for any
// invalid/expired/revoked case (callers respond with a uniform 404 so token
// state can't be probed).
async function resolveShare(token) {
  if (!TOKEN_RE.test(token || '')) return null
  const svc = serviceClient()
  const { data, error } = await svc
    .from('plan_shares')
    .select('id, plan_id, scope, source, snapshot_id, show_dietary, expires_at, revoked_at, view_count')
    .eq('token', token)
    .maybeSingle()
  if (error || !data) return null
  if (data.revoked_at) return null
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null
  return { svc, share: data }
}

// Load the shared plan document (live plan or a specific snapshot).
async function loadShareDoc(svc, share) {
  if (share.source === 'snapshot' && share.snapshot_id) {
    const snap = await svc
      .from('plan_snapshots')
      .select('doc, name')
      .eq('id', share.snapshot_id)
      .maybeSingle()
    return snap.data?.doc || null
  }
  const plan = await svc.from('plans').select('doc, name').eq('id', share.plan_id).maybeSingle()
  return plan.data?.doc || null
}

// Best-effort view stamp (read-modify-write; never blocks the response).
function bumpViews(svc, id, current = 0) {
  svc
    .from('plan_shares')
    .update({ view_count: (current || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('id', id)
    .then(() => {})
    .catch(() => {})
}

// GET /api/share/:token — metadata only (header + which UI to show).
router.get('/:token', async (req, res, next) => {
  try {
    const resolved = await resolveShare(req.params.token)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    const doc = await loadShareDoc(resolved.svc, resolved.share)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    bumpViews(resolved.svc, resolved.share.id, resolved.share.view_count)
    res.json({
      scope: resolved.share.scope,
      weddingName: doc.meta?.weddingName || '',
      venue: doc.meta?.venue || '',
      date: doc.meta?.date || '',
      expiresAt: resolved.share.expires_at,
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/share/:token/doc — sanitized read-only canvas document (view scope).
router.get('/:token/doc', async (req, res, next) => {
  try {
    const resolved = await resolveShare(req.params.token)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    if (resolved.share.scope !== 'view') {
      return res.status(403).json({ error: 'This link only supports seat lookup.' })
    }
    const doc = await loadShareDoc(resolved.svc, resolved.share)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(sanitizeDocForView(doc, { showDietary: resolved.share.show_dietary }))
  } catch (e) {
    next(e)
  }
})

// Stricter limiter on name search to cap enumeration attempts.
const findLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

// GET /api/share/:token/find?q=:name — single-guest seat lookup (both scopes).
router.get('/:token/find', findLimiter, async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString()
    if (q.trim().length < 2) return res.json({ matches: [] })
    const resolved = await resolveShare(req.params.token)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    const doc = await loadShareDoc(resolved.svc, resolved.share)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json({ matches: findGuestSeat(doc, q) })
  } catch (e) {
    next(e)
  }
})

export default router
