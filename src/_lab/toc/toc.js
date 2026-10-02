/* ============================================================
   LAB CHROME — toc: the canvas's groups, listed in its top-left
   corner — a table of contents built from the group titles on the
   page, in their order, with how many screens (or boards) each
   holds. Clicking a name zooms to that group exactly as clicking
   its title on the canvas does (canvas/canvas.js). Header switch
   (toc/toggle.html): Off / On — starts On; remembered per page for
   the tab. While it's shown, fitting keeps clear of it (canvas.js).
   Loaded by canvas/canvas.html.
   Classic script (not a module) so it also runs from file://.
   ============================================================ */

(() => {
  const canvas = document.querySelector('[data-canvas]');
  const world = canvas?.querySelector('[data-canvas-world]');
  if (!(canvas instanceof HTMLElement) || !(world instanceof HTMLElement)) return;
  const titles = [...world.querySelectorAll('.lab-group-title')].filter((t) => t instanceof HTMLElement);
  if (!titles.length) return; // nothing to list — the header switch hides itself too (toc.css)

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  };
  const nav = el('nav', 'lab-canvas-toc');
  nav.dataset.canvasToc = '';
  nav.setAttribute('aria-label', 'Groups');
  const list = el('ol');
  for (const title of titles) {
    const group = title.closest('.lab-group');
    const name = title.textContent.trim();
    const count = group ? group.querySelectorAll('.lab-screen').length || group.querySelectorAll('.lab-board').length : 0;
    const button = el('button');
    button.type = 'button';
    button.title = `Zoom to ${name}`;
    button.append(el('span', '', name));
    if (count) button.append(el('span', 'lab-canvas-toc-count', String(count)));
    button.addEventListener('click', () => title.click()); // the canvas's own zoom to the group (canvas.js)
    const item = el('li');
    item.append(button);
    list.append(item);
  }
  nav.append(el('p', 'lab-canvas-toc-head', 'Groups'), list);
  world.before(nav);
  // mouse clicks don't park focus on the list, so Space stays the hand tool
  nav.addEventListener('pointerdown', (e) => e.target instanceof Element && e.target.closest('button') && e.preventDefault());

  Lab.toggle('toc', {
    modes: ['off', 'on'],
    fallback: 'on',
    onChange: (m) => {
      nav.hidden = m !== 'on';
    },
  });
})();
