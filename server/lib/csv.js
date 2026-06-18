/**
 * A small, dependency-free CSV reader/writer. Handles quoted fields,
 * escaped quotes (""), embedded commas/newlines, and CRLF or LF endings.
 */

export function parseCsv(text) {
  const clean = String(text).replace(/^\uFEFF/, '') // strip BOM
  const rows = []
  let field = ''
  let record = []
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n') {
      record.push(field)
      rows.push(record)
      record = []
      field = ''
    } else if (ch === '\r') {
      // swallow; \r\n handled by the \n branch
    } else {
      field += ch
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    rows.push(record)
  }

  if (rows.length === 0) return { headers: [], rows: [] }

  const headers = rows[0].map((h) => h.trim())
  const dataRows = rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== '')) // skip blank lines
    .map((r) => {
      const obj = {}
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim()
      })
      return obj
    })

  return { headers, rows: dataRows }
}

// Cells beginning with these characters can be executed as formulas by Excel /
// Google Sheets. Prefixing with a quote neutralises the injection.
const FORMULA_LEAD = /^[=+\-@\t\r]/

export function toCsv(headers, rows) {
  const esc = (v) => {
    let s = v == null ? '' : String(v)
    if (FORMULA_LEAD.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = headers.map(esc).join(',')
  const body = rows.map((row) => row.map(esc).join(',')).join('\r\n')
  return `${head}\r\n${body}${body ? '\r\n' : ''}`
}
