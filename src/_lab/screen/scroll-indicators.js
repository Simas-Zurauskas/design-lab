/* ============================================================
   LAB CHROME — screen: scroll indicators. Screens hide native
   scrollbars (screen/screen.css) and get iOS-style ones instead — thin overlay thumbs
   that take no layout space and are hidden at rest. They flash
   when the screen loads, while an area scrolls, and when the
   pointer first enters a scrollable area (the desktop stand-in
   for "you could swipe here"). Drawn in a fixed layer on top of
   the screen, so design markup is never touched.
   Classic script (not a module) so it also runs from file://.
   ============================================================ */

(() => {
  const INSET = 2; // px from the scroller's edge
  const THICK = 3; // px
  const MIN_LEN = 24; // px
  const LINGER = 900; // ms visible after the last scroll / hover-in

  const page = Lab.page;
  const axes = (el) => Lab.scrollAxes(el);
  // the areas the pointer is over: nearest scroller per axis
  const scrollersAt = (start) => {
    const { x, y } = Lab.scrollersAt(start);
    return new Set([x, y].filter(Boolean));
  };

  const layer = document.createElement('div');
  layer.className = 'lab-scroll-layer';
  document.body.append(layer);

  const bars = new Map(); // scroller -> { x, y, timer }

  // padding box of the scroller in viewport coords. The page's own
  // indicator hugs the phone column, not the (possibly wide) window.
  const box = (el) => {
    if (el === page()) {
      const col = document.body.firstElementChild?.getBoundingClientRect();
      const left = col ? Math.max(col.left, 0) : 0;
      const right = col ? Math.min(col.right, el.clientWidth) : el.clientWidth;
      return { left, top: 0, width: right - left, height: el.clientHeight };
    }
    const r = el.getBoundingClientRect();
    return { left: r.left + el.clientLeft, top: r.top + el.clientTop, width: el.clientWidth, height: el.clientHeight };
  };

  const place = (el, bar, can = axes(el)) => {
    const b = box(el);
    if (can.y) {
      const track = b.height - 2 * INSET;
      const len = Math.max(MIN_LEN, (track * el.clientHeight) / el.scrollHeight);
      const pos = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * (track - len);
      Object.assign(bar.y.style, {
        left: `${b.left + b.width - INSET - THICK}px`,
        top: `${b.top + INSET + pos}px`,
        width: `${THICK}px`,
        height: `${len}px`,
      });
    }
    if (can.x) {
      const track = b.width - 2 * INSET;
      const len = Math.max(MIN_LEN, (track * el.clientWidth) / el.scrollWidth);
      const pos = (el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (track - len);
      Object.assign(bar.x.style, {
        left: `${b.left + INSET + pos}px`,
        top: `${b.top + b.height - INSET - THICK}px`,
        width: `${len}px`,
        height: `${THICK}px`,
      });
    }
  };

  const show = (el) => {
    const can = axes(el);
    if (!can.x && !can.y) return;
    let bar = bars.get(el);
    if (!bar) bars.set(el, (bar = {}));
    for (const axis of ['x', 'y']) {
      if (!can[axis] || bar[axis]) continue;
      bar[axis] = document.createElement('div');
      bar[axis].className = 'lab-scroll-thumb';
      layer.append(bar[axis]);
    }
    place(el, bar, can);
    for (const axis of ['x', 'y']) bar[axis]?.toggleAttribute('data-on', can[axis]);
    clearTimeout(bar.timer);
    bar.timer = setTimeout(() => {
      bar.x?.removeAttribute('data-on');
      bar.y?.removeAttribute('data-on');
    }, LINGER);
  };

  // scrolling one area moves the others on screen (a rail inside a scrolled page)
  const placeVisible = () => bars.forEach((bar, el) => (bar.x?.hasAttribute('data-on') || bar.y?.hasAttribute('data-on')) && place(el, bar));

  document.addEventListener(
    'scroll',
    (e) => {
      show(e.target === document ? page() : e.target);
      placeVisible();
    },
    { capture: true, passive: true },
  );
  addEventListener('resize', placeVisible);

  // hover hint: flash only the areas the pointer just entered, not on every move
  let hovered = new Set();
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const now = scrollersAt(e.target);
    now.forEach((el) => !hovered.has(el) && show(el));
    hovered = now;
  });
  document.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) hovered = new Set(); // left the screen: re-entering flashes again
  });

  // flash on appear, like a phone does when a scroll view comes on screen
  const flashAll = () => [page(), ...document.body.querySelectorAll('*')].forEach(show);
  if (document.readyState === 'complete') flashAll();
  else addEventListener('load', flashAll, { once: true });
})();
