/* ============================================================
   LAB CHROME — workbench infrastructure, NOT design content.
   Drag-to-scroll: on a desktop browser a phone screen has no
   touch, so any scrollable area (horizontal rails, vertical
   lists, the screen itself) can be grabbed and dragged with the
   mouse — the way it would behave under a finger. Works on top
   of normal wheel/trackpad scrolling, never replaces it.
   ============================================================ */

const DRAG_THRESHOLD = 4; // px before a press counts as a drag (not a click)

const page = () => document.scrollingElement || document.documentElement;

// which axes THIS element can scroll. The page root is special-cased: it
// scrolls with `overflow: visible`, so the style test would reject it.
const axes = (el) => {
  const isPage = el === page();
  const style = isPage ? null : getComputedStyle(el);
  const scrollable = (v) => v === 'auto' || v === 'scroll';
  return {
    x: (isPage || scrollable(style.overflowX)) && el.scrollWidth > el.clientWidth,
    y: (isPage || scrollable(style.overflowY)) && el.scrollHeight > el.clientHeight,
  };
};

// Nearest scrollable ancestor PER AXIS, so a horizontal rail still lets the
// page scroll vertically under the same drag — as a finger would.
const findScrollers = (start) => {
  let x = null;
  let y = null;
  for (let el = start; el instanceof Element; el = el.parentElement) {
    const can = axes(el);
    if (!x && can.x) x = el;
    if (!y && can.y) y = el;
    if (x && y) return { x, y };
  }
  const root = page();
  const can = axes(root);
  return { x: x || (can.x ? root : null), y: y || (can.y ? root : null) };
};

const IGNORE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

document.addEventListener('pointerdown', (e) => {
  // touch scrolls natively; leave secondary buttons and form controls alone
  if (e.pointerType === 'touch' || e.button !== 0) return;
  if (e.target.closest(IGNORE)) return;

  const { x: scrollerX, y: scrollerY } = findScrollers(e.target);
  if (!scrollerX && !scrollerY) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const fromLeft = scrollerX ? scrollerX.scrollLeft : 0;
  const fromTop = scrollerY ? scrollerY.scrollTop : 0;
  let dragging = false;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!dragging) {
      dragging = true;
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
    if (scrollerX) scrollerX.scrollLeft = fromLeft - dx;
    if (scrollerY) scrollerY.scrollTop = fromTop - dy;
    ev.preventDefault(); // stop text/image selection mid-drag
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (dragging) {
      // a drag must not also fire the link/button click underneath it. The
      // timeout disarms it if no click follows (drag released outside the
      // window) — otherwise it would swallow the user's next real click.
      const swallow = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 0);
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp, { once: true });
  document.addEventListener('pointercancel', onUp, { once: true });
});
