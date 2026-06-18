import { describe, it, expect, vi, beforeEach } from 'vitest'

// Run as if Supabase auth is configured, with a fixed token.
vi.mock('./supabase.js', () => ({
  authEnabled: true,
  getAccessToken: async () => 'test-token',
}))

const { api } = await import('./client.js')

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ id: 'p1', doc: {}, rev: 3 }),
  }))
})

describe('api client (auth mode)', () => {
  it('loadPlan GETs /plans/current with a bearer token', async () => {
    await api.loadPlan()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toMatch(/\/plans\/current$/)
    expect(opts.headers.Authorization).toBe('Bearer test-token')
  })

  it('savePlan PUTs the document + rev for optimistic concurrency', async () => {
    await api.savePlan('p1', { guests: {} }, 3)
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toMatch(/\/plans\/p1$/)
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toEqual({ doc: { guests: {} }, rev: 3 })
    expect(opts.headers.Authorization).toBe('Bearer test-token')
  })

  it('surfaces the HTTP status on error (so a 409 can be detected)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'stale' }),
    }))
    await expect(api.savePlan('p1', {}, 1)).rejects.toMatchObject({ status: 409 })
  })
})
