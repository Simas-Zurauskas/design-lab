# Design Lab

Design workbench: wireframes → theme tokens → high-fidelity screens. Parcel + Tailwind v4 + posthtml includes. Two technical users; AI does most edits.

## System vs content — read this first
`src/_lab/` and `scripts/` are **workbench infrastructure** (phone frames, sidebar, reset buttons, wf primitives, build fixer). **Never edit them unless the user explicitly asks to change the workbench itself.** Default assumption: every request is about designs (screens, tokens, design components). System files carry a `LAB CHROME` header comment as a second signal.

## Structure
- `src/_lab/` — SYSTEM: `lab.css` (`.phone-frame`/`.phone-screen`/`.lab-btn`/`.lab-bar` chrome, sidebar active states, `.wf-img`/`.wf-line` wireframe primitives), `sidebar.html`, `reset.js` (gallery reset buttons), `back.html` (full-screen "‹ Gallery / ↺ Reset" bar — every screen includes it before `</body>`; it hides itself inside gallery iframes), `drag-scroll.js` (click-drag scrolling for any overflow area — no markup needed, see below).
- `scripts/fix-nested-urls.mjs` — SYSTEM: post-build step; Parcel writes root-relative bundle refs that break nested pages. Always part of `yarn build`; don't remove.
- `src/index.html` — SYSTEM: redirect to the wireframes gallery (no landing page by design).
- `src/theme.css` — CONTENT: ALL design tokens (`@theme static`). Single source of truth; per-project re-skin = edit only this file.
- `src/theme/index.html` — CONTENT: renders the tokens; values read live from CSS variables, but the swatch LIST is hand-maintained — new token = add a swatch card.
- `src/wireframes/` — CONTENT: grayscale screens + gallery. Structure/flow only — never add color or branding.
- `src/hifi/` — CONTENT: themed screens + gallery.
- `src/components/` — CONTENT: parts of the designs, included via `<include src="components/x.html"></include>` (path relative to `src/`, NOT to the including file). Currently only `status-bar.html` (neutral phone OS chrome). Hi-fi variants go in `components/hifi/` (create it when the first one exists).

**The lab is currently blank** — no project designs. Each section holds one placeholder `screen-01.html` to copy from, and `theme.css` carries neutral placeholder values. Starting a project = fill in `theme.css`, then build screens.

## The one hard rule for hi-fi
Hi-fi files (`src/hifi/`, `src/components/hifi/`) use THEME TOKENS ONLY — `bg-primary`, `text-ink`, `border-line`, `rounded-app`, `font-display`… Never hex values, never default-palette classes (`gray-*`, `blue-*`…). Audit (must return nothing):
```sh
grep -rnE '#[0-9a-fA-F]{3,8}|(bg|text|border|from|to|ring)-(gray|slate|zinc|red|blue|green|amber|neutral|stone)-[0-9]' src/hifi/ src/components/hifi/
```
Disclosed exceptions: `components/status-bar.html` (neutral OS chrome); `.phone-frame`/`.lab-btn` classes (workbench chrome from `_lab/lab.css`).

## Icons
Lucide is the system icon set (full set bundled via `src/_lab/icons.js` — SYSTEM file). Use `<i data-lucide="house" class="h-5 w-5"></i>` anywhere; any lucide name works with no system edit. Icons render as inline SVGs inheriting the current text color. Every screen + the theme page loads it with `<script type="module" src="../_lab/icons.js"></script>` before `</body>` — copy that line into new screens. Lucide has NO brand icons (Google/Apple etc.) — use neutral shapes for those.

## Scrolling — system behavior, no design wiring
Phone screens have no touch on a desktop browser, so `_lab/drag-scroll.js` lets any scrollable area be **grabbed and dragged with the mouse** — horizontal rails, vertical lists, and the whole screen. It ships inside the `_lab/back.html` include, so **every screen has it automatically**; never add a per-screen script tag or per-design drag code. Section pages (galleries, theme) load it directly since they don't include back.html.

Zero markup in designs: write normal `overflow-x-auto` / `overflow-y-auto` containers and they are draggable. It resolves the nearest scrollable ancestor **per axis** (so dragging a horizontal rail still scrolls the page vertically) and falls back to the page itself. Wheel/trackpad are unaffected; a drag past 4px suppresses the click underneath so dragging a rail of links doesn't navigate.

## Commands
Package manager is **yarn** (yarn.lock — do not create package-lock.json).
- `yarn dev` → http://localhost:1234 (never run while `build` runs — both write `dist/`)
- `yarn build` → static `dist/`, works from file:// or any host

## Adding things
- **Screen**: copy `screen-01.html` in `src/wireframes/` or `src/hifi/` (a blank scaffold carrying the status bar, back bar and icons script), set `<title>` + `data-page`, add a `<figure class="phone-frame">…` block to that section's gallery. Parcel picks it up via the package.json globs. Links to screens that don't exist yet HARD-FAIL the build — use `href="#"` until the target exists.
- **Section**: new `src/<name>/index.html` (copy an existing section page, set `data-section`), one link in `src/_lab/sidebar.html`, one active-state selector in `_lab/lab.css` (both are system edits — this is the explicit-request case).
- **Active states** are CSS-only: `data-section` (sidebar) / `data-page` (bottom nav) on `<body>`.

## Gotchas
- Dev server missing new Tailwind classes → delete `.parcel-cache`, restart.
- Keep files small (one screen/component per file) — that's the point of the setup.
