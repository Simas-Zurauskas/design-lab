/* ============================================================
   LAB CHROME — sheet: the host side of the screens framed on a
   sheet page. The same bargain as the canvas: scroll over a screen
   moves the page (no scroll traps), dragging scrolls inside it
   (screen/drag-scroll.js), ⌥/Alt + scroll scrolls it natively, a
   middle-drag scrolls the page. Answers a screen's canvas:hello
   with canvas:host so its bridge (screen/bridge.js) passes those
   gestures up; pinch / ⌘-Ctrl + scroll, shortcuts and link reports
   have nothing to act on here and are dropped.
   Loaded by sheet/sheet.html.
   ============================================================ */

(() => {
  const sheet = document.querySelector('[data-lab-sheet]');
  if (!(sheet instanceof HTMLElement)) return;
  const frames = () => [...sheet.querySelectorAll('iframe')];

  /** @param {'canvas:hello' | 'canvas:wheel' | 'canvas:pan'} type @param {(data: any, frame: HTMLIFrameElement) => void} handle */
  const fromScreen = (type, handle) =>
    Lab.on(type, (d, e) => {
      const frame = frames().find((f) => f.contentWindow === e.source); // only our own screens
      if (frame) handle(d, frame);
    });

  fromScreen('canvas:hello', (d, frame) => Lab.post(frame.contentWindow, 'canvas:host'));

  const LINE = 16; // px per line for a wheel that counts in lines (deltaMode 1)
  fromScreen('canvas:wheel', (d) => {
    if (d.ctrlKey || d.metaKey) return; // a zoom gesture: the sheet doesn't zoom
    const unit = Number(d.deltaMode) === 1 ? LINE : Number(d.deltaMode) === 2 ? sheet.clientHeight : 1;
    const dx = (+d.deltaX || 0) * unit;
    const dy = (+d.deltaY || 0) * unit;
    sheet.scrollBy({ left: d.shiftKey && !dx ? dy : dx, top: d.shiftKey && !dx ? 0 : dy, behavior: 'instant' });
  });

  // middle-drag: streamed in screen coordinates, so the page follows the mouse wherever it goes
  let last = null;
  fromScreen('canvas:pan', (d) => {
    if (d.phase === 'start') last = { x: Number(d.sx), y: Number(d.sy) };
    else if (d.phase === 'move' && last) {
      sheet.scrollBy({ left: last.x - Number(d.sx), top: last.y - Number(d.sy), behavior: 'instant' });
      last = { x: Number(d.sx), y: Number(d.sy) };
    } else last = null;
  });
})();
