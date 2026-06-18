/**
 * Thin fetch wrappers for the Tableaux backend. In dev, requests go to the
 * relative `/api` path, which Vite proxies to http://localhost:3001 (see
 * vite.config.js). Override with VITE_API_BASE if hosting the API elsewhere.
 *
 * When Supabase auth is enabled, every request carries the user's access token
 * so the server can authorize it and scope it to that user's plan.
 */
import { getAccessToken } from './supabase.js'

const BASE = import.meta.env.VITE_API_BASE || '/api'

async function authHeaders() {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(options.headers || {}),
    },
    ...options,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    let body = null
    try {
      body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message)
    err.status = res.status
    err.body = body
    throw err
  }
  const contentType = res.headers.get('content-type') || ''
  return contentType.includes('application/json') ? res.json() : res.text()
}

export const api = {
  // Legacy single-tenant document (no auth).
  getState: () => request('/state'),
  saveState: (doc) => request('/state', { method: 'POST', body: JSON.stringify(doc) }),

  // Multi-tenant, auth + RLS backed plan (the SaaS path).
  loadPlan: () => request('/plans/current'),
  savePlan: (id, doc, rev) =>
    request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify({ doc, rev }) }),

  uploadCsv: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/upload/csv`, {
      method: 'POST',
      headers: { ...(await authHeaders()) },
      body: form,
    })
    if (!res.ok) {
      let message = `Upload failed (${res.status})`
      try {
        const body = await res.json()
        if (body?.error) message = body.error
      } catch {
        /* ignore */
      }
      throw new Error(message)
    }
    return res.json()
  },

  // Legacy (file-store) snapshots.
  listSnapshots: () => request('/snapshots'),
  saveSnapshot: (name) =>
    request('/snapshots', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteSnapshot: (id) => request(`/snapshots/${id}`, { method: 'DELETE' }),

  // SaaS (table-backed) snapshots, scoped to a plan + the authenticated owner.
  listPlanSnapshots: (planId) => request(`/plans/${planId}/snapshots`),
  createPlanSnapshot: (planId, name) =>
    request(`/plans/${planId}/snapshots`, { method: 'POST', body: JSON.stringify({ name }) }),
  restorePlanSnapshot: (planId, snapId) =>
    request(`/plans/${planId}/snapshots/${snapId}/restore`, { method: 'POST' }),
  deletePlanSnapshot: (planId, snapId) =>
    request(`/plans/${planId}/snapshots/${snapId}`, { method: 'DELETE' }),

  exportCsvUrl: () => `${BASE}/export/csv`,

  // Plan deletion + account lifecycle (GDPR).
  deletePlan: (id) => request(`/plans/${id}`, { method: 'DELETE' }),
  deleteAccount: () => request('/account', { method: 'DELETE' }),
  exportMyData: () => request('/account/export'),

  // Share links (auth: owner manages their own).
  listShares: (planId) => request(`/shares?planId=${encodeURIComponent(planId)}`),
  createShare: (payload) => request('/shares', { method: 'POST', body: JSON.stringify(payload) }),
  updateShare: (id, patch) =>
    request(`/shares/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteShare: (id) => request(`/shares/${id}`, { method: 'DELETE' }),
}
