export const slug = (name) =>
  String(name || 'tableaux')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tableaux'

/** Trigger a browser download of `content`. */
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Export the full plan as a JSON file (re-importable / backup). */
export function exportJson(doc, name) {
  downloadFile(`${slug(name)}.json`, JSON.stringify(doc, null, 2), 'application/json')
}
