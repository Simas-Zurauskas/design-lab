/* ============================================================
   LAB CHROME — canvas: the gallery's ↺ reset buttons — one per
   screen (in its name label) and ↺ Reset all (in the header).
   A reset lights up (.lab-btn-alert) while its screen is away from
   how it opened: navigated inside its frame, or changed in place
   ('screen:changed' from screen/interact.js). Resetting reloads the
   frame's original page — reassigning src does that even when the
   value is the same. Loaded by canvas/canvas.html.
   ============================================================ */

(() => {
  const resetAll = document.querySelector('[data-reset-all]');
  const figures = [...document.querySelectorAll('.lab-screen')].filter((f) => f.querySelector('iframe') && f.querySelector('[data-reset]'));
  const refreshAll = () =>
    resetAll?.classList.toggle(
      'lab-btn-alert',
      figures.some((f) => f.querySelector('[data-reset]').classList.contains('lab-btn-alert')),
    );
  const reset = (figure) => {
    const frame = figure.querySelector('iframe');
    frame.dataset.resetting = '1';
    frame.src = frame.getAttribute('src');
  };

  for (const figure of figures) {
    const frame = figure.querySelector('iframe');
    const button = figure.querySelector('[data-reset]');
    const original = Lab.path(frame.getAttribute('src'));
    let loadedOnce = false;
    frame.addEventListener('load', () => {
      let away;
      if (frame.dataset.resetting) {
        delete frame.dataset.resetting;
        away = false;
      } else {
        try {
          away = frame.contentWindow.location.pathname !== original;
        } catch {
          away = loadedOnce; // file://: frames are opaque — any later load means it moved on
        }
      }
      loadedOnce = true;
      button.classList.toggle('lab-btn-alert', away);
      refreshAll();
    });
    button.addEventListener('click', () => reset(figure));
  }

  // a screen changed its own state in place — away from how it opened, too
  Lab.on('screen:changed', (d, e) => {
    const figure = figures.find((f) => f.querySelector('iframe').contentWindow === e.source);
    if (!figure) return;
    figure.querySelector('[data-reset]').classList.add('lab-btn-alert');
    refreshAll();
  });

  resetAll?.addEventListener('click', () => figures.forEach(reset));
})();
