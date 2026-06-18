import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { pathToFileURL, fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env for the running server, but not under tests — the test suite sets
// its own environment per file, and auto-loading would leak config between them.
if (process.env.NODE_ENV !== 'test') dotenv.config()

import stateRoutes from './routes/state.js'
import uploadRoutes from './routes/upload.js'
import snapshotRoutes from './routes/snapshots.js'
import exportRoutes from './routes/export.js'
import planRoutes from './routes/plans.js'
import shareRoutes from './routes/shares.js'
import publicShareRoutes from './routes/publicShare.js'
import accountRoutes from './routes/account.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { ensureState } from './lib/persistence.js'
import { supabaseConfigured, serviceClient } from './lib/supabase.js'

const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
// Allowlist (comma-separated CLIENT_ORIGIN supports staging + prod domains).
const ALLOWED_ORIGINS = CLIENT_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function supabaseOrigin() {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null
  } catch {
    return null
  }
}

/** Build the Express app (no side effects) — also used by the test suite. */
export function createApp() {
  // Fail fast: never run a public production server on the unauthenticated
  // legacy file store. Misconfiguration here would expose everyone's data.
  if (process.env.NODE_ENV === 'production' && !supabaseConfigured()) {
    throw new Error(
      'Refusing to start in production without Supabase configured (SUPABASE_URL / SUPABASE_ANON_KEY).'
    )
  }

  const app = express()

  // Security headers + Content-Security-Policy. CORP is relaxed so a
  // separate-origin client can still read API responses; connect-src allows the
  // browser to reach Supabase (auth/db) and Sentry directly.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Disallow framing entirely (clickjacking) and trim the referrer to the
      // origin on cross-site navigations. HSTS is on by default and takes
      // effect once the app is served over HTTPS (behind Fly's TLS proxy).
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", supabaseOrigin(), 'https://*.sentry.io'].filter(Boolean),
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  )
  // Permissions-Policy isn't set by helmet — disable powerful features the app
  // never uses so a future XSS can't reach the camera/mic/location.
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    next()
  })
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / non-browser callers (no Origin header) and the allowlist.
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true)
        else cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
    })
  )
  // The plan document can be legitimately large (up to 5000 guests); everything
  // else is small. The plans parser runs first and marks the body parsed, so the
  // tighter global parser below skips it.
  app.use('/api/plans', express.json({ limit: '12mb' }))
  app.use(express.json({ limit: '256kb' }))

  // Lightweight request log (method, path, status, duration). Quiet in tests.
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api', (req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        console.log(
          `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${
            Date.now() - start
          }ms`
        )
      })
      next()
    })
  }

  // Coarse abuse protection. Generous enough for normal editing + auto-save.
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false })
  )

  app.get('/api/health', async (req, res) => {
    let db = null
    if (supabaseConfigured()) {
      try {
        const r = await serviceClient()
          .from('plans')
          .select('id', { head: true, count: 'exact' })
        db = !r.error
      } catch {
        db = false
      }
    }
    res.json({ ok: true, name: 'tableaux', auth: supabaseConfigured(), db })
  })
  // Multi-tenant, auth + RLS backed plan storage (the SaaS path).
  app.use('/api/plans', planRoutes)
  // Share-link management (auth) + public token-based read access (no auth).
  app.use('/api/shares', shareRoutes)
  app.use('/api/share', publicShareRoutes)
  // Account lifecycle: data export + GDPR deletion (auth).
  app.use('/api/account', accountRoutes)
  // CSV parsing is stateless but the heaviest endpoint — cap it tighter than the
  // global limiter to blunt upload abuse.
  app.use(
    '/api/upload',
    rateLimit({
      windowMs: 15 * 60_000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    uploadRoutes
  )

  // Legacy single-tenant file storage. These routes are UNAUTHENTICATED and back
  // a single shared state.json, so they are mounted ONLY when Supabase isn't
  // configured AND we're not in production (local/offline dev + tests). In SaaS
  // mode they would be an open door to the shared file, so they are omitted.
  if (!supabaseConfigured() && process.env.NODE_ENV !== 'production') {
    app.use('/api/state', stateRoutes)
    app.use('/api/snapshots', snapshotRoutes)
    app.use('/api/export', exportRoutes)
  }

  app.use('/api', notFound)

  // Production: serve the built client and fall back to index.html for client-side
  // routes. In dev the Vite server handles this; under tests it's skipped.
  if (process.env.NODE_ENV === 'production') {
    const dist = join(__dirname, '..', 'client', 'dist')
    app.use(
      express.static(dist, {
        setHeaders: (res, filePath) => {
          // index.html must stay fresh so clients always fetch the current
          // (hashed) asset references; Vite-hashed assets are immutable.
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache')
          } else if (/-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
        },
      })
    )
    app.get('*', (req, res) => res.sendFile(join(dist, 'index.html')))
  }

  app.use(errorHandler)

  return app
}

/** Seed state if needed, then start listening. Returns the http server. */
export async function startServer() {
  await ensureState()
  const app = createApp()
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`\n  Tableaux API ready  →  http://localhost:${PORT}`)
      console.log(`  Client origin       →  ${CLIENT_ORIGIN}`)
      if (supabaseConfigured()) {
        console.log('  Mode                →  Supabase (multi-tenant, auth + RLS)\n')
      } else {
        console.warn(
          '  Mode                →  ⚠ single-tenant, NO AUTH (Supabase not configured — local use only)\n'
        )
      }
      resolve(server)
    })
  })
}

// Boot only when executed directly (node index.js / nodemon), not when imported.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  startServer().catch((err) => {
    console.error('Failed to initialise Tableaux state:', err)
    process.exit(1)
  })
}
