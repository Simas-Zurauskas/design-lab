# Design Lab

An HTML design workbench — our Figma replacement for producing app designs.

Everything is plain HTML + Tailwind, so AI edits it natively (no design-tool round-trips), every change is a
reviewable diff, prototypes are actually clickable, and the design tokens you approve are the exact CSS the
real app ships with. The design-to-dev handoff step disappears.

## The workflow

Each step is a section in the sidebar — a pan/zoom canvas, like a Figma page (Explorations and the Design System:
pages that scroll like a document):

1. **Explorations** — drastically different visual directions, a round at a time: each direction a description
   board (a style tile) above its live screens. Tabs in the header switch rounds; keep what fits.
2. **Design System** — the chosen look as design tokens in one file, `src/theme.css`, explained in a scrolling
   document (principles, colour, type, layout, components, accessibility, how to build with it).
3. **Wireframes** — grayscale flows, so feedback stays about structure, not colors: one canvas per *package* of
   journeys, a note under each frame for the variations that share its layout, all built from a shared gray kit
   drawn on the design system's geometry.
4. **Components** — the building blocks, made only from those tokens.
5. **High fidelity** — screens composed from the components; re-skinning for the next app = swapping `theme.css`.

**Current state:** a blank lab. Wireframes hold the gray kit (the **Kit** tab) and one placeholder package
(*Sample*, four frames) to copy from; the Design System document is a skeleton showing the neutral placeholder
tokens in `theme.css`; Explorations has an empty Round 1; Components and High fidelity are empty.

## Quick start

```sh
yarn            # install
yarn dev        # http://localhost:1234 — opens into Explorations
yarn links      # print what links to what, per section (fails on broken links, unlabeled controls)
yarn build      # dist/ — fully static, works from file:// or any host
yarn test       # + yarn lint · yarn typecheck · yarn format:check — what CI runs on every push
```

## Using it

- **The canvas** — scroll to pan, pinch or ⌘/Ctrl+scroll to zoom, drag empty space (or Space+drag, or
  middle-drag anywhere) to pan. `+` / `−`, Shift+1 fit, Shift+0 real size, `?` for all shortcuts. Screens show
  at real device size at 100%; click a group's title — or its name in the **Groups** list, top-left (switch it
  Off / On in the header) — to zoom to it.
- **Screens are live** — click through them right on the canvas; drag to scroll inside one. Chips, switches and
  choices really toggle. ↺ on a screen (or ↺ Reset all) brings it back once it lights up.
- **Hotspots** (header) — outline what can be clicked: solid goes to another screen, dotted changes the screen
  in place. Off / Hover / Always. While they show, pointing at a link draws a line to the screen it opens, like
  Figma's prototype view.
- **Explorations rounds** — a page that scrolls like a document: scroll over a screen scrolls the page, drag to
  scroll inside it. Screens are real size, scaled down together when the window is narrow. The round tabs next
  to the title switch rounds.
- **Full screen** — click a screen's name: it opens in a phone frame with ‹ Gallery, ↺ Reset and Hotspots, and
  the address bar follows you as you click through. ‹ Gallery goes back to the page you opened it from.
- **Light / Dark** — bottom of the sidebar; it themes the workbench, never the designs.

## Layout

| Where | What |
| --- | --- |
| `src/explorations/` · `src/design-system/` · `src/wireframes/` · `src/components/` · `src/hifi/` | The sections: each `index.html` is its canvas (or document); screens are `screen-*.html`. Explorations has a page per round (`round-NN.html`), Wireframes a canvas per package (`round-<package>.html`) plus the Kit; each `index.html` is the overview. |
| `src/theme.css` | All design tokens — the single source of truth for hi-fi. |
| `src/components/` | Shared design parts via `<include>` with JSON props — edit once, changes everywhere (the gray wireframe kit in `components/wf/`, themed ones in `components/hifi/`). |
| `src/_lab/` + `scripts/` | **The workbench itself** — map in [`src/_lab/README.md`](src/_lab/README.md). Only changed on purpose; day-to-day design work never touches it. |
| `CLAUDE.md` | How AI agents work in this repo — rules, where things go, recipes. |
| `EXPLORATIONS-PROMPT.md` | How to start an Explorations round: rounds are run by the `mood-board-creator` skill (researched guidelines, divergent variants built and critiqued from screenshots, the round page). |

Icons are [Lucide](https://lucide.dev), inlined at build time — `<i data-lucide="name" class="h-5 w-5"></i>` works in
any screen (a misspelled name fails the build).

## Sharing

`yarn build` produces a self-contained `dist/` — open it from the filesystem or drop it on any static host. On
Cloudflare, `_headers` (copied into `dist/`) lets browsers cache the scripts and styles instead of re-checking them.

**Hosted:** `wrangler.jsonc` deploys the lab to Cloudflare Workers once Workers Builds is connected to this repo (it
builds on every push to `main`); it can be embedded in Notion.
Opened in its own tab it asks for a password first; inside Notion (or any frame) and on `localhost` / `file://` it
doesn't. The browser remembers the unlock until the password changes. It is a client-side lock — it keeps casual
visitors out, but the pages are public to anyone who reads the source. To change the password:
`printf %s 'new password' | shasum -a 256`, paste the result as `PASSWORD_SHA256` in `src/_lab/gate/gate.js`, push.

## Gotchas

- Links to screens that don't exist yet **fail the build** — use `href="#"` until the target exists.
- `yarn dev` and `yarn build` both write `dist/` — never run them at the same time.
- New Tailwind class not showing in dev? Delete `.parcel-cache` and restart. New section? Restart `yarn dev`.
