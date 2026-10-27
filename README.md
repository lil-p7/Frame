# Frame — Build visually. Think structurally.

A local-first visual website builder. Design pages in a browser editor — a
component library, drag-and-drop canvas, layers tree, properties inspector,
responsive breakpoints, multi-page projects, undo/redo, preview mode — then
export a standalone, buildable website.

Everything runs in the browser: projects and images live in IndexedDB, there
is no backend and no account.

The full product and engineering specification lives in
[`FRAME_SPEC.md`](./FRAME_SPEC.md).

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer (developed on Node 23)
- npm 10+

## Getting started

```bash
npm install
npm run dev
```

Open the printed URL (http://localhost:5173 by default), create a project on
the dashboard, and start dropping components onto the canvas.

## Scripts

| Command               | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Start the Vite dev server with HMR                      |
| `npm run build`       | Type-check (`tsc -b`) and build the production bundle    |
| `npm run preview`     | Serve the production build locally                      |
| `npm test`            | Run the full Vitest suite once (unit + integration)     |
| `npm run test:watch`  | Run Vitest in watch mode                                |
| `npm run lint`        | ESLint over the whole repository                        |
| `npm run typecheck`   | TypeScript project build check (no emit)                |
| `npm run format`      | Format with Prettier                                   |
| `npm run format:check`| Check formatting without writing                       |

## Using Frame

**Dashboard (`/`)** — create, open, rename, duplicate, and delete projects;
search the list; corrupt or unreadable records are flagged instead of
crashing the dashboard.

**Editor (`/editor/:projectId`)** — the main workspace:

- **Components tab** — click a component to insert it at the current valid
  position, or drag it onto the canvas / into the layer tree.
- **Layers tab** — the document tree: select, rename (Enter commits,
  Escape cancels), hide, lock, and reorder rows by dragging the grip or with
  the keyboard (`Alt+↑` / `Alt+↓`).
- **Canvas** — click to select, click empty space to clear the selection;
  hover outlines and drop indicators show what a drag would do. Zoom and
  viewport presets (desktop / tablet / mobile / custom width) live in the
  toolbar.
- **Inspector** — registry-driven controls grouped into Content, Layout,
  Typography, Appearance, Spacing, and Advanced. Style edits can be written
  for the current breakpoint (Desktop base values, plus Tablet/Mobile
  overrides shown as *Override* vs *Inherited*).
- **Saving** — every command is validated, written to IndexedDB, and only
  then applied to the UI and recorded in history; the status chip in the
  toolbar shows *Saving… / Saved / Failed*.

**Keyboard shortcuts**

| Shortcut                    | Action                                   |
| --------------------------- | ---------------------------------------- |
| `Ctrl/Cmd + Z`              | Undo                                     |
| `Ctrl/Cmd + Shift + Z`, `Ctrl + Y` | Redo                               |
| `Ctrl/Cmd + C` / `Ctrl/Cmd + V` | Copy / paste a component             |
| `Ctrl/Cmd + D`              | Duplicate the selection                  |
| `Delete` / `Backspace`      | Delete the selection                     |
| `Escape`                    | Clear the selection (or cancel in-place) |
| `Alt+↑` / `Alt+↓`           | Move the focused layer up / down         |

**Pages** — create, duplicate, reorder, and delete pages from the page menu
in the toolbar; each page has its own title, slug, and background. Links can
target other pages, and a deleted target is reported rather than linking
nowhere.

**Assets** — upload local images from the image component or inspector;
files are validated (type + size), stored in IndexedDB, and referenced by a
stable storage key so exports and reloads keep working.

**Preview (`/preview/:projectId/:pageId`)** — the page rendered without any
editor chrome, at the selected viewport width, with working navigation
between pages.

**Export** — validates the project first (unknown components, missing image
bytes, broken links, duplicate slugs all block the export with a message),
then downloads a zip containing a complete, standalone Vite project: one
source component per page, the generated stylesheet with per-breakpoint media
queries, `public/assets/` for images, and its own README. Unzip it and run:

```bash
npm install
npm run build   # or: npm run dev
```

## Architecture

Feature-first folders under `src/`; the app shell wires them together.

```
src/
├── app/                 # providers, route table, router
├── features/
│   ├── dashboard/       # project list, create/rename/delete dialogs
│   ├── projects/        # ProjectRepository, Dexie/IndexedDB adapter, services
│   ├── document/        # the document model and all pure document logic
│   │   ├── model/       # FrameProject/FramePage/FrameNode + zod schemas
│   │   ├── commands/    # atomic, validated, immutable page operations
│   │   ├── traversal/   # find/walk/path/clone helpers
│   │   ├── validation/  # schema + tree invariants -> issue list
│   │   ├── history/     # per-page undo/redo stacks (bounded, coalescing)
│   │   ├── responsive/  # breakpoint model and CSS value serialization
│   │   ├── navigation.ts# internal / anchor / external link classification
│   │   └── stylesheet/  # page + node CSS rules for any mode
│   ├── component-registry/ # declarative component definitions
│   │   ├── definitions/ # section, stack, grid, heading, image, button, ...
│   │   ├── staticTree.ts# shared renderer used by preview AND export
│   │   └── styles.ts    # supported style keys and validation
│   ├── editor/          # shell, toolbar, sidebars, canvas, inspector,
│   │   │                # drag-and-drop, shortcuts, commands hook
│   │   └── stores/      # zustand: editor UI state, history, clipboard
│   ├── preview/         # chrome-less preview route + renderer
│   ├── export/          # validation, site generator, zip packaging
│   └── assets/          # image validation, storage, object-URL hooks
├── lib/                 # id generation, class merging, errors
├── styles/              # Tailwind entry + design tokens + reduced motion
└── test/                # Vitest setup (jsdom, jest-dom, fake IndexedDB)
```

Key ideas:

- **The document is plain serializable data.** `FrameProject` → `pages[]` →
  a `FramePage.root` tree of `FrameNode`s — no React instances, validated by
  zod against `schemaVersion`. Every mutation goes through a pure command
  (`insertNode`, `moveNode`, `updateNodeStyles`, …) that returns a new page
  and refuses invalid input with a specific message (root protection, cycles,
  child rules, duplicate IDs, unsafe style values).
- **One registry, three renderers.** Each component declares its editor
  behavior, its static markup, its props schema, and its inspector controls
  in one place. The canvas, the preview route, and the website export all
  consume the same definitions, so what you design is what exports.
- **Persistence sits behind `ProjectRepository`.** The Dexie/IndexedDB
  adapter is swappable; every method returns explicit success or failure.
  Commands run through a serialized queue (`usePageCommands`): validate →
  save → record history → adjust selection. A failed save leaves the document
  untouched, announces the error, and never records a history entry; a failed
  undo save rolls the history stacks back with it.
- **State is split by lifetime.** Project/document data flows through props
  from the route; transient editor UI (selection, viewport, panels, drag
  indicators) and per-session undo stacks live in zustand stores and are
  never persisted.
- **Responsive styles are data, not strings.** A node stores base (Desktop)
  styles plus optional Tablet/Mobile overrides; the resolver and stylesheet
  generator produce matching CSS, and the preview/export render the same
  breakpoint the editor shows.
- **Export is generation, not scraping.** The site generator emits typed
  React source, a stylesheet, an app shell with hash routes, and packages the
  referenced images from IndexedDB into `public/assets/`. Output is
  deterministic (byte-identical for the same project) and treats all
  document content as untrusted input.

## Testing

Vitest + React Testing Library + `fake-indexeddb` give tests a real IndexedDB
in jsdom, so persistence paths are exercised end-to-end in-process:

- **Unit** — commands, traversal, validation, history, responsive resolution,
  stylesheet generation, URL validation, ID generation, export generation.
- **Integration** — create/open/save/reload, insert and edit through the
  real UI, layer-tree selection, inspector style commits, undo/redo,
  copy/paste/duplicate, pages, assets, export packaging, preview.
- **Hardening** — large-document performance budgets, rerender profiling,
  accessibility behavior, and save-failure recovery.

```bash
npm test           # full suite
npx vitest run src/features/editor   # one feature
```

The release quality gates are `npm run typecheck`, `npm run lint`,
`npm test`, and `npm run build`; all must pass.

## Deployment

`npm run build` produces a static `dist/` directory. No server, database,
build-time environment variables, or secrets are required — the app is
fully client-side.

Routing is client-side (`/`, `/editor/:projectId`,
`/preview/:projectId/:pageId`), so deep links must fall back to
`index.html`. Two common hosts are already configured:

- **Netlify / Cloudflare Pages** — `public/_redirects` is copied into the
  build automatically.
- **Vercel** — `vercel.json` ships the rewrite rule.

For any other host, add the equivalent "serve `index.html` for unknown
paths" rule. Deploy at the domain root (the default Vite `base`).

## Limitations

- **Local-only data.** Projects live in this browser's IndexedDB. There are
  no accounts, sync, or cloud backup (a spec non-goal for this release), and
  clearing site data deletes projects — **export your projects regularly**.
- **No project file import yet.** Export produces a website package, not a
  re-importable Frame project (spec §24 import is future work); recovery
  covers damaged/corrupt records shown in the UI.
- **Exported sites use hash routes** (`/#/about`) so they work on any static
  host without rewrite rules.
- **Scope boundaries from the spec** — no multiplayer, no arbitrary
  JavaScript or custom CSS editing, no plugin marketplace, no fully
  unrestricted rich text.
- **History is bounded** to 80 steps per page per session, and undo/redo is
  session-only (never persisted).
- **Large projects** are tested at roughly 800 nodes per page with
  performance budgets; beyond that the editor still works but is not tuned.

## License

Private project — all rights reserved unless stated otherwise.
