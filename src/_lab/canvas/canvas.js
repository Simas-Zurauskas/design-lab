/* ============================================================
   LAB CHROME — canvas: every section page as a 2D field you pan
   and zoom, Figma-style. Markup contract (see _lab/README.md):
     [data-canvas]            viewport — clips, takes all input
       [data-canvas-world]    laid out by plain CSS (canvas.css),
                              moved and scaled as one piece
   Screens sit at native device size (core/tokens.css) and the zoom
   does all scaling, so 100% is real device size. Opening a section always fits
   everything; coming back to it (from one of its screens, Back,
   or a dev reload) lands exactly where you were — the view is
   kept per tab in sessionStorage. Screens pass their
   scroll / pinch / shortcuts up here via screen/bridge.js.
   Background dots take their color from --lab-dot (core/tokens.css)
   and redraw when the lab theme switches. The view maths (clamp,
   zoom, fit, zoom steps) is canvas/view-math.js.
   Classic script (not a module) so it also runs from file://.
   ============================================================ */

(() => {
  const FAR_K = 0.12; // below this, screen names are too small to read and hide
  const DOT_STEP = 24; // world units between background dots at the finest level
  const DOT_MIN = 14; // px — dots never sit closer than this on screen
  const DOT_R = 1; // px
  const DRAG_THRESHOLD = 4; // px before a press on a name / title turns into a pan
  const IDLE = 160; // ms without input before a gesture is over (screens take the pointer back)
  const LINE_PX = 16; // wheel deltaMode 1 (Firefox mouse wheels) → px
  const STORE = `lab:canvas:${location.pathname}`;
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const canvas = document.querySelector('[data-canvas]');
  const world = canvas && canvas.querySelector('[data-canvas-world]');
  if (world) setup(canvas, world);

  function setup(canvas, world) {
    const tools = canvas.querySelector('[data-canvas-tools]');
    const help = canvas.querySelector('[data-canvas-help]');
    const helpBtn = canvas.querySelector('[data-canvas-action="help"]');
    const zoomLabel = canvas.querySelector('[data-canvas-zoom-label]');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const grid = document.createElement('canvas');
    grid.className = 'lab-canvas-grid';
    grid.setAttribute('aria-hidden', 'true');
    canvas.prepend(grid);
    const ctx = grid.getContext('2d');

    let view = { x: 0, y: 0, k: 1 }; // world → canvas: p = world * k + (x, y)
    let vp = { w: 0, h: 0 }; // canvas size
    let content = { w: 0, h: 0 }; // world size, untransformed
    let started = false;
    let restored = false; // view came from storage — never auto re-fit over it
    let touched = false; // the user moved the view — never auto re-fit over it

    /* ---- geometry ------------------------------------------------------- */

    let rect = null; // canvas client rect; reset whenever it can change
    const canvasRect = () => rect || (rect = canvas.getBoundingClientRect());
    const local = (cx, cy) => {
      const r = canvasRect();
      return { x: cx - r.left, y: cy - r.top };
    };
    const center = () => ({ x: vp.w / 2, y: vp.h / 2 });
    // the view maths (canvas/view-math.js), bound to this canvas's viewport and content
    const math = Lab.viewMath;
    const clampK = math.clampK;
    const clampView = (v) => math.clampView(v, vp, content);
    const zoomAround = math.zoomAround; // same world point stays under canvas point p
    const fitRect = (r, head) => math.fitRect(r, vp, head);
    // the arranged content itself — not the world's padding, which only reserves room for titles
    // at the farthest zoom
    const contentBox = () => {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const el of world.children) {
        if (el.matches('.lab-flows')) continue; // flow lines span the world; not content
        x0 = Math.min(x0, el.offsetLeft);
        y0 = Math.min(y0, el.offsetTop);
        x1 = Math.max(x1, el.offsetLeft + el.offsetWidth);
        y1 = Math.max(y1, el.offsetTop + el.offsetHeight);
      }
      return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: content.w, h: content.h };
    };
    const fitAll = () => fitRect(contentBox());
    const worldRect = (el) => {
      const r = el.getBoundingClientRect();
      const c = canvasRect();
      return { x: (r.left - c.left - view.x) / view.k, y: (r.top - c.top - view.y) / view.k, w: r.width / view.k, h: r.height / view.k };
    };
    const measure = () => {
      content = { w: world.offsetWidth, h: world.offsetHeight };
    };

    /* ---- render + persist ----------------------------------------------- */

    let band = '';
    let saveTimer = 0;
    // The world is promoted to its own layer only while it moves (canvas.css, [data-gesture]): a zoom then scales
    // one bitmap instead of re-rastering every live screen at every new scale — which, measured over a pinch,
    // was 5–10× the raster work and presented frames late or partial. Once input stops it re-rasters crisp.
    // Background dots, drawn at their exact positions every frame (a tiled CSS background
    // snaps and shimmers). On-screen spacing is folded into one octave [DOT_MIN, 2·DOT_MIN):
    // every other dot fades out as you zoom out and back in as you zoom in, so the density
    // never jumps — at the fold, the half-faded dots are exactly the ones that vanish.
    // dot color from the lab theme (--lab-dot, core/tokens.css) — re-read when it switches
    const readDot = () => getComputedStyle(canvas).getPropertyValue('--lab-dot').trim() || 'transparent';
    let dotColor = readDot();
    document.addEventListener('lab:theme', () => {
      dotColor = readDot();
      drawGrid();
    });
    const drawGrid = () => {
      if (!ctx || !vp.w || !vp.h) return;
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.round(vp.w * dpr);
      const bh = Math.round(vp.h * dpr);
      if (grid.width !== bw || grid.height !== bh) {
        grid.width = bw;
        grid.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vp.w, vp.h);
      let f = DOT_STEP * view.k;
      while (f < DOT_MIN) f *= 2;
      while (f >= 2 * DOT_MIN) f /= 2;
      const fade = (f - DOT_MIN) / DOT_MIN; // 0 at the fold → 1 just before the next one
      const coarse = new Path2D();
      const fine = new Path2D();
      const i1 = Math.floor((vp.w - view.x) / f);
      const j1 = Math.floor((vp.h - view.y) / f);
      // centers snapped to device-pixel CENTERS: every dot rasterizes identically and crisp (a
      // dot on a pixel corner smears over four pixels at a quarter strength — near invisible on
      // 1x screens), and the field never brightens or dims as a whole when it moves sub-pixel
      const snap = (v) => (Math.floor(v * dpr) + 0.5) / dpr;
      for (let i = Math.ceil(-view.x / f); i <= i1; i++) {
        const px = snap(view.x + i * f);
        for (let j = Math.ceil(-view.y / f); j <= j1; j++) {
          const py = snap(view.y + j * f);
          const path = i & 1 || j & 1 ? fine : coarse; // every other dot, both axes, is the fading one
          path.moveTo(px + DOT_R, py);
          path.arc(px, py, DOT_R, 0, 2 * Math.PI);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = dotColor;
      ctx.fill(coarse);
      if (fade > 0.01) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = dotColor;
        ctx.fill(fine);
      }
    };
    // moved to a screen with another pixel density: redraw sharp
    const watchDpr = () =>
      matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener(
        'change',
        () => {
          drawGrid();
          watchDpr();
        },
        { once: true },
      );
    watchDpr();

    const render = () => {
      const { x, y, k } = view;
      world.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      world.style.setProperty('--k', k);
      drawGrid();
      const b = k < FAR_K ? 'far' : 'near';
      if (b !== band) canvas.dataset.zoom = band = b;
      if (zoomLabel) zoomLabel.textContent = `${Math.round(k * 100)}%`;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 200);
    };
    const set = (v) => {
      view = clampView(v);
      render();
    };

    // stored as the world point at the center + zoom, so a different window size still lands right
    const save = () => {
      if (started) Lab.session.set(STORE, JSON.stringify({ cx: (vp.w / 2 - view.x) / view.k, cy: (vp.h / 2 - view.y) / view.k, k: view.k }));
    };
    const restore = () => {
      try {
        const s = JSON.parse(Lab.session.get(STORE));
        if (!s || ![s.cx, s.cy, s.k].every(Number.isFinite) || s.k <= 0) return null;
        const k = clampK(s.k);
        return { k, x: vp.w / 2 - s.cx * k, y: vp.h / 2 - s.cy * k };
      } catch {
        return null; // nothing stored, or garbage
      }
    };
    addEventListener('pagehide', save);

    /* ---- gesture state: screens don't catch the pointer while the canvas moves --- */

    let idleTimer = 0;
    const active = () => {
      if (!('gesture' in canvas.dataset)) canvas.dataset.gesture = '';
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!pan && !tween) delete canvas.dataset.gesture;
      }, IDLE);
    };

    /* ---- animation ------------------------------------------------------ */

    let tween = 0;
    let tweenTarget = null;
    const stop = () => {
      cancelAnimationFrame(tween);
      tween = 0;
      tweenTarget = null;
    };
    const base = () => tweenTarget || view; // repeated steps stack on where a running animation is headed
    // zoom interpolates in log space around an anchor, so it never swoops
    const animate = (target, anchor = center(), ms = 240) => {
      stop();
      target = clampView(target);
      if (ms <= 0 || reduceMotion.matches) return set(target);
      const from = view;
      const a0 = { x: (anchor.x - from.x) / from.k, y: (anchor.y - from.y) / from.k };
      const a1 = { x: (anchor.x - target.x) / target.k, y: (anchor.y - target.y) / target.k };
      const l0 = Math.log(from.k);
      const l1 = Math.log(target.k);
      const t0 = performance.now();
      tweenTarget = target;
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = 1 - (1 - t) ** 3;
        const k = Math.exp(l0 + (l1 - l0) * e);
        view = { k, x: anchor.x - (a0.x + (a1.x - a0.x) * e) * k, y: anchor.y - (a0.y + (a1.y - a0.y) * e) * k };
        render();
        if (t < 1) {
          tween = requestAnimationFrame(frame);
        } else {
          tween = 0;
          tweenTarget = null;
          set(target);
        }
        active();
      };
      tween = requestAnimationFrame(frame);
    };
    const go = (target, anchor, ms) => {
      touched = true;
      animate(target, anchor, ms);
    };
    const zoomStep = (dir) => {
      const b = base();
      go(zoomAround(b, math.step(b.k, dir), center()), center(), 200);
    };

    /* ---- wheel: trackpad pans + pinches directly, a mouse wheel eases ---- */

    let gesture = null; // Safari pinch (GestureEvent)
    const onWheel = (w, p) => {
      const m = w.deltaMode === 1 ? LINE_PX : w.deltaMode === 2 ? vp.h : 1;
      let dx = w.deltaX * m;
      let dy = w.deltaY * m;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      if (w.shiftKey && !dx) [dx, dy] = [dy, 0]; // shift + mouse wheel = sideways
      const mouse = w.deltaMode === 1 || (Number.isFinite(w.wheelDeltaY) && w.wheelDeltaY !== 0 && w.wheelDeltaY % 120 === 0 && !w.deltaX);
      touched = true;
      active();
      if (w.ctrlKey || w.metaKey) {
        if (gesture) return; // Safari already zooms via gesture events
        const f = Math.exp(-Math.max(-50, Math.min(50, mouse ? Math.sign(dy) * Math.min(Math.abs(dy), 30) : dy)) / 100);
        const b = base(); // direct input lands on where an eased step was headed — no motion lost
        if (mouse) animate(zoomAround(b, b.k * f, p), p, 140);
        else {
          stop();
          set(zoomAround(b, b.k * f, p));
        }
      } else {
        const b = base();
        if (mouse) animate({ k: b.k, x: b.x - dx, y: b.y - dy }, center(), 140);
        else {
          stop();
          set({ k: b.k, x: b.x - dx, y: b.y - dy });
        }
      }
    };
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!started) return; // no-JS fallback scrolls natively until the canvas is live
        e.preventDefault();
        onWheel(e, local(e.clientX, e.clientY));
      },
      { passive: false },
    );

    const onGesture = (phase, scale, p) => {
      if (phase === 'start') {
        stop();
        gesture = { k0: view.k };
        return;
      }
      if (!gesture) return;
      if (phase === 'end') {
        gesture = null;
        active();
        return;
      }
      if (pointers.size > 1 || !Number.isFinite(scale) || scale <= 0) return; // touch pinch runs through pointers
      touched = true;
      active();
      set(zoomAround(view, gesture.k0 * scale, p));
    };
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      canvas.addEventListener(
        type,
        (e) => {
          e.preventDefault(); // Safari would zoom the whole page
          if (started) onGesture(type.slice(7), e.scale, Number.isFinite(e.clientX) ? local(e.clientX, e.clientY) : center());
        },
        { passive: false },
      );
    }

    /* ---- pointer pan: empty space, Space + drag, middle button, touch ---- */

    const pointers = new Map(); // pointerId → canvas point
    let pan = null; // { moved, press, threshold, v0, c0, d0 }
    const centroid = () => {
      let x = 0;
      let y = 0;
      for (const p of pointers.values()) {
        x += p.x;
        y += p.y;
      }
      return { x: x / pointers.size, y: y / pointers.size };
    };
    const spread = () => {
      if (pointers.size < 2) return 0;
      const [a, b] = pointers.values();
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    // new finger count: carry on from the current view, no jump
    const rebase = () => {
      pan.v0 = { ...view };
      pan.c0 = centroid();
      pan.d0 = spread();
    };
    const beginPan = () => {
      pan.moved = true;
      touched = true;
      canvas.dataset.panning = '';
      for (const id of pointers.keys()) {
        try {
          canvas.setPointerCapture(id);
        } catch {
          // that pointer is already gone (released between events) — nothing to capture
        }
      }
    };
    const endPan = () => {
      const moved = !!pan?.moved;
      pointers.clear();
      pan = null;
      delete canvas.dataset.panning;
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      active();
      return moved;
    };
    const onMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return onUp(e); // release happened where we couldn't see it
      const p = local(e.clientX, e.clientY);
      pointers.set(e.pointerId, p);
      if (!pan.moved) {
        if (Math.hypot(p.x - pan.press.x, p.y - pan.press.y) <= pan.threshold) return;
        beginPan();
      }
      const c = centroid();
      const d = spread();
      const { v0, c0, d0 } = pan;
      const k = clampK(d0 > 0 && d > 0 ? (v0.k * d) / d0 : v0.k);
      set({ k, x: c.x - ((c0.x - v0.x) / v0.k) * k, y: c.y - ((c0.y - v0.y) / v0.k) * k });
      active();
    };
    const onUp = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size) return rebase();
      if (endPan()) Lab.swallowNext('click', 'auxclick'); // a drag that started on a name / title must not also open it
    };
    // left button pans from the canvas; the middle button pans from anywhere on the page
    document.addEventListener('pointerdown', (e) => {
      const middle = e.button === 1;
      const t = e.target;
      if (!started || (e.button !== 0 && !middle) || !(t instanceof Element)) return;
      if (!middle && (!canvas.contains(t) || t.closest('[data-canvas-tools], [data-canvas-help], code, input, textarea, select, [contenteditable]'))) return;
      if (e.pointerType === 'mouse' && pan) endPan(); // a lost release — start clean
      if (remote) remotePan('end');
      stop();
      pointers.set(e.pointerId, local(e.clientX, e.clientY));
      if (!pan) {
        const onControl = !middle && !!t.closest('a[href], button, [role="button"]');
        pan = { moved: false, press: pointers.get(e.pointerId), threshold: onControl ? DRAG_THRESHOLD : 0 };
        addEventListener('pointermove', onMove);
        addEventListener('pointerup', onUp);
        addEventListener('pointercancel', onUp);
      }
      rebase();
      if (middle) {
        // no autoscroll; screens stop catching the pointer before it can cross one. A middle-click
        // that never moves still reaches its link (open in new tab).
        e.preventDefault();
        canvas.dataset.panning = '';
      } else if (spaceHeld || pointers.size > 1) {
        e.preventDefault(); // text selection
        beginPan();
      }
    });
    document.addEventListener('mousedown', (e) => started && e.button === 1 && e.preventDefault()); // belt and braces: autoscroll

    // Middle-drag that began over a screen: the screen streams its pointer here (screen/bridge.js).
    // Screen coordinates, so it doesn't matter that the screen moves with the canvas under the mouse.
    let remote = null; // { sx, sy, v0 }
    const remotePan = (phase, sx, sy) => {
      if (phase === 'start') {
        if (pan) endPan();
        stop();
        remote = { sx, sy, v0: { ...view } };
        canvas.dataset.panning = '';
        touched = true;
      } else if (remote && phase === 'move') {
        set({ k: remote.v0.k, x: remote.v0.x + sx - remote.sx, y: remote.v0.y + sy - remote.sy });
      } else if (remote) {
        remote = null;
        delete canvas.dataset.panning;
      }
      active();
    };
    // the browser may route the rest of that drag to this page instead — same math
    addEventListener('pointermove', (e) => {
      if (!remote || e.pointerType !== 'mouse') return;
      if (e.buttons & 4) remotePan('move', e.screenX, e.screenY);
      else remotePan('end');
    });
    addEventListener('pointerup', (e) => remote && e.button === 1 && remotePan('end'));

    /* ---- keyboard ------------------------------------------------------- */

    let spaceHeld = false;
    const setSpace = (on) => {
      if (spaceHeld === on) return;
      spaceHeld = on;
      if (on) canvas.dataset.space = '';
      else delete canvas.dataset.space;
    };
    // a toolbar button or its shortcut (Lab.canvasKey — the same names)
    const act = (action) => {
      if (action === 'in') zoomStep(1);
      else if (action === 'out') zoomStep(-1);
      else if (action === 'actual') go(zoomAround(base(), 1, center()));
      else if (action === 'fit') go(fitAll());
      else if (action === 'help') toggleHelp();
    };
    // true = the key is the canvas's (caller prevents its default)
    const onKey = (e, fromScreen) => {
      if (Lab.isSpace(e)) {
        if (!fromScreen && e.type === 'keydown' && !spaceHeld && Lab.keyboardFocused()) return false; // a keyboard-focused control keeps Space
        setSpace(e.type === 'keydown');
        return true;
      }
      if (e.type !== 'keydown') return false;
      const action = Lab.canvasKey(e);
      if (action) return (act(action), true);
      if (e.altKey || e.ctrlKey || e.metaKey) return false;
      if (e.key === 'Escape' && helpOpen) return (toggleHelp(false), true);
      if (!fromScreen && ARROWS[e.key]) {
        const [ax, ay] = ARROWS[e.key];
        const d = e.shiftKey ? 320 : 64;
        const b = base();
        go({ k: b.k, x: b.x - ax * d, y: b.y - ay * d }, center(), 160);
        return true;
      }
      return false;
    };
    addEventListener('keydown', (e) => {
      if (!started || e.defaultPrevented || Lab.editable(e.target)) return;
      if (onKey(e, false)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      if (Lab.isSpace(e) && spaceHeld) {
        setSpace(false);
        e.preventDefault();
      }
    });
    // focus left the page (another window, the OS): no key or button release will ever arrive
    const release = () => {
      setSpace(false);
      if (pan) endPan();
      if (remote) remotePan('end');
    };
    addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => document.hidden && release());

    /* ---- screens (screen/bridge.js) ------------------------------------- */

    const frames = () => world.querySelectorAll('iframe');
    const frameOf = (source) => {
      for (const f of frames()) if (f.contentWindow === source) return f;
      return null;
    };
    // point inside a screen (its own CSS px) → canvas point, whatever the zoom
    const framePoint = (frame, x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return center();
      const r = frame.getBoundingClientRect();
      const s = frame.offsetWidth ? r.width / frame.offsetWidth : 1;
      return local(r.left + x * s, r.top + y * s);
    };
    const greet = (f) => Lab.post(f.contentWindow, 'canvas:host');
    for (const f of frames()) {
      greet(f);
      f.addEventListener('load', () => greet(f));
    }
    // only our own screens may drive the canvas — and only once it's live (a hello is always answered)
    const fromScreen = (type, handle) =>
      Lab.on(type, (d, e) => {
        const frame = frameOf(e.source);
        if (frame && (started || type === 'canvas:hello')) handle(d, frame);
      });
    fromScreen('canvas:hello', (d, frame) => greet(frame));
    fromScreen('canvas:pan', (d) => {
      const sx = Number(d.sx);
      const sy = Number(d.sy);
      if (d.phase === 'end' || (['start', 'move'].includes(d.phase) && Number.isFinite(sx) && Number.isFinite(sy))) remotePan(d.phase, sx, sy);
    });
    fromScreen('canvas:wheel', (d, frame) => {
      const wheel = {
        deltaX: +d.deltaX || 0,
        deltaY: +d.deltaY || 0,
        deltaMode: +d.deltaMode || 0,
        wheelDeltaY: +d.wheelDeltaY || 0,
        ctrlKey: !!d.ctrlKey,
        metaKey: !!d.metaKey,
        shiftKey: !!d.shiftKey,
      };
      onWheel(wheel, framePoint(frame, Number(d.x), Number(d.y)));
    });
    fromScreen('canvas:gesture', (d, frame) => {
      if (['start', 'change', 'end'].includes(d.phase)) onGesture(d.phase, Number(d.scale), framePoint(frame, Number(d.x), Number(d.y)));
    });
    fromScreen('canvas:key', (d) => {
      if ((d.type !== 'keydown' && d.type !== 'keyup') || typeof d.key !== 'string') return;
      onKey(
        { type: d.type, key: d.key, code: String(d.code || ''), shiftKey: !!d.shiftKey, ctrlKey: !!d.ctrlKey, metaKey: !!d.metaKey, altKey: !!d.altKey },
        true,
      );
    });

    /* ---- controls: toolbar, help, group titles ----------------------------- */

    let helpOpen = false;
    const toggleHelp = (open = !helpOpen) => {
      if (!help) return;
      helpOpen = open;
      help.hidden = !open;
      helpBtn?.setAttribute('aria-expanded', String(open));
    };
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (helpOpen && !(e.target instanceof Element && e.target.closest('[data-canvas-help], [data-canvas-action="help"]'))) toggleHelp(false);
      },
      true,
    );
    // mouse clicks don't park focus on the toolbar, so Space stays the hand tool
    tools?.addEventListener('pointerdown', (e) => e.target.closest('button') && e.preventDefault());
    tools?.addEventListener('click', (e) => {
      const action = e.target.closest('[data-canvas-action]')?.dataset.canvasAction;
      if (started && action) act(action);
    });

    for (const t of world.querySelectorAll('.lab-group-title')) {
      t.setAttribute('role', 'button');
      t.tabIndex = 0;
      if (!t.title) t.title = 'Zoom to this group';
    }
    const zoomToGroup = (title) => {
      const g = title.closest('.lab-group');
      if (g) go(fitRect(worldRect(g)));
    };
    world.addEventListener('click', (e) => {
      const t = e.target.closest('.lab-group-title');
      if (t && started) zoomToGroup(t);
    });
    world.addEventListener('keydown', (e) => {
      const t = e.target.closest?.('.lab-group-title');
      if (t && started && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        zoomToGroup(t);
      }
    });

    // Tab onto something off-screen: bring it into view. The browser may also scroll the
    // (overflow: hidden) canvas itself to reveal it — that scroll is turned into a pan.
    world.addEventListener('focusin', (e) => {
      const t = e.target;
      if (!started || !(t instanceof Element) || t.tagName === 'IFRAME' || !t.matches(':focus-visible')) return;
      const r = t.getBoundingClientRect();
      const c = canvasRect();
      if (r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom) return;
      const b = base();
      go({ k: b.k, x: b.x + c.left + c.width / 2 - (r.left + r.width / 2), y: b.y + c.top + c.height / 2 - (r.top + r.height / 2) });
    });
    canvas.addEventListener('scroll', () => {
      const dx = canvas.scrollLeft;
      const dy = canvas.scrollTop;
      if (!started || (!dx && !dy)) return;
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
      touched = true;
      set({ k: view.k, x: view.x - dx, y: view.y - dy });
    });

    /* ---- sizing + start ------------------------------------------------- */

    // Coming back rather than opening: a reload (incl. the dev server's after an edit), Back /
    // Forward, or arriving from another page in this section (a screen's "‹ Gallery").
    const returning = () => {
      const nav = Lab.navType();
      if (nav === 'reload' || nav === 'back_forward') return true;
      if (!document.referrer) return false; // typed URL, file://: an opening
      const from = new URL(document.referrer);
      return from.origin === location.origin && from.pathname !== location.pathname && Lab.dir(from.href) === Lab.dir(location.href);
    };

    const start = () => {
      measure();
      canvas.scrollLeft = 0; // the no-JS fallback may have been scrolled
      canvas.scrollTop = 0;
      const saved = returning() ? restore() : null; // opening a section always fits
      restored = !!saved;
      view = clampView(saved || fitAll());
      started = true;
      render();
      canvas.dataset.ready = '';
    };
    // viewport resize keeps the world point at the center where it was. Border box: start() drops the no-JS
    // fallback's scrollbars, which grows the content box — not a resize, and not a second notification that frame
    new ResizeObserver(() => {
      rect = null;
      const { width: w, height: h } = canvasRect();
      if (w < 1 || h < 1) return; // hidden / collapsed: wait for a real size
      if (!started) {
        vp = { w, h };
        return start();
      }
      const c = { x: (vp.w / 2 - view.x) / view.k, y: (vp.h / 2 - view.y) / view.k };
      vp = { w, h };
      set({ k: view.k, x: w / 2 - c.x * view.k, y: h / 2 - c.y * view.k });
    }).observe(canvas, { box: 'border-box' });
    // content resize (web fonts, an edit): re-fit only if nobody has chosen a view yet
    new ResizeObserver(() => {
      measure();
      if (started) set(touched || restored ? view : fitAll());
    }).observe(world);
    addEventListener('resize', () => {
      rect = null;
    });
  }
})();
