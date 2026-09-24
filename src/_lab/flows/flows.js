/* ============================================================
   LAB CHROME — flows: on a canvas, a line from every link in a
   screen to the screen it opens — like Figma's prototype
   connections. Header switch (flows/toggle.html): Off / Hover
   (only the line of the link under the pointer) / Always (all
   lines; the one under the pointer stands out, the rest dim).
   Starts on Hover; remembered per page for the tab.
   Screens report their links from the inside (screen/bridge.js),
   so lines follow scrolling and clicking through, and it works
   from file:// too. Lines live in an SVG inside the world — world
   units, so pan and zoom move them for free — while stroke width,
   start dot and arrowhead stay screen-sized. Links inside a <nav>
   (tab bars: the same on every screen) are drawn faint; a link
   out of view starts dashed at the nearest visible edge.
   Classic script (not a module) so it also runs from file://.
   ============================================================ */

(() => {
  const canvas = document.querySelector('[data-canvas]');
  const world = canvas?.querySelector('[data-canvas-world]');
  if (!(canvas instanceof HTMLElement) || !(world instanceof HTMLElement)) return;
  const figures = [...world.querySelectorAll('.lab-screen')].filter((f) => f.querySelector('iframe'));
  if (!figures.length) return;

  const EDGE = 64; // world units kept between an arrival and the target's corners

  const pathOf = Lab.path;
  const screens = figures.map((fig) => {
    const frame = fig.querySelector('iframe');
    return { fig, frame, bezel: fig.querySelector('.phone-frame') || frame, path: pathOf(frame.getAttribute('src')), page: null, links: [] };
  });
  const byPath = new Map(screens.map((s) => [s.path, s]));

  const make = (tag, attrs = {}) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    return el;
  };
  const svg = make('svg', { class: 'lab-flows', 'aria-hidden': 'true' });
  world.append(svg);

  /* ---- geometry: layout boxes in world units (untouched by the canvas transform) ---- */

  const boxOf = (el) => {
    let x = 0;
    let y = 0;
    for (let n = el; n && n !== world;) {
      x += n.offsetLeft;
      y += n.offsetTop;
      const p = n.offsetParent;
      if (p && p !== world) {
        x += p.clientLeft;
        y += p.clientTop;
      }
      n = p;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const f = (n) => Math.round(n * 10) / 10;

  // One link → one curve. Target beside the screen: leave the link on the side facing it and enter
  // its nearest edge, level with the link when it can, so lines stay as straight as possible.
  // Target above / below: leave sideways past the screen's nearer edge, then arc into the target's
  // top / bottom — never straight through the screen's own content.
  const curve = (frameBox, from, to, l, lit, ends) => {
    const L = { x: frameBox.x + l.x, y: frameBox.y + l.y, w: l.w, h: l.h };
    const cx = L.x + L.w / 2;
    const cy = L.y + L.h / 2;
    const span = (d) => Math.min(Math.max(d * 0.5, 48), 360);
    let sx, sy, ex, ey, c1, c2;
    if (to.x >= from.x + from.w || to.x + to.w <= from.x) {
      const dir = to.x >= from.x + from.w ? 1 : -1; // right / left
      sx = dir > 0 ? L.x + L.w : L.x;
      sy = cy;
      ex = dir > 0 ? to.x : to.x + to.w;
      ey = clamp(cy, to.y + EDGE, to.y + to.h - EDGE);
      const reach = span(Math.abs(ex - sx));
      c1 = [sx + dir * reach, sy];
      c2 = [ex - dir * reach, ey];
    } else {
      const down = to.y >= from.y + from.h ? 1 : -1; // below / above
      const side = cx >= from.x + from.w / 2 ? 1 : -1; // the screen's nearer vertical edge
      sx = side > 0 ? L.x + L.w : L.x;
      sy = cy;
      const edge = side > 0 ? from.x + from.w : from.x;
      ex = clamp(edge, to.x + EDGE, to.x + to.w - EDGE);
      ey = down > 0 ? to.y : to.y + to.h;
      c1 = [edge + side * 72, sy]; // clear the edge before turning
      c2 = [ex, ey - down * span(Math.abs(ey - sy))];
    }
    const angle = (Math.atan2(ey - c2[1], ex - c2[0]) * 180) / Math.PI;
    const g = make('g', { class: `lab-flow${l.nav ? ' is-nav' : ''}${l.hidden ? ' is-offscreen' : ''}${lit ? ' is-focus' : ''}`, ...ends });
    g.append(
      make('path', { d: `M${f(sx)} ${f(sy)}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(ex)} ${f(ey)}` }),
      make('circle', { r: '3.5', style: `transform:translate(${f(sx)}px,${f(sy)}px) scale(var(--flow-s))` }),
      make('path', {
        class: 'lab-flow-arrow',
        d: 'M0 0L-9 -5L-9 5Z',
        style: `transform:translate(${f(ex)}px,${f(ey)}px) rotate(${f(angle)}deg) scale(var(--flow-s))`,
      }),
    );
    return g;
  };

  /* ---- render (once per frame at most) ---- */

  let mode = 'always';
  let focus = null; // { s, i } — link i of screen s is under the pointer
  let queued = false;
  const draw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  };
  const render = () => {
    queued = false;
    canvas.toggleAttribute('data-flow-focus', !!focus && mode !== 'off');
    if (mode === 'off') return svg.replaceChildren();
    svg.setAttribute('width', world.offsetWidth);
    svg.setAttribute('height', world.offsetHeight);
    const boxes = new Map(screens.map((s) => [s, { frame: boxOf(s.frame), bezel: boxOf(s.bezel) }]));
    const rest = [];
    const front = []; // the hovered link's line paints on top
    for (const s of screens) {
      const page = pathOf(s.page);
      for (const [i, l] of s.links.entries()) {
        const target = pathOf(l.href);
        const t = byPath.get(target);
        if (!t || t === s || target === page) continue; // not on this canvas, or a link to itself
        const lit = !!focus && focus.s === s && focus.i === i;
        if (mode === 'hover' && !lit) continue;
        const ends = { 'data-from': page || s.path, 'data-to': target }; // for inspection / tests
        (lit ? front : rest).push(curve(boxes.get(s).frame, boxes.get(s).bezel, boxes.get(t).bezel, l, lit, ends));
      }
    }
    svg.replaceChildren(...rest, ...front);
  };

  /* ---- links reported by each screen (screen/bridge.js) ---- */

  const screenOf = (source) => screens.find((x) => x.frame.contentWindow === source); // only our own screens
  Lab.on('canvas:links', (d, e) => {
    const s = screenOf(e.source);
    if (!s || !Array.isArray(d.links)) return;
    s.page = typeof d.page === 'string' ? d.page : null;
    s.links = d.links
      .slice(0, Lab.MAX_LINKS)
      .filter((l) => l && typeof l.href === 'string' && [l.x, l.y, l.w, l.h].every((n) => Number.isFinite(+n)))
      .map((l) => ({ href: l.href, nav: !!l.nav, hidden: !!l.hidden, x: +l.x, y: +l.y, w: Math.max(0, +l.w), h: Math.max(0, +l.h) }));
    draw();
  });
  // which link the pointer is on (screen/bridge.js) — -1: none
  Lab.on('canvas:hover', (d, e) => {
    const s = screenOf(e.source);
    if (!s || !Number.isInteger(d.index)) return;
    if (d.index >= 0) focus = { s, i: d.index };
    else if (focus?.s === s) focus = null;
    draw();
  });
  // a screen navigating inside its frame: drop the old page's lines until the new one reports
  for (const s of screens) {
    s.frame.addEventListener('load', () => {
      s.links = [];
      if (focus?.s === s) focus = null;
      draw();
    });
  }
  new ResizeObserver(draw).observe(world);

  /* ---- mode: the header switch ---- */

  Lab.toggle('flows', {
    fallback: 'hover',
    onChange: (m) => {
      mode = m;
      canvas.dataset.flows = m;
      draw();
    },
  });
})();
