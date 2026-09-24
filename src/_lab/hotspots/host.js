/* ============================================================
   LAB CHROME — hotspots, host side: runs on the page that SHOWS
   screens (a gallery canvas, or a screen opened full screen) and
   hands its Hotspots switch's mode to them — pushed on every
   change, answered when a screen asks on load (so frame timing
   never matters). Starts on Hover; remembered per page for the tab
   — a section's full-screen views share one setting.
   Loaded by hotspots/toggle.html.
   ============================================================ */

(() => {
  if (Lab.hosted) return; // inside a canvas frame the gallery is the host
  const fullScreen = !!document.querySelector('[data-lab-bar]'); // a screen opened on its own
  const key = fullScreen ? `lab:hotspots:${Lab.dir(location.href)}(full screen)` : `lab:hotspots:${location.pathname}`;
  const frames = () => [...document.querySelectorAll('iframe')];

  let mode = 'hover';
  const push = () => {
    for (const f of frames()) Lab.post(f.contentWindow, 'hotspots:mode', { mode });
    if (fullScreen) document.documentElement.dataset.labHotspots = mode; // the raw page (?bare, phones) is the screen
  };
  Lab.toggle('hotspots', {
    key,
    fallback: 'hover',
    onChange: (m) => {
      mode = m;
      push();
    },
  });
  // only our own screens are answered
  Lab.on('hotspots:ask', (d, e) => {
    const frame = frames().find((f) => f.contentWindow === e.source);
    if (frame) Lab.post(frame.contentWindow, 'hotspots:mode', { mode });
  });
})();
