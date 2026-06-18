import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import request from 'supertest'
import { createClient } from '@supabase/supabase-js'

// Load server/.env regardless of the working directory vitest runs from.
const here = dirname(fileURLToPath(import.meta.url))
config({ path: join(here, '.env') })

const { createApp } = await import('./index.js')

const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
// These tests need a running local Supabase (`npx supabase start`). They are
// skipped automatically when it isn't configured (e.g. plain CI).
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

d('plans API — auth, RLS isolation, concurrency, validation', () => {
  let app
  let tokenA
  let tokenB
  const stamp = Date.now()

  beforeAll(async () => {
    app = createApp()
    tokenA = await signUp(`a_${stamp}@example.com`)
    tokenB = await signUp(`b_${stamp}@example.com`)
  }, 30000)

  const auth = (t) => ({ Authorization: `Bearer ${t}` })

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/plans/current')
    expect(res.status).toBe(401)
  })

  it('creates and returns the caller’s own plan', async () => {
    const res = await request(app).get('/api/plans/current').set(auth(tokenA))
    expect([200, 201]).toContain(res.status)
    expect(res.body.id).toBeTruthy()
    expect(res.body.rev).toBe(0)
  })

  it('updates with the correct rev and bumps it; rejects a stale rev', async () => {
    const cur = await request(app).get('/api/plans/current').set(auth(tokenA))
    const { id, rev } = cur.body

    const ok = await request(app)
      .put(`/api/plans/${id}`)
      .set(auth(tokenA))
      .send({ rev, doc: { meta: { weddingName: 'Renamed' }, guests: {}, tables: {} } })
    expect(ok.status).toBe(200)
    expect(ok.body.rev).toBe(rev + 1)
    expect(ok.body.doc.meta.weddingName).toBe('Renamed')

    // Re-using the old rev must now fail with 409 (someone else moved on).
    const stale = await request(app)
      .put(`/api/plans/${id}`)
      .set(auth(tokenA))
      .send({ rev, doc: { guests: {}, tables: {} } })
    expect(stale.status).toBe(409)
  })

  it('isolates tenants: B cannot read or write A’s plan (RLS)', async () => {
    const aPlan = await request(app).get('/api/plans/current').set(auth(tokenA))
    const bPlan = await request(app).get('/api/plans/current').set(auth(tokenB))
    expect(bPlan.body.id).not.toBe(aPlan.body.id)

    const attack = await request(app)
      .put(`/api/plans/${aPlan.body.id}`)
      .set(auth(tokenB))
      .send({ rev: aPlan.body.rev, doc: { guests: {}, tables: {} } })
    expect(attack.status).toBe(404) // RLS hides A's row from B entirely
  })

  it('rejects an oversized document (entity cap)', async () => {
    const cur = await request(app).get('/api/plans/current').set(auth(tokenA))
    const guests = {}
    for (let i = 0; i < 5001; i++) guests[`g${i}`] = { id: `g${i}` }
    const res = await request(app)
      .put(`/api/plans/${cur.body.id}`)
      .set(auth(tokenA))
      .send({ rev: cur.body.rev, doc: { guests, tables: {} } })
    expect(res.status).toBe(400)
  })

  it('captures, lists, restores and deletes snapshots (table-backed, isolated)', async () => {
    const cur = await request(app).get('/api/plans/current').set(auth(tokenA))
    const id = cur.body.id

    await request(app)
      .put(`/api/plans/${id}`)
      .set(auth(tokenA))
      .send({ rev: cur.body.rev, doc: { meta: { weddingName: 'Snapshotted' }, guests: {}, tables: {} } })

    const snap = await request(app).post(`/api/plans/${id}/snapshots`).set(auth(tokenA)).send({ name: 'cp' })
    expect(snap.status).toBe(201)

    const after = await request(app).get('/api/plans/current').set(auth(tokenA))
    await request(app)
      .put(`/api/plans/${id}`)
      .set(auth(tokenA))
      .send({ rev: after.body.rev, doc: { meta: { weddingName: 'Changed' }, guests: {}, tables: {} } })

    const list = await request(app).get(`/api/plans/${id}/snapshots`).set(auth(tokenA))
    expect(list.body.length).toBeGreaterThanOrEqual(1)

    const restored = await request(app)
      .post(`/api/plans/${id}/snapshots/${snap.body.id}/restore`)
      .set(auth(tokenA))
    expect(restored.status).toBe(200)
    expect(restored.body.doc.meta.weddingName).toBe('Snapshotted')

    // Another tenant cannot snapshot A's plan.
    const attack = await request(app).post(`/api/plans/${id}/snapshots`).set(auth(tokenB)).send({ name: 'x' })
    expect(attack.status).toBe(404)

    const del = await request(app).delete(`/api/plans/${id}/snapshots/${snap.body.id}`).set(auth(tokenA))
    expect(del.status).toBe(204)
  })
})
