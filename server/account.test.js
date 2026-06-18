import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import request from 'supertest'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '.env') })

const { createApp } = await import('./index.js')

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
const d = hasSupabase ? describe : describe.skip

async function signUp(email) {
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: created, error } = await anon.auth.signUp({ email, password: 'password123' })
  if (error) throw error
  // Email confirmation is required (the server 403s unverified users), so
  // confirm the new account via the admin API before signing in for the test.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && created.user) {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await admin.auth.admin.updateUserById(created.user.id, { email_confirm: true })
  }
  const signedIn = await anon.auth.signInWithPassword({ email, password: 'password123' })
  if (signedIn.error) throw signedIn.error
  return signedIn.data.session.access_token
}

d('account lifecycle — plan delete, data export, account delete', () => {
  let app
  let token
  const stamp = Date.now()
  const auth = (t) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => {
    app = createApp()
    token = await signUp(`acc_${stamp}@example.com`)
  }, 30000)

  it('exports the caller’s own data', async () => {
    await request(app).get('/api/plans/current').set(auth(token)) // ensure a plan exists
    const res = await request(app).get('/api/account/export').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.plans)).toBe(true)
    expect(res.body.plans.length).toBeGreaterThanOrEqual(1)
    expect(res.body.account.email).toContain('acc_')
  })

  it('deletes a plan', async () => {
    const cur = await request(app).get('/api/plans/current').set(auth(token))
    const del = await request(app).delete(`/api/plans/${cur.body.id}`).set(auth(token))
    expect(del.status).toBe(204)
  })

  it('deletes the account (cascades), invalidating the session', async () => {
    const del = await request(app).delete('/api/account').set(auth(token))
    expect(del.status).toBe(204)
    // The user is gone; the token no longer resolves to a user.
    const after = await request(app).get('/api/account/export').set(auth(token))
    expect(after.status).toBe(401)
  })
})
