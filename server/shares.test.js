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

const planDoc = {
  meta: { weddingName: 'Test Wedding', venue: 'Barn', date: '2026-09-01' },
  guests: {
    g1: { id: 'g1', firstName: 'Jane', lastName: 'Doe', fullName: 'Jane Doe', email: 'jane@secret.com', notes: 'private', assignedTableId: 't1', side: 'bride' },
  },
  groups: {},
  tables: { t1: { id: 't1', label: 'Table 1', type: 'round', capacity: 8, seatMode: 'seat', assignedGuestIds: ['g1'] } },
  zones: {},
}

d('shares API — links, public read, sanitization, isolation', () => {
  let app
  let tokenA
  let tokenB
  let planId
  const stamp = Date.now()
  const auth = (t) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => {
    app = createApp()
    tokenA = await signUp(`sa_${stamp}@example.com`)
    tokenB = await signUp(`sb_${stamp}@example.com`)
    const cur = await request(app).get('/api/plans/current').set(auth(tokenA))
    planId = cur.body.id
    await request(app)
      .put(`/api/plans/${planId}`)
      .set(auth(tokenA))
      .send({ rev: cur.body.rev, doc: planDoc })
  }, 30000)

  it('creates a view share and lists it', async () => {
    const created = await request(app)
      .post('/api/shares')
      .set(auth(tokenA))
      .send({ planId, scope: 'view', label: 'Family' })
    expect(created.status).toBe(201)
    expect(created.body.token).toBeTruthy()
    expect(created.body.token.length).toBeGreaterThanOrEqual(24)

    const list = await request(app).get(`/api/shares?planId=${planId}`).set(auth(tokenA))
    expect(list.body.some((s) => s.id === created.body.id)).toBe(true)
  })

  it('serves a sanitized doc on the public view link (no PII)', async () => {
    const created = await request(app).post('/api/shares').set(auth(tokenA)).send({ planId, scope: 'view' })
    const token = created.body.token

    const meta = await request(app).get(`/api/share/${token}`)
    expect(meta.status).toBe(200)
    expect(meta.body.weddingName).toBe('Test Wedding')

    const doc = await request(app).get(`/api/share/${token}/doc`)
    expect(doc.status).toBe(200)
    const json = JSON.stringify(doc.body)
    expect(json).not.toContain('jane@secret.com')
    expect(json).not.toContain('private')
    expect(doc.body.guests.g1.fullName).toBe('Jane Doe')
  })

  it('find-seat returns only the matched guest and rejects /doc', async () => {
    const created = await request(app).post('/api/shares').set(auth(tokenA)).send({ planId, scope: 'find-seat' })
    const token = created.body.token

    const found = await request(app).get(`/api/share/${token}/find?q=jane`)
    expect(found.status).toBe(200)
    expect(found.body.matches).toHaveLength(1)
    expect(found.body.matches[0]).toMatchObject({ fullName: 'Jane Doe', tableLabel: 'Table 1', seatNumber: 1 })

    const blocked = await request(app).get(`/api/share/${token}/doc`)
    expect(blocked.status).toBe(403)
  })

  it('returns 404 for revoked, missing and malformed tokens', async () => {
    const created = await request(app).post('/api/shares').set(auth(tokenA)).send({ planId, scope: 'view' })
    await request(app).patch(`/api/shares/${created.body.id}`).set(auth(tokenA)).send({ revoked: true })
    expect((await request(app).get(`/api/share/${created.body.token}`)).status).toBe(404)
    expect((await request(app).get('/api/share/totally-made-up-token-xyz')).status).toBe(404)
    expect((await request(app).get('/api/share/!!')).status).toBe(404)
  })

  it("isolates tenants: B cannot list or revoke A's shares", async () => {
    const created = await request(app).post('/api/shares').set(auth(tokenA)).send({ planId, scope: 'view' })
    const bList = await request(app).get(`/api/shares?planId=${planId}`).set(auth(tokenB))
    expect(bList.body.find((s) => s.id === created.body.id)).toBeUndefined()
    const bRevoke = await request(app).patch(`/api/shares/${created.body.id}`).set(auth(tokenB)).send({ revoked: true })
    expect(bRevoke.status).toBe(404)
  })
})
