import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Auth (and the multi-tenant /api/plans backend) is enabled only when Supabase
 * is configured. Otherwise the app runs in legacy, no-login local mode against
 * the file-based /api/state — handy for offline dev and tests.
 */
export const authEnabled = !!(url && anonKey)

export const supabase = authEnabled
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** The current access token (or null), used to authorize API calls. */
export async function getAccessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── Dev-only auth bypass ─────────────────────────────────────────────────────
// `import.meta.env.DEV` is statically false in production builds, so everything
// guarded by it is dead-code-eliminated — the bypass can never ship.
export const isDev = import.meta.env.DEV

/** When true, the login screen is skipped automatically on load (dev only). */
export const devAuthBypass = isDev && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

/**
 * Sign into a fixed local dev account, creating it on first use. This uses the
 * real auth + RLS path (it just skips typing credentials), so the rest of the
 * app behaves exactly as it will in production. Dev only.
 */
export async function devSignIn() {
  if (!isDev || !supabase) throw new Error('Dev sign-in is not available')
  const email = import.meta.env.VITE_DEV_USER_EMAIL || 'dev@tableaux.local'
  const password = import.meta.env.VITE_DEV_USER_PASSWORD || 'devpassword123'
  let res = await supabase.auth.signInWithPassword({ email, password })
  if (res.error) {
    await supabase.auth.signUp({ email, password })
    res = await supabase.auth.signInWithPassword({ email, password })
  }
  if (res.error) throw res.error
  return res.data
}
