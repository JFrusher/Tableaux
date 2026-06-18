import { userClient, supabaseConfigured } from '../lib/supabase.js'

/**
 * Require a valid Supabase access token (Authorization: Bearer <jwt>).
 *
 * On success, attaches:
 *   - req.user      — the authenticated user (validated by GoTrue)
 *   - req.supabase  — a client scoped to that user, so every query it runs is
 *                     subject to Row-Level Security (defence in depth on top of
 *                     the explicit owner_id filters in the routes).
 */
export async function requireAuth(req, res, next) {
  try {
    if (!supabaseConfigured()) {
      return res.status(503).json({ error: 'Authentication is not configured on this server.' })
    }
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) return res.status(401).json({ error: 'Missing bearer token' })

    const supabase = userClient(token)
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    // Require a verified email before any data access. Supabase sets
    // email_confirmed_at once the user clicks the confirmation link; until then
    // the account exists but cannot read or write personal data.
    if (!data.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Email not verified' })
    }

    req.user = data.user
    req.supabase = supabase
    next()
  } catch (e) {
    next(e)
  }
}
