/* ============================================================
   LAB CHROME — screen: the canvas bridge — the screen side of
   canvas/canvas.js and flows/flows.js. Inside a canvas frame:
   scroll and pinch over a screen move the canvas (no scroll traps),
   a middle-drag that starts on a screen pans it, canvas shortcuts
   pressed while focus is inside are passed up, and the screen
   reports where its links sit and which one is hovered (flow
   lines). Dragging still scrolls screen content (drag-scroll.js);
   ⌥/Alt + scroll scrolls it natively. Outside a canvas (the
   full-screen view) this does nothing.
   Messages (core/lab.js) → parent: canvas:hello | canvas:wheel |
   canvas:gesture | canvas:pan | canvas:key | canvas:links |
   canvas:hover; ← parent: canvas:host.
   ============================================================ */

(() => {
  if (!Lab.hosted) return;

  let host = false;
  try {
    host = !!window.frameElement?.closest('[data-canvas]');
  } catch {
    // cross-origin (file://) — the canvas announces itself instead (canvas:host)
  }
  Lab.on('canvas:host', (d, e) => {
    if (e.source !== window.parent) return;
    host = true;
    reportLinks();
  });

  const send = (type, fields) => Lab.post(window.parent, type, fields);
  send('canvas:hello');

  // Links for the flow lines (flows.js): each one's VISIBLE box in this screen's own px and where it
  // goes. A link scrolled away or cut off by an overflow area reports the nearest visible point
  // instead, flagged hidden. Re-sent (once per frame at most) on load, scroll, resize and DOM change.
  let queued = false;
  let reported = []; // the <a> behind each entry of the last report, in order
  let hoveredEl = null; // the link under the pointer — its line is the one to show
  let hovered = -1;
  const sendHover = () => {
    const i = hoveredEl ? reported.indexOf(hoveredEl) : -1;
    if (i === hovered) return;
    hovered = i;
    if (host) send('canvas:hover', { index: i });
  };
  const reportLinks = () => {
    if (!host || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const clips = new Map(); // element → its visible box: the viewport cut down by clipping ancestors
      const clipOf = (el) => {
        if (!el || el === document.body || el === document.documentElement) return { l: 0, t: 0, r: innerWidth, b: innerHeight };
        if (clips.has(el)) return clips.get(el);
        let c = clipOf(el.parentElement);
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const r = el.getBoundingClientRect();
          c = { l: Math.max(c.l, r.left), t: Math.max(c.t, r.top), r: Math.min(c.r, r.right), b: Math.min(c.b, r.bottom) };
        }
        clips.set(el, c);
        return c;
      };
      // what the pointer would actually land on at (x, y) — the lab's own layers don't count
      const hits = (a, x, y) => {
        const el = document.elementFromPoint(x, y);
        return !!el && (el === a || a.contains(el));
      };
      const links = [];
      reported = [];
      for (const a of document.querySelectorAll('a[href]')) {
        if (!(a instanceof HTMLAnchorElement)) continue; // an SVG <a> has no string href — not a screen link
        if (links.length >= Lab.MAX_LINKS || a.closest('[data-lab-bar]')) continue;
        const r = a.getBoundingClientRect();
        if (!r.width || !r.height) continue; // not rendered
        const c = clipOf(a.parentElement);
        let l = Math.max(c.l, r.left);
        let t = Math.max(c.t, r.top);
        let rr = Math.min(c.r, r.right);
        let b = Math.min(c.b, r.bottom);
        let shown = rr > l && b > t;
        // Covered at its middle (a full-screen backdrop under a sheet): keep only the part you can
        // actually click, found by sampling a grid. Covered everywhere: it can't be clicked — no line.
        if (shown && !hits(a, (l + rr) / 2, (t + b) / 2)) {
          const N = 6;
          const cw = (rr - l) / N;
          const ch = (b - t) / N;
          let box = null;
          for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
              const x = l + (i + 0.5) * cw;
              const y = t + (j + 0.5) * ch;
              if (!hits(a, x, y)) continue;
              box = box
                ? { l: Math.min(box.l, x - cw / 2), t: Math.min(box.t, y - ch / 2), r: Math.max(box.r, x + cw / 2), b: Math.max(box.b, y + ch / 2) }
                : { l: x - cw / 2, t: y - ch / 2, r: x + cw / 2, b: y + ch / 2 };
            }
          }
          if (!box) continue;
          [l, t, rr, b] = [box.l, box.t, box.r, box.b];
          shown = true;
        }
        // hidden: the point of the visible area nearest to the link
        const px = Math.min(Math.max((r.left + r.right) / 2, c.l), c.r);
        const py = Math.min(Math.max((r.top + r.bottom) / 2, c.t), c.b);
        reported.push(a);
        links.push(
          shown
            ? { href: a.href, nav: !!a.closest('nav'), x: l, y: t, w: rr - l, h: b - t }
            : { href: a.href, nav: !!a.closest('nav'), x: px, y: py, w: 0, h: 0, hidden: true },
        );
      }
      send('canvas:links', { page: location.href, links });
      hovered = -2; // positions renumbered: re-announce the hovered link
      sendHover();
    });
  };
  addEventListener('pointerover', (e) => {
    hoveredEl = (e.target instanceof Element && e.target.closest('a[href]')) || null;
    sendHover();
  });
  document.documentElement.addEventListener('pointerleave', () => {
    hoveredEl = null;
    sendHover();
  });
  addEventListener('load', reportLinks);
  addEventListener('scroll', reportLinks, { capture: true, passive: true });
  addEventListener('resize', reportLinks);
  // the lab's own layers (scroll thumbs, the bar) change constantly and never move a link. aria-pressed /
  // aria-checked: a toggle (interact.js) can show or hide content through Tailwind aria-* variants and move links
  new MutationObserver(
    (records) => records.some((r) => !(r.target instanceof Element && r.target.closest('.lab-scroll-layer, [data-lab-bar]'))) && reportLinks(),
  ).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'href', 'hidden', 'aria-pressed', 'aria-checked'],
  });
  reportLinks();

  addEventListener(
    'wheel',
    (e) => {
      if (!host || e.altKey) return;
      e.preventDefault();
      send('canvas:wheel', {
        x: e.clientX,
        y: e.clientY,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        wheelDeltaY: ('wheelDeltaY' in e && e.wheelDeltaY) || 0, // non-standard (Chromium / WebKit): tells a mouse wheel from a trackpad
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      });
    },
    { passive: false },
  );

  // middle-drag pans the canvas from anywhere — over a screen too. Streamed in screen
  // coordinates: this screen moves with the canvas under the mouse while it pans.
  let mid = null; // { x, y, moved }
  // this screen owns the pointer for the whole drag, so it has to show the grab cursor itself
  const grabbing = document.createElement('style');
  grabbing.textContent = '* { cursor: grabbing !important; }';
  const endMid = () => {
    if (!mid) return;
    const moved = mid.moved;
    mid = null;
    grabbing.remove();
    send('canvas:pan', { phase: 'end' });
    if (moved) Lab.swallowNext('auxclick'); // a drag must not also middle-click (open in new tab) what it ended on
  };
  addEventListener(
    'pointerdown',
    (e) => {
      if (!host || e.button !== 1) return;
      e.preventDefault(); // no autoscroll
      mid = { x: e.screenX, y: e.screenY, moved: false };
      document.head.append(grabbing);
      send('canvas:pan', { phase: 'start', sx: e.screenX, sy: e.screenY });
    },
    true,
  );
  addEventListener('mousedown', (e) => host && e.button === 1 && e.preventDefault(), true);
  addEventListener(
    'pointermove',
    (e) => {
      if (!mid) return;
      if (!(e.buttons & 4)) return endMid(); // released where we couldn't see it
      if (Math.hypot(e.screenX - mid.x, e.screenY - mid.y) > 3) mid.moved = true;
      send('canvas:pan', { phase: 'move', sx: e.screenX, sy: e.screenY });
    },
    true,
  );
  addEventListener('pointerup', (e) => e.button === 1 && endMid(), true);
  addEventListener('pointercancel', endMid, true);

  // Safari pinch — GestureEvent is Safari-only, so it isn't in the DOM typings
  /** @param {Event & { scale: number, clientX: number, clientY: number }} e */
  const onGesture = (e) => {
    if (!host) return;
    e.preventDefault();
    send('canvas:gesture', { phase: e.type.slice(7), scale: e.scale, x: e.clientX, y: e.clientY });
  };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(type, onGesture, { passive: false });

  const isCanvasKey = (e) => Lab.isSpace(e) || !!Lab.canvasKey(e); // the canvas's shortcuts: one list, core/lab.js
  let spaceUp = false; // a Space we took on keydown — its keyup is ours too
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    const { type } = e;
    if (!host || Lab.editable(e.target) || !isCanvasKey(e)) return;
    if (Lab.isSpace(e)) {
      // a control reached with the keyboard keeps Space for itself
      if (type === 'keydown' && !spaceUp && Lab.keyboardFocused()) return;
      if (type === 'keyup' && !spaceUp) return;
      spaceUp = type === 'keydown';
    }
    e.preventDefault();
    send('canvas:key', { type, key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey });
  };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  // focus left the screen with Space still down: its keyup will never arrive here
  addEventListener('blur', () => {
    endMid();
    if (!spaceUp) return;
    spaceUp = false;
    send('canvas:key', { type: 'keyup', key: ' ', code: 'Space' });
  });
})();
