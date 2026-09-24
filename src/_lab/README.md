# `_lab/` — the workbench (SYSTEM)

Everything in this folder is the **Design Lab itself** — the frame designs are shown in — never a design.
Designs live in `src/<section>/`, `src/components/` and `src/theme.css`. Change anything here only when
asked to change the workbench. Every file starts with a `LAB CHROME` header saying what it is.

## Conventions

- **One job per folder**; each keeps its CSS, JS and HTML include together.
- **Names**: lab classes are `lab-*`, lab attributes `data-lab-*` / `data-canvas*`, storage keys `lab:*`,
  window messages `{ lab: '<type>' }`. Designs never use any of them (except the arrangement classes a section page
  uses on purpose — see *Section page*).
- **Colors and the device size**: only in `core/tokens.css` (`--lab-*`; colors light + dark, `--lab-device-*` /
  `--lab-bezel-*` once). No hex anywhere else in lab CSS (one exception: the white under a screen while it loads).
- **Scripts are classic** (no `import`) so the build works from `file://`; each is an IIFE. Shared helpers live
  once on the `Lab` global (`core/lab.js`: `var Lab`, typed from that file by `yarn typecheck`) — reuse them,
  don't re-write them. `icons/icons.js` is the one module (it imports lucide).
- **Checked**: `yarn lint` (an empty `catch` needs a comment saying why), `yarn typecheck` (a misspelled `Lab.*`
  member or message type fails), `yarn test` (`test/` — view maths, `Lab` core, both scripts).
- **Zero per-design wiring**: a screen has one lab line; a section page has three includes. Behavior comes
  from plain HTML (`<a href>`, `aria-pressed`, `role="radio"`) — never a script inside a design.

## Map

| Folder | What | Files | Loaded by |
| --- | --- | --- | --- |
| `core/` | Shared foundation | `tokens.css` lab colors (light/dark) + device size · `lab.js` the `Lab` global: `hosted`, the message protocol (`post` / `on`), the canvas shortcut list (`canvasKey`), `toggle`, shared helpers | `lab.css` · first script of `shell/sidebar.html` and `screen/chrome.html` |
| `shell/` | Frame of every section page | `sidebar.html` nav + light/dark switch (boots core + theme) · `sidebar.js` current section + switch · `theme.js` applies light/dark · `shell.css` page, sidebar, header, `.lab-btn`, `.lab-seg` | section pages (`sidebar.html`); `theme.js` also in screens |
| `canvas/` | The pan/zoom field | `canvas.html` toolbar, shortcuts, empty state + loads every section-page script · `view-math.js` clamp / zoom / fit / steps (pure) · `canvas.js` engine (input) · `canvas.css` field, rows, groups, screens, boards, phone frame · `gallery.js` ↺ reset buttons | section pages (`canvas.html`) |
| `flows/` | Lines link → screen | `toggle.html` header switch · `flows.js` draws them · `flows.css` | header (`toggle.html`), `canvas.html` (`flows.js`) |
| `hotspots/` | Outlines on what's clickable | `toggle.html` switch (+ `host.js`) · `host.js` hands the mode to screens · `screen.js` sets it inside a screen · `hotspots.css` | header + full-screen bar (`toggle.html`), `screen/chrome.html` (`screen.js`) |
| `screen/` | What every screen gets | `chrome.html` the one include · `viewer.js` full-screen device view + bar · `bridge.js` screen ↔ canvas · `interact.js` in-screen state · `drag-scroll.js` · `scroll-indicators.js` · `screen.css` | every screen (`chrome.html`) |
| `wireframe/` | The wireframe medium | `wireframe.css` `.wf-img` `.wf-line` | `lab.css` (used inside wireframe screens) |
| `icons/` | Lucide runtime | `icons.js` | `screen/chrome.html`, `canvas/canvas.html` |
| `lab.css` | CSS entry — imports the above in order | | `src/styles.css` |

Also system, outside this folder: `scripts/links.mjs` (`yarn links`), `scripts/fix-nested-urls.mjs` (post-build),
`test/` (`yarn test`), `src/index.html` (redirect to the wireframes section), `package.json` (its `source` globs
are the build's entries: `src/*/index.html`, `src/*/screen-*.html`), the tool configs and `.github/workflows/`.

## Section page (`src/<section>/index.html`)

```html
<body data-section="wireframes" class="lab-page">
  <div class="lab-shell">
    <include src="_lab/shell/sidebar.html"></include>          <!-- FIRST: boots Lab + theme -->
    <main class="lab-main">
      <header class="lab-header">
        <div><h1>Title</h1><p>One line.</p></div>
        <div class="lab-header-controls">                       <!-- only sections with screens -->
          <include src="_lab/hotspots/toggle.html"></include>
          <include src="_lab/flows/toggle.html"></include>
          <button data-reset-all class="lab-btn">↺ Reset all</button>
        </div>
      </header>
      <div data-canvas class="lab-canvas" role="region" aria-label="… canvas">
        <div data-canvas-world class="lab-canvas-world"> …arrangement… </div>
        <include src="_lab/canvas/canvas.html"></include>        <!-- LAST: controls + scripts -->
      </div>
    </main>
  </div>
</body>
```

Arrangement (plain CSS flow, no coordinates): `.lab-row` (screens, or groups side by side) ·
`section.lab-group > h2.lab-group-title` (a journey; its title zooms to it) · `figure.lab-screen`
(figcaption name + `data-reset` button, `.phone-frame > iframe.phone-screen`) · `.lab-board` (fixed-width
non-screen content). Sizes are world units: 1 = one device px at 100%.

## Screen (`src/<section>/screen-*.html`)

A normal page the device's width (390 px, `core/tokens.css`); its last line in `<body>` is `<include src="_lab/screen/chrome.html"></include>`.
That gives: the full-screen device viewer + bar (‹ Gallery, ↺ Reset, Hotspots), hotspot outlines,
interactions, the canvas bridge, drag-to-scroll, scroll indicators, icons. Shown by the lab (a canvas frame or
the full-screen viewer) the bar stays hidden and `Lab.hosted` is true. A page merely *framed* by someone else
(a Notion embed) is not hosted: it keeps its own bar, viewer and switches.

## Messages between frames (`postMessage`)

Every message is `{ lab: TYPE, …fields }`, sent with `Lab.post(window, TYPE, fields)` and handled with
`Lab.on(TYPE, (data, event) => …)`. The types are listed once, in `MESSAGES` in `core/lab.js`: an unknown type
throws, and fails `yarn typecheck`.

| From → to | Type | Meaning |
| --- | --- | --- |
| screen → canvas | `canvas:hello` / ← `canvas:host` | handshake (the only way to know on `file://`) |
| screen → canvas | `canvas:wheel` · `canvas:gesture` · `canvas:pan` · `canvas:key` | scroll / pinch / middle-drag / shortcuts over a screen move the canvas |
| screen → canvas | `canvas:links` · `canvas:hover` | where the screen's links are and which is pointed at (flows) |
| screen → host | `hotspots:ask` / ← `hotspots:mode` | hotspot mode, asked on load, pushed on change |
| screen → host | `screen:changed` | a control changed state — light the screen's ↺ reset |

Hosts accept messages only from their own frames (`event.source` checked) — every handler, no exceptions.

## Storage

| Key | Where | What |
| --- | --- | --- |
| `lab:theme` | localStorage | light / dark choice (absent = follow the system) |
| `lab:canvas:<page>` | session | canvas view (center + zoom) to return to |
| `lab:hotspots:<page>` · `lab:flows:<page>` | session | per-page switch choice (default Hover) |
| `lab:hotspots:<section>/(full screen)` | session | the full-screen views' hotspot choice |
| `lab:entry` | session | the screen a full-screen viewing started on (↺ Reset target) |

## Recipes (system changes)

- **New section** — `src/<name>/index.html` from the skeleton above (`data-section="<name>"`) and a link in
  `shell/sidebar.html` (`data-side="<name>"` — the current-section highlight is automatic). The build picks it
  up by glob (`package.json` → `source`). Restart `yarn dev`.
- **New lab color** — add `--lab-<name>` to both blocks of `core/tokens.css`, use `var(--lab-<name>)`.
- **New remembered switch** — markup `<div data-lab-toggle="name" class="lab-seg">` with
  `<button data-mode="…">`s; drive it with `Lab.toggle('name', { fallback, onChange })`.
- **New message between frames** — add its type to `MESSAGES` in `core/lab.js` (with a one-line meaning), then
  `Lab.post` / `Lab.on` it; add a row to the table above.
- **New canvas shortcut** — add it to `Lab.canvasKey` (`core/lab.js`) as a toolbar action name and handle that
  name in `canvas.js`'s `act()` — screens pass it up by themselves.
- **New behavior inside every screen** — a classic script in `screen/`, added to `screen/chrome.html` after
  `core/lab.js`.
- **Verify** — `yarn lint`, `yarn typecheck` and `yarn test` pass; `yarn build` passes (a link to a missing screen
  or a ref that resolves nowhere hard-fails); `yarn links` exits 0; the page works from `dist/` opened as a file.
