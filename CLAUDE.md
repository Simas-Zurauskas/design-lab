# Design Lab

An HTML design workbench — a Figma replacement where every design is plain HTML + Tailwind v4, so AI edits
it directly, every change is a diff, prototypes are really clickable, and the approved tokens are the CSS the
app ships with. Parcel builds it; posthtml `<include>` composes it. Two technical users; AI does most edits.

Each **section** (sidebar) is a pan/zoom **canvas** (Figma-like) of screens or boards — except Explorations, a
scrolling **sheet** per round — in workflow order:
**Explorations → Design System → Wireframes → Components → High fidelity.**

## Read this first — system vs content

- **SYSTEM** — the workbench: `src/_lab/` (its map: **`src/_lab/README.md`**), `scripts/`, `test/`,
  `src/index.html`, `package.json` and the tool configs. Every file in `src/_lab/` starts with a `LAB CHROME` header. **Never edit system
  files unless the user explicitly asks to change the workbench itself.**
- **CONTENT** — the designs: screens, what's on each canvas, `src/components/`, `src/theme.css`, the
  content-layer rules in `src/styles.css`.
- Default assumption: every request is about designs.
- **Docs are three files — there is no `docs/` folder:** `README.md` (people), this file (agents),
  `src/_lab/README.md` (the workbench map). Keep them true; don't create new doc files or a `docs/` folder. One more
  file is not a doc but a pointer: `EXPLORATIONS-PROMPT.md` — Explorations rounds are run by the `mood-board-creator`
  skill (`~/dev/ai/SKILLS/mood-board-creator`); the file says how to start one here.

## Where the designs are

| Path | Section | What goes there |
| --- | --- | --- |
| `src/explorations/` | Explorations | Divergent visual directions in **rounds** — free-form on purpose (any colors, fonts, images; not bound to tokens). `round-NN.html` is one round: a **sheet** (scrolls like a page, no pan/zoom); `index.html` opens the latest round; `parts/rounds.html` is the round tabs. A variant = `screen-rR-vNN-1…3.html` + `rR-vNN.css` (every selector under `.rR-vNN`) + `parts/rR-vNN-board.html` (its description board); shared photos in `img/`. The winner is promoted into `theme.css`. |
| `src/theme.css` | — | **All design tokens** (`@theme static`) — the single source of truth. Re-skin = edit only this file. |
| `src/theme/index.html` | Design System | Boards previewing the tokens (values can be read live via `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')`; which swatches exist is hand-kept). |
| `src/wireframes/` | Wireframes | Grayscale screens (`screen-NN.html`) + `index.html` (the canvas arrangement). Structure and flow only — never color or branding. |
| `src/components/` | Components | Design parts, included with `<include src="components/x.html"></include>` (path from `src/`, NOT from the including file): `status-bar.html` (neutral phone OS chrome); wireframe parts are `wf-<name>.html`. Themed parts go in `components/hifi/` (create it with the first one). `components/index.html` is the Components canvas — the only page in this folder (the build's entries are `src/*/index.html` + `src/*/screen-*.html`, so parts are never built as pages). |
| `src/hifi/` | High fidelity | Themed screens + canvas. `screen-01.html` is the blank scaffold to copy (not on the canvas). |
| `src/styles.css` | — | Imports Tailwind, `theme.css` and the lab; below that, content-layer rules (e.g. a tab bar's active state keyed off `data-page`, Components boards on the theme). |

**Current state:** a blank lab. Wireframes hold one placeholder group, *Sample flow* (01 · Home → 02 · Item → 03 ·
Done), to copy from and then replace. Explorations has an empty Round 1 (`round-01.html`; `index.html` opens it).
Design System, Components and High fidelity are empty; `theme.css` holds neutral placeholder values.

## Rules

1. **Wireframes are grayscale.** Tailwind `gray-*` + white/black only, the `.wf-img` (image placeholder) and
   `.wf-line` (text line) primitives, no brand.
2. **Hi-fi uses theme tokens only** — `src/hifi/`, `src/components/hifi/`, `src/components/index.html`:
   `bg-primary`, `text-ink`, `border-line`, `rounded-card`, `font-display`… never hex, never palette classes.
   Audit (must print nothing):
   ```sh
   grep -rnsE '#[0-9a-fA-F]{3,8}|(bg|text|border|from|to|ring)-(gray|slate|zinc|red|blue|green|amber|neutral|stone)-[0-9]' src/hifi/ src/components/hifi/ src/components/index.html
   ```
   Exceptions: `components/status-bar.html` (neutral OS chrome); lab classes in markup (`.phone-frame`, `.lab-*`).
3. **Links & interactions — the markup is the only source.** Every element in a screen is exactly one of:
   - **goes to a screen** → `<a href="screen-05.html">` (solid hotspot, a flow line on the canvas);
   - **changes the UI in place** → `<button aria-pressed="false">` (on/off: chips, switches) or
     `role="radio"` + `aria-checked` inside `role="radiogroup" aria-label="…"` (one of many). Style both states
     with Tailwind `aria-pressed:` / `aria-checked:` (children: `group` + `group-aria-*:`). Dotted hotspot;
   - **does nothing yet** → `<a href="#">` (target not designed) or a plain `<button>` — not outlined, not
     clickable-looking. Things that never do anything (past days, taken slots) are plain text.
   Clicking, hotspots, flow lines and `yarn links` all read these same attributes. Content that changes a lot
   (next month, a sent message) is its own state screen linked with `href`. Never a `<script>` in a design.
4. **Label icon-only links and controls** (`aria-label`) and give them a size (`h-9 w-9`…). `yarn links` fails on
   a link or control with no name.
5. **Boards** (`.lab-board`) get an explicit width (`w-[896px]`) and no viewport breakpoints (`sm:` / `lg:`)
   inside — the canvas, not the window, sizes them.
6. **Icons**: Lucide, full set — `<i data-lucide="house" class="h-5 w-5"></i>` anywhere; any name works (inlined as
   `<svg>` at build — an unknown name fails the build). No brand icons (Google/Apple…) — use neutral shapes.
7. **Keep files small** — one screen / component per file. That's the point of the setup.

## Common tasks

- **New screen** — copy `screen-01.html` in `src/wireframes/` or `src/hifi/` (status bar, lab line, nothing
  else), set `<title>` (`"15 · Settings"` — the canvas caption and frame title must match it; `yarn links`
  checks) and `<body data-page="…">`. Its last
  line stays `<include src="_lab/screen/chrome.html"></include>`. Links to screens that don't exist yet
  **hard-fail the build** — use `href="#"` until they do.
- **Put it on the canvas** — in that section's `index.html`, inside a group's `.lab-row`:
  ```html
  <figure class="lab-screen">
    <figcaption><a href="screen-15.html">15 · Settings</a><button data-reset class="lab-btn" title="Reset this screen">↺</button></figcaption>
    <div class="phone-frame"><iframe src="screen-15.html" title="Settings" class="phone-screen"></iframe></div>
  </figure>
  ```
- **Group a journey** — `<section class="lab-group"><h2 class="lab-group-title">Settings</h2> <div class="lab-row">…screens…</div> </section>`;
  put groups side by side in a `.lab-row` at the top of `[data-canvas-world]`. No coordinates — CSS lays it out.
- **New component** — `src/components/hifi/<name>.html` (tokens only). On the Components canvas: a group per
  component, a `<div class="lab-board w-[…]">` per state containing its `<include>` (boards sit on the theme
  automatically). Hi-fi screens include the same file — the library and the screens can't drift.
- **Preview tokens** — boards on the Design System canvas; **explore a direction** — a variant in an Explorations
  round (next two items).
- **New variant in a round** — its files (table above); in the round page a
  `<section class="lab-sheet-section" id="rR-vNN"><div class="lab-sheet-fit">` holding the board's `<include>`, then a
  `.lab-row` of `figure.lab-screen`s (same markup as a canvas, iframes `loading="lazy"`). Fonts: a Google Fonts
  `<link>` in each screen's `<head>` and in the round page's (never a CSS `@import` — a build may merge stylesheets
  and drop it). Boards on a sheet: `w-[1286px]` = a row of three devices.
- **New round** — add its tab to `src/explorations/parts/rounds.html`, create `round-NN.html` from the last round
  (keep the skeleton: sidebar, header with the tabs include, `[data-lab-sheet]` > `.lab-sheet-body`,
  `_lab/sheet/sheet.html` last), point `src/explorations/index.html` at it.
- **Check the flow** — `yarn links` prints what links to what, per section, lists placeholders and screens
  nothing links to, and fails on missing targets, unlabeled controls and screen names on a canvas or round page
  that don't match `<title>`.
- **Workbench changes** (new section, lab UI, behavior) — system; see `src/_lab/README.md` (map, contracts,
  messages, recipes).

## What the user sees (so you can reason about reports)

- **Canvas**: scroll = pan · pinch / ⌘-Ctrl+scroll = zoom · drag empty space, Space+drag or middle-drag
  (anywhere) = pan · `+` `−` · Shift+1 fit · Shift+0 100% · `?` shortcuts. Scrolling over a screen pans the
  canvas; dragging scrolls inside it (⌥/Alt+scroll natively). Screens render at native 390×844 (100% = device
  size). Opening a section fits it; coming back (‹ Gallery, Back, a reload) restores the view.
- **Sheet** (Explorations rounds): scrolls like a page — scroll over a screen scrolls the page, dragging scrolls
  inside it (⌥/Alt+scroll natively). Screens at native size, scaled down with their board as one block when the
  window is narrow (CSS zoom steps). Round tabs next to the title; no Groups list, no flow lines.
- **Groups list**: top-left of every canvas with groups, fixed while it pans — each group's name (+ how many
  screens), a click zooms to it like its title does. Header switch **Groups** Off/On (starts On).
- **Header switches** (sections with screens): **Hotspots** Off/Hover/Always (solid = goes to a screen,
  dotted = changes the UI; the one under the pointer pulses). While it's Hover or Always, pointing at a link
  also draws a line to the screen it opens (flows — no switch of their own). Switches are remembered per page
  for the tab. ↺ Reset all + a ↺ per screen light up once a screen was clicked away from or changed.
- **Full screen** (a screen's name clicked, or its URL): the screen in a device bezel on the lab background,
  with ‹ Gallery (back to the page it was opened from — a round, a canvas), ↺ Reset and Hotspots. `?bare` shows
  the raw page.
- **Sidebar bottom**: Light / Dark for the lab UI only — designs never change with it.

## Commands

Package manager is **yarn** (yarn.lock — never create package-lock.json).
- `yarn dev` → http://localhost:1234 (never while `yarn build` runs — both write `dist/`)
- `yarn build` → static `dist/`, works from `file://` or any host. Chains `scripts/fix-nested-urls.mjs` (fails on a
  ref that resolves nowhere); don't bypass it. Then copies `_headers` (Cloudflare caching) into `dist/`.
- `yarn links` → the link map (exit 1 on missing targets, unlabeled controls, canvas / round names ≠ `<title>`)
- `yarn test` · `yarn lint` · `yarn format` / `format:check` · `yarn typecheck` — the gates CI runs
  (`.github/workflows/check.yml`, with `build`, `links`, a dependency audit and a secret sweep). Run them after
  any workbench change; content-only changes need `yarn links` (and `yarn build` if links changed).

## Gotchas

- New Tailwind class not showing in dev → delete `.parcel-cache`, restart `yarn dev`.
- A new section needs a `yarn dev` restart (the entries are globs in `package.json` → `source`).
- A link to a screen that doesn't exist fails the build — `href="#"` until it exists.
