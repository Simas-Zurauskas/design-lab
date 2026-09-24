/* ============================================================
   LAB CHROME — core: window.Lab, the helpers every lab script
   shares, so each one exists exactly once. Loaded first on every
   page — shell/sidebar.html (section pages) and screen/chrome.html
   (screens) include it before any other lab script.
   Classic script (not a module) so it also runs from file://; its
   top-level `var Lab` is window.Lab — the one global the lab adds,
   typed from this file (yarn typecheck).
   ============================================================ */

/* exported Lab */
var Lab = (() => {
  // storage that never throws (private windows / blocked storage just forget — even reaching it can throw)
  /** @param {() => Storage} area */
  const storage = (area) => ({
    /** @param {string} key */
    get(key) {
      try {
        return area().getItem(key);
      } catch {
        return null;
      }
    },
    /** @param {string} key @param {string} value */
    set(key, value) {
      try {
        area().setItem(key, value);
      } catch {
        // blocked storage: the choice is simply not remembered
      }
    },
  });
  /** @typedef {ReturnType<typeof storage>} LabStorage */
  const local = storage(() => localStorage);
  const session = storage(() => sessionStorage);
  const page = () => document.scrollingElement || document.documentElement;
  const url = (u) => {
    try {
      return new URL(u, location.href);
    } catch {
      return null;
    }
  };

  // Shown BY THE LAB — a screen inside a canvas or the full-screen viewer — which is not the same as framed: a lab
  // page embedded somewhere else (a Notion embed) is framed but is its own host. Same-origin parent: ask the frame
  // element. Cross-origin parent: over http(s) it is someone else's page (the lab and its screens always share an
  // origin); on file:// every file is its own origin and only the lab frames a screen.
  const hostedByLab = () => {
    if (window.self === window.top) return false;
    let frame = null;
    try {
      frame = window.frameElement;
    } catch {
      // older browsers throw for a cross-origin parent instead of returning null — same answer
    }
    return frame ? !!frame.closest('[data-canvas], .lab-viewer') : location.protocol === 'file:';
  };

  // Every message between frames is { lab: TYPE, …fields }. The types are listed once, here: posting or listening
  // for a type that isn't on the list throws, so a typo fails loudly instead of being ignored by the other side.
  const MESSAGES = /** @type {const} */ ([
    'canvas:hello', // screen → canvas: here I am (the handshake — the only way to know on file://)
    'canvas:host', // canvas → screen: you are on a canvas
    'canvas:wheel', // screen → canvas: scroll / zoom over a screen moves the canvas
    'canvas:gesture', // screen → canvas: Safari pinch
    'canvas:pan', // screen → canvas: a middle-drag that started on a screen
    'canvas:key', // screen → canvas: a canvas shortcut pressed while focus is inside
    'canvas:links', // screen → canvas: where the screen's links are (flow lines)
    'canvas:hover', // screen → canvas: which link is pointed at
    'hotspots:ask', // screen → host: what's the hotspot mode?
    'hotspots:mode', // host → screen: the hotspot mode (on load and on every change)
    'screen:changed', // screen → host: a control changed state — light the screen's ↺ reset
  ]);
  /** @typedef {typeof MESSAGES[number]} LabMessage */
  /** @param {string} type */
  const known = (type) => {
    // the typecheck catches a typo at a typed call site; this catches it at runtime everywhere else
    if (!(/** @type {readonly string[]} */ (MESSAGES).includes(type))) throw new Error(`Lab: unknown message type "${type}"`);
    return type;
  };

  const Lab = {
    local, // lasts: UI preferences (the lab theme)
    session, // this tab: canvas views, per-page toggles

    hosted: hostedByLab(),

    /** URL (relative to this page) → its pathname, and the folder it's in */
    path: (u) => url(u)?.pathname ?? null,
    dir: (u) => url(u)?.pathname.replace(/[^/]*$/, '') ?? null,
    /** the element that scrolls the page */
    page,
    /** how this page was reached: 'navigate' | 'reload' | 'back_forward' (undefined if the browser can't say) */
    navType: () => /** @type {PerformanceNavigationTiming | undefined} */ (performance.getEntriesByType?.('navigation')[0])?.type, // 'navigation' entries are this type

    /**
     * send a lab message to another window (a frame, the parent)
     * @param {Window | null | undefined} target
     * @param {LabMessage} type
     * @param {object} [fields]
     */
    post(target, type, fields = {}) {
      target?.postMessage({ ...fields, lab: known(type) }, '*');
    },
    /**
     * handle one lab message type — handler(data, event). Check event.source: messages can come from anywhere
     * @param {LabMessage} type
     * @param {(data: any, event: MessageEvent) => void} handler
     */
    on(type, handler) {
      known(type);
      addEventListener('message', (e) => {
        if (e.data?.lab === type) handler(e.data, e);
      });
    },
    /** the most links a screen reports for flow lines — sender and receiver both cap at this */
    MAX_LINKS: 300,

    /** typing somewhere — keys belong to the field, not to the lab */
    editable: (t) => t instanceof Element && !!t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'),
    /** a control reached with the keyboard keeps Space / Enter for itself */
    keyboardFocused: () => {
      const a = document.activeElement;
      return !!a && a.matches('button, a[href], [role="button"], summary') && a.matches(':focus-visible');
    },
    isSpace: (e) => e.code === 'Space' || e.key === ' ',
    /**
     * The canvas's keyboard shortcuts — the one list, read by the canvas (canvas.js) and by screens, which pass these
     * keys up instead of keeping them (screen/bridge.js). Returns the action (the toolbar's data-canvas-action names)
     * or null. Space, the hand tool, is separate (isSpace).
     * @param {Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>} e
     * @returns {'in' | 'out' | 'fit' | 'actual' | 'help' | null}
     */
    canvasKey(e) {
      if (e.altKey) return null;
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return 'in'; // ⌘/Ctrl too: beats browser zoom
      if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') return 'out';
      if (e.ctrlKey || e.metaKey) return null;
      if (e.shiftKey && e.code === 'Digit1') return 'fit';
      if (e.shiftKey && e.code === 'Digit0') return 'actual';
      if (e.key === '?') return 'help';
      return null;
    },
    /** A drag must not also click (or middle-click: open in new tab) whatever it ends on. Armed for this task only:
        a drag released outside the window sends no click, and the user's next real click must go through. */
    swallowNext(...types) {
      const swallow = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      for (const type of types) {
        addEventListener(type, swallow, { capture: true, once: true });
        setTimeout(() => removeEventListener(type, swallow, { capture: true }), 0);
      }
    },

    /** which axes an element scrolls on its own (the page root scrolls with overflow: visible) */
    scrollAxes(el) {
      const isPage = el === Lab.page();
      const style = isPage ? null : getComputedStyle(el);
      const scrollable = (v) => v === 'auto' || v === 'scroll';
      return {
        x: (isPage || scrollable(style.overflowX)) && el.scrollWidth > el.clientWidth,
        y: (isPage || scrollable(style.overflowY)) && el.scrollHeight > el.clientHeight,
      };
    },
    /** nearest scrollable ancestor PER AXIS, falling back to the page — a horizontal rail inside a
        scrolling page gives { x: rail, y: page } */
    scrollersAt(start) {
      let x = null;
      let y = null;
      for (let el = start; el instanceof Element && !(x && y); el = el.parentElement) {
        const can = Lab.scrollAxes(el);
        if (!x && can.x) x = el;
        if (!y && can.y) y = el;
      }
      const root = Lab.page();
      const can = Lab.scrollAxes(root);
      return { x: x || (can.x ? root : null), y: y || (can.y ? root : null) };
    },

    /**
     * A remembered segmented setting — Hotspots, Flows, the lab theme. Markup (optional — a setting can
     * live without a visible switch):
     *   <div data-lab-toggle="NAME"> … <button data-mode="off">…</button> <button data-mode="on">…</button> </div>
     * Lab.toggle(NAME, { modes, fallback, store: Lab.session | Lab.local, key, onChange })
     * reads the stored choice (else fallback), marks the pressed button, stores + reports every change.
     * Returns { get(), set(mode) }.
     * @param {string} name
     * @param {{ modes?: string[], fallback?: string, store?: LabStorage, key?: string, onChange?: (mode: string) => void }} [options]
     */
    toggle(name, { modes, fallback, store = session, key = `lab:${name}:${location.pathname}`, onChange = () => {} } = {}) {
      const el = document.querySelector(`[data-lab-toggle="${name}"]`);
      const all = modes || (el ? [...el.querySelectorAll('[data-mode]')].map((b) => b.getAttribute('data-mode')) : []);
      const saved = store.get(key);
      let mode = all.includes(saved) ? saved : fallback;
      const render = () => el?.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)));
      const set = (m, remember = true) => {
        if (!all.includes(m)) return;
        mode = m;
        if (remember) store.set(key, m);
        render();
        onChange(m);
      };
      el?.addEventListener('click', (e) => {
        const b = e.target instanceof Element && e.target.closest('[data-mode]');
        if (b) set(b.getAttribute('data-mode'));
      });
      render();
      onChange(mode);
      return { get: () => mode, set };
    },

    /** light / dark for the lab UI — set by shell/theme.js on pages that theme it */
    theme: undefined,
    /** the canvas's view maths — set by canvas/view-math.js on section pages */
    viewMath: undefined,
  };

  // In JS, TypeScript leaves an object literal open-ended — any member name reads fine. This mapped copy of its
  // type closes it, so a misspelled Lab.member is a typecheck error. (No runtime effect.)
  /** @template T @param {T} object @returns {{ [K in keyof T]: T[K] }} */
  const closed = (object) => object;
  return closed(Lab);
})();
