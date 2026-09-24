/* ============================================================
   LAB CHROME — hotspots, screen side: inside every screen (via
   screen/chrome.html). Sets <html data-lab-hotspots="off|hover|always">
   from whatever shows the screen (hotspots/host.js) — asked for on
   load, pushed on every change. Outline styles: hotspots.css.
   ============================================================ */

(() => {
  const MODES = ['off', 'hover', 'always'];
  const set = (mode) => {
    if (MODES.includes(mode)) document.documentElement.dataset.labHotspots = mode;
  };
  if (!document.documentElement.dataset.labHotspots) set('hover'); // a full-screen page's own switch may have set it already
  Lab.on('hotspots:mode', (d, e) => e.source === window.parent && set(d.mode));
  if (Lab.hosted) Lab.post(window.parent, 'hotspots:ask');
})();
