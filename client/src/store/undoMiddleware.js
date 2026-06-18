/**
 * Command-pattern undo/redo for Zustand.
 *
 * Every undoable mutation is expressed as a *command*:
 *
 *   { type, label, payload, inverse }
 *
 * where `payload` and `inverse` are both *patches* in the same shape (see
 * applyPatch). `payload` moves the document forward; `inverse` (captured at
 * dispatch time, from current state) reverses it exactly. Dispatching applies
 * the payload and records the command; undo replays the inverse; redo replays
 * the payload again.
 *
 * Action creators in actions.js build these commands. The reducer here is a
 * single pure function — no per-action switch — which keeps the whole system
 * small and impossible to get subtly wrong.
 */

const ENTITY_COLLECTIONS = ['guests', 'groups', 'tables', 'zones']
const SINGLETONS = ['meta', 'room', 'settings', 'canvas']

/**
 * Apply a patch to the document slices of `state`, returning only the changed
 * top-level keys (Zustand shallow-merges them back in).
 *
 *   - Entity collections (guests/groups/tables/zones): a map of id → entity to
 *     set, or id → null to delete.
 *   - Singletons (meta/room/settings/canvas): a shallow-merged partial.
 *   - constraints / snapshots: whole-array replacement.
 *
 * Never mutates the input — callers rely on prior object references staying
 * intact so captured inverses remain valid.
 */
export function applyPatch(state, patch) {
  if (!patch) return {}
  const update = {}

  for (const key of ENTITY_COLLECTIONS) {
    if (patch[key]) {
      const next = { ...state[key] }
      for (const [id, value] of Object.entries(patch[key])) {
        if (value === null || value === undefined) delete next[id]
        else next[id] = value
      }
      update[key] = next
    }
  }

  for (const key of SINGLETONS) {
    if (patch[key]) update[key] = { ...state[key], ...patch[key] }
  }

  if (patch.constraints) update.constraints = patch.constraints
  if (patch.snapshots) update.snapshots = patch.snapshots

  return update
}

/**
 * Zustand middleware. Augments the store with `_history`, `_rev`, and the
 * `dispatch` / `undo` / `redo` methods.
 *
 * `_rev` is a monotonic counter bumped on every document change (dispatched or
 * direct) so the auto-save hook can detect "dirty since last save" cheaply.
 */
export const withHistory =
  (createState, { limit = 50 } = {}) =>
  (set, get, api) => {
    const bumpRev = () => (get()._rev || 0) + 1

    const base = createState(set, get, api)

    return {
      ...base,
      _history: { past: [], future: [] },
      _rev: 0,

      dispatch: (action) => {
        const state = get()
        const command = typeof action === 'function' ? action(state) : action
        if (!command || !command.payload) return null
        set({
          ...applyPatch(state, command.payload),
          _rev: bumpRev(),
          _history: {
            past: [...state._history.past, command].slice(-limit),
            future: [],
          },
        })
        return command // callers can read command.meta (e.g. newTableId)
      },

      undo: () => {
        const state = get()
        const { past, future } = state._history
        if (past.length === 0) return
        const command = past[past.length - 1]
        set({
          ...applyPatch(state, command.inverse),
          _rev: bumpRev(),
          _history: { past: past.slice(0, -1), future: [command, ...future] },
        })
      },

      redo: () => {
        const state = get()
        const { past, future } = state._history
        if (future.length === 0) return
        const command = future[0]
        set({
          ...applyPatch(state, command.payload),
          _rev: bumpRev(),
          _history: {
            past: [...past, command].slice(-limit),
            future: future.slice(1),
          },
        })
      },

      clearHistory: () => set({ _history: { past: [], future: [] } }),

      /** Bump the revision for a direct (non-undoable) document mutation. */
      _touch: (update) => set({ ...update, _rev: bumpRev() }),
    }
  }
