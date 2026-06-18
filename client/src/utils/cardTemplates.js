/**
 * Multi-up card layouts for printable place cards and escort cards. Dimensions
 * are in millimetres (jsPDF unit 'mm') against US Letter, with cut/fold guides
 * drawn so users can trim. Approximate Avery layouts — close enough to print
 * on standard perforated stock or to cut by hand.
 */
export const CARD_TEMPLATES = {
  'place-tent': {
    label: 'Place cards — tent fold (2 per page)',
    kind: 'place',
    pageW: 215.9,
    pageH: 279.4,
    marginX: 18,
    marginY: 24,
    cols: 1,
    rows: 2,
    cellW: 180,
    cellH: 110,
    gapX: 0,
    gapY: 12,
    fold: true,
  },
  'escort-10up': {
    label: 'Escort cards — 10 per page (Avery 5371)',
    kind: 'escort',
    pageW: 215.9,
    pageH: 279.4,
    marginX: 16,
    marginY: 12.7,
    cols: 2,
    rows: 5,
    cellW: 88.9,
    cellH: 50.8,
    gapX: 6,
    gapY: 0,
    fold: false,
  },
}

export const CARD_TEMPLATE_LIST = Object.entries(CARD_TEMPLATES).map(([id, t]) => ({ id, ...t }))
