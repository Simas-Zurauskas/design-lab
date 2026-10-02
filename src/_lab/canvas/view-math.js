/* ============================================================
   LAB CHROME — canvas: the view maths, as pure functions of
   (view, viewport, content) — no DOM, no state — so canvas.js
   stays about input and the numbers can be tested on their own
   (test/view-math.test.mjs). A view maps world → canvas:
   p = world * k + (x, y). Loaded by canvas/canvas.html before
   canvas.js. Classic script (not a module) so it also runs from
   file://.
   ============================================================ */

(() => {
  const MIN_K = 0.05;
  const MAX_K = 4;
  const STEPS = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const KEEP = 96; // px of content that always stays in view — it can't be panned into the void
  const FIT_PAD = 40; // px kept around whatever is being fitted
  const TITLE_ROOM = 40; // px above a fitted rect for group titles
  const TOOLS_ROOM = 40; // px below it, clear of the zoom toolbar

  const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));

  Lab.viewMath = {
    clampK,
    /** view → the nearest allowed one: zoom in range, and at least KEEP px of the content on screen */
    clampView({ x, y, k }, vp, content) {
      k = clampK(k);
      const mx = Math.min(KEEP, vp.w / 2);
      const my = Math.min(KEEP, vp.h / 2);
      return {
        k,
        x: Math.min(vp.w - mx, Math.max(mx - content.w * k, x)),
        y: Math.min(vp.h - my, Math.max(my - content.h * k, y)),
      };
    },
    /** view zoomed to k, with the world point under canvas point p staying put */
    zoomAround(v, k, p) {
      k = clampK(k);
      const r = k / v.k;
      return { k, x: p.x - (p.x - v.x) * r, y: p.y - (p.y - v.y) * r };
    },
    /**
     * world rect → the view that shows it whole, centered, never above 100%.
     * `head` = px kept free above the rect for the titles that sit on top of it (they don't scale with the zoom,
     * so this can't be folded into the world rect); `left` = px of the canvas's left edge covered by a panel
     * (the groups list) — the rect is fitted into the rest
     */
    fitRect(r, vp, head = TITLE_ROOM, left = 0) {
      if (!(r.w > 0 && r.h > 0)) return { k: 1, x: left + FIT_PAD, y: FIT_PAD + head };
      const w = Math.max(1, vp.w - left - 2 * FIT_PAD);
      const h = Math.max(1, vp.h - 2 * FIT_PAD - head - TOOLS_ROOM);
      const k = clampK(Math.min(w / r.w, h / r.h, 1));
      return { k, x: left + FIT_PAD + (w - r.w * k) / 2 - r.x * k, y: FIT_PAD + head + (h - r.h * k) / 2 - r.y * k };
    },
    /** the world rect the canvas shows, grown by `margin` canvas px on every side */
    viewRect({ x, y, k }, vp, margin = 0) {
      return { x: (-x - margin) / k, y: (-y - margin) / k, w: (vp.w + 2 * margin) / k, h: (vp.h + 2 * margin) / k };
    },
    /** two rects share some area (touching edges don't count) */
    overlaps: (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h,
    /** the next zoom stop from k: dir > 0 in, dir < 0 out (off the ends: the limit) */
    step(k, dir) {
      if (dir > 0) return STEPS.find((s) => s > k * 1.001) ?? MAX_K;
      return [...STEPS].reverse().find((s) => s < k / 1.001) ?? MIN_K;
    },
  };
})();
