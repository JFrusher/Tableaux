# Tableaux

**An interactive wedding seating planner.** Import your guest list, build a to‑scale
room by dragging table types onto a canvas, and assign guests to tables (or individual
seats) with drag and drop. Tableaux is desktop‑first, made for non‑technical users, and
designed to feel like a considered editorial tool rather than a spreadsheet.

<!-- Add a screenshot at docs/screenshot.png and restore: ![Tableaux interface](docs/screenshot.png) -->

![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Zustand](https://img.shields.io/badge/state-Zustand-2D3748)
![dnd kit](https://img.shields.io/badge/drag%20%26%20drop-dnd--kit-000000)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-7C6F5B)

---

## Quick start

```bash
git clone https://github.com/JFrusher/tableaux
cd tableaux && npm install
npm run dev
```

Then open **http://localhost:5173**. The first run seeds a realistic 90‑guest demo
wedding so you can try the drag‑and‑drop straight away. The API runs on
`http://localhost:3001` and `npm run dev` starts both together.

> Requires Node 18+ (Node 20+ recommended).

## Authentication & multi-tenant mode

Tableaux runs in one of two modes:

- **Legacy local mode** (default with no config) — no login, a single shared plan in
  `server/data/state.json`. Great for offline dev and the test suite.
- **Multi-tenant SaaS mode** — sign-in (email + password or magic link) with per-user
  plans isolated in Postgres by **Row-Level Security**. Enabled by configuring Supabase.

To run SaaS mode locally with the [Supabase CLI](https://supabase.com/docs/guides/cli)
(needs Docker):

```bash
npx supabase start          # boots local Postgres + auth (first run pulls images)
npx supabase status -o env  # copy the API URL + anon key into the env files below
```

Set `server/.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and
`client/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — see the `.env.example`
files. The service-role key is **server-only** and must never reach the browser. Stop the
stack with `npx supabase stop`.

**Dev auth bypass** — to test the rest of the app without logging in each time, click
**⚡ Skip sign-in (dev)** on the login screen, or set `VITE_DEV_AUTH_BYPASS=true` to skip
it automatically. This signs into a fixed dev account (the real auth + RLS path) and is
compiled out of production builds, so it can never ship.

## Importing your guest list

Click **Import guests** in the left panel (or the upload icon in its header) and drop in a
CSV exported from Joy, Zola, The Knot, or any spreadsheet. Tableaux reads your column
headers and auto‑maps **First name**, **Last name**, **RSVP / Attending** and **Dietary** —
you can correct any mapping, tell it which RSVP values mean "coming" (e.g. `Yes`,
`Confirmed`), preview exactly who will be imported, and choose whether to replace, update,
or add to your existing list. A sample file lives at
[`client/public/sample-guests.csv`](client/public/sample-guests.csv).

## Using the planner

- **Build the room** — drag a table type from the toolbar onto the canvas. Pan by dragging
  empty space, zoom with the mouse wheel, and press **F** to fit everything on screen.
- **Seat guests** — drag a guest card (or a whole group by its handle) onto a table. Switch
  a table to *seat‑level* in its inspector to drop guests onto specific seats.
- **Stay organised** — search and filter guests, group them (select a few, then **G**),
  and watch the live capacity rings and warnings as your plan takes shape.
- **Undo anything** — `Cmd/Ctrl + Z` / `Cmd/Ctrl + Shift + Z`. Auto‑save runs every 30s,
  or save manually with `Cmd/Ctrl + S`.

### Keyboard shortcuts

| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Cmd/Ctrl + Z` | Undo | `Delete` / `Backspace` | Remove selected table |
| `Cmd/Ctrl + Shift + Z` | Redo | `Cmd/Ctrl + D` | Duplicate selected table |
| `Cmd/Ctrl + S` | Save | `F` | Fit canvas to screen |
| `Escape` | Deselect / close | `+` / `-` | Zoom in / out |
| `Cmd/Ctrl + A` | Select unassigned guests | `G` | Group selected guests |

## Adapting it for your wedding

- **Rename the wedding** — click the name at the top of the left panel.
- **Resize the room** — drag the handle on the bottom‑right corner of the room outline, or
  change the dimensions to match your venue's floor plan.
- **Settings** (gear icon) — grid snapping & style, the default seating mode for new tables,
  and whether to show dietary badges and group colours.
- **Seating rules** — from Settings or the warnings panel, add "should sit together" /
  "shouldn't sit together" rules; Tableaux flags conflicts without ever blocking you.
- **Snapshots** — save named checkpoints (e.g. *After Mum's edits*) and restore them later.
- **Export for your caterer** — Export → **Table assignments (CSV)** produces a sheet of who
  is at each table, with seats, dietary needs and notes. **Full plan (JSON)** is a complete
  backup.

## Tech stack

- **Frontend** — React 18, Vite, Zustand (with command‑pattern undo/redo), @dnd‑kit,
  React Router, CSS Modules. UI in Inter, display type in Cormorant Garamond.
- **Backend** — Node.js + Express with file‑based JSON persistence (`server/data/state.json`,
  seeded from `seed-state.json` on first run). Multer handles CSV uploads.

## Project layout

```
tableaux/
├── client/   # React + Vite frontend
│   └── src/  # components, hooks, store (Zustand), utils, API client
└── server/   # Express REST API + JSON persistence
    ├── routes/  # state, upload, snapshots, export
    ├── lib/     # persistence, CSV, id helpers
    └── data/    # state.json (live) + seed-state.json (demo)
```

State is a single JSON document, mirrored between the Zustand store and
`server/data/state.json`.

## API reference

The client talks to a small REST API on `http://localhost:3001`. It's handy if you want
to script backups or integrate another tool.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/state` | Fetch the full plan document |
| `POST` | `/api/state` | Persist the full plan document |
| `POST` | `/api/upload/csv` | Upload a guest‑list CSV (multipart `file`) |
| `GET` | `/api/snapshots` | List saved snapshots (metadata only) |
| `POST` | `/api/snapshots` | Capture a named snapshot (`{ "name": "…" }`) |
| `DELETE` | `/api/snapshots/:id` | Delete a snapshot |
| `GET` | `/api/export/csv` | Download the caterer assignment sheet |

Configure the port with `PORT` and the allowed client origin with `CLIENT_ORIGIN`
(see [`server/index.js`](server/index.js)).

## Available scripts

Run from the repository root:

| Command | What it does |
|---|---|
| `npm run dev` | Start the API and client together (watch mode) |
| `npm run build` | Build the production client bundle |
| `npm start` | Run the API server (serves persisted state) |
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests and write a coverage report to `coverage/` |
| `npm run lint` | Lint all `.js` / `.jsx` files |
| `npm run format` | Format the codebase with Prettier |

## Testing

Tests run on [Vitest](https://vitest.dev) as a two-project workspace: the React client
in a `jsdom` environment with [Testing Library](https://testing-library.com), and the
Express server in `node` with [Supertest](https://github.com/ladjs/supertest). Tests live
next to the code they cover (`*.test.js` / `*.test.jsx`).

```bash
npm test                 # run everything once
npm run test:watch       # re-run on change
npm run test:coverage    # HTML + lcov report in coverage/
```

Coverage focuses on the highest-value logic — the undo/redo engine, guest assignment,
CSV parsing/import, seat geometry, the warnings rules, and every API endpoint. To target
one project, use `npx vitest --project client` or `--project server`.

## Note on dependencies

The dev toolchain (Vite 5 / esbuild) carries a couple of low‑severity advisories that only
affect the local dev server and are not exploitable for a tool you run on your own machine.
The shipped app is static. Upgrading is a one‑line change to `client/package.json` when a
non‑breaking Vite release is available.

## Getting help

- **Something not working?** Open an [issue](https://github.com/yourname/tableaux/issues)
  with steps to reproduce, your OS, and your Node version (`node --version`).
- **Questions or ideas?** Start a [discussion](https://github.com/yourname/tableaux/discussions).
- **Stuck on the demo data?** Delete `server/data/state.json` and restart — it re‑seeds
  from `seed-state.json`.

## Contributing

Contributions are welcome. The short version:

1. Fork the repo and create a branch (`git checkout -b feature/your-idea`).
2. `npm install`, then `npm run dev` to work against a live reload.
3. Run `npm run lint` and `npm run format` before committing.
4. Open a pull request describing the change and the problem it solves.

Bug reports and feature requests are just as valuable as code — please use the issue
tracker.

## Maintainers

Maintained by Jacob Frusher, Built as an
editorial‑quality take on wedding seating planning.

## Licence

[MIT](LICENSE) — free to clone, adapt, and use for your own wedding. 🤍
