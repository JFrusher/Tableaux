import { getTableGeometry, DEFAULT_PPU } from './seatPositions.js'

/**
 * Build a to-scale SVG of the room, zones and tables from a plain plan `doc`
 * (no store, no React) so it can be reused by the PDF exporter and the
 * read-only public viewer. Uses the same getTableGeometry the editor uses, so
 * the printed plan matches the screen.
 */

const escAttr = (s) =>
  String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])

function shapePath(geom) {
  if (geom.shape === 'circle') return `<circle cx="0" cy="0" r="${geom.radius}" />`
  if (geom.shape === 'rect') {
    const rx = geom.rounded ? 14 : 6
    return `<rect x="${-geom.width / 2}" y="${-geom.height / 2}" width="${geom.width}" height="${geom.height}" rx="${rx}" />`
  }
  return `<path d="M ${-geom.radius} ${geom.cy} A ${geom.radius} ${geom.radius} 0 0 1 ${geom.radius} ${geom.cy} Z" />`
}

export function buildFloorPlanSvg(doc, { ppu, showSeats = true } = {}) {
  const settings = doc.settings || {}
  const scale = ppu || settings.pixelsPerUnit || DEFAULT_PPU
  const tables = Object.values(doc.tables || {})
  const zones = Object.values(doc.zones || {})
  const room = doc.room || {}
  const roomW = (room.widthUnits ? room.widthUnits * scale : room.width) || 1200
  const roomH = (room.heightUnits ? room.heightUnits * scale : room.height) || 900

  // Multi-room: render each floor space; fall back to a single rect for old docs.
  const spaces =
    Array.isArray(room.spaces) && room.spaces.length
      ? room.spaces
      : [{ shape: 'rect', x: 0, y: 0, width: roomW, height: roomH, backgroundColour: '#FAF8F5' }]
  const joins = Array.isArray(room.joins) ? room.joins : []
  const spaceBox = (sp) =>
    sp.shape === 'polygon'
      ? {
          minX: Math.min(...sp.vertices.map((v) => sp.x + v.x)),
          minY: Math.min(...sp.vertices.map((v) => sp.y + v.y)),
          maxX: Math.max(...sp.vertices.map((v) => sp.x + v.x)),
          maxY: Math.max(...sp.vertices.map((v) => sp.y + v.y)),
        }
      : { minX: sp.x, minY: sp.y, maxX: sp.x + sp.width, maxY: sp.y + sp.height }

  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  spaces.forEach((sp) => {
    const b = spaceBox(sp)
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  })

  const geoms = tables.map((t) => {
    const g = getTableGeometry(t, scale)
    const rad = ((t.rotation || 0) * Math.PI) / 180
    const hw = g.width / 2 + 24
    const hh = g.height / 2 + 24
    const ex = Math.abs(hw * Math.cos(rad)) + Math.abs(hh * Math.sin(rad))
    const ey = Math.abs(hw * Math.sin(rad)) + Math.abs(hh * Math.cos(rad))
    minX = Math.min(minX, t.x - ex)
    maxX = Math.max(maxX, t.x + ex)
    minY = Math.min(minY, t.y - ey)
    maxY = Math.max(maxY, t.y + ey)
    return { t, g }
  })

  const pad = 32
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  const W = Math.max(1, maxX - minX)
  const H = Math.max(1, maxY - minY)

  const parts = []
  // Floor spaces (rectangles + polygons).
  spaces.forEach((sp) => {
    const fill = sp.backgroundColour || '#FAF8F5'
    if (sp.shape === 'polygon') {
      const pts = sp.vertices.map((v) => `${sp.x + v.x},${sp.y + v.y}`).join(' ')
      parts.push(`<polygon points="${pts}" fill="${fill}" stroke="#D8CCBE" stroke-width="2"/>`)
    } else {
      parts.push(
        `<rect x="${sp.x}" y="${sp.y}" width="${sp.width}" height="${sp.height}" rx="14" fill="${fill}" stroke="#D8CCBE" stroke-width="2"/>`
      )
    }
  })
  // Join bridges: cover touching borders so joined spaces read as one floor.
  joins.forEach((j) => {
    const a = spaces.find((s) => s.id === j.a)
    const b = spaces.find((s) => s.id === j.b)
    if (!a || !b) return
    const ba = spaceBox(a)
    const bb = spaceBox(b)
    const x1 = Math.max(ba.minX, bb.minX) - 2
    const y1 = Math.max(ba.minY, bb.minY) - 2
    const x2 = Math.min(ba.maxX, bb.maxX) + 2
    const y2 = Math.min(ba.maxY, bb.maxY) + 2
    if (x2 > x1 && y2 > y1) {
      parts.push(
        `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="${a.backgroundColour || '#FAF8F5'}"/>`
      )
    }
  })
  zones.forEach((z) => {
    if (z.shape === 'circle') {
      parts.push(
        `<ellipse cx="${z.x + z.width / 2}" cy="${z.y + z.height / 2}" rx="${z.width / 2}" ry="${z.height / 2}" fill="#0000000a" stroke="#bbb" stroke-dasharray="6 4"/>`
      )
    } else {
      parts.push(
        `<rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" fill="#0000000a" stroke="#bbb" stroke-dasharray="6 4"/>`
      )
    }
    parts.push(`<text x="${z.x + 8}" y="${z.y + 18}" font-size="13" fill="#999">${escAttr(z.label)}</text>`)
  })

  geoms.forEach(({ t, g }) => {
    const rot = t.rotation || 0
    const tint = t.colour || '#ffffff'
    const opacity = t.colour ? 0.25 : 1
    const seatsSvg = showSeats
      ? g.seats.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="6" fill="#fff" stroke="#bbb" stroke-width="1"/>`).join('')
      : ''
    parts.push(
      `<g transform="translate(${t.x} ${t.y}) rotate(${rot})">` +
        `<g fill="${tint}" fill-opacity="${opacity}" stroke="#999" stroke-width="1.5">${shapePath(g)}</g>` +
        seatsSvg +
        `</g>`
    )
    // Labels are drawn upright (outside the rotated group) so they stay readable.
    parts.push(
      `<text x="${t.x}" y="${t.y + 4}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${escAttr(t.label)}</text>`
    )
  })

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}">` +
    parts.join('') +
    `</svg>`
  return { svg, width: W, height: H }
}
