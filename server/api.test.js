import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let app
let dir

beforeAll(async () => {
  // Isolate persistence in a throwaway temp dir.
  dir = mkdtempSync(join(tmpdir(), 'tableaux-test-'))
  process.env.TABLEAUX_DATA_DIR = dir
  const indexMod = await import('./index.js')
  const { ensureState } = await import('./lib/persistence.js')
  await ensureState()
  app = indexMod.createApp()
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.TABLEAUX_DATA_DIR
})

describe('health & state', () => {
  it('GET /api/health is ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('GET /api/state returns a seeded document', async () => {
    const res = await request(app).get('/api/state')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('guests')
    expect(res.body).toHaveProperty('settings')
  })

  it('POST /api/state round-trips and stamps updatedAt', async () => {
    const doc = {
      meta: { weddingName: 'Round Trip' },
      guests: {},
      groups: {},
      tables: {},
      zones: {},
      room: { width: 1200, height: 900 },
      canvas: { zoom: 1, panX: 0, panY: 0 },
      snapshots: [],
      settings: {},
    }
    const res = await request(app).post('/api/state').send(doc)
    expect(res.status).toBe(200)
    expect(res.body.meta.weddingName).toBe('Round Trip')
    expect(res.body.meta.updatedAt).toBeTruthy()

    const get = await request(app).get('/api/state')
    expect(get.body.meta.weddingName).toBe('Round Trip')
  })

  it('POST /api/state rejects a non-object body', async () => {
    const res = await request(app).post('/api/state').send([1, 2, 3])
    expect(res.status).toBe(400)
  })
})

describe('upload', () => {
  it('POST /api/upload/csv parses an uploaded file', async () => {
    const csv = 'First Name,Last Name,Attending\nEmma,Clarke,Yes\nJohn,Doe,No\n'
    const res = await request(app)
      .post('/api/upload/csv')
      .attach('file', Buffer.from(csv), 'guests.csv')
    expect(res.status).toBe(200)
    expect(res.body.rowCount).toBe(2)
    expect(res.body.headers).toContain('First Name')
    expect(res.body.rows[0]).toMatchObject({ 'First Name': 'Emma' })
  })

  it('rejects a missing file', async () => {
    const res = await request(app).post('/api/upload/csv')
    expect(res.status).toBe(400)
  })
})

describe('snapshots', () => {
  it('creates, lists (metadata only), and deletes', async () => {
    const created = await request(app).post('/api/snapshots').send({ name: 'Snap 1' })
    expect(created.status).toBe(201)
    expect(created.body).toHaveLength(1)
    expect(created.body[0]).not.toHaveProperty('state')
    const id = created.body[0].id

    const list = await request(app).get('/api/snapshots')
    expect(list.body).toHaveLength(1)

    const del = await request(app).delete(`/api/snapshots/${id}`)
    expect(del.status).toBe(200)
    expect(del.body).toHaveLength(0)
  })
})

describe('export & 404', () => {
  it('GET /api/export/csv returns a CSV with the expected header', async () => {
    const res = await request(app).get('/api/export/csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text.split(/\r?\n/)[0]).toBe('Table,Seat,Guest,Side,RSVP,Dietary,Group,Notes')
  })

  it('unknown /api routes return a 404 JSON error', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })
})
