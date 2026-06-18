import { Router } from 'express'
import multer from 'multer'
import { parseCsv } from '../lib/csv.js'
import { LIMITS } from '../lib/planSchema.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB — a 5000-row guest CSV is well under 1 MB
  fileFilter: (req, file, cb) => {
    // Accept the real CSV content types, plus a .csv extension fallback for
    // browsers that send a blank/odd type. Generic application/octet-stream is
    // deliberately NOT accepted — it would wave through arbitrary binaries.
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    if (ok) cb(null, true)
    else cb(Object.assign(new Error('Only .csv files are accepted'), { status: 400 }))
  },
})

// POST /api/upload/csv — parse an uploaded CSV into headers + row objects.
// Column mapping and normalisation happen client-side in the import flow.
router.post('/csv', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('No file uploaded'), { status: 400 })
    }
    const text = req.file.buffer.toString('utf8')
    const { headers, rows } = parseCsv(text)
    // Content validation (not just extension/MIME): reject implausible files.
    if (rows.length > LIMITS.guests) {
      throw Object.assign(
        new Error(`That file has ${rows.length} rows — the maximum is ${LIMITS.guests} guests.`),
        { status: 400 }
      )
    }
    res.json({
      filename: req.file.originalname,
      headers,
      rows,
      rowCount: rows.length,
    })
  } catch (e) {
    next(e)
  }
})

export default router
