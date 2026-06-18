/**
 * Fetch helpers for the PUBLIC, token-based share endpoints. Deliberately
 * carries NO auth headers — these pages are viewed by guests without an
 * account, and the token in the URL is the only credential.
 */
const BASE = import.meta.env.VITE_API_BASE || '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const publicApi = {
  shareMeta: (token) => get(`/share/${encodeURIComponent(token)}`),
  shareDoc: (token) => get(`/share/${encodeURIComponent(token)}/doc`),
  findSeat: (token, q) =>
    get(`/share/${encodeURIComponent(token)}/find?q=${encodeURIComponent(q)}`),
}
