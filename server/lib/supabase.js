import { createClient } from '@supabase/supabase-js'

const url = () => process.env.SUPABASE_URL
const anonKey = () => process.env.SUPABASE_ANON_KEY
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY

/** True when the Supabase-backed (multi-tenant SaaS) path is configured. */
export const supabaseConfigured = () => !!(url() && anonKey())

/**
 * A Supabase client scoped to a single end-user's access token. Every PostgREST
 * query it makes runs under that user's Row-Level Security context, so the
 * database — not application code — enforces tenant isolation.
 */
export function userClient(accessToken) {
  return createClient(url(), anonKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * Service-role client — BYPASSES RLS. Server-only, for admin/maintenance tasks.
 * The service key must never be sent to the browser.
 */
export function serviceClient() {
  if (!serviceKey()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url(), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
