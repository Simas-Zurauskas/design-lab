# Design Lab

An HTML design workbench — our Figma replacement for producing app designs.

Everything here is plain HTML + Tailwind, which means AI edits it natively (no design-tool MCP round-trips), every change is a reviewable diff, prototypes are actually clickable, and the design tokens you approve are the exact CSS the real app ships with. The design-to-dev handoff step disappears.

**The workflow (per app):**

1. **Wireframe** a flow in `src/wireframes/` — grayscale on purpose, so feedback stays about structure and flow, not colors.
2. **Settle the brand** in `src/theme.css` — one file of design tokens; argue about it on the Theme page, which renders every token live.
3. **Promote screens** to `src/hifi/` — built exclusively from the tokens, so re-skinning for the next app = swapping `theme.css`.

**Current state: blank.** No project designs are loaded. Each section has one placeholder `screen-01.html` to copy from, and `theme.css` holds neutral placeholder tokens — start by filling those in.

## Quick start

```sh
yarn            # install
yarn dev        # http://localhost:1234 — opens straight into the wireframes gallery
yarn build      # dist/ — fully static, works from file:// or any host
```

Each section gallery shows screens in scaled phone frames with per-screen and reset-all buttons. Click a screen title to view it full size — a floating "‹ Gallery / ↺ Reset" bar gets you back (it hides itself inside gallery embeds). Screens link to each other, so the whole thing doubles as a clickable prototype.

Scrollable areas (horizontal rails, vertical lists, the screen itself) can be **click-dragged with the mouse**, the way a finger would move them — no touch device needed to demo a scrolling prototype. Wheel and trackpad still work as usual.

## Layout

| Where | What |
| --- | --- |
| `src/wireframes/` | Grayscale screens + gallery. One file per screen. |
| `src/theme.css` | ALL design tokens (`@theme static`) — the single source of truth. |
| `src/theme/` | The Theme page: swatches, type scale, controls — values read live from the tokens. |
| `src/hifi/` | Themed screens + gallery. **Theme tokens only** — no hex, no default-palette classes (audit grep in CLAUDE.md). |
| `src/components/` | Shared design parts via posthtml `<include>` — edit once, changes everywhere. Currently just the phone status bar. |
| `src/_lab/` + `scripts/` | **The workbench itself** (sidebar, phone frames, reset/back controls, build fixer). Marked with `LAB CHROME` headers — only edited on explicit request. Day-to-day work never touches these. |

Icons are [Lucide](https://lucide.dev), bundled locally as a system default — `<i data-lucide="name" class="h-5 w-5"></i>` works on every screen, wireframe and hi-fi alike.

## Sharing

`yarn build` produces a self-contained `dist/` — open it from the filesystem, drop it on any static host, or link it from Notion. For inline viewing in Notion docs, paste screenshots of the screens and keep the hosted build as the click-through link.

## Gotchas

- Links to screens that don't exist yet **hard-fail the build** — use `href="#"` until the target file exists.
- Dev and build both write `dist/` — never run them at the same time.
- Dev server missing new Tailwind classes? Delete `.parcel-cache` and restart.
- `yarn build` chains `scripts/fix-nested-urls.mjs` (Parcel's relative refs break on nested pages without it) — don't bypass it.
- Adding screens/sections: recipes in `CLAUDE.md` — short version: copy a sibling file, add a gallery figure / sidebar link.
