# Tableaux — LinkedIn Post Source Material

> Extraction document for writing a LinkedIn post about the Tableaux project.
> Compiled from the repo (README, HOSTING.md, the original product brief, source code, git history, and Supabase migrations). Everything below is grounded in what's actually in the codebase.

---

## 1. Project Overview

**Tableaux is an interactive, to-scale wedding seating planner** — an open-source, full-stack web app that lets a non-technical couple import their guest list from a CSV, build a floor plan by dragging table types onto a canvas, and assign guests to tables (or to individual seats) with drag-and-drop.

The guiding product principle is that it should feel like **a considered editorial design tool, not a spreadsheet** — warm typography (Inter + Cormorant Garamond), a restrained taupe palette, no AI-generated "gradient hero banner" look. The brief explicitly states: *"The design must not look AI-generated… editorial, warm, considered… built by someone who cares about typography."*

**Who it's for:** couples planning a wedding (and, by extension, anyone laying out a seated event). It's desktop-first and built so that someone can clone it, run it with one command, and use it without reading documentation. The demo seeds a realistic 90-guest, 10-table wedding on first run so drag-and-drop works immediately.

**Two operating modes:**
- **Local mode** — no login, a single shared plan persisted to a JSON file. Great for offline use, dev, and the test suite.
- **Multi-tenant SaaS mode** — email/password + magic-link auth, per-user plans isolated in Postgres by Row-Level Security, public read-only share links, and a "Find my seat" guest-facing page.

---

## 2. Technical Stack & Tools Used

### Frontend
- **React 18 (hooks only, no class components)** — the entire UI is a projection of a single store; components hold almost no local state.
- **Vite 5** — build tool and dev server; chosen for fast HMR. `VITE_*` env vars are inlined at build time (which became a real deployment consideration — see §4).
- **Zustand** — global state management, extended with a **command-pattern undo/redo** engine. Chosen over Redux for minimal boilerplate while still allowing a custom middleware-style history layer.
- **@dnd-kit (core + sortable + utilities)** — all drag-and-drop: guest→table, guest→seat, group-drag, and dragging table types out of the palette onto the canvas. Drop-target type is resolved by ID prefix convention (`table_`, `seat_`).
- **React Router v6** — initially a single route, but structured for extensibility; later genuinely used for public share routes (`/share/...`, "find my seat").
- **CSS Modules + design tokens** — component-scoped styles, no Tailwind, no CSS-in-JS. A `tokens.css` file holds the palette, type scale, spacing (8px grid), radii, and shadows. `clsx` for conditional classes.
- **Inter + Cormorant Garamond** (Google Fonts) — UI vs. display/editorial type.
- **jsPDF + jspdf-autotable + svg2pdf.js** — client-side PDF export (floor plans and caterer/printable reports) with no server rendering.
- **qrcode** — generates QR codes for share links / "find my seat".
- **@supabase/supabase-js** — browser auth client (gated by anon key + RLS).

### Backend
- **Node.js + Express 4** — small REST API. In production it *also serves the built client* as a single artifact (no separate static host needed).
- **File-based JSON persistence** — a single `state.json`, seeded from `seed-state.json` on first run. Deliberately no database in local mode.
- **Multer** — multipart CSV upload handling.
- **helmet** — security headers + CSP (HSTS, X-Frame-Options DENY, referrer-policy, permissions-policy, nosniff).
- **express-rate-limit** — abuse protection on the API.
- **cors** — origin allowlist (comma-separated to support staging + prod).
- **dotenv** — config; deliberately *not* auto-loaded under tests to avoid config leaking between test files.

### Data & Auth (SaaS mode)
- **Supabase** — Postgres + GoTrue auth + Row-Level Security. The production server *fails fast* if Supabase isn't configured, so a public deployment can never accidentally run on the unauthenticated file store.
- **Postgres RLS** — tenant isolation enforced at the database layer (`owner_id = auth.uid()`), so an application-code bug cannot leak another user's plan.
- **SQL migrations** — versioned schema in `supabase/migrations/` (init + shares), including triggers and optimistic-concurrency logic.

### Tooling, Testing & Ops
- **Vitest** — two-project workspace: client in `jsdom` + Testing Library, server in `node` + Supertest. 28 test files; coverage focuses on the highest-value logic.
- **ESLint + Prettier** — shared config across client/server.
- **Concurrently** — single `npm run dev` boots API + client together.
- **npm workspaces** — monorepo (root / client / server).
- **Docker** (multi-stage) + **Docker Compose** — builds the client inside the image and ships a single container; persistent volume for data.
- **GitHub Actions CI** — lint + tests + build + docker build on push.
- **Fly.io + Supabase** — the documented recommended hosting stack, with a full reasoned comparison against Render, Railway, and Vercel/Cloudflare.
- **UptimeRobot** — uptime monitoring that doubles as a keep-alive so the free Supabase project doesn't pause after 7 days idle.
- **MIT licensed**, public GitHub repo with README, CONTRIBUTING guidance, issue/discussion pointers, and tech-stack badges.

---

## 3. Skills Demonstrated

- **State architecture** — single-source-of-truth store with a hand-rolled **command-pattern undo/redo** (every mutation captures its inverse; history capped at 50).
- **Custom geometry / computational design** — polar seat placement around round tables, grid offsets for rectangular ones, and a from-scratch **Figma/Canva-style alignment-snapping engine** with on-canvas guide lines and equal-spacing distribution ticks.
- **Canvas interaction engineering** — pan/zoom with cursor-anchored zoom, screen↔canvas coordinate conversion, CSS transforms, and crisp `non-scaling-stroke` SVG overlays at any zoom level.
- **Drag-and-drop UX** — multi-modal DnD (table-level, seat-level, whole-group) with valid/invalid drop affordances and capacity feedback.
- **API design** — small, well-documented REST surface; clean route/middleware/lib separation.
- **Database design & multi-tenancy** — Postgres schema, indexes, triggers, **Row-Level Security**, and **optimistic concurrency** (a DB-owned `rev` column rejects stale writes to prevent last-write-wins clobbering).
- **Security thinking** — a dedicated server-side **sanitization boundary** for public share links (whitelists safe guest fields, strips email/notes/RSVP/dietary-raw); fail-fast in production without auth; service-role key kept strictly server-side; CSP/HSTS/rate-limiting.
- **GDPR / data-protection compliance** — privacy policy + terms pages, "export my data (JSON)" (Art. 20 portability), account deletion, and a documented (if not-yet-automated) data-retention policy.
- **Internationalisation of units** — cm as the canonical stored unit, lossless metric/imperial display toggle, locale-based default (imperial for US/LR/MM).
- **UX/UI & design-systems** — a full token system (colour, type scale, spacing, radii, shadows), `prefers-reduced-motion` support, accessibility floor (keyboard-reachable, focus-trapped modals, DnD keyboard alternative, aria-labels).
- **Testing discipline** — client + server test projects, endpoint tests, persistence round-trip tests, geometry unit tests.
- **DevOps** — multi-stage Docker, Compose, CI pipeline, single-artifact deploy, dependency-audit hygiene.
- **Open-source craft** — one-command quickstart, seeded demo data, contribution docs, honest notes on dev-only dependency advisories.
- **Technical writing** — an unusually thorough, honest hosting guide (free-tier caveats, rate limits, "free for small usage, not guaranteed-free").
- **CSV data wrangling** — fuzzy column auto-mapping, configurable "which values mean coming", import preview, and merge strategies (replace/update/add).

---

## 4. Problems Overcome

- **Undo/redo for everything, cleanly** — rather than diffing whole state, every action captures its own inverse at dispatch time (command pattern in a Zustand middleware), so move/add/delete/assign/group are all reversible with a 50-item cap.
- **Snapping that explains itself** — grid snapping alone made laying out a room by eye fiddly. The solution: a pure, fully unit-tested `computeSnap()` that solves X and Y **independently**, supports center/edge alignment, edge-flush adjacency, centering between walls, flush-to-wall margins, and **equal-spacing distribution** — and renders a guide line (and distance ticks) showing *why* it snapped. On by default, toggleable, and momentarily bypassed by holding **Alt**.
- **Snapping + rotation** — tables rotate with CSS only, so snapping uses the unrotated axis-aligned box; rotated footprints were explicitly scoped out rather than half-built.
- **Multi-tenant isolation that survives bugs** — instead of trusting app code to filter by user, isolation is pushed into Postgres RLS (`owner_id = auth.uid()`), so even a flawed query can't return another tenant's plan.
- **Concurrent edits / stale writes** — a DB-owned `rev` integer bumped by a trigger; clients send the rev they last read and a mismatched write affects 0 rows and is rejected — optimistic concurrency without last-write-wins clobbering.
- **Public sharing without leaking PII** — a single hard sanitization boundary (`shareSanitize.js`) that everything served to public endpoints must pass through; it whitelists safe fields and strips emails, notes, RSVP, tags, plus-ones, constraints, and settings. Dietary is owner-opt-in and even then only the canonical key, never the raw free text.
- **Vite build-time env vars in production** — `VITE_*` values are inlined at build, so they must be passed as **Docker build args**, while server secrets are **runtime secrets**. Getting this split wrong silently bakes wrong URLs into the bundle — documented explicitly in the hosting guide.
- **Not shipping the dev auth bypass** — a "Skip sign-in (dev)" path that uses the real auth + RLS code path but is compiled out of production builds, so it can never leak into a shipped artifact.
- **Free-tier operational gotchas** — free Supabase projects pause after 7 days idle and the built-in email is rate-limited (~2–4/hour); solved/mitigated with an UptimeRobot keep-alive and honest documentation rather than pretending they don't exist.
- **Lossless unit switching** — storing everything in cm and treating metric/imperial purely as a display preference means toggling never mutates or rounds stored data.
- **Honest dependency posture** — dev-only Vite/esbuild advisories don't affect the shipped static app; rather than noisy "fixes," the README and hosting guide explain exactly why `npm audit --omit=dev` is clean and the rest is non-shipping.

---

## 5. Design & Product Decisions

- **Single JSON document as the data model** — the entire plan (guests, groups, tables, zones, room, settings, snapshots) is one document, mirrored between the Zustand store and persistence. Simple to reason about, trivial to export/back up.
- **Two-mode architecture** — the same app runs login-free on a file store *or* as a multi-tenant SaaS on Supabase, chosen by config. This keeps the OSS "clone and run" promise while enabling a real hosted product.
- **Editorial aesthetic as a hard requirement** — explicit design tokens, two carefully chosen typefaces, warm taupe accents, and a "must not look AI-generated" rule. Design was treated as a spec, not an afterthought.
- **Warnings, never blocks** — over-capacity, conflicting "shouldn't sit together" rules, dietary mismatches, and >30% unassigned all surface as amber nudges; the tool never stops the user from doing what they want.
- **SVG tables, not DOM divs** — tables are rendered as SVG with computed seat positions and capacity arcs, so they scale crisply and carry rich visual state (selected, drag-over valid/full, warning).
- **Snapshots in their own table** — in SaaS mode, snapshots are stored separately from the plan doc so saving a plan never re-serialises every snapshot blob.
- **Sanitization as a named module** — the public/private boundary is a single, documented file rather than scattered field-picking, making the security surface auditable.
- **cm as canonical unit** — physical dimensions stored once in cm; pixels derived at render time; display units are a preference.
- **One deployable artifact** — Express serves the built SPA, so there's no CORS-split or separate static host to manage for a small app.
- **Scope discipline** — rotated-footprint snapping and automated data-retention deletion were deliberately deferred and *documented as deferred* rather than left as silent gaps.

---

## 6. Learning Moments

(Inferred from the trajectory of the work — frame these as "things levelled up on.")

- Implementing a **command-pattern undo/redo** engine by hand rather than reaching for a library.
- Writing a **non-trivial 2D geometry/snapping algorithm** (independent-axis snapping + distribution spacing) and making it fully unit-testable by keeping it pure.
- Going from a **single-user file-backed app to a multi-tenant SaaS** — and learning that the right place to enforce isolation is the database (RLS), not the app layer.
- Learning **optimistic concurrency** with a DB-owned revision counter and trigger.
- Discovering the practical consequences of **Vite inlining env vars at build time** when containerising (build args vs. runtime secrets).
- Designing a **deliberate PII sanitization boundary** for public sharing.
- The operational realities of **free hosting tiers** (idle pausing, email rate limits) and engineering around them.
- **Locale-aware unit handling** done losslessly.
- Setting up a **two-project Vitest workspace** (jsdom + node) cleanly.

---

## 7. Metrics / Scale / Impact

- **~14,600 lines** of JS/JSX across client + server.
- **28 test files** spanning client (jsdom + Testing Library) and server (Supertest), covering undo/redo, guest assignment, CSV import, seat geometry, the warnings rules, persistence round-trips, sharing, and every API endpoint.
- **8 feature-grouped commits** taking it from initial scaffold → tests → SaaS mode → units → multi-room polygon spaces → table presets → alignment snapping.
- **7 table types** with distinct shapes, default capacities, and seat-position algorithms (round, rect, banquet, top-table, sweetheart, cabaret, kids).
- **90-guest / 10-table** seeded demo wedding on first run.
- **~218-line** pure snapping util backed by a **141-line** test file.
- Free-tier scale headroom: Supabase free tier supports **50,000 monthly active users** and **500 MB** Postgres.
- **0 production dependency vulnerabilities** (`npm audit --omit=dev --audit-level=high`); remaining advisories are dev-only and non-shipping.
- Full **GDPR** surface: privacy policy, terms, data export, account deletion.

*(No public star/user counts available in the repo — leave those out unless you have real numbers.)*

---

## 8. Interesting Angles for LinkedIn (hooks)

1. "I built a wedding seating planner that feels like Figma — drag a table onto a canvas and it snaps into alignment with guide lines telling you *why*."
2. "Most seating tools are glorified spreadsheets. I wanted something that felt like an editorial design tool — so 'must not look AI-generated' was an actual requirement in the spec."
3. "I wrote a Figma/Canva-style alignment-snapping engine from scratch: center/edge alignment, flush-to-wall, and equal-spacing distribution — all as one pure, fully unit-tested function."
4. "Tenant isolation that survives my own bugs: I pushed it into Postgres Row-Level Security, so even a broken query physically can't return another couple's guest list."
5. "Optimistic concurrency in ~10 lines of SQL: the database owns a revision counter, and a write with a stale rev just affects zero rows. No last-write-wins clobbering when two people edit."
6. "The same codebase runs two ways — login-free on a JSON file so anyone can clone-and-go, or a full multi-tenant SaaS on Supabase — decided entirely by config."
7. "Public share links were the scariest feature: one sanitization module is the *only* path from a private plan to a public view. It whitelists safe fields and strips every piece of PII."
8. "My production server refuses to boot without auth configured — fail-fast beats a misconfigured deploy quietly serving everyone's data off a flat file."
9. "There's a 'Skip sign-in' dev button that uses the *real* auth path — but it's compiled out of production builds, so it can never ship."
10. "Storing every measurement in centimetres and treating metric/imperial as a pure display toggle means switching units is completely lossless."
11. "Undo/redo for *everything* — built by hand with the command pattern: every action captures its own inverse at dispatch time."
12. "I learned the hard way that Vite inlines env vars at build time — which means in Docker they're build args, not runtime secrets. Got the OG tags and sitemap wrong until I split them."
13. "I wrote a hosting guide that tells you the truth: free tiers pause after 7 days idle and rate-limit your emails. So an UptimeRobot ping doubles as a keep-alive."
14. "It ships as one Docker container — Express serves the built React app — so there's no separate static host and no CORS-split to babysit."
15. "Tables are SVG, not divs — so seat positions are computed with real geometry (polar coordinates around circles, grid offsets for rectangles) and stay crisp at any zoom."
16. "The tool warns but never blocks: over-capacity, 'these two shouldn't sit together', dietary gaps — all amber nudges, never a hard stop. It's their wedding, not mine."
17. "GDPR wasn't an afterthought: export-my-data (JSON), account deletion, and a written retention policy — for a side project."

---

## 9. Tone Notes

Pick one primary angle; the project supports all three.

1. **Builder's journey / craft story** — "I built the wedding seating tool I wished existed." Lead with the editorial-design-not-a-spreadsheet motivation, then reveal the engineering depth underneath (snapping engine, RLS, undo/redo). Best for reach: relatable hook, surprising depth. Warm, first-person, a little self-aware.

2. **Technical deep-dive** — Pick ONE meaty thing (the alignment-snapping engine, or RLS + optimistic concurrency, or the dual local/SaaS architecture) and go deep with a diagram or code snippet. Best for credibility with senior engineers. Confident, specific, teaches something.

3. **Problem → solution story** — Frame around a concrete pain ("laying out a room by eye is fiddly", "two people editing clobber each other", "how do I share a plan without leaking everyone's email?") and walk through how each was solved. Best for semi-technical audiences and PMs; reads as product thinking, not just code.

> A strong combined move: open with the builder's-journey hook (angle 1) for the scroll-stopper, then drop into ONE technical deep-dive (angle 2) so the post rewards engineers who keep reading, and close with the open-source MIT link.
