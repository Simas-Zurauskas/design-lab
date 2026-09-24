/* ============================================================
   LAB CHROME — screen: drag-to-scroll. On a desktop browser a phone screen has no
   touch, so any scrollable area (horizontal rails, vertical
   lists, the screen itself) can be grabbed and dragged with the
   mouse — the way it would behave under a finger. Works on top
   of normal wheel/trackpad scrolling, never replaces it.
   Classic script (not a module) so it also runs from file://.
   ============================================================ */

(() => {
  const DRAG_THRESHOLD = 4; // px before a press counts as a drag (not a click)

  document.addEventListener('pointerdown', (e) => {
    // touch scrolls natively; leave secondary buttons and form controls alone
    if (e.pointerType === 'touch' || e.button !== 0) return;
    if (Lab.editable(e.target)) return;

    // nearest scroller per axis, so a horizontal rail still lets the page scroll vertically under
    // the same drag — as a finger would
    const { x: scrollerX, y: scrollerY } = Lab.scrollersAt(e.target);
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

    // up or cancel, whichever comes first, ends the press — and takes all three listeners with it
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (dragging) Lab.swallowNext('click'); // the drag must not also click the link / button underneath
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
})();
