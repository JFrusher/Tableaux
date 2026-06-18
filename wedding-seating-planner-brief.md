# Wedding Seating Planner — Full Project Brief
### A prompt for Claude Code to build the complete application

---

## Project Overview

Build **Tableaux** — a full-stack, open-source interactive wedding seating planner. The user imports a guest list via CSV, builds a to-scale room layout by dragging and dropping table types onto a canvas, and assigns guests to tables (or specific seats) via drag and drop. State is persisted to a Node.js backend via REST API. The app is desktop-only, designed for non-technical users, and should feel like a premium editorial tool — not a vibe-coded side project.

This is a public GitHub repo. Anyone planning a wedding should be able to clone it, run it with one command, and use it without reading documentation.

---

## Tech Stack

### Frontend
- **React 18** with hooks (no class components)
- **Vite** as the build tool
- **Zustand** for global state management (including undo/redo middleware)
- **@dnd-kit/core + @dnd-kit/sortable** for all drag-and-drop interactions
- **React Router v6** (single route for now, but structured for extensibility)
- **CSS Modules** for component-scoped styles (no Tailwind, no CSS-in-JS — clean, readable stylesheets)
- **Inter** (body/UI) + **Cormorant Garamond** (display/headings) from Google Fonts

### Backend
- **Node.js + Express** REST API
- **File-based JSON persistence** — a single `data/state.json` file; no database needed
- **Multer** for CSV file uploads
- **CORS** configured for `http://localhost:5173`

### Dev tooling
- **Concurrently** to run frontend and backend with one `npm run dev`
- **ESLint + Prettier** with a shared config
- **Nodemon** for backend hot reload

---

## File Structure

```
tableaux/
├── README.md
├── package.json                   # root — runs both client and server
├── .eslintrc.js
├── .prettierrc
├── .gitignore
│
├── client/                        # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── public/
│   │   └── sample-guests.csv      # anonymised demo CSV
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.module.css
│       │
│       ├── store/
│       │   ├── useStore.js         # Zustand store — all global state
│       │   ├── undoMiddleware.js   # Command pattern undo/redo
│       │   └── actions.js         # Action creators
│       │
│       ├── api/
│       │   └── client.js          # Fetch wrappers for all backend endpoints
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.jsx        # Three-panel layout wrapper
│       │   │   ├── AppShell.module.css
│       │   │   ├── Toolbar.jsx         # Top bar: save, undo, redo, export, settings
│       │   │   └── Toolbar.module.css
│       │   │
│       │   ├── guestPanel/
│       │   │   ├── GuestPanel.jsx          # Left panel: waiting area
│       │   │   ├── GuestPanel.module.css
│       │   │   ├── GuestCard.jsx           # Individual draggable guest chip
│       │   │   ├── GuestCard.module.css
│       │   │   ├── GroupBlock.jsx          # Collapsible named group with drag handle
│       │   │   ├── GroupBlock.module.css
│       │   │   ├── GuestSearch.jsx         # Search/filter bar
│       │   │   └── ImportModal.jsx         # CSV import flow
│       │   │
│       │   ├── canvas/
│       │   │   ├── RoomCanvas.jsx          # Main pan/zoom canvas
│       │   │   ├── RoomCanvas.module.css
│       │   │   ├── CanvasGrid.jsx          # Background grid/dot pattern
│       │   │   ├── RoomOutline.jsx         # Draggable room boundary shape
│       │   │   ├── TableNode.jsx           # Rendered table on canvas
│       │   │   ├── TableNode.module.css
│       │   │   ├── SeatSlot.jsx            # Individual droppable seat position
│       │   │   ├── SeatSlot.module.css
│       │   │   ├── ZoneLabel.jsx           # Non-seatable zone (dance floor etc.)
│       │   │   └── ZoneLabel.module.css
│       │   │
│       │   ├── sidebar/
│       │   │   ├── RightSidebar.jsx        # Context panel (table/guest details)
│       │   │   ├── RightSidebar.module.css
│       │   │   ├── TableInspector.jsx      # Edit selected table properties
│       │   │   ├── GuestInspector.jsx      # View/edit selected guest details
│       │   │   └── StatsPanel.jsx          # Live counts: seated, unassigned etc.
│       │   │
│       │   ├── toolbar/
│       │   │   ├── TablePalette.jsx        # Drag-out table type picker
│       │   │   └── TablePalette.module.css
│       │   │
│       │   └── ui/
│       │       ├── Modal.jsx               # Generic modal wrapper
│       │       ├── Toast.jsx               # Notification toasts
│       │       ├── Tooltip.jsx
│       │       ├── Button.jsx
│       │       ├── IconButton.jsx
│       │       ├── Badge.jsx               # Dietary/tag badges
│       │       └── ConfirmDialog.jsx
│       │
│       ├── hooks/
│       │   ├── useUndoRedo.js
│       │   ├── useCanvasPanZoom.js
│       │   ├── useKeyboardShortcuts.js
│       │   └── useAutoSave.js
│       │
│       ├── utils/
│       │   ├── csvParser.js               # Parse + normalise CSV columns
│       │   ├── seatPositions.js           # Compute seat x/y around table shapes
│       │   ├── exportJson.js
│       │   └── exportCsv.js
│       │
│       └── styles/
│           ├── tokens.css                 # Design tokens (colours, spacing, type)
│           └── global.css                 # Resets, body, fonts
│
└── server/
    ├── package.json
    ├── index.js                   # Express app entry
    ├── routes/
    │   ├── state.js               # GET /state, POST /state
    │   └── upload.js              # POST /upload/csv
    ├── middleware/
    │   └── errorHandler.js
    └── data/
        └── state.json             # Persisted state (gitignored, seeded on first run)
```

---

## Data Model

All state lives in a single JSON object, both in Zustand and in `server/data/state.json`.

```jsonc
{
  "meta": {
    "weddingName": "Sophie & James",
    "venue": "The Old Barn",
    "date": "2025-09-06",
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  },

  "guests": {
    "g_abc123": {
      "id": "g_abc123",
      "firstName": "Emma",
      "lastName": "Clarke",
      "fullName": "Emma Clarke",           // denormalised for display speed
      "email": "emma@example.com",
      "dietary": "vegetarian",             // free string, normalised on import
      "dietaryRaw": "Vegetarian",          // original CSV value
      "side": "bride",                     // "bride" | "groom" | "both" | null
      "rsvpStatus": "confirmed",           // "confirmed" | "declined" | "pending"
      "plusOneOf": null,                   // guest ID this is a plus-one of, or null
      "groupId": "grp_xyz",               // group membership, or null
      "assignedTableId": "tbl_001",        // null if unassigned
      "assignedSeatId": "seat_001_3",      // null if table-level only
      "notes": "",
      "tags": ["close-friend"]
    }
  },

  "groups": {
    "grp_xyz": {
      "id": "grp_xyz",
      "name": "University friends",
      "colour": "#7B6FA0",                 // used to tint group in waiting area
      "memberIds": ["g_abc123", "g_def456"]
    }
  },

  "tables": {
    "tbl_001": {
      "id": "tbl_001",
      "label": "Table 1",                  // display name — editable
      "designation": null,                 // "top-table" | "kids" | "vip" | null
      "type": "round",                     // see Table Types below
      "capacity": 8,
      "x": 320,                            // canvas position (px, unscaled)
      "y": 240,
      "rotation": 0,                       // degrees
      "assignedGuestIds": ["g_abc123"],     // ordered; for seat-level, index = seat
      "seatMode": "table",                 // "table" | "seat"
      "colour": null                       // optional override tint
    }
  },

  "zones": {
    "zone_001": {
      "id": "zone_001",
      "label": "Dance Floor",
      "x": 600,
      "y": 400,
      "width": 200,
      "height": 150,
      "shape": "rect",                     // "rect" | "circle"
      "colour": "#E8E0D5"
    }
  },

  "room": {
    "width": 1200,                         // canvas room boundary width (px)
    "height": 900,
    "backgroundColour": "#FAF8F5"
  },

  "canvas": {
    "zoom": 1,
    "panX": 0,
    "panY": 0
  },

  "snapshots": [
    {
      "id": "snap_001",
      "name": "After initial draft",
      "savedAt": "ISO string",
      "state": { /* full state clone */ }
    }
  ],

  "settings": {
    "defaultSeatMode": "table",           // new tables default to table or seat mode
    "showDietaryBadges": true,
    "showGroupColours": true,
    "gridSnap": true,
    "gridSize": 20
  }
}
```

---

## Table Types

Each type defines a shape, default capacity, and a seat-position algorithm.

| Type | Shape | Default capacity | Notes |
|---|---|---|---|
| `round` | Circle | 8 | Seats equally distributed around circumference |
| `rect` | Rectangle | 10 | Seats along both long sides + short ends |
| `banquet` | Long rectangle | 16 | Seats on both long sides only |
| `top-table` | Wide rectangle | 12 | Seats on one side only (facing guests) |
| `sweetheart` | Small circle | 2 | Couple's table, no seat numbers shown |
| `cabaret` | Half-circle | 6 | Seats on curved edge only |
| `kids` | Rectangle, rounded corners | 8 | Styled with distinct colour |

In the `TablePalette`, these are shown as small SVG thumbnails that can be dragged onto the canvas. Dropping one creates a new table at the drop position with defaults.

---

## Backend API

Base URL: `http://localhost:3001`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/state` | Returns full state JSON |
| `POST` | `/api/state` | Replaces full state JSON, returns saved state |
| `POST` | `/api/upload/csv` | Accepts multipart CSV upload, returns parsed guest array |
| `GET` | `/api/snapshots` | Returns list of snapshot metadata (no state blobs) |
| `POST` | `/api/snapshots` | Save named snapshot |
| `DELETE` | `/api/snapshots/:id` | Delete snapshot |
| `GET` | `/api/export/csv` | Returns assignment CSV for caterers |

On first run, if `data/state.json` doesn't exist, seed it from `data/seed-state.json` (included in repo with demo data).

---

## Feature Specifications

### 1. CSV Import Flow

**Entry point:** "Import guests" button in the Guest Panel or empty state prompt.

**Step 1 — Upload:** Drag-and-drop area or file picker. Accepts `.csv` only. Show filename and row count on selection.

**Step 2 — Column mapping:** Display a preview table of the first 5 rows. For each required field (First Name, Last Name, RSVP/Attending, Dietary), show a dropdown of detected CSV column headers. Auto-select the best match using fuzzy matching (check for "first", "name", "attending", "rsvp", "diet", "food", "restriction" case-insensitively). For RSVP status, show a secondary prompt: "Which values mean 'coming'?" — display the unique values found in that column as toggleable chips. Default: select "Yes", "Confirmed", "TRUE", "1", "Attending".

**Step 3 — Preview:** Show a scrollable table of guests who will be imported (filtered to confirmed only). Show count: "Importing 84 guests." Allow the user to deselect individuals.

**Step 4 — Merge strategy (if re-importing):** If guests already exist in state, ask: "Update existing guests?" / "Replace all guests?" / "Add new only". Detect duplicates by email, then by full name.

**Step 5 — Done:** Dismiss modal. Guests appear in the waiting area immediately. Show a toast: "84 guests imported."

---

### 2. Guest Panel (Left Sidebar)

Fixed left panel, 280px wide, dark background.

**Header:** Wedding name (editable inline). Stats line: "84 guests · 12 unassigned".

**Search bar:** Filters visible guest cards and groups in real time. Searches first name, last name, group name.

**Filter chips:** Row of small toggleable chips below search: All · Unassigned · Bride's side · Groom's side · Vegetarian · Vegan · GF · Has notes. Active chips are highlighted.

**Group blocks:**
- Collapsible header showing group name, colour swatch, member count, and a "drag group" handle on the left
- When collapsed: shows a row of avatar initials for members
- When expanded: shows individual GuestCards
- Right-click on group header → rename, recolour, dissolve group, select all
- Dragging the group handle drags all members as a unit (custom drag overlay showing "Group: University friends (6)")

**Unassigned individual guests** sit below groups in a flat list.

**GuestCard:**
- Shows full name prominently
- Small dietary badge if set (coloured dot + abbreviation: V, VG, GF, N)
- Side indicator (B / G dot in brand colour)
- Partially transparent if fully assigned
- Drag handle on left edge
- Click to select and open in right sidebar inspector

**Creating groups:**
- Select multiple GuestCards (shift-click or drag-select within panel)
- Right-click → "Create group from selection"
- Or drag one card onto another to prompt group creation

---

### 3. Canvas (Centre)

**Pan:** Click and drag on empty canvas space (not on a table or zone).

**Zoom:** Mouse wheel. Also +/- buttons in bottom-right corner. Zoom range: 25%–200%. Zoom is centred on cursor position.

**Grid:** Dot grid by default, toggled to line grid or off in settings. 20px base grid. Tables snap to grid when `settings.gridSnap` is true.

**Room outline:** A rounded-rectangle boundary representing the venue. Resizable by dragging corner handles. Purely visual — guests can be placed outside it but it triggers a warning badge.

**Canvas controls (bottom right):** Zoom in, zoom out, fit to screen, toggle grid, undo, redo. These float above the canvas.

**Table placement:**
- Drag a table type from the `TablePalette` (top bar) onto the canvas
- On drop, create a new table at that position with a generated label ("Table 1", "Table 2"…) and default capacity
- Click to select — shows selection ring, opens TableInspector in right sidebar
- Double-click to open rename input inline
- Right-click → Rename, Duplicate, Delete, Change type, Set designation, Toggle seat mode
- Drag to reposition (snaps to grid if enabled)
- Resize handle on corner for rectangular types (adjusts capacity proportionally)

**Guest assignment — table mode:**
- Drag a GuestCard (or group) from the waiting area and drop onto a table
- Table highlights with a green ring as a valid drop target during drag
- If table is full, ring turns red; drop is rejected with a toast: "Table 1 is full (8/8)"
- Guest disappears from waiting area (or becomes semi-opaque if in a partially-placed group)
- Table shows a fill arc around its edge: 0–100% of capacity, coloured by fill level (green → amber → red)

**Guest assignment — seat mode:**
- When a table is in seat mode, hovering shows individual seat slots around it
- Each seat slot is a circular drop zone (~30px) positioned around the table perimeter
- Occupied seats show guest initials; empty seats show "+"
- Drag a guest from waiting area onto a specific seat slot
- Click an occupied seat to select that guest (opens GuestInspector in right sidebar)
- Right-click occupied seat → Remove from seat, Swap with…

**Visual states on tables:**
- Default: label, capacity ring, seated count
- Selected: highlighted border, handles visible
- Drag-over (valid): green glow ring
- Drag-over (full): red ring + "Full" label
- Has warning: amber exclamation badge (hover for detail)

**Zones:**
- Drawn with the zone tool (icon in toolbar): click and drag to create a labelled non-seatable area
- Rendered as a translucent filled shape behind tables
- Double-click to rename
- Drag to reposition, drag corners to resize

---

### 4. Right Sidebar

Context-sensitive. 260px wide.

**Nothing selected:** Shows StatsPanel — total guests, seated, unassigned, dietary breakdown (mini bar chart), table fill summary (list of tables with fill %).

**Table selected (TableInspector):**
- Table label (editable inline)
- Type selector (dropdown with thumbnails)
- Capacity spinner
- Designation selector (None / Top table / VIP / Kids / Band/Bar)
- Seat mode toggle: "Table-level" / "Seat-level"
- Colour picker for table tint
- Seated guests list with remove buttons
- "Clear table" button

**Guest selected (GuestInspector):**
- Full name (editable)
- Email
- Dietary (editable, with suggestions)
- Side selector (Bride / Groom / Both)
- RSVP status
- Group membership (editable)
- Assigned table/seat (click to navigate to it)
- Notes textarea
- Tags
- "Remove from table" button

---

### 5. Top Toolbar

Full-width bar at the top.

**Left section:** App logo/name "Tableaux" in display font.

**Centre section:** TablePalette — row of draggable table type thumbnails. Each is a small SVG of the table shape with its name below. Drag from here onto the canvas.

**Right section:**
- Undo (Cmd/Ctrl+Z)
- Redo (Cmd/Ctrl+Shift+Z)
- Save (Cmd/Ctrl+S) — saves to backend, shows "Saved" momentarily
- Snapshots — dropdown to view/restore/name snapshots
- Export — dropdown: "Export JSON", "Export CSV (table assignments)"
- Settings (gear icon) — modal for grid, seat mode default, show/hide dietary badges

---

### 6. Undo / Redo

Implemented with a Command pattern middleware in Zustand.

Every state mutation is wrapped in a `dispatch(action)` call. Each action has:
- `type`: string identifier
- `payload`: the data to apply
- `inverse`: the data needed to reverse it (captured at dispatch time)

Actions that must be undoable: move table, add table, delete table, assign guest, unassign guest, move group, create group, dissolve group, rename table, rename group, change capacity, add zone, remove zone, move zone.

History stack: capped at 50 items. Undo/redo keyboard shortcuts bound globally. Toolbar buttons show disabled state when stack is empty. A compact history list is optionally viewable in a slide-out panel.

---

### 7. Save & Snapshots

**Auto-save:** Every 30 seconds if state has changed. A small "Saving…" → "Saved at 14:32" indicator lives in the top toolbar. On failure, show "Save failed — check server is running."

**Manual save:** Cmd/Ctrl+S or the save button.

**Snapshots:** Named point-in-time copies of full state. Up to 10 stored. Accessible via toolbar dropdown. Creating one: click "Save snapshot", enter a name (e.g. "After Mum's edits"), click Save. Restoring: click snapshot name → confirm dialog.

---

### 8. Warnings Engine

A lightweight rules system that surfaces issues as amber badges on the canvas without blocking the user.

Built-in warnings (computed on every state change):
- Table over capacity
- Guest assigned to a full table
- Guests without a dietary note at a table where others have specific requirements (prompt to check)
- Top table has no sweetheart couple assigned
- More than 30% of guests still unassigned (info-level nudge)

Custom constraints (set in a Constraints panel, accessible from settings):
- "These people should NOT sit together" — select two guests, add rule. Warns if they end up at the same table.
- "These people SHOULD sit together" — warns if they end up at different tables.

Warning badges sit on tables and guest cards. A warnings summary panel is accessible from the toolbar, listing all current issues with one-click navigation to the relevant table/guest.

---

## Design System

### Palette

| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#1C1917` | Primary text, headings |
| `--ink-soft` | `#57534E` | Secondary text, labels |
| `--ink-muted` | `#A8A29E` | Placeholder, disabled |
| `--surface` | `#FAFAF9` | Page background |
| `--surface-raised` | `#FFFFFF` | Cards, panels |
| `--surface-subtle` | `#F5F5F4` | Input backgrounds, table hover |
| `--border` | `#E7E5E4` | Panel edges, dividers |
| `--accent` | `#7C6F5B` | Primary action, selection rings (warm taupe) |
| `--accent-hover` | `#5C5143` | Hover state |
| `--accent-light` | `#EDE8E1` | Accent tint backgrounds |
| `--ok` | `#4A7C59` | Full table ring, success states |
| `--warn` | `#C07C2A` | Warning badges |
| `--danger` | `#A63228` | Errors, full-table rejection |
| `--panel-bg` | `#1E1C1A` | Left sidebar background |
| `--panel-text` | `#E7E5E4` | Text on dark sidebar |

### Typography

Load from Google Fonts in `index.html`:
```
Cormorant Garamond: 400, 600 (display, panel headings, table labels on canvas)
Inter: 400, 500, 600 (all UI text, labels, inputs)
```

Type scale (CSS custom properties in `tokens.css`):
- `--text-xs`: 11px / Inter 500 — badges, meta labels
- `--text-sm`: 13px / Inter 400 — secondary UI
- `--text-base`: 15px / Inter 400 — body
- `--text-ui`: 13px / Inter 500 — buttons, inputs
- `--text-label`: 11px / Inter 600 uppercase tracking-widened — section headers
- `--text-display`: 22px / Cormorant Garamond 600 — app name, modal headings
- `--text-table`: 13px / Cormorant Garamond 400 — table labels on canvas

### Spacing

8px base grid. Tokens: `--space-1` (4px) through `--space-8` (64px) in 4px increments.

### Radii

- `--radius-sm`: 4px — badges, chips
- `--radius-md`: 8px — cards, buttons
- `--radius-lg`: 12px — modals, panels
- `--radius-full`: 9999px — avatar initials, round table rendered shape

### Shadows

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 4px 12px rgba(0,0,0,0.10);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
--shadow-drag: 0 12px 32px rgba(0,0,0,0.18);  /* dragging state */
```

### Component Patterns

**Buttons:**
- Primary: `background: var(--accent)`, white text, `--radius-md`, 36px height, `--text-ui`
- Secondary: `background: var(--surface-subtle)`, `--ink` text, `border: 1px solid var(--border)`
- Ghost: transparent, `--ink-soft` text, hover fills `var(--surface-subtle)`
- Danger: `background: var(--danger)`, white text
- Icon button: 32×32px, `--radius-md`, ghost style

**Guest cards (dark panel):**
- `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.10)`
- Hover: `background: rgba(255,255,255,0.10)`
- Drag: lifted with `--shadow-drag`, slight scale(1.02), rotate(1deg)
- Assigned: `opacity: 0.4`, strikethrough on name

**Tables on canvas:**
- SVG-rendered shapes, not divs
- Label below table in `--text-table`
- Capacity ring: SVG arc, stroke colour transitions with fill level
- Selected: 2px `--accent` ring with 4px offset
- Shadows match `--shadow-sm` at rest, `--shadow-md` when hovered

**Seat slots:**
- 28px circles, `border: 2px dashed var(--border)` when empty
- Hover/drag-over: `border-color: var(--accent)`, soft `--accent-light` fill
- Occupied: solid `--accent` background, white initials in `--text-xs`

**Modals:**
- Max-width 560px, `--radius-lg`, `--shadow-lg`, backdrop `rgba(0,0,0,0.4)`
- Header in `--text-display`, body in `--text-base`
- Footer with action buttons always right-aligned

**Toasts:**
- Bottom-right, stack upward, auto-dismiss 3s
- Types: info (neutral), success (--ok), warning (--warn), error (--danger)
- Small `--radius-md` pill with icon + message

---

## Interactions & Animations

Keep animations purposeful. Use `prefers-reduced-motion` media query to disable all transitions when set.

- **Panel resize:** Guest panel and right sidebar are fixed-width (no resize); they slide in/out on toggle with a 200ms ease transition
- **Drag lift:** Scale 1.02, rotate 1.5deg, shadow increases — transition: 120ms ease-out
- **Drop accepted:** Table flashes green ring for 400ms
- **Drop rejected:** Table shakes (translateX keyframe) for 300ms
- **Toast appear/dismiss:** Slide in from right, fade on dismiss
- **Canvas zoom:** CSS transform with 100ms ease on scroll, instant on button press
- **Modal:** Fade in + scale from 0.96→1, 150ms ease-out

No loading spinners — operations should be fast enough to not need them. If save takes >500ms, show a subtle "Saving…" text.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + S` | Save |
| `Escape` | Deselect / close modal |
| `Delete / Backspace` | Remove selected table (with confirm) |
| `Cmd/Ctrl + D` | Duplicate selected table |
| `F` | Fit canvas to screen |
| `+` / `-` | Zoom in / out |
| `Cmd/Ctrl + A` | Select all unassigned guests in panel |
| `G` | Group selected guests |

---

## Error States & Empty States

**No guests imported yet (Guest Panel):**
Large centred prompt: "Start by importing your guest list" + "Import CSV" button. Small note: "Have a Joy, Zola, or spreadsheet export? We'll help you map the columns."

**Canvas empty:**
Faint dashed room outline. Centred text: "Drag table types from the toolbar to start building your room." Arrow pointing up toward the palette.

**CSV column not recognised:**
In the import modal step 2, unmatched required fields are highlighted red. "We couldn't find a column for [First Name]. Please select one above."

**Table full on drop:**
Red ring flash on table. Toast: "Table 3 is full — 8 of 8 seats taken." Guest returns to waiting area.

**Save failed:**
Toast (error): "Couldn't save — is the server running? (npm run dev:server)" Persists until dismissed.

---

## Demo Mode

Seed the app with a realistic demo dataset on first run: a 90-guest wedding across 10 tables. Groups include "Bride's family", "Groom's family", "University friends", "Work colleagues". A mix of dietary requirements. Some guests already assigned, some not — so users can immediately experience the drag-and-drop interactions.

Seed data lives in `server/data/seed-state.json`. The server copies it to `state.json` on first run if `state.json` doesn't exist.

---

## README Requirements

The README should include:

1. A short description of what Tableaux is
2. A screenshot or GIF of the interface (add placeholder image path `/docs/screenshot.png`)
3. **Quick start** — must be three commands:
   ```bash
   git clone https://github.com/yourname/tableaux
   cd tableaux && npm install
   npm run dev
   ```
   Then open `http://localhost:5173`
4. How to import a CSV (one paragraph)
5. A link to the sample CSV in `/client/public/sample-guests.csv`
6. **Adapting for your wedding** — a short section explaining the key settings, how to change the room size, and how to export for your caterer
7. Tech stack badges
8. MIT licence note

---

## Implementation Order

Build in this sequence. Do not skip ahead — each phase builds on the last.

**Phase 1 — Foundation**
1. Set up monorepo with Vite + React client and Express server
2. Implement Zustand store with full data model
3. Implement undo/redo middleware
4. Set up auto-save with backend persistence
5. Apply design tokens and global styles

**Phase 2 — Guest Panel**
6. GuestPanel layout and styling
7. GuestCard component
8. GroupBlock component with collapse/expand
9. Search and filter functionality
10. Import modal (all 5 steps)

**Phase 3 — Canvas Core**
11. RoomCanvas with pan and zoom
12. Grid rendering
13. Room outline shape
14. TablePalette in toolbar (drag source)
15. TableNode component (all types, SVG rendering)

**Phase 4 — Assignment**
16. Table-level drag-and-drop (guest → table)
17. Seat-level drop zones (SeatSlot component)
18. Group drag (multi-guest)
19. Capacity ring visualisation
20. Table/guest selection and right sidebar

**Phase 5 — Polish**
21. Warnings engine
22. Keyboard shortcuts
23. Toasts
24. Zone tool
25. Snapshot system
26. Export functions (JSON, CSV)
27. Demo seed data
28. README

---

## Critical Implementation Notes for Claude Code

1. **Start with the data model and store.** Get `useStore.js` right before building any UI. Every component is a projection of store state — not local state.

2. **@dnd-kit usage:** Use `DndContext` at the app root. Use `useDraggable` for GuestCards and table palette items. Use `useDroppable` for tables (table-level) and SeatSlot (seat-level). The `over` ID during drag determines drop target type by ID prefix convention: `table_`, `seat_`.

3. **SVG table rendering:** Each table type is an SVG element positioned absolutely on the canvas. Seat positions are computed by `seatPositions.js` using polar coordinates for round tables and grid offsets for rectangular types. Never use DOM elements to represent tables on the canvas.

4. **Canvas transform:** The canvas div uses `transform: translate(panX, panY) scale(zoom)`. All mouse coordinates must be converted back to canvas-space before writing to state. Provide a `canvasToScreen` and `screenToCanvas` utility in `useCanvasPanZoom.js`.

5. **CSS Modules:** Every component gets its own `.module.css`. No global class names for component styles. Design tokens are global (imported in `global.css`). Use `clsx` for conditional class composition.

6. **No inline styles** except for computed values that genuinely can't be CSS (table x/y position, capacity ring stroke-dashoffset, group colours).

7. **Accessibility floor:** All interactive elements are keyboard-reachable. Modals trap focus. Drag-and-drop has a keyboard alternative (click a guest, then click a table to assign). All icon buttons have `aria-label`.

8. **Performance:** Guest lists can be 150+ items. Virtualise the guest panel list with `react-window` if rendering becomes sluggish. Memoize GuestCard and TableNode with `React.memo`. Selector functions in Zustand must be stable references.

9. **Error boundaries:** Wrap the Canvas and Guest Panel in error boundaries so a render error in one panel doesn't crash the app.

10. **The design must not look AI-generated.** Follow the token system precisely. No gradient hero banners. No excessive rounded corners. No neon accent colours. The aesthetic is: editorial, warm, considered. Think a well-designed productivity tool built by someone who cares about typography.
