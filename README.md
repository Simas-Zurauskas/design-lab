# Design Lab

An HTML design workbench — our Figma replacement for producing app designs.

Everything is plain HTML + Tailwind, so AI edits it natively (no design-tool round-trips), every change is a
reviewable diff, prototypes are actually clickable, and the design tokens you approve are the exact CSS the
real app ships with. The design-to-dev handoff step disappears.

## The workflow

Each step is a section in the sidebar — a pan/zoom canvas, like a Figma page:

1. **Wireframes** — grayscale flows, so feedback stays about structure, not colors.
2. **Explorations** — drastically different visual directions side by side; keep what fits.
3. **Theme** — the chosen look as design tokens in one file, `src/theme.css`.
4. **Components** — the building blocks, made only from those tokens.
5. **High fidelity** — screens composed from the components; re-skinning for the next app = swapping `theme.css`.

**Current state:** Wireframes hold *Horse Tinder* (14 screens, 5 journeys). The other sections are empty and
`theme.css` has neutral placeholder tokens.

## Quick start

```sh
yarn            # install
yarn dev        # http://localhost:1234 — opens into Wireframes
yarn links      # print what links to what, per section (fails on broken links, unlabeled controls)
yarn build      # dist/ — fully static, works from file:// or any host
yarn test       # + yarn lint · yarn typecheck · yarn format:check — what CI runs on every push
```

## Using it

- **The canvas** — scroll to pan, pinch or ⌘/Ctrl+scroll to zoom, drag empty space (or Space+drag, or
  middle-drag anywhere) to pan. `+` / `−`, Shift+1 fit, Shift+0 real size, `?` for all shortcuts. Screens show
  at real device size at 100%; click a group's title to zoom to it.
- **Screens are live** — click through them right on the canvas; drag to scroll inside one. Chips, switches and
  choices really toggle. ↺ on a screen (or ↺ Reset all) brings it back once it lights up.
- **Hotspots** (header) — outline what can be clicked: solid goes to another screen, dotted changes the screen
  in place. Off / Hover / Always.
- **Flows** (header) — a line from each link to the screen it opens, like Figma's prototype view. Hover shows
  just the line of the link you're pointing at.
- **Full screen** — click a screen's name: it opens in a phone frame with ‹ Gallery, ↺ Reset and Hotspots, and
  the address bar follows you as you click through.
- **Light / Dark** — bottom of the sidebar; it themes the workbench, never the designs.

## Layout

| Where | What |
| --- | --- |
| `src/wireframes/` · `src/explorations/` · `src/theme/` · `src/components/` · `src/hifi/` | The sections: each `index.html` is its canvas; screens are `screen-NN.html`. |
| `src/theme.css` | All design tokens — the single source of truth for hi-fi. |
| `src/components/` | Shared design parts via `<include>` — edit once, changes everywhere (themed ones in `components/hifi/`). |
| `src/_lab/` + `scripts/` | **The workbench itself** — map in [`src/_lab/README.md`](src/_lab/README.md). Only changed on purpose; day-to-day design work never touches it. |
| `CLAUDE.md` | How AI agents work in this repo — rules, where things go, recipes. |

Icons are [Lucide](https://lucide.dev), bundled locally — `<i data-lucide="name" class="h-5 w-5"></i>` works in
any screen.

## Sharing

`yarn build` produces a self-contained `dist/` — open it from the filesystem or drop it on any static host.
(From the filesystem, icons don't render — host it for a full demo.)

**In Notion, privately:** live embeds of each section — the repo stays private and the site is viewable only
inside Notion (Cloudflare Pages + a small edge rule).

## Gotchas

- Links to screens that don't exist yet **fail the build** — use `href="#"` until the target exists.
- `yarn dev` and `yarn build` both write `dist/` — never run them at the same time.
- New Tailwind class not showing in dev? Delete `.parcel-cache` and restart. New section? Restart `yarn dev`.
