/* ============================================================
   LAB CHROME — screen: the full-screen viewer + its bar. A screen
   opened on its own (its name clicked on a canvas, a typed URL) is
   presented as a device: centered on the lab background, true size
   (scaled down only to fit the window), named above. The screen
   runs inside at exactly the device size (core/tokens.css) — the
   viewport it has on the canvas — so it never meets the window edges. Clicking through
   keeps the address bar and title on the current screen (a reload
   or a shared link lands there). ↺ Reset works like the gallery's:
   lit only once you've left the screen you opened — or changed it
   (interact.js) — and it resets that screen in place.
   No device on a phone-sized window (there the screen IS the
   device) or with ?bare in the URL (the raw page, for debugging) —
   the bar still works there, navigating the page itself.
   ============================================================ */

(() => {
  if (Lab.hosted) return; // on a canvas: no bar, no viewer

  const bar = document.querySelector('[data-lab-bar]');
  const reset = bar?.querySelector('[data-lab-reset]');
  if (bar instanceof HTMLElement) bar.hidden = false;

  const KEY = 'lab:entry';
  const samePage = (a, b) => Lab.path(a) === Lab.path(b);

  // Entry = the screen this viewing started on. A fresh open (from a gallery, a typed URL) arms it;
  // a reload, Back/Forward, or clicking from one screen to the next (raw page) keeps it.
  const nav = Lab.navType();
  const from = document.referrer && new URL(document.referrer);
  const fromScreen = !!from && from.origin === location.origin && Lab.dir(from.href) === Lab.dir(location.href) && !/(^|\/)(index\.html)?$/.test(from.pathname);
  let entry = Lab.session.get(KEY);
  if (!entry || Lab.dir(entry) !== Lab.dir(location.href) || (nav === 'navigate' && !fromScreen)) {
    entry = location.href;
    Lab.session.set(KEY, entry);
  }
  const light = (away) => reset?.classList.toggle('lab-btn-alert', away);

  const viewing = !new URLSearchParams(location.search).has('bare') && matchMedia('(min-width: 600px) and (min-height: 480px)').matches;
  if (!viewing) {
    // raw page: the address bar is the screen
    light(!samePage(location.href, entry));
    reset?.addEventListener('click', () => reset.classList.contains('lab-btn-alert') && (location.href = entry));
    return;
  }

  // the device with its bezel — sizes from core/tokens.css (0 if unreadable: then it simply never scales down)
  const css = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(css.getPropertyValue(name)) || 0;
  const DEVICE_W = px('--lab-device-w') + 2 * px('--lab-bezel-w');
  const DEVICE_H = px('--lab-device-h') + 2 * px('--lab-bezel-w');
  const ROOM_X = 64; // px of window kept free across
  const ROOM_Y = 136; // px kept free down: lab bar, name, breathing room

  const viewer = document.createElement('div');
  viewer.className = 'lab-viewer';
  viewer.innerHTML =
    '<div class="lab-viewer-stage"><p class="lab-viewer-title"></p>' +
    '<div class="lab-viewer-device"><div class="lab-viewer-bezel"><iframe></iframe></div></div></div>';
  // the screen renders inside the device instead — drop this page's own copy (the lab bar and the
  // scripts stay; nothing after this point has been parsed yet)
  for (const el of [...document.body.children]) if (!el.matches('[data-lab-bar], script, style')) el.remove();
  document.body.prepend(viewer);
  document.documentElement.classList.add('lab-viewing');

  const title = viewer.querySelector('.lab-viewer-title');
  const frame = viewer.querySelector('iframe');
  title.textContent = frame.title = document.title;
  frame.src = location.href;

  let loaded = false;
  let resetting = false;
  frame.addEventListener('load', () => {
    let away;
    try {
      const url = frame.contentWindow.location.href;
      document.title = title.textContent = frame.title = frame.contentDocument.title;
      if (url !== location.href) history.replaceState(history.state, '', url);
      away = !samePage(url, entry);
    } catch {
      away = loaded && !resetting; // file://: frames are opaque — any later load means you moved on
    }
    loaded = true;
    resetting = false;
    light(away);
  });
  reset?.addEventListener('click', () => {
    if (!reset.classList.contains('lab-btn-alert')) return;
    resetting = true;
    frame.src = entry;
  });
  // a chip / switch / choice changed inside (interact.js): the screen is away from how it opened
  Lab.on('screen:changed', (d, e) => e.source === frame.contentWindow && light(true));

  const fit = () => {
    const s = Math.min(1, (innerWidth - ROOM_X) / DEVICE_W, (innerHeight - ROOM_Y) / DEVICE_H);
    viewer.style.setProperty('--s', String(Math.max(0.3, s)));
  };
  fit();
  addEventListener('resize', fit);
})();
