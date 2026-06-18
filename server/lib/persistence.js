import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultDataDir = join(__dirname, '..', 'data')

// Resolved lazily so tests (and deployments) can redirect storage with
// TABLEAUX_DATA_DIR without the module caching a path at import time.
const dataDir = () => process.env.TABLEAUX_DATA_DIR || defaultDataDir
const statePath = () => join(dataDir(), 'state.json')
const seedPath = () => join(dataDir(), 'seed-state.json')

/**
 * A blank, valid plan. Used as a fallback if no seed file is present so the
 * server always boots into a usable state.
 */
export function emptyState() {
  const now = new Date().toISOString()
  return {
    meta: {
      weddingName: 'Our Wedding',
      venue: '',
      date: '',
      createdAt: now,
      updatedAt: now,
    },
    guests: {},
    groups: {},
    tables: {},
    zones: {},
    room: { width: 1200, height: 900, backgroundColour: '#FAF8F5' },
    canvas: { zoom: 1, panX: 0, panY: 0 },
    snapshots: [],
    constraints: [],
    settings: {
      defaultSeatMode: 'table',
      showDietaryBadges: true,
      showGroupColours: true,
      gridSnap: true,
      gridSize: 20,
    },
  }
}

/**
 * On first run, copy seed-state.json → state.json. Falls back to an empty
 * plan if the seed file is missing or unreadable.
 */
export async function ensureState() {
  await fs.mkdir(dataDir(), { recursive: true })
  try {
    await fs.access(statePath())
  } catch {
    let seed
    try {
      seed = JSON.parse(await fs.readFile(seedPath(), 'utf8'))
      console.log('  · Seeding data/state.json from seed-state.json')
    } catch {
      seed = emptyState()
      console.log('  · No seed-state.json found — starting from an empty plan')
    }
    await writeState(seed)
  }
}

export async function readState() {
  const raw = await fs.readFile(statePath(), 'utf8')
  return JSON.parse(raw)
}

// Serialise writes so concurrent saves can't interleave or corrupt the file.
let writeChain = Promise.resolve()

export function writeState(state) {
  const task = writeChain.then(async () => {
    const next = {
      ...state,
      meta: { ...(state.meta || {}), updatedAt: new Date().toISOString() },
    }
    const target = statePath()
    const tmp = `${target}.tmp`
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
    await fs.rename(tmp, target) // atomic on POSIX
    return next
  })
  // Keep the chain alive even if one write rejects.
  writeChain = task.catch(() => {})
  return task
}
