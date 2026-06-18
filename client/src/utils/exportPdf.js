import { buildFloorPlanSvg } from './floorPlanSvg.js'
import { buildAssignmentTable } from './exportCsv.js'
import { CARD_TEMPLATES } from './cardTemplates.js'
import { slug } from './exportJson.js'

// jsPDF + svg2pdf + autotable are heavy and only needed on export, so they are
// dynamically imported (kept out of the main bundle).
async function loadPdf() {
  const [{ jsPDF }, svg2pdfMod, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    import('jspdf-autotable'),
  ])
  return {
    jsPDF,
    svg2pdf: svg2pdfMod.svg2pdf || svg2pdfMod.default,
    autoTable: autoTableMod.default || autoTableMod.autoTable,
  }
}

const tableByLabel = (a, b) =>
  String(a.label).localeCompare(String(b.label), undefined, { numeric: true })

/** Seated guests in table → seat order, with their table label. */
function seatedGuests(doc) {
  const guests = doc.guests || {}
  const tables = doc.tables || {}
  const out = []
  Object.values(tables)
    .sort(tableByLabel)
    .forEach((t) => {
      for (const gid of (t.assignedGuestIds || []).filter(Boolean)) {
        const g = guests[gid]
        if (g) out.push({ name: g.fullName, table: t.label, lastName: g.lastName || g.fullName })
      }
    })
  return out
}

/** To-scale floor plan (page 1) + a per-table assignment sheet (page 2+). */
export async function exportFloorPlanPdf(doc, name, opts = {}) {
  const { jsPDF, svg2pdf, autoTable } = await loadPdf()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 36

  pdf.setFontSize(16)
  pdf.setTextColor(40)
  pdf.text(name || 'Seating plan', margin, margin)
  pdf.setFontSize(9)
  pdf.setTextColor(130)
  pdf.text('To-scale floor plan', margin, margin + 14)

  const { svg, width, height } = buildFloorPlanSvg(doc, opts)
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  const availW = pageW - margin * 2
  const availH = pageH - margin * 2 - 24
  const scale = Math.min(availW / width, availH / height)
  await svg2pdf(el, pdf, {
    x: margin + (availW - width * scale) / 2,
    y: margin + 24,
    width: width * scale,
    height: height * scale,
  })

  const { headers, rows } = buildAssignmentTable(doc)
  if (rows.length) {
    pdf.addPage('a4', 'portrait')
    pdf.setFontSize(14)
    pdf.setTextColor(40)
    pdf.text(`${name || 'Seating plan'} — assignments`, margin, margin)
    autoTable(pdf, {
      head: [headers],
      body: rows,
      startY: margin + 12,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [123, 111, 160] },
      margin: { left: margin, right: margin },
    })
  }

  pdf.save(`${slug(name)}-floor-plan.pdf`)
}

function renderCards(pdf, items, tpl) {
  const perPage = tpl.cols * tpl.rows
  items.forEach((item, i) => {
    const onPage = i % perPage
    if (i > 0 && onPage === 0) pdf.addPage()
    const col = onPage % tpl.cols
    const row = Math.floor(onPage / tpl.cols)
    const x = tpl.marginX + col * (tpl.cellW + tpl.gapX)
    const y = tpl.marginY + row * (tpl.cellH + tpl.gapY)

    pdf.setDrawColor(205)
    pdf.setLineWidth(0.2)
    pdf.rect(x, y, tpl.cellW, tpl.cellH)
    if (tpl.fold) {
      // dashed fold line across the middle for tent cards
      pdf.setLineDashPattern([2, 2], 0)
      pdf.line(x, y + tpl.cellH / 2, x + tpl.cellW, y + tpl.cellH / 2)
      pdf.setLineDashPattern([], 0)
    }

    const cx = x + tpl.cellW / 2
    const cy = y + (tpl.fold ? tpl.cellH * 0.75 : tpl.cellH / 2)
    pdf.setFontSize(tpl.kind === 'escort' ? 13 : 18)
    pdf.setTextColor(20)
    pdf.text(String(item.name), cx, cy - 2, { align: 'center' })
    pdf.setFontSize(tpl.kind === 'escort' ? 9 : 11)
    pdf.setTextColor(120)
    pdf.text(String(item.table), cx, cy + (tpl.kind === 'escort' ? 6 : 9), { align: 'center' })
  })
}

export async function exportCards(doc, name, templateId) {
  const tpl = CARD_TEMPLATES[templateId]
  if (!tpl) return
  const { jsPDF } = await loadPdf()
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [tpl.pageW, tpl.pageH] })

  let items = seatedGuests(doc)
  if (tpl.kind === 'escort') {
    items = [...items].sort((a, b) => String(a.lastName).localeCompare(String(b.lastName)))
  }
  if (!items.length) {
    items = [{ name: 'No seated guests yet', table: '' }]
  }

  renderCards(pdf, items, tpl)
  pdf.save(`${slug(name)}-${tpl.kind}-cards.pdf`)
}
